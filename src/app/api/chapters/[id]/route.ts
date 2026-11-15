import type { NextRequest } from 'next/server';
import { apiHandler, assertSameOrigin, fail, ok, requireUser } from '@/lib/api/http';
import { chapterUpdateSchema } from '@/lib/api/schemas';
import { chapterWithMeta, deleteChapter, updateChapter } from '@/lib/db/chapters';
import { unlinkMediaFiles } from '@/lib/api/mediaFiles';

type Ctx = { params: Promise<Record<string, string>> };

/** GET /api/chapters/[id] — 人生故事详情（含封面、按序关联记录） */
export const GET = apiHandler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const chapter = chapterWithMeta(id, user.id);
  if (!chapter) return fail(404, 'NOT_FOUND', '人生故事不存在');
  return ok(chapter);
});

/** PATCH /api/chapters/[id] — 编辑人生故事 */
export const PATCH = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = chapterUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const chapter = updateChapter(user.id, id, parsed.data);
  if (!chapter) return fail(404, 'NOT_FOUND', '人生故事不存在');
  return ok(chapter);
});

/** DELETE /api/chapters/[id] — 删除人生故事（硬删除，连同封面媒体） */
export const DELETE = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const cover = deleteChapter(user.id, id);
  if (cover === null) return fail(404, 'NOT_FOUND', '人生故事不存在');
  unlinkMediaFiles(cover);
  return ok({ deleted: true });
});
