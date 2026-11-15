import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser } from '@/lib/api/http';
import { archiveListQuerySchema, placeCreateSchema } from '@/lib/api/schemas';
import { createPlace, listPlaces } from '@/lib/db/places';

/** GET /api/places — 地点列表（支持 q 搜索） */
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const parsed = archiveListQuerySchema.safeParse(Object.fromEntries(sp.entries()));
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const result = listPlaces(user.id, {
    page: parsed.data.page,
    page_size: parsed.data.page_size,
    q: parsed.data.q,
  });
  return ok(result);
});

/** POST /api/places — 新增地点 */
export const POST = apiHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = placeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const place = createPlace(user.id, parsed.data);
  return ok(place);
});
