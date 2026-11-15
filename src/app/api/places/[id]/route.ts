import type { NextRequest } from 'next/server';
import { apiHandler, assertSameOrigin, fail, ok, requireUser } from '@/lib/api/http';
import { placeUpdateSchema } from '@/lib/api/schemas';
import { deletePlace, placeWithMeta, updatePlace } from '@/lib/db/places';
import { unlinkMediaFiles } from '@/lib/api/mediaFiles';

type Ctx = { params: Promise<Record<string, string>> };

/** GET /api/places/[id] — 地点详情（含封面、关联统计） */
export const GET = apiHandler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const place = placeWithMeta(id, user.id);
  if (!place) return fail(404, 'NOT_FOUND', '地点不存在');
  return ok(place);
});

/** PATCH /api/places/[id] — 编辑地点 */
export const PATCH = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = placeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const place = updatePlace(user.id, id, parsed.data);
  if (!place) return fail(404, 'NOT_FOUND', '地点不存在');
  return ok(place);
});

/** DELETE /api/places/[id] — 删除地点（硬删除，连同封面媒体） */
export const DELETE = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const cover = deletePlace(user.id, id);
  if (cover === null) return fail(404, 'NOT_FOUND', '地点不存在');
  unlinkMediaFiles(cover);
  return ok({ deleted: true });
});
