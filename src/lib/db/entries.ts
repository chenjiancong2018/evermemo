import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import type { EntryRow, EntryWithMeta, MediaRow, PersonRow, PlaceRow, TagRow } from '@/lib/types';

export interface EntryInput {
  title: string;
  content: string;
  entry_type: string;
  occurred_at: string;
  mood: string | null;
  tags: string[];
  media_ids: string[];
  people_ids: string[];
  places_ids: string[];
  is_favorite: boolean;
  is_important: boolean;
  is_archived: boolean;
}

export interface EntryListQuery {
  page: number;
  page_size: number;
  type?: string;
  tag?: string;
  mood?: string;
  person?: string;
  place?: string;
  year?: number;
  month?: number;
  /** YYYY-MM-DD 区间（闭区间，含起止当天），供 AI 回顾等使用 */
  from?: string;
  to?: string;
  favorite?: boolean;
  important?: boolean;
  archived?: boolean;
  trash?: boolean;
  q?: string;
}

/** 带标签、媒体、人物、地点元数据 */
export function entryWithMeta(entryId: string, userId: string): EntryWithMeta | null {
  const db = getDb();
  const entry = db
    .prepare('SELECT * FROM entries WHERE id = ? AND user_id = ?')
    .get(entryId, userId) as EntryRow | undefined;
  if (!entry) return null;
  const tags = db
    .prepare(
      `SELECT t.* FROM tags t
       JOIN entry_tags et ON et.tag_id = t.id
       WHERE et.entry_id = ? ORDER BY t.name COLLATE NOCASE`
    )
    .all(entryId) as TagRow[];
  const media = db
    .prepare('SELECT * FROM media WHERE entry_id = ? ORDER BY created_at, id')
    .all(entryId) as MediaRow[];
  const people = db
    .prepare(
      `SELECT p.* FROM people p
       JOIN entry_people ep ON ep.person_id = p.id
       WHERE ep.entry_id = ? ORDER BY p.name`
    )
    .all(entryId) as PersonRow[];
  const places = db
    .prepare(
      `SELECT pl.* FROM places pl
       JOIN entry_places epl ON epl.place_id = pl.id
       WHERE epl.entry_id = ? ORDER BY pl.name`
    )
    .all(entryId) as PlaceRow[];
  return { ...entry, tags, media, people, places };
}

export function getEntry(userId: string, id: string, includeDeleted = false): EntryWithMeta | null {
  const db = getDb();
  const cond = includeDeleted ? 'id = ? AND user_id = ?' : 'id = ? AND user_id = ? AND deleted_at IS NULL';
  const entry = db
    .prepare(`SELECT * FROM entries WHERE ${cond}`)
    .get(id, userId) as EntryRow | undefined;
  if (!entry) return null;
  return entryWithMeta(id, userId);
}

export function createEntry(userId: string, input: EntryInput): EntryWithMeta {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO entries
       (id, user_id, title, content, content_format, entry_type, occurred_at, created_at, updated_at,
        mood, is_favorite, is_important, is_archived, deleted_at)
       VALUES (?, ?, ?, ?, 'md', ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    ).run(
      id, userId, input.title, input.content, input.entry_type,
      input.occurred_at, now, now,
      input.mood, input.is_favorite ? 1 : 0, input.is_important ? 1 : 0, input.is_archived ? 1 : 0
    );
    attachTags(id, userId, input.tags);
    attachMedia(id, userId, input.media_ids);
    attachPeople(id, userId, input.people_ids);
    attachPlaces(id, userId, input.places_ids);
  });
  tx();
  return entryWithMeta(id, userId)!;
}

