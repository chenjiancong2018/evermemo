import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, SESSION_COOKIE } from '@/lib/auth/session';
import { createVault, setVaultKey, unlockVault } from '@/lib/crypto/vault';
import { apiHandler, fail, ok, assertSameOrigin } from '@/lib/api/http';
import { loginSchema } from '@/lib/api/schemas';
import type { UserRow } from '@/lib/types';

export const POST = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const body = await req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const { email, password } = parsed.data;

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  if (!user) return fail(401, 'BAD_CREDENTIALS', '邮箱或密码不正确');

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return fail(401, 'BAD_CREDENTIALS', '邮箱或密码不正确');

  // 解锁保险库（旧账号无 vault：用本次口令现场创建，胶囊密钥随之迁移到口令派生）
  if (!user.vault_salt || !user.vault_key) {
    const vault = createVault(password);
    db.prepare('UPDATE users SET vault_salt = ?, vault_key = ?, updated_at = ? WHERE id = ?').run(
      vault.salt,
      vault.wrapped,
      new Date().toISOString(),
      user.id
    );
    setVaultKey(user.id, vault.dataKey);
  } else {
    const dataKey = unlockVault(password, user.vault_salt, user.vault_key);
    if (dataKey) setVaultKey(user.id, dataKey);
  }

  const token = createSession(user.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  });

  return ok({ id: user.id, email: user.email, display_name: user.display_name });
});
