import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { aiDraftPatchSchema } from '@/lib/api/schemas';
import { getDraft, updateDraftStatus, updateDraftContent, deleteDraft } from '@/lib/db/ai';

type Ctx = { params: Promise<Record<string, string>> };

export const GET = apiHandler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const draft = getDraft(user.id, id);
  if (!draft) return fail(404, 'NOT_FOUND', '草稿不存在');
  return ok({ draft });
});

/** 应用/丢弃草稿；应用只是标记状态，内容由调用方写入目标记录 */
export const PATCH = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = aiDraftPatchSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  if (body.content !== undefined && typeof body.content === 'string') {
    updateDraftContent(user.id, id, body.content);
  }
  if (!updateDraftStatus(user.id, id, parsed.data.status)) {
    return fail(404, 'NOT_FOUND', '草稿不存在');
  }
  return ok({ draft: getDraft(user.id, id) });
});

export const DELETE = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!deleteDraft(user.id, id)) return fail(404, 'NOT_FOUND', '草稿不存在');
  return ok({ deleted: true });
});