export function updateEntry(userId: string, id: string, input: Partial<EntryInput>): EntryWithMeta | null {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM entries WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .get(id, userId) as EntryRow | undefined;
  if (!existing) return null;

  const merged: EntryInput = {
    title: input.title ?? existing.title,
    content: input.content ?? existing.content,
    entry_type: input.entry_type ?? existing.entry_type,
    occurred_at: input.occurred_at ?? existing.occurred_at,
    mood: input.mood !== undefined ? input.mood : existing.mood,
    tags: input.tags ?? [],
    media_ids: input.media_ids ?? [],
    people_ids: input.people_ids ?? [],
    places_ids: input.places_ids ?? [],
    is_favorite: input.is_favorite ?? existing.is_favorite === 1,
    is_important: input.is_important ?? existing.is_important === 1,
    is_archived: input.is_archived ?? existing.is_archived === 1,
  };

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE entries SET title=?, content=?, entry_type=?, occurred_at=?, mood=?,
       is_favorite=?, is_important=?, is_archived=?, updated_at=?
       WHERE id=? AND user_id=?`
    ).run(
      merged.title, merged.content, merged.entry_type, merged.occurred_at, merged.mood,
      merged.is_favorite ? 1 : 0, merged.is_important ? 1 : 0, merged.is_archived ? 1 : 0,
      new Date().toISOString(), id, userId
    );
    // 关联字段仅在显式提供时才重挂（避免部分 PATCH 清空标签/媒体/人物/地点）
    if (input.tags !== undefined) {
      db.prepare('DELETE FROM entry_tags WHERE entry_id = ?').run(id);
      attachTags(id, userId, merged.tags);
    }
    if (input.media_ids !== undefined) {
      db.prepare('UPDATE media SET entry_id = NULL WHERE entry_id = ?').run(id);
      attachMedia(id, userId, merged.media_ids);
    }
    if (input.people_ids !== undefined) {
      db.prepare('DELETE FROM entry_people WHERE entry_id = ?').run(id);
      attachPeople(id, userId, merged.people_ids);
    }
    if (input.places_ids !== undefined) {
      db.prepare('DELETE FROM entry_places WHERE entry_id = ?').run(id);
      attachPlaces(id, userId, merged.places_ids);
    }
  });
  tx();
  return entryWithMeta(id, userId);
}

function attachTags(entryId: string, userId: string, names: string[]): void {
  const db = getDb();
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    db.prepare(
      `INSERT INTO tags (id, user_id, name, color, created_at)
       VALUES (?, ?, ?, NULL, ?)
       ON CONFLICT(user_id, name) DO NOTHING`
    ).run(randomUUID(), userId, name, new Date().toISOString());
    const tag = db
      .prepare('SELECT id FROM tags WHERE user_id = ? AND name = ?')
      .get(userId, name) as { id: string };
    if (tag) {
      db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)').run(entryId, tag.id);
    }
  }
}

function attachMedia(entryId: string, userId: string, mediaIds: string[]): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE media SET entry_id = ? WHERE id = ? AND user_id = ?');
  for (const mediaId of mediaIds) stmt.run(entryId, mediaId, userId);
}

function attachPeople(entryId: string, userId: string, personIds: string[]): void {
  const db = getDb();
  const stmt = db.prepare('INSERT OR IGNORE INTO entry_people (entry_id, person_id) VALUES (?, ?)');
  for (const pid of personIds) {
    const owned = db.prepare('SELECT 1 FROM people WHERE id = ? AND user_id = ?').get(pid, userId);
    if (owned) stmt.run(entryId, pid);
  }
}

function attachPlaces(entryId: string, userId: string, placeIds: string[]): void {
  const db = getDb();
  const stmt = db.prepare('INSERT OR IGNORE INTO entry_places (entry_id, place_id) VALUES (?, ?)');
  for (const pid of placeIds) {
    const owned = db.prepare('SELECT 1 FROM places WHERE id = ? AND user_id = ?').get(pid, userId);
    if (owned) stmt.run(entryId, pid);
  }
}

export function listEntries(userId: string, q: EntryListQuery): {
  items: EntryWithMeta[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
} {
  const db = getDb();
  const where: string[] = ['e.user_id = ?'];
  const params: unknown[] = [userId];

  if (q.trash) {
    where.push('e.deleted_at IS NOT NULL');
  } else {
    where.push('e.deleted_at IS NULL');
  }
  if (q.type) { where.push('e.entry_type = ?'); params.push(q.type); }
  if (q.mood) { where.push('e.mood = ?'); params.push(q.mood); }
  if (q.favorite) where.push('e.is_favorite = 1');
  if (q.important) where.push('e.is_important = 1');
  if (q.archived) where.push('e.is_archived = 1');
  else if (!q.trash) where.push('e.is_archived = 0');
  if (q.year) { where.push("substr(e.occurred_at, 1, 4) = ?"); params.push(String(q.year)); }
  if (q.month) { where.push("substr(e.occurred_at, 6, 2) = ?"); params.push(String(q.month).padStart(2, '0')); }
  if (q.from) { where.push('e.occurred_at >= ?'); params.push(q.from); }
  if (q.to) { where.push('e.occurred_at <= ?'); params.push(`${q.to}T23:59:59`); }
  if (q.tag) {
    where.push(
      `EXISTS (SELECT 1 FROM entry_tags et JOIN tags t ON t.id = et.tag_id
       WHERE et.entry_id = e.id AND t.user_id = e.user_id AND t.name = ?)`
    );
    params.push(q.tag);
  }
  if (q.person) {
    where.push(
      `EXISTS (SELECT 1 FROM entry_people ep JOIN people p ON p.id = ep.person_id
       WHERE ep.entry_id = e.id AND p.user_id = e.user_id AND p.name = ?)`
    );
    params.push(q.person);
  }
  if (q.place) {
    where.push(
      `EXISTS (SELECT 1 FROM entry_places epl JOIN places pl ON pl.id = epl.place_id
       WHERE epl.entry_id = e.id AND pl.user_id = e.user_id AND pl.name = ?)`
    );
    params.push(q.place);
  }

  // 全文搜索：中文 ≥3 字走 trigram FTS，否则 LIKE 兜底
  const qt = q.q?.trim();
  if (qt) {
    const len = Array.from(qt).length;
    let useFts = false;
    if (len >= 3) {
      const phrase = `"${qt.replace(/"/g, '""')}"`;
      try {
        db.prepare('SELECT rowid FROM entries_fts WHERE entries_fts MATCH ? LIMIT 1').get(phrase);
        useFts = true;
        where.push('e.rowid IN (SELECT rowid FROM entries_fts WHERE entries_fts MATCH ?)');
        params.push(phrase);
      } catch {
        useFts = false;
      }
    }
    if (!useFts) {
      where.push('(e.title LIKE ? OR e.content LIKE ?)');
      params.push(`%${qt}%`, `%${qt}%`);
    }
  }

  const whereSql = where.join(' AND ');
  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM entries e WHERE ${whereSql}`).get(...params) as { c: number }
  ).c;

  const offset = (q.page - 1) * q.page_size;
  const rows = db
    .prepare(
      `SELECT e.* FROM entries e WHERE ${whereSql}
       ORDER BY e.occurred_at DESC, e.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, q.page_size, offset) as EntryRow[];

  const items = rows.map((r) => entryWithMeta(r.id, userId)!);
  return {
    items,
    total,
    page: q.page,
    page_size: q.page_size,
    has_more: offset + rows.length < total,
  };
}

export function softDeleteEntry(userId: string, id: string): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const res = db
    .prepare('UPDATE entries SET deleted_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .run(now, id, userId);
  return res.changes > 0;
}

export function restoreEntry(userId: string, id: string): boolean {
  const db = getDb();
  const res = db
    .prepare('UPDATE entries SET deleted_at = NULL WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL')
    .run(id, userId);
  return res.changes > 0;
}

/** 彻底删除：移除记录、其媒体行（文件由调用方删除）、标签关联 */
export function destroyEntry(userId: string, id: string): MediaRow[] {
  const db = getDb();
  const media = db
    .prepare('SELECT * FROM media WHERE entry_id = ? AND user_id = ?')
    .all(id, userId) as MediaRow[];
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM media WHERE entry_id = ? AND user_id = ?').run(id, userId);
    db.prepare('DELETE FROM entries WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL').run(id, userId);
  });
  tx();
  return media;
}
