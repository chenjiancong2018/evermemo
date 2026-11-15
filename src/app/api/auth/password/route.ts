import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession, destroySession, SESSION_COOKIE } from '@/lib/auth/session';
import { createVault, setVaultKey, unlockVault, wrapDataKey } from '@/lib/crypto/vault';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { changePasswordSchema } from '@/lib/api/schemas';

export const PUT = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await req.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const { old_password, new_password } = parsed.data;

  const valid = await verifyPassword(old_password, user.password_hash);
  if (!valid) return fail(400, 'WRONG_PASSWORD', '当前密码不正确');

  const db = getDb();
  const newHash = await hashPassword(new_password);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    newHash,
    new Date().toISOString(),
    user.id
  );

  // 保险库：用旧口令解开数据密钥，再用新口令重新包裹（胶囊密文本身不重加密）
  const row = db.prepare('SELECT vault_salt, vault_key FROM users WHERE id = ?').get(user.id) as
    | { vault_salt: string | null; vault_key: string | null }
    | undefined;
  const existingKey = row?.vault_salt && row?.vault_key ? unlockVault(old_password, row.vault_salt, row.vault_key) : null;
  if (existingKey) {
    const rewrapped = wrapDataKey(new_password, existingKey);
    db.prepare('UPDATE users SET vault_salt = ?, vault_key = ? WHERE id = ?').run(rewrapped.salt, rewrapped.wrapped, user.id);
    setVaultKey(user.id, existingKey);
  } else {
    // 旧账号（无保险库）或解包失败：现场创建，不阻断改密
    const vault = createVault(new_password);
    db.prepare('UPDATE users SET vault_salt = ?, vault_key = ? WHERE id = ?').run(vault.salt, vault.wrapped, user.id);
    setVaultKey(user.id, vault.dataKey);
  }

  // 其他会话全部失效，当前会话换新 token
  const store = await cookies();
  const currentToken = store.get(SESSION_COOKIE)?.value;
  if (currentToken) destroySession(currentToken);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  const token = createSession(user.id);
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  });

  return ok({ changed: true });
});
