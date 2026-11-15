import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { aiStorySchema } from '@/lib/api/schemas';
import { storyDraft } from '@/lib/ai/features';
import { createDraft } from '@/lib/db/ai';

/** AI 故事整理：把人生故事关联的记录串成叙事草稿，不触碰原故事正文 */
export const POST = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await req.json();
  const parsed = aiStorySchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const result = await storyDraft(user.id, parsed.data.entry_ids);
  if (result.entryCount === 0) {
    return fail(404, 'NOT_FOUND', '这些记录不存在或不属于你');
  }
  const draft = createDraft(user.id, {
    kind: 'story',
    title: '故事整理草稿',
    content: result.draft,
    meta: { entryIds: parsed.data.entry_ids, entryCount: result.entryCount },
    sourceEntryIds: result.sources,
    isMock: result.mock,
  });
  return ok({ draft });
});
