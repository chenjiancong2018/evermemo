import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import type {
  EntryWithMeta,
  ImportanceLevel,
  MediaRow,
  MilestoneRow,
  MilestoneWithMeta,
  PersonRow,
  PlaceRow,
} from '@/lib/types';
import { entryWithMeta } from '@/lib/db/entries';

export interface MilestoneInput {
  title: string;
  description?: string | null;
  occurred_at: string;
  cover_media_id?: string | null;
  importance?: ImportanceLevel;
  entry_ids?: string[];
  person_ids?: string[];
  place_ids?: string[];
}

export interface MilestoneListQuery {
  page: number;
  page_size: number;
  year?: number;
  q?: string;
}

export function milestoneWithMeta(milestoneId: string, userId: string): MilestoneWithMeta | null {
  const db = getDb();
  const ms = db
    .prepare('SELECT * FROM milestones WHERE id = ? AND user_id = ?')
    .get(milestoneId, userId) as MilestoneRow | undefined;
  if (!ms) return null;

  const cover = ms.cover_path
    ? ((db.prepare('SELECT * FROM media WHERE id = ? AND user_id = ?').get(
        ms.cover_path,
        userId
      ) as MediaRow | undefined) ?? null)
    : null;
  const entryRows = db
    .prepare(
      `SELECT e.id FROM milestone_entries me
       JOIN entries e ON e.id = me.entry_id
       WHERE me.milestone_id = ? AND e.user_id = ? AND e.deleted_at IS NULL
       ORDER BY e.occurred_at DESC`
    )
    .all(milestoneId, userId) as { id: string }[];
  const entries = entryRows.map((r) => entryWithMeta(r.id, userId)!).filter(Boolean) as EntryWithMeta[];
  const people = db
    .prepare(
      `SELECT p.* FROM milestone_people mp
       JOIN people p ON p.id = mp.person_id
       WHERE mp.milestone_id = ? ORDER BY p.name`
    )
    .all(milestoneId) as PersonRow[];
  const places = db
    .prepare(
      `SELECT pl.* FROM milestone_places mpl
       JOIN places pl ON pl.id = mpl.place_id
       WHERE mpl.milestone_id = ? ORDER BY pl.name`
    )
    .all(milestoneId) as PlaceRow[];

  return { ...ms, cover, entries, people, places };
}

