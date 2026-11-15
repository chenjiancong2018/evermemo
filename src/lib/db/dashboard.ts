import { getDb } from '@/lib/db';
import type { EntryWithMeta } from '@/lib/types';
import { entryWithMeta } from '@/lib/db/entries';

export interface HomeStats {
  totalEntries: number;
  thisYearEntries: number;
  favorites: number;
  photos: number;
  tags: number;
  /** 连续记录天数（截至今天或昨天） */
  streak: number;
}

export function getHomeStats(userId: string): HomeStats {
  const db = getDb();
  const now = new Date();
  const year = String(now.getFullYear());

  const total = db
    .prepare('SELECT COUNT(*) AS c FROM entries WHERE user_id = ? AND deleted_at IS NULL')
    .get(userId) as { c: number };
  const thisYear = db
    .prepare(
      `SELECT COUNT(*) AS c FROM entries
       WHERE user_id = ? AND deleted_at IS NULL AND substr(occurred_at, 1, 4) = ?`
    )
    .get(userId, year) as { c: number };
  const favorites = db
    .prepare('SELECT COUNT(*) AS c FROM entries WHERE user_id = ? AND deleted_at IS NULL AND is_favorite = 1')
    .get(userId) as { c: number };
  const photos = db
    .prepare('SELECT COUNT(*) AS c FROM media WHERE user_id = ?')
    .get(userId) as { c: number };
  const tags = db
    .prepare('SELECT COUNT(*) AS c FROM tags WHERE user_id = ?')
    .get(userId) as { c: number };

  // 连续记录天数：从今天（或昨天）起向前数有记录的连续日期
  const days = db
    .prepare(
      `SELECT DISTINCT substr(occurred_at, 1, 10) AS d FROM entries
       WHERE user_id = ? AND deleted_at IS NULL`
    )
    .all(userId) as { d: string }[];
  const daySet = new Set(days.map((r) => r.d));

  let streak = 0;
  let cursor = new Date(now);
  if (!daySet.has(isoDay(cursor))) cursor = new Date(cursor.getTime() - 86400000);
  while (daySet.has(isoDay(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }

  return {
    totalEntries: total.c,
    thisYearEntries: thisYear.c,
    favorites: favorites.c,
    photos: photos.c,
    tags: tags.c,
    streak,
  };
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 往年今日：历史同月同日（不含今年） */
export function getOnThisDay(userId: string): EntryWithMeta[] {
  const db = getDb();
  const now = new Date();
  const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const rows = db
    .prepare(
      `SELECT * FROM entries
       WHERE user_id = ? AND deleted_at IS NULL AND is_archived = 0
         AND substr(occurred_at, 6, 5) = ?
         AND substr(occurred_at, 1, 4) != ?
       ORDER BY occurred_at DESC LIMIT 12`
    )
    .all(userId, md, String(now.getFullYear())) as { id: string }[];
  return rows.map((r) => entryWithMeta(r.id, userId)!);
}

export function getRecentEntries(userId: string, limit = 5): EntryWithMeta[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM entries
       WHERE user_id = ? AND deleted_at IS NULL AND is_archived = 0
       ORDER BY occurred_at DESC, created_at DESC LIMIT ?`
    )
    .all(userId, limit) as { id: string }[];
  return rows.map((r) => entryWithMeta(r.id, userId)!);
}

/** 时间轴分布（按月），用于年份时间线预览 */
export function getYearMonths(userId: string): { year: number; months: number[] }[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT substr(occurred_at, 1, 7) AS ym, COUNT(*) AS c FROM entries
       WHERE user_id = ? AND deleted_at IS NULL AND is_archived = 0
       GROUP BY ym ORDER BY ym DESC`
    )
    .all(userId) as { ym: string; c: number }[];
  const map = new Map<number, Set<number>>();
  for (const r of rows) {
    const [y, m] = r.ym.split('-').map(Number);
    if (!map.has(y)) map.set(y, new Set());
    map.get(y)!.add(m);
  }
  return Array.from(map.entries()).map(([year, months]) => ({
    year,
    months: Array.from(months).sort((a, b) => b - a),
  }));
}

export interface YearStat {
  year: number;
  entries: number;
  photos: number;
  milestones: number;
  /** 该年关联到人生故事的记录数 */
  chapterEntries: number;
}

/** 逐年统计（人生阶段页用）：记录数/照片数/里程碑数/故事关联数 */
export function getStatsPerYear(userId: string): YearStat[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT substr(e.occurred_at, 1, 4) AS year,
              COUNT(*) AS entries,
              COUNT(DISTINCT m.id) AS photos,
              COUNT(DISTINCT me.milestone_id) AS milestones,
              COUNT(DISTINCT ce.chapter_id) AS chapters
       FROM entries e
       LEFT JOIN media m ON m.entry_id = e.id
       LEFT JOIN milestone_entries me ON me.entry_id = e.id
       LEFT JOIN chapter_entries ce ON ce.entry_id = e.id
       WHERE e.user_id = ? AND e.deleted_at IS NULL AND e.is_archived = 0
       GROUP BY year ORDER BY year ASC`
    )
    .all(userId) as { year: string; entries: number; photos: number; milestones: number; chapters: number }[];
  return rows.map((r) => ({
    year: Number(r.year),
    entries: r.entries,
    photos: r.photos,
    milestones: r.milestones,
    chapterEntries: r.chapters,
  }));
}

/** 第一条记录的发生日期（YYYY-MM-DD），无记录返回 null */
export function getFirstEntryAt(userId: string): string | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT occurred_at FROM entries WHERE user_id = ? AND deleted_at IS NULL AND is_archived = 0 ORDER BY occurred_at ASC LIMIT 1`
    )
    .get(userId) as { occurred_at: string } | undefined;
  return row?.occurred_at ?? null;
}
