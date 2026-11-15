import type { NextRequest } from 'next/server';
import { apiHandler, assertSameOrigin, fail, ok, requireUser } from '@/lib/api/http';
import { milestoneUpdateSchema } from '@/lib/api/schemas';
import { deleteMilestone, milestoneWithMeta, updateMilestone } from '@/lib/db/milestones';
import { unlinkMediaFiles } from '@/lib/api/mediaFiles';

type Ctx = { params: Promise<Record<string, string>> };

/** GET /api/milestones/[id] — 重要时刻详情（含封面、关联记录/人物/地点） */
export const GET = apiHandler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const milestone = milestoneWithMeta(id, user.id);
  if (!milestone) return fail(404, 'NOT_FOUND', '重要时刻不存在');
  return ok(milestone);
});

/** PATCH /api/milestones/[id] — 编辑重要时刻 */
export const PATCH = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = milestoneUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const milestone = updateMilestone(user.id, id, parsed.data);
  if (!milestone) return fail(404, 'NOT_FOUND', '重要时刻不存在');
  return ok(milestone);
});

/** DELETE /api/milestones/[id] — 删除重要时刻（硬删除，连同封面媒体） */
export const DELETE = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const cover = deleteMilestone(user.id, id);
  if (cover === null) return fail(404, 'NOT_FOUND', '重要时刻不存在');
  unlinkMediaFiles(cover);
  return ok({ deleted: true });
});
