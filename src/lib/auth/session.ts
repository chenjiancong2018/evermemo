import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import type { UserRow } from '@/lib/types';

export const SESSION_COOKIE = 'evermemo_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface SessionUser extends UserRow {}

/** 创建会话，返回原始 token（仅此一次可见） */
export function createSession(userId: string): string {
  const token = randomBytes(32).toString('base64url');
  const db = getDb();
  const now = new Date();
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    randomBytes(16).toString('hex'),
    userId,
    sha256Hex(token),
    now.toISOString(),
    new Date(now.getTime() + SESSION_TTL_MS).toISOString()
  );
  return token;
}

export function destroySession(token: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256Hex(token));
}

/** 从请求 Cookie 中解析当前登录用户；未登录返回 null */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`
    )
    .get(sha256Hex(token), new Date().toISOString()) as UserRow | undefined;
  if (!row) return null;
  return row;
}

export function clearSessionCookie(): void {
  // 由调用方在 Server Action / Route Handler 中执行：
  // (await cookies()).set(SESSION_COOKIE, '', { maxAge: 0, path: '/' })
  void 0;
}
