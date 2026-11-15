import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser } from '@/lib/api/http';
import { mediaListQuerySchema } from '@/lib/api/schemas';
import { listMedia } from '@/lib/db/media';

export const GET = apiHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const parsed = mediaListQuerySchema.safeParse(Object.fromEntries(sp.entries()));
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const q = parsed.data;
  const result = listMedia(user.id, {
    page: q.page,
    page_size: q.page_size,
    tag: q.tag,
    favorite: q.favorite === '1',
    entry_id: q.entry_id,
    q: q.q,
  });
  return ok(result);
});
