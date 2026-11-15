import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { aiReviewSchema } from '@/lib/api/schemas';
import { reviewRange } from '@/lib/ai/features';
import { createDraft } from '@/lib/db/ai';

/** AI 区间回顾（今日/本周/月度/自定义），记录不足时不调 AI 并如实说明 */
export const POST = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await req.json();
  const parsed = aiReviewSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const { start, end, label } = parsed.data;
  const result = await reviewRange(user.id, { start, end, label: label ?? `${start} 至 ${end}` });
  if (result.entryCount === 0) {
    return ok({ notEnough: true, entryCount: 0, message: '这个时间段还没有任何记录，先去记下一些生活片段吧。' });
  }
  const draft = createDraft(user.id, {
    kind: 'review',
    title: `${label ?? `${start} 至 ${end}`} 的回顾`,
    content: result.draft,
    meta: { start, end, label, entryCount: result.entryCount },
    sourceEntryIds: result.sources,
    isMock: result.mock,
  });
  return ok({ draft });
});
