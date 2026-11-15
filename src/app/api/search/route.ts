import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser } from '@/lib/api/http';
import { listEntries } from '@/lib/db/entries';
import { listPeople } from '@/lib/db/people';
import { listPlaces } from '@/lib/db/places';
import { listChapters } from '@/lib/db/chapters';

/** GET /api/search?q= — 聚合搜索：记录 + 人物 + 地点 + 人生故事 */
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const q = (sp.get('q') ?? '').trim().slice(0, 200);
  if (!q) return fail(400, 'VALIDATION', '请输入搜索关键词');

  const [entries, people, places, chapters] = await Promise.all([
    Promise.resolve(listEntries(user.id, { page: 1, page_size: 10, q })),
    Promise.resolve(listPeople(user.id, { page: 1, page_size: 10, q })),
    Promise.resolve(listPlaces(user.id, { page: 1, page_size: 10, q })),
    Promise.resolve(listChapters(user.id, { page: 1, page_size: 10, q })),
  ]);

  return ok({
    q,
    entries: entries.items,
    entries_total: entries.total,
    people: people.items,
    people_total: people.total,
    places: places.items,
    places_total: places.total,
    chapters: chapters.items,
    chapters_total: chapters.total,
  });
});
