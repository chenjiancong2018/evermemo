import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { tagCreateSchema } from '@/lib/api/schemas';
import { createTag, listTags } from '@/lib/db/tags';

export const GET = apiHandler(async (req: NextRequest) => {
  const user = await requireUser();
  return ok({ items: listTags(user.id) });
});

export const POST = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await req.json();
  const parsed = tagCreateSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const tag = createTag(user.id, parsed.data.name, parsed.data.color);
  return ok(tag);
});
