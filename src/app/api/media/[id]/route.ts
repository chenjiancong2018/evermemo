import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { NextRequest } from 'next/server';
import { UPLOADS_DIR } from '@/lib/config';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { mediaPatchSchema } from '@/lib/api/schemas';
import { deleteMediaRow, getMedia, patchMedia } from '@/lib/db/media';

type Ctx = { params: Promise<Record<string, string>> };

export const GET = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const media = getMedia(user.id, id);
  if (!media) return fail(404, 'NOT_FOUND', '图片不存在');
  return ok(media);
});

export const PATCH = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = mediaPatchSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const media = patchMedia(user.id, id, {
    caption: parsed.data.caption,
    is_favorite: parsed.data.is_favorite,
  });
  if (!media) return fail(404, 'NOT_FOUND', '图片不存在');
  return ok(media);
});

export const DELETE = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const media = deleteMediaRow(user.id, id);
  if (!media) return fail(404, 'NOT_FOUND', '图片不存在');
  for (const p of [media.storage_path, media.thumbnail_path]) {
    if (!p) continue;
    try {
      unlinkSync(join(UPLOADS_DIR, p));
    } catch {
      /* 文件已不存在 */
    }
  }
  return ok({ deleted: true });
});
