import type { NextRequest } from 'next/server';
import { apiHandler, assertSameOrigin, fail, ok, requireUser } from '@/lib/api/http';
import { chapterEntriesSchema } from '@/lib/api/schemas';
import { chapterWithMeta, setChapterEntries } from '@/lib/db/chapters';

type Ctx = { params: Promise<Record<string, string>> };

/** PUT /api/chapters/[id]/entries — 整体重排关联记录（按数组顺序写 sort_order） */
export const PUT = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!chapterWithMeta(id, user.id)) return fail(404, 'NOT_FOUND', '人生故事不存在');
  const body = await req.json().catch(() => null);
  const parsed = chapterEntriesSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  setChapterEntries(user.id, id, parsed.data.entry_ids);
  return ok({ updated: true });
});
