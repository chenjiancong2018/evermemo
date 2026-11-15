import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { createSession, SESSION_COOKIE } from '@/lib/auth/session';
import { setVaultKey, unlockWithRecovery, wrapDataKey } from '@/lib/crypto/vault';
import { apiHandler, fail, ok, assertSameOrigin } from '@/lib/api/http';
import { takeToken, resetTokens } from '@/lib/api/rateLimit';
import { recoverAccountSchema } from '@/lib/api/schemas';
import type { UserRow } from '@/lib/types';

/**
 * 用恢复码找回账号：邮箱 + 恢复码 + 新口令 → 重设口令并重新包裹保险库。
 *
 * - 恢复码只在生成时显示一次；使用成功后立即吊销（一次性），防止泄露后被反复利用。
 * - 数据密钥保持不变，因此已有胶囊正文在新口令下继续可读。
 * - 成功后自动登录（发新会话），并作废旧会话。
 */
export const POST = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);

  const body = await req.json().catch(() => ({}));
  const parsed = recoverAccountSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const { email, recovery_code, new_password } = parsed.data;

  // 限流：同一邮箱 15 分钟内最多 5 次尝试（恢复码本身有 160 bit 熵，限流只是防护纵深）
  const gateKey = `recover:${email.toLowerCase()}`;
  const gate = takeToken(gateKey, 5, 15 * 60 * 1000);
  if (!gate.allowed) {
    const minutes = Math.max(1, Math.ceil(gate.retryAfterMs / 60000));
    return fail(429, 'TOO_MANY_ATTEMPTS', `尝试次数过多，请 ${minutes} 分钟后再试`);
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  // 统一错误文案：不暴露「邮箱是否存在」「是否设置过恢复码」
  const invalid = () => fail(400, 'INVALID_RECOVERY', '邮箱或恢复码不正确');
  if (!user) return invalid();
  if (!user.recovery_salt || !user.recovery_key) return invalid();

  const dataKey = unlockWithRecovery(recovery_code, user.recovery_salt, user.recovery_key);
  if (!dataKey) return invalid();

  const passwordHash = await hashPassword(new_password);
  const vault = wrapDataKey(new_password, dataKey);
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      'UPDATE users SET password_hash = ?, vault_salt = ?, vault_key = ?, updated_at = ? WHERE id = ?'
    ).run(passwordHash, vault.salt, vault.wrapped, now, user.id);
    // 恢复码一次性使用：成功后吊销
    db.prepare('UPDATE users SET recovery_salt = NULL, recovery_key = NULL WHERE id = ?').run(user.id);
    // 作废旧会话
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  });
  tx();

  resetTokens(gateKey);
  setVaultKey(user.id, dataKey);

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
