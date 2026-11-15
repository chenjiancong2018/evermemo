import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import type { ChapterRow, ChapterWithMeta, EntryWithMeta, MediaRow } from '@/lib/types';
import { entryWithMeta } from '@/lib/db/entries';

export interface ChapterInput {
  title: string;
  description?: string | null;
  content?: string | null;
  cover_media_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface ChapterListQuery {
  page: number;
  page_size: number;
  q?: string;
}

export function chapterWithMeta(chapterId: string, userId: string): ChapterWithMeta | null {
  const db = getDb();
  const chapter = db
    .prepare('SELECT * FROM chapters WHERE id = ? AND user_id = ?')
    .get(chapterId, userId) as ChapterRow | undefined;
  if (!chapter) return null;

  const cover = chapter.cover_path
    ? ((db.prepare('SELECT * FROM media WHERE id = ? AND user_id = ?').get(
        chapter.cover_path,
        userId
      ) as MediaRow | undefined) ?? null)
    : null;
  const rows = db
    .prepare(
      `SELECT ce.entry_id, ce.sort_order FROM chapter_entries ce
       JOIN entries e ON e.id = ce.entry_id
       WHERE ce.chapter_id = ? AND e.user_id = ? AND e.deleted_at IS NULL
       ORDER BY ce.sort_order, ce.entry_id`
    )
    .all(chapterId, userId) as { entry_id: string; sort_order: number }[];
  const entries = rows
    .map((r) => {
      const e = entryWithMeta(r.entry_id, userId);
      return e ? { ...e, sort_order: r.sort_order } : null;
    })
    .filter(Boolean) as (EntryWithMeta & { sort_order: number })[];

  return { ...chapter, cover, entries };
}

export function listChapters(userId: string, q: ChapterListQuery): {
  items: ChapterWithMeta[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
} {
  const db = getDb();
  const where: string[] = ['user_id = ?'];
  const params: unknown[] = [userId];
  const qt = q.q?.trim();
  if (qt) {
    where.push('(title LIKE ? OR description LIKE ? OR content LIKE ?)');
    params.push(`%${qt}%`, `%${qt}%`, `%${qt}%`);
  }
  const whereSql = where.join(' AND ');
  const { c: total } = db
    .prepare(`SELECT COUNT(*) AS c FROM chapters WHERE ${whereSql}`)
    .get(...params) as { c: number };
  const offset = (q.page - 1) * q.page_size;
  const rows = db
    .prepare(
      `SELECT * FROM chapters WHERE ${whereSql}
       ORDER BY COALESCE(start_date, '9999'), created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, q.page_size, offset) as ChapterRow[];
  return {
    items: rows.map((r) => chapterWithMeta(r.id, userId)!).filter(Boolean),
    total,
    page: q.page,
    page_size: q.page_size,
    has_more: offset + rows.length < total,
  };
}

export function createChapter(userId: string, input: ChapterInput): ChapterWithMeta {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO chapters (id, user_id, title, description, content, cover_path, start_date, end_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, userId, input.title, input.description ?? null, input.content ?? null,
    input.cover_media_id ?? null, input.start_date ?? null, input.end_date ?? null, now, now
  );
  return chapterWithMeta(id, userId)!;
}

export function updateChapter(
  userId: string,
  id: string,
  input: Partial<ChapterInput>
): ChapterWithMeta | null {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM chapters WHERE id = ? AND user_id = ?')
    .get(id, userId) as ChapterRow | undefined;
  if (!existing) return null;
  const merged = {
    title: input.title ?? existing.title,
    description: input.description !== undefined ? input.description : existing.description,
    content: input.content !== undefined ? input.content : existing.content,
    cover_path: input.cover_media_id !== undefined ? input.cover_media_id : existing.cover_path,
    start_date: input.start_date !== undefined ? input.start_date : existing.start_date,
    end_date: input.end_date !== undefined ? input.end_date : existing.end_date,
  };
  db.prepare(
    `UPDATE chapters SET title=?, description=?, content=?, cover_path=?, start_date=?, end_date=?, updated_at=?
     WHERE id=? AND user_id=?`
  ).run(
    merged.title, merged.description, merged.content, merged.cover_path,
    merged.start_date, merged.end_date, new Date().toISOString(), id, userId
  );
  return chapterWithMeta(id, userId);
}

/** 设置故事关联记录与排序：entry_ids 按给定顺序写入 sort_order */
export function setChapterEntries(userId: string, chapterId: string, entryIds: string[]): ChapterWithMeta | null {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM chapters WHERE id = ? AND user_id = ?')
    .get(chapterId, userId) as ChapterRow | undefined;
  if (!existing) return null;
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM chapter_entries WHERE chapter_id = ?').run(chapterId);
    let order = 0;
    for (const eid of entryIds) {
      const owned = db
        .prepare('SELECT 1 FROM entries WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
        .get(eid, userId);
      if (owned) {
        db.prepare('INSERT OR IGNORE INTO chapter_entries (chapter_id, entry_id, sort_order) VALUES (?, ?, ?)').run(
          chapterId,
          eid,
          order
        );
        order++;
      }
    }
  });
  tx();
  return chapterWithMeta(chapterId, userId);
}

/** 硬删除故事：级联清理 chapter_entries，封面媒体行与文件由调用方处理 */
export function deleteChapter(userId: string, id: string): MediaRow | null {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM chapters WHERE id = ? AND user_id = ?')
    .get(id, userId) as ChapterRow | undefined;
  if (!existing) return null;
  const cover = existing.cover_path
    ? ((db.prepare('SELECT * FROM media WHERE id = ? AND user_id = ?').get(
        existing.cover_path,
        userId
      ) as MediaRow | undefined) ?? null)
    : null;
  const tx = db.transaction(() => {
    if (cover) db.prepare('DELETE FROM media WHERE id = ?').run(cover.id);
    db.prepare('DELETE FROM chapters WHERE id = ? AND user_id = ?').run(id, userId);
  });
  tx();
  return cover;
}
