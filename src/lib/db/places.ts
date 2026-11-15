import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import type { EntryWithMeta, MediaRow, PlaceRow, PlaceWithMeta } from '@/lib/types';
import { entryWithMeta } from '@/lib/db/entries';

export interface PlaceInput {
  name: string;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  cover_media_id?: string | null;
}

export interface PlaceListQuery {
  page: number;
  page_size: number;
  q?: string;
}

export function placeWithMeta(placeId: string, userId: string): PlaceWithMeta | null {
  const db = getDb();
  const place = db
    .prepare('SELECT * FROM places WHERE id = ? AND user_id = ?')
    .get(placeId, userId) as PlaceRow | undefined;
  if (!place) return null;

  const cover = place.cover_path
    ? ((db.prepare('SELECT * FROM media WHERE id = ? AND user_id = ?').get(
        place.cover_path,
        userId
      ) as MediaRow | undefined) ?? null)
    : null;
  const { c: entryCount } = db
    .prepare(
      `SELECT COUNT(*) AS c FROM entry_places ep
       JOIN entries e ON e.id = ep.entry_id
       WHERE ep.place_id = ? AND e.user_id = ? AND e.deleted_at IS NULL`
    )
    .get(placeId, userId) as { c: number };
  const { c: photoCount } = db
    .prepare(
      `SELECT COUNT(*) AS c FROM entry_places ep
       JOIN entries e ON e.id = ep.entry_id
       JOIN media m ON m.entry_id = e.id
       WHERE ep.place_id = ? AND e.user_id = ? AND e.deleted_at IS NULL`
    )
    .get(placeId, userId) as { c: number };

  return { ...place, cover, entryCount, photoCount };
}

/** 地点相关的记录，按发生日期倒序 */
export function listPlaceEntries(
  userId: string,
  placeId: string,
  page: number,
  page_size: number
): { items: EntryWithMeta[]; total: number; has_more: boolean } {
  const db = getDb();
  const { c: total } = db
    .prepare(
      `SELECT COUNT(*) AS c FROM entry_places ep
       JOIN entries e ON e.id = ep.entry_id
       WHERE ep.place_id = ? AND e.user_id = ? AND e.deleted_at IS NULL`
    )
    .get(placeId, userId) as { c: number };
  const offset = (page - 1) * page_size;
  const rows = db
    .prepare(
      `SELECT e.id FROM entry_places ep
       JOIN entries e ON e.id = ep.entry_id
       WHERE ep.place_id = ? AND e.user_id = ? AND e.deleted_at IS NULL
       ORDER BY e.occurred_at DESC LIMIT ? OFFSET ?`
    )
    .all(placeId, userId, page_size, offset) as { id: string }[];
  return {
    items: rows.map((r) => entryWithMeta(r.id, userId)!).filter(Boolean),
    total,
    has_more: offset + rows.length < total,
  };
}

export function listPlaces(userId: string, q: PlaceListQuery): {
  items: PlaceRow[];
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
    where.push('(name LIKE ? OR country LIKE ? OR city LIKE ? OR address LIKE ?)');
    params.push(`%${qt}%`, `%${qt}%`, `%${qt}%`, `%${qt}%`);
  }
  const whereSql = where.join(' AND ');
  const { c: total } = db.prepare(`SELECT COUNT(*) AS c FROM places WHERE ${whereSql}`).get(...params) as { c: number };
  const offset = (q.page - 1) * q.page_size;
  const items = db
    .prepare(`SELECT * FROM places WHERE ${whereSql} ORDER BY created_at, name LIMIT ? OFFSET ?`)
    .all(...params, q.page_size, offset) as PlaceRow[];
  return { items, total, page: q.page, page_size: q.page_size, has_more: offset + items.length < total };
}

export function createPlace(userId: string, input: PlaceInput): PlaceRow {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO places (id, user_id, name, country, city, address, latitude, longitude, description, cover_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, userId, input.name, input.country ?? null, input.city ?? null, input.address ?? null,
    input.latitude ?? null, input.longitude ?? null, input.description ?? null,
    input.cover_media_id ?? null, now, now
  );
  return db.prepare('SELECT * FROM places WHERE id = ?').get(id) as PlaceRow;
}

export function updatePlace(userId: string, id: string, input: Partial<PlaceInput>): PlaceRow | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM places WHERE id = ? AND user_id = ?').get(id, userId) as PlaceRow | undefined;
  if (!existing) return null;
  const merged = {
    name: input.name ?? existing.name,
    country: input.country !== undefined ? input.country : existing.country,
    city: input.city !== undefined ? input.city : existing.city,
    address: input.address !== undefined ? input.address : existing.address,
    latitude: input.latitude !== undefined ? input.latitude : existing.latitude,
    longitude: input.longitude !== undefined ? input.longitude : existing.longitude,
    description: input.description !== undefined ? input.description : existing.description,
    cover_path: input.cover_media_id !== undefined ? input.cover_media_id : existing.cover_path,
  };
  db.prepare(
    `UPDATE places SET name=?, country=?, city=?, address=?, latitude=?, longitude=?, description=?, cover_path=?, updated_at=?
     WHERE id=? AND user_id=?`
  ).run(
    merged.name, merged.country, merged.city, merged.address, merged.latitude, merged.longitude,
    merged.description, merged.cover_path, new Date().toISOString(), id, userId
  );
  return db.prepare('SELECT * FROM places WHERE id = ?').get(id) as PlaceRow;
}

/** 硬删除地点：级联清理 entry_places/milestone_places，封面媒体行与文件由调用方处理 */
export function deletePlace(userId: string, id: string): MediaRow | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM places WHERE id = ? AND user_id = ?').get(id, userId) as PlaceRow | undefined;
  if (!existing) return null;
  const cover = existing.cover_path
    ? ((db.prepare('SELECT * FROM media WHERE id = ? AND user_id = ?').get(existing.cover_path, userId) as MediaRow | undefined) ?? null)
    : null;
  const tx = db.transaction(() => {
    if (cover) db.prepare('DELETE FROM media WHERE id = ?').run(cover.id);
    db.prepare('DELETE FROM places WHERE id = ? AND user_id = ?').run(id, userId);
  });
  tx();
  return cover;
}
