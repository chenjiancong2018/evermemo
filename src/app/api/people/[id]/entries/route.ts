import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser } from '@/lib/api/http';
import { listPersonEntries, personWithMeta } from '@/lib/db/people';

type Ctx = { params: Promise<Record<string, string>> };

/** GET /api/people/[id]/entries — 人物相关的记录（分页） */
export const GET = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get('page') ?? '1') || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get('page_size') ?? '30') || 30));
  if (!personWithMeta(id, user.id)) return fail(404, 'NOT_FOUND', '人物不存在');
  const result = listPersonEntries(user.id, id, page, pageSize);
  return ok(result);
});
