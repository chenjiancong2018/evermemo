import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import type { TagRow } from '@/lib/types';

export interface TagWithCount extends TagRow {
  entry_count: number;
}

/** 全部标签（含使用次数） */
export function listTags(userId: string): TagWithCount[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT t.*, COUNT(et.entry_id) AS entry_count
       FROM tags t
       LEFT JOIN entry_tags et ON et.tag_id = t.id
       LEFT JOIN entries e ON e.id = et.entry_id AND e.deleted_at IS NULL
       WHERE t.user_id = ?
       GROUP BY t.id
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(userId) as TagWithCount[];
}

export function createTag(userId: string, name: string, color: string | null): TagRow {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO tags (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, name) DO NOTHING`
  ).run(randomUUID(), userId, name.trim(), color, now);
  return db
    .prepare('SELECT * FROM tags WHERE user_id = ? AND name = ?')
    .get(userId, name.trim()) as TagRow;
}

export function deleteTag(userId: string, id: string): boolean {
  const db = getDb();
  const res = db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(id, userId);
  return res.changes > 0;
}
