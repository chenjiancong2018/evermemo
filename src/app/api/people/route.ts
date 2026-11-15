import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser } from '@/lib/api/http';
import { archiveListQuerySchema, personCreateSchema } from '@/lib/api/schemas';
import { createPerson, listPeople } from '@/lib/db/people';

/** GET /api/people — 人物列表（支持 q 搜索） */
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const parsed = archiveListQuerySchema.safeParse(Object.fromEntries(sp.entries()));
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const result = listPeople(user.id, {
    page: parsed.data.page,
    page_size: parsed.data.page_size,
    q: parsed.data.q,
  });
  return ok(result);
});

/** POST /api/people — 新增人物 */
export const POST = apiHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = personCreateSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const person = createPerson(user.id, parsed.data);
  return ok(person);
});
