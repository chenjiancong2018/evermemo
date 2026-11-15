import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser, assertSameOrigin, HttpError } from '@/lib/api/http';
import { capsuleUpdateSchema } from '@/lib/api/schemas';
import { deleteCapsule, getCapsule, updateCapsule } from '@/lib/db/capsules';
import { assertVaultReady } from '@/lib/api/vaultGuard';

type Ctx = { params: Promise<Record<string, string>> };

/** 单条胶囊。未到期返回 content 为空 + openable=false（服务器端强制）。 */
export const GET = apiHandler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const capsule = getCapsule(user.id, id);
  if (!capsule) throw new HttpError(404, 'NOT_FOUND', '胶囊不存在');
  return ok(capsule);
});

/** 编辑（仅未到期可编辑）。 */
export const PATCH = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = capsuleUpdateSchema.safeParse(body);
  if (!parsed.success) return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  // 修改正文时保险库必须已解锁（否则无法安全重加密）
  if (parsed.data.content !== undefined) assertVaultReady(user.id);
  const capsule = updateCapsule(user.id, id, parsed.data);
  if (!capsule) {
    const existing = getCapsule(user.id, id);
    if (!existing) throw new HttpError(404, 'NOT_FOUND', '胶囊不存在');
    throw new HttpError(400, 'ALREADY_OPEN', '这封信已经开启，不能再修改了');
  }
  return ok(capsule);
});

/** 删除（已开启的胶囊可删除，这是归档整理，不是修改信件）。 */
export const DELETE = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const deleted = deleteCapsule(user.id, id);
  if (!deleted) throw new HttpError(404, 'NOT_FOUND', '胶囊不存在');
  return ok({ deleted: true });
});
