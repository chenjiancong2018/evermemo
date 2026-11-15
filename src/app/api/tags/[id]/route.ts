import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { deleteTag } from '@/lib/db/tags';

type Ctx = { params: Promise<Record<string, string>> };

export const DELETE = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const done = deleteTag(user.id, id);
  if (!done) return fail(404, 'NOT_FOUND', '标签不存在');
  return ok({ deleted: true });
});
