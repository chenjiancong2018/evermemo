import type { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { verifyPassword } from '@/lib/auth/password';
import { clearVaultKey, getVaultKey, isVaultUnlocked, setVaultKey, unlockVault } from '@/lib/crypto/vault';

/** 保险库状态：是否已解锁、是否已建立（旧账号在下次登录时自动建立）、是否已设置恢复码 */
export const GET = apiHandler(async () => {
  const user = await requireUser();
  const db = getDb();
  const row = db
    .prepare('SELECT vault_salt, vault_key, recovery_salt, recovery_key FROM users WHERE id = ?')
    .get(user.id) as
    | { vault_salt: string | null; vault_key: string | null; recovery_salt: string | null; recovery_key: string | null }
    | undefined;
  return ok({
    unlocked: isVaultUnlocked(user.id),
    has_vault: !!(row?.vault_salt && row?.vault_key),
    has_recovery: !!(row?.recovery_salt && row?.recovery_key),
  });
});

/** 用登录口令解锁保险库（解锁后 12 小时内胶囊正文可读） */
export const POST = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) return fail(400, 'VALIDATION', '请输入登录密码');

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return fail(400, 'WRONG_PASSWORD', '密码不正确');

  const db = getDb();
  const row = db.prepare('SELECT vault_salt, vault_key FROM users WHERE id = ?').get(user.id) as
    | { vault_salt: string | null; vault_key: string | null }
    | undefined;
  if (!row?.vault_salt || !row?.vault_key) {
    return fail(409, 'NO_VAULT', '保险库尚未建立，请重新登录以完成初始化');
  }
  const dataKey = unlockVault(password, row.vault_salt, row.vault_key);
  if (!dataKey) return fail(500, 'VAULT_CORRUPT', '保险库数据异常，暂时无法解锁');
  setVaultKey(user.id, dataKey);
  return ok({ unlocked: true });
});

/** 立即锁定（清除内存中的解锁状态） */
export const DELETE = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  clearVaultKey(user.id);
  return ok({ unlocked: isVaultUnlocked(user.id) });
});