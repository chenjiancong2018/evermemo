import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { createSession, SESSION_COOKIE } from '@/lib/auth/session';
import { createVault, setVaultKey } from '@/lib/crypto/vault';
import { apiHandler, fail, ok, HttpError, assertSameOrigin } from '@/lib/api/http';
import { registerSchema } from '@/lib/api/schemas';

export const POST = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const { email, password, display_name } = parsed.data;

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return fail(409, 'EMAIL_TAKEN', '该邮箱已注册');

  const id = randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  // 保险库：每用户随机数据密钥，用登录口令派生的 KEK 包裹（胶囊加密的真实锚点）
  const vault = createVault(password);
  db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, avatar_path, bio, timezone, locale, created_at, updated_at, vault_salt, vault_key)
     VALUES (?, ?, ?, ?, NULL, '', 'Asia/Shanghai', 'zh-CN', ?, ?, ?, ?)`
  ).run(id, email, passwordHash, display_name || email.split('@')[0], now, now, vault.salt, vault.wrapped);
  setVaultKey(id, vault.dataKey);

  const token = createSession(id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  });

  return ok({
    id,
    email,
    display_name: display_name || email.split('@')[0],
  });
});
