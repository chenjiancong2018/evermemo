import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser } from '@/lib/api/http';
import { listPlaceEntries, placeWithMeta } from '@/lib/db/places';

type Ctx = { params: Promise<Record<string, string>> };

/** GET /api/places/[id]/entries — 地点相关的记录（分页） */
export const GET = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get('page') ?? '1') || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get('page_size') ?? '30') || 30));
  if (!placeWithMeta(id, user.id)) return fail(404, 'NOT_FOUND', '地点不存在');
  const result = listPlaceEntries(user.id, id, page, pageSize);
  return ok(result);
});
