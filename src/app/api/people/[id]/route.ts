import type { NextRequest } from 'next/server';
import { apiHandler, assertSameOrigin, fail, ok, requireUser } from '@/lib/api/http';
import { personUpdateSchema } from '@/lib/api/schemas';
import { deletePerson, personWithMeta, updatePerson } from '@/lib/db/people';
import { unlinkMediaFiles } from '@/lib/api/mediaFiles';

type Ctx = { params: Promise<Record<string, string>> };

/** GET /api/people/[id] — 人物详情（含头像、关联统计、共同里程碑） */
export const GET = apiHandler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const person = personWithMeta(id, user.id);
  if (!person) return fail(404, 'NOT_FOUND', '人物不存在');
  return ok(person);
});

/** PATCH /api/people/[id] — 编辑人物 */
export const PATCH = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = personUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const person = updatePerson(user.id, id, parsed.data);
  if (!person) return fail(404, 'NOT_FOUND', '人物不存在');
  return ok(person);
});

/** DELETE /api/people/[id] — 删除人物（硬删除，连同头像媒体） */
export const DELETE = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const avatar = deletePerson(user.id, id);
  if (avatar === null) return fail(404, 'NOT_FOUND', '人物不存在');
  unlinkMediaFiles(avatar);
  return ok({ deleted: true });
});
