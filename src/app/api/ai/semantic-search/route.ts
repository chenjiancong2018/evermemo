import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { aiSemanticSearchSchema } from '@/lib/api/schemas';
import { semanticSearch } from '@/lib/ai/semantic';

/** 语义搜索：向量相似度（配置 AI 时）或关键词降级，无结果时如实说明 */
export const POST = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await req.json();
  const parsed = aiSemanticSearchSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const result = await semanticSearch(user.id, parsed.data.query);
  return ok({
    mode: result.mode,
    note: result.note,
    hits: result.hits.map((h) => ({
      score: Number(h.score.toFixed(3)),
      entry: {
        id: h.entry.id,
        title: h.entry.title,
        content: h.entry.content,
        entry_type: h.entry.entry_type,
        occurred_at: h.entry.occurred_at,
        mood: h.entry.mood,
        is_favorite: h.entry.is_favorite,
        is_important: h.entry.is_important,
      },
    })),
  });
});
