import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser } from '@/lib/api/http';
import { archiveListQuerySchema, chapterCreateSchema } from '@/lib/api/schemas';
import { createChapter, listChapters } from '@/lib/db/chapters';

/** GET /api/chapters — 人生故事列表（支持 q 搜索） */
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const parsed = archiveListQuerySchema.safeParse(Object.fromEntries(sp.entries()));
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const result = listChapters(user.id, {
    page: parsed.data.page,
    page_size: parsed.data.page_size,
    q: parsed.data.q,
  });
  return ok(result);
});

/** POST /api/chapters — 新增人生故事 */
export const POST = apiHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = chapterCreateSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const chapter = createChapter(user.id, parsed.data);
  return ok(chapter);
});
