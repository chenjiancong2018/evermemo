import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import type { EntryWithMeta, MediaRow, MilestoneRow, PersonRow, PersonWithMeta } from '@/lib/types';
import { entryWithMeta } from '@/lib/db/entries';

export interface PersonInput {
  name: string;
  nickname?: string | null;
  avatar_media_id?: string | null;
  relationship_type?: string | null;
  description?: string | null;
  first_met_at?: string | null;
  notes?: string | null;
}

export interface PersonListQuery {
  page: number;
  page_size: number;
  q?: string;
}

export function personWithMeta(personId: string, userId: string): PersonWithMeta | null {
  const db = getDb();
  const person = db
    .prepare('SELECT * FROM people WHERE id = ? AND user_id = ?')
    .get(personId, userId) as PersonRow | undefined;
  if (!person) return null;

  const avatar = person.avatar_path
    ? ((db.prepare('SELECT * FROM media WHERE id = ? AND user_id = ?').get(
        person.avatar_path,
        userId
      ) as MediaRow | undefined) ?? null)
    : null;
  const { c: entryCount } = db
    .prepare('SELECT COUNT(*) AS c FROM entry_people ep JOIN entries e ON e.id = ep.entry_id WHERE ep.person_id = ? AND e.user_id = ? AND e.deleted_at IS NULL')
    .get(personId, userId) as { c: number };
  const { c: photoCount } = db
    .prepare(
      `SELECT COUNT(*) AS c FROM entry_people ep
       JOIN entries e ON e.id = ep.entry_id
       JOIN media m ON m.entry_id = e.id
       WHERE ep.person_id = ? AND e.user_id = ? AND e.deleted_at IS NULL`
    )
    .get(personId, userId) as { c: number };
  const sharedMilestones = db
    .prepare(
      `SELECT ms.* FROM milestones ms
       JOIN milestone_people mp ON mp.milestone_id = ms.id
       WHERE mp.person_id = ? AND ms.user_id = ?
       ORDER BY ms.occurred_at DESC`
    )
    .all(personId, userId) as MilestoneRow[];

  return { ...person, avatar, entryCount, photoCount, sharedMilestones };
}

/** 人物相关的记录（含照片），按发生日期倒序 */
export function listPersonEntries(
  userId: string,
  personId: string,
  page: number,
  page_size: number
): { items: EntryWithMeta[]; total: number; has_more: boolean } {
  const db = getDb();
  const { c: total } = db
    .prepare(
      `SELECT COUNT(*) AS c FROM entry_people ep
       JOIN entries e ON e.id = ep.entry_id
       WHERE ep.person_id = ? AND e.user_id = ? AND e.deleted_at IS NULL`
    )
    .get(personId, userId) as { c: number };
  const offset = (page - 1) * page_size;
  const rows = db
    .prepare(
      `SELECT e.id FROM entry_people ep
       JOIN entries e ON e.id = ep.entry_id
       WHERE ep.person_id = ? AND e.user_id = ? AND e.deleted_at IS NULL
       ORDER BY e.occurred_at DESC LIMIT ? OFFSET ?`
    )
    .all(personId, userId, page_size, offset) as { id: string }[];
  return {
    items: rows.map((r) => entryWithMeta(r.id, userId)!).filter(Boolean),
    total,
    has_more: offset + rows.length < total,
  };
}

export function listPeople(userId: string, q: PersonListQuery): {
  items: PersonRow[];
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
    where.push('(name LIKE ? OR nickname LIKE ? OR relationship_type LIKE ?)');
    params.push(`%${qt}%`, `%${qt}%`, `%${qt}%`);
  }
  const whereSql = where.join(' AND ');
  const { c: total } = db.prepare(`SELECT COUNT(*) AS c FROM people WHERE ${whereSql}`).get(...params) as { c: number };
  const offset = (q.page - 1) * q.page_size;
  const items = db
    .prepare(`SELECT * FROM people WHERE ${whereSql} ORDER BY created_at, name LIMIT ? OFFSET ?`)
    .all(...params, q.page_size, offset) as PersonRow[];
  return { items, total, page: q.page, page_size: q.page_size, has_more: offset + items.length < total };
}

export function createPerson(userId: string, input: PersonInput): PersonRow {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO people (id, user_id, name, nickname, avatar_path, relationship_type, description, first_met_at, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, userId, input.name, input.nickname ?? null, input.avatar_media_id ?? null,
    input.relationship_type ?? null, input.description ?? null, input.first_met_at ?? null,
    input.notes ?? null, now, now
  );
  return db.prepare('SELECT * FROM people WHERE id = ?').get(id) as PersonRow;
}

export function updatePerson(userId: string, id: string, input: Partial<PersonInput>): PersonRow | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM people WHERE id = ? AND user_id = ?').get(id, userId) as PersonRow | undefined;
  if (!existing) return null;
  const merged = {
    name: input.name ?? existing.name,
    nickname: input.nickname !== undefined ? input.nickname : existing.nickname,
    avatar_path: input.avatar_media_id !== undefined ? input.avatar_media_id : existing.avatar_path,
    relationship_type: input.relationship_type !== undefined ? input.relationship_type : existing.relationship_type,
    description: input.description !== undefined ? input.description : existing.description,
    first_met_at: input.first_met_at !== undefined ? input.first_met_at : existing.first_met_at,
    notes: input.notes !== undefined ? input.notes : existing.notes,
  };
  db.prepare(
    `UPDATE people SET name=?, nickname=?, avatar_path=?, relationship_type=?, description=?, first_met_at=?, notes=?, updated_at=?
     WHERE id=? AND user_id=?`
  ).run(
    merged.name, merged.nickname, merged.avatar_path, merged.relationship_type,
    merged.description, merged.first_met_at, merged.notes, new Date().toISOString(), id, userId
  );
  return db.prepare('SELECT * FROM people WHERE id = ?').get(id) as PersonRow;
}

/** 硬删除人物：级联清理 entry_people/milestone_people，头像媒体行与文件由调用方处理 */
export function deletePerson(userId: string, id: string): MediaRow | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM people WHERE id = ? AND user_id = ?').get(id, userId) as PersonRow | undefined;
  if (!existing) return null;
  const avatar = existing.avatar_path
    ? ((db.prepare('SELECT * FROM media WHERE id = ? AND user_id = ?').get(existing.avatar_path, userId) as MediaRow | undefined) ?? null)
    : null;
  const tx = db.transaction(() => {
    if (avatar) db.prepare('DELETE FROM media WHERE id = ?').run(avatar.id);
    db.prepare('DELETE FROM people WHERE id = ? AND user_id = ?').run(id, userId);
  });
  tx();
  return avatar;
}
