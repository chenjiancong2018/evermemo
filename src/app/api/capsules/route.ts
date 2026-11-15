import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { capsuleCreateSchema, capsuleListQuerySchema } from '@/lib/api/schemas';
import { createCapsule, listCapsules } from '@/lib/db/capsules';
import { assertVaultReady } from '@/lib/api/vaultGuard';

/** 记忆胶囊列表 + 创建 */
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const parsed = capsuleListQuerySchema.safeParse({
    page: url.searchParams.get('page') ?? undefined,
    page_size: url.searchParams.get('page_size') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
  });
  if (!parsed.success) return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  const data = listCapsules(user.id, parsed.data);
  return ok(data);
});

export const POST = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await req.json();
  const parsed = capsuleCreateSchema.safeParse(body);
  if (!parsed.success) return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  assertVaultReady(user.id);
  const capsule = createCapsule(user.id, parsed.data);
  return ok(capsule);
});
