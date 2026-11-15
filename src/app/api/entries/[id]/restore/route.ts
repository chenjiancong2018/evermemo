import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { restoreEntry } from '@/lib/db/entries';

type Ctx = { params: Promise<Record<string, string>> };

/** 从回收站恢复 */
export const POST = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const done = restoreEntry(user.id, id);
  if (!done) return fail(404, 'NOT_FOUND', '回收站中不存在该记录');
  return ok({ restored: true });
});
