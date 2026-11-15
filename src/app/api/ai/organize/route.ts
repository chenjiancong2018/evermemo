import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { aiOrganizeSchema } from '@/lib/api/schemas';
import { organizeEntry } from '@/lib/ai/features';
import { createDraft } from '@/lib/db/ai';

/** AI 记录整理：生成建议草稿（标题/标签/类型/润色），不触碰原记录 */
export const POST = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await req.json();
  const parsed = aiOrganizeSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const result = await organizeEntry(user.id, parsed.data.content);
  const draft = createDraft(user.id, {
    kind: 'organize',
    title: result.title,
    content: result.polished,
    meta: { tags: result.tags, entry_type: result.entry_type, suggested_title: result.title },
    isMock: result.mock,
  });
  return ok({ draft, result });
});
