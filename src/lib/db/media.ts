import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import type { MediaRow } from '@/lib/types';

export interface MediaCreateInput {
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  thumbnail_path: string | null;
  captured_at: string | null;
  entry_id?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface MediaListQuery {
  page: number;
  page_size: number;
  tag?: string;
  favorite?: boolean;
  entry_id?: string;
  q?: string;
  /** 按拍摄/创建年份（YYYY）过滤，纪念册用 */
  year?: string;
}

export function createMedia(userId: string, input: MediaCreateInput): MediaRow {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO media (id, user_id, entry_id, file_name, storage_path, mime_type, file_size,
      thumbnail_path, media_type, caption, is_favorite, captured_at, width, height, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'image', '', 0, ?, ?, ?, ?)`
  ).run(
    id, userId, input.entry_id ?? null, input.file_name, input.storage_path,
    input.mime_type, input.file_size, input.thumbnail_path, input.captured_at,
    input.width ?? null, input.height ?? null,
    new Date().toISOString()
  );
  return db.prepare('SELECT * FROM media WHERE id = ?').get(id) as MediaRow;
}

export function getMedia(userId: string, id: string): MediaRow | null {
  const db = getDb();
  return (
    (db.prepare('SELECT * FROM media WHERE id = ? AND user_id = ?').get(id, userId) as MediaRow | undefined) ??
    null
  );
}

export function patchMedia(
  userId: string,
  id: string,
  patch: { caption?: string; is_favorite?: boolean }
): MediaRow | null {
  const db = getDb();
  const existing = getMedia(userId, id);
  if (!existing) return null;
  const caption = patch.caption ?? existing.caption;
  const isFavorite = patch.is_favorite !== undefined ? (patch.is_favorite ? 1 : 0) : existing.is_favorite;
  db.prepare('UPDATE media SET caption = ?, is_favorite = ? WHERE id = ?').run(caption, isFavorite, id);
  return getMedia(userId, id);
}

export function listMedia(userId: string, q: MediaListQuery): {
  items: MediaRow[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
} {
  const db = getDb();
  const where: string[] = ['m.user_id = ?'];
  const params: unknown[] = [userId];
  if (q.favorite) where.push('m.is_favorite = 1');
  if (q.q) {
    where.push('m.caption LIKE ?');
    params.push(`%${q.q}%`);
  }
  if (q.entry_id) { where.push('m.entry_id = ?'); params.push(q.entry_id); }
  if (q.year) {
    where.push("substr(COALESCE(m.captured_at, m.created_at), 1, 4) = ?");
    params.push(q.year);
  }
  if (q.tag) {
    where.push(
      `EXISTS (SELECT 1 FROM entry_tags et JOIN tags t ON t.id = et.tag_id
       WHERE et.entry_id = m.entry_id AND t.user_id = m.user_id AND t.name = ?)`
    );
    params.push(q.tag);
  }
  const whereSql = where.join(' AND ');
  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM media m WHERE ${whereSql}`).get(...params) as { c: number }
  ).c;
  const offset = (q.page - 1) * q.page_size;
  const items = db
    .prepare(
      `SELECT m.* FROM media m WHERE ${whereSql}
       ORDER BY COALESCE(m.captured_at, m.created_at) DESC, m.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, q.page_size, offset) as MediaRow[];
  return { items, total, page: q.page, page_size: q.page_size, has_more: offset + items.length < total };
}

export function deleteMediaRow(userId: string, id: string): MediaRow | null {
  const db = getDb();
  const existing = getMedia(userId, id);
  if (!existing) return null;
  db.prepare('DELETE FROM media WHERE id = ? AND user_id = ?').run(id, userId);
  return existing;
}
