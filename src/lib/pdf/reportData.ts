import type { EntryWithMeta } from '@/lib/types';

/** 服务端报告聚合（与 ReportView.compute 保持一致） */
export interface ReportData {
  total: number;
  photos: number;
  favorites: number;
  important: number;
  byMonth: { month: string; count: number }[];
  byType: { type: string; count: number }[];
  byMood: { mood: string; count: number }[];
  byTag: { tag: string; count: number }[];
  firstAt: string | null;
  lastAt: string | null;
  activeDays: number;
  longestStreak: number;
  topDay: { date: string; count: number } | null;
}

export function computeReport(entries: EntryWithMeta[]): ReportData {
  const monthMap = new Map<string, number>();
  const typeMap = new Map<string, number>();
  const moodMap = new Map<string, number>();
  const tagMap = new Map<string, number>();
  const dayMap = new Map<string, number>();
  let photos = 0;
  let favorites = 0;
  let important = 0;
  for (const e of entries) {
    const month = e.occurred_at.slice(0, 7);
    monthMap.set(month, (monthMap.get(month) ?? 0) + 1);
    typeMap.set(e.entry_type, (typeMap.get(e.entry_type) ?? 0) + 1);
    if (e.mood) moodMap.set(e.mood, (moodMap.get(e.mood) ?? 0) + 1);
    for (const t of e.tags) tagMap.set(t.name, (tagMap.get(t.name) ?? 0) + 1);
    const day = e.occurred_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    photos += e.media.length;
    if (e.is_favorite) favorites += 1;
    if (e.is_important) important += 1;
  }
  const days = Array.from(dayMap.keys()).sort();
  let longestStreak = 0;
  let cur = 0;
  let prev: number | null = null;
  for (const d of days) {
    const t = new Date(d + 'T00:00:00').getTime();
    if (prev !== null && t - prev === 86400000) cur += 1;
    else cur = 1;
    longestStreak = Math.max(longestStreak, cur);
    prev = t;
  }
  const topDay = Array.from(dayMap.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
  return {
    total: entries.length,
    photos,
    favorites,
    important,
    byMonth: Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count })),
    byType: Array.from(typeMap.entries()).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count })),
    byMood: Array.from(moodMap.entries()).sort((a, b) => b[1] - a[1]).map(([mood, count]) => ({ mood, count })),
    byTag: Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([tag, count]) => ({ tag, count })),
    firstAt: entries.length ? entries.map((e) => e.occurred_at).sort()[0] : null,
    lastAt: entries.length ? entries.map((e) => e.occurred_at).sort().at(-1)! : null,
    activeDays: dayMap.size,
    longestStreak,
    topDay: topDay ? { date: topDay[0], count: topDay[1] } : null,
  };
}
