import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { entryUpdateSchema } from '@/lib/api/schemas';
import { getEntry, softDeleteEntry, updateEntry } from '@/lib/db/entries';

type Ctx = { params: Promise<Record<string, string>> };

export const GET = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const entry = getEntry(user.id, id, true);
  if (!entry) return fail(404, 'NOT_FOUND', '记录不存在');
  return ok(entry);
});

export const PATCH = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = entryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const d = parsed.data;
  const entry = updateEntry(user.id, id, {
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
  if (!entry) return fail(404, 'NOT_FOUND', '记录不存在');
  return ok(entry);
});

/** 软删除（进回收站） */
export const DELETE = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const okNow = softDeleteEntry(user.id, id);
  if (!okNow) return fail(404, 'NOT_FOUND', '记录不存在');
  return ok({ deleted: true });
});
