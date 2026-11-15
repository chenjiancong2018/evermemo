import type { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { verifyPassword } from '@/lib/auth/password';
import { createRecovery, getVaultKey, unlockVault } from '@/lib/crypto/vault';
import { vaultPasswordSchema } from '@/lib/api/schemas';

interface VaultRow {
  vault_salt: string | null;
  vault_key: string | null;
  recovery_salt: string | null;
  recovery_key: string | null;
}

function readVaultRow(userId: string): VaultRow | undefined {
  return getDb()
    .prepare('SELECT vault_salt, vault_key, recovery_salt, recovery_key FROM users WHERE id = ?')
    .get(userId) as VaultRow | undefined;
}

/** 取得当前用户的数据密钥：优先内存缓存，其次用登录口令现场解包 */
function resolveDataKey(userId: string, password: string, row: VaultRow | undefined): Buffer | null {
  const cached = getVaultKey(userId);
  if (cached) return cached;
  if (!row?.vault_salt || !row?.vault_key) return null;
  return unlockVault(password, row.vault_salt, row.vault_key);
}

/** 生成（或重新生成）恢复码：需要提供登录口令，恢复码只返回一次 */
export const POST = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();

  const body = await req.json().catch(() => ({}));
  const parsed = vaultPasswordSchema.safeParse(body);
  if (!parsed.success) return fail(400, 'VALIDATION', '请输入登录密码');
  const { password } = parsed.data;

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return fail(400, 'WRONG_PASSWORD', '密码不正确');

  const row = readVaultRow(user.id);
  if (!row?.vault_salt || !row?.vault_key) {
    return fail(409, 'NO_VAULT', '保险库尚未建立，请重新登录以完成初始化');
  }
  const dataKey = resolveDataKey(user.id, password, row);
  if (!dataKey) return fail(500, 'VAULT_CORRUPT', '保险库数据异常，暂时无法生成恢复码');

  const recovery = createRecovery(dataKey);
  getDb()
    .prepare('UPDATE users SET recovery_salt = ?, recovery_key = ?, updated_at = ? WHERE id = ?')
    .run(recovery.salt, recovery.wrapped, new Date().toISOString(), user.id);

  // 明文恢复码只在这里返回一次，服务端不保存
  return ok({ recovery_code: recovery.code });
});

/** 撤销恢复码（同样需要登录口令） */
export const DELETE = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();

  const body = await req.json().catch(() => ({}));
  const parsed = vaultPasswordSchema.safeParse(body);
  if (!parsed.success) return fail(400, 'VALIDATION', '请输入登录密码');
  const valid = await verifyPassword(parsed.data.password, user.password_hash);
  if (!valid) return fail(400, 'WRONG_PASSWORD', '密码不正确');

  getDb()
    .prepare('UPDATE users SET recovery_salt = NULL, recovery_key = NULL, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), user.id);
  return ok({ has_recovery: false });
});
