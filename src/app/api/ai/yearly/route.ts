import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { aiYearlySchema } from '@/lib/api/schemas';
import { yearlyReview } from '@/lib/ai/features';
import { createDraft } from '@/lib/db/ai';

/** AI 年度回顾：基于整年真实记录总结，无记录时不调 AI 并如实说明 */
export const POST = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await req.json();
  const parsed = aiYearlySchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const { year } = parsed.data;
  const result = await yearlyReview(user.id, year);
  if (result.entryCount === 0) {
    return ok({ notEnough: true, entryCount: 0, message: `${year} 年还没有任何记录。` });
  }
  const draft = createDraft(user.id, {
    kind: 'yearly',
    title: `${year} 年度回顾`,
    content: result.story,
    meta: {
      year,
      keywords: result.keywords,
      events: result.events,
      travels: result.travels,
      photos: result.photos,
      quotes: result.quotes,
    },
    isMock: result.mock,
  });
  return ok({ draft });
});