export function listMilestones(userId: string, q: MilestoneListQuery): {
  items: MilestoneWithMeta[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
} {
  const db = getDb();
  const where: string[] = ['user_id = ?'];
  const params: unknown[] = [userId];
  if (q.year) {
    where.push("substr(occurred_at, 1, 4) = ?");
    params.push(String(q.year));
  }
  const qt = q.q?.trim();
  if (qt) {
    where.push('(title LIKE ? OR description LIKE ?)');
    params.push(`%${qt}%`, `%${qt}%`);
  }
  const whereSql = where.join(' AND ');
  const { c: total } = db
    .prepare(`SELECT COUNT(*) AS c FROM milestones WHERE ${whereSql}`)
    .get(...params) as { c: number };
  const offset = (q.page - 1) * q.page_size;
  const rows = db
    .prepare(`SELECT * FROM milestones WHERE ${whereSql} ORDER BY occurred_at DESC LIMIT ? OFFSET ?`)
    .all(...params, q.page_size, offset) as MilestoneRow[];
  return {
    items: rows.map((r) => milestoneWithMeta(r.id, userId)!).filter(Boolean),
    total,
    page: q.page,
    page_size: q.page_size,
    has_more: offset + rows.length < total,
  };
}

/** 里程碑覆盖的年份列表（用于年份浏览） */
export function listMilestoneYears(userId: string): number[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT substr(occurred_at, 1, 4) AS y FROM milestones
       WHERE user_id = ? ORDER BY y DESC`
    )
    .all(userId) as { y: string }[];
  return rows.map((r) => Number(r.y));
}

export function createMilestone(userId: string, input: MilestoneInput): MilestoneWithMeta {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO milestones (id, user_id, title, description, occurred_at, cover_path, importance, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, userId, input.title, input.description ?? null, input.occurred_at,
      input.cover_media_id ?? null, input.importance ?? 1, now, now
    );
    attachLinks(id, userId, input.entry_ids ?? [], input.person_ids ?? [], input.place_ids ?? []);
  });
  tx();
  return milestoneWithMeta(id, userId)!;
}

export function updateMilestone(
  userId: string,
  id: string,
  input: Partial<MilestoneInput>
): MilestoneWithMeta | null {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM milestones WHERE id = ? AND user_id = ?')
    .get(id, userId) as MilestoneRow | undefined;
  if (!existing) return null;
  const merged = {
    title: input.title ?? existing.title,
    description: input.description !== undefined ? input.description : existing.description,
    occurred_at: input.occurred_at ?? existing.occurred_at,
    cover_path: input.cover_media_id !== undefined ? input.cover_media_id : existing.cover_path,
    importance: input.importance ?? existing.importance,
  };
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE milestones SET title=?, description=?, occurred_at=?, cover_path=?, importance=?, updated_at=?
       WHERE id=? AND user_id=?`
    ).run(
      merged.title, merged.description, merged.occurred_at, merged.cover_path,
      merged.importance, new Date().toISOString(), id, userId
    );
    if (input.entry_ids !== undefined || input.person_ids !== undefined || input.place_ids !== undefined) {
      db.prepare('DELETE FROM milestone_entries WHERE milestone_id = ?').run(id);
      db.prepare('DELETE FROM milestone_people WHERE milestone_id = ?').run(id);
      db.prepare('DELETE FROM milestone_places WHERE milestone_id = ?').run(id);
      attachLinks(
        id,
        userId,
        input.entry_ids ?? [],
        input.person_ids ?? [],
        input.place_ids ?? []
      );
    }
  });
  tx();
  return milestoneWithMeta(id, userId);
}

function attachLinks(
  milestoneId: string,
  userId: string,
  entryIds: string[],
  personIds: string[],
  placeIds: string[]
): void {
  const db = getDb();
  for (const eid of entryIds) {
    const owned = db
      .prepare('SELECT 1 FROM entries WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
      .get(eid, userId);
    if (owned) db.prepare('INSERT OR IGNORE INTO milestone_entries (milestone_id, entry_id) VALUES (?, ?)').run(milestoneId, eid);
  }
  for (const pid of personIds) {
    const owned = db.prepare('SELECT 1 FROM people WHERE id = ? AND user_id = ?').get(pid, userId);
    if (owned) db.prepare('INSERT OR IGNORE INTO milestone_people (milestone_id, person_id) VALUES (?, ?)').run(milestoneId, pid);
  }
  for (const plid of placeIds) {
    const owned = db.prepare('SELECT 1 FROM places WHERE id = ? AND user_id = ?').get(plid, userId);
    if (owned) db.prepare('INSERT OR IGNORE INTO milestone_places (milestone_id, place_id) VALUES (?, ?)').run(milestoneId, plid);
  }
}

/** 硬删除里程碑：级联清理关联表，封面媒体行与文件由调用方处理 */
export function deleteMilestone(userId: string, id: string): MediaRow | null {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM milestones WHERE id = ? AND user_id = ?')
    .get(id, userId) as MilestoneRow | undefined;
  if (!existing) return null;
  const cover = existing.cover_path
    ? ((db.prepare('SELECT * FROM media WHERE id = ? AND user_id = ?').get(
        existing.cover_path,
        userId
      ) as MediaRow | undefined) ?? null)
    : null;
  const tx = db.transaction(() => {
    if (cover) db.prepare('DELETE FROM media WHERE id = ?').run(cover.id);
    db.prepare('DELETE FROM milestones WHERE id = ? AND user_id = ?').run(id, userId);
  });
  tx();
  return cover;
}
