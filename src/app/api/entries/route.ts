import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { entryCreateSchema, listQuerySchema } from '@/lib/api/schemas';
import { createEntry, listEntries } from '@/lib/db/entries';

export const GET = apiHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const parsed = listQuerySchema.safeParse(Object.fromEntries(sp.entries()));
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const q = parsed.data;
  const result = listEntries(user.id, {
    page: q.page,
    page_size: q.page_size,
    type: q.type,
    tag: q.tag,
    mood: q.mood,
    year: q.year,
    month: q.month,
    from: q.from,
    to: q.to,
    favorite: q.favorite === '1',
    important: q.important === '1',
    archived: q.archived === '1',
    trash: q.trash === '1',
    person: q.person,
    place: q.place,
    q: q.q,
  });
  return ok(result);
});

export const POST = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await req.json();
  const parsed = entryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const d = parsed.data;
  const entry = createEntry(user.id, {
    title: d.title,
    content: d.content,
    entry_type: d.entry_type,
    occurred_at: d.occurred_at,
    mood: d.mood,
    tags: d.tags,
    media_ids: d.media_ids,
    people_ids: d.people_ids,
    places_ids: d.places_ids,
    is_favorite: d.is_favorite,
    is_important: d.is_important,
    is_archived: d.is_archived,
  });
  return ok(entry);
});
