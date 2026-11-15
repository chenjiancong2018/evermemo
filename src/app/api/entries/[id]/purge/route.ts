import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { NextRequest } from 'next/server';
import { UPLOADS_DIR } from '@/lib/config';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { destroyEntry } from '@/lib/db/entries';

type Ctx = { params: Promise<Record<string, string>> };

/** 彻底删除回收站记录，连同其媒体文件 */
export const POST = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await ctx.params;
  const media = destroyEntry(user.id, id);
  for (const m of media) {
    for (const p of [m.storage_path, m.thumbnail_path]) {
      if (!p) continue;
      try {
        unlinkSync(join(UPLOADS_DIR, p));
      } catch {
        /* 文件已不存在 */
      }
    }
  }
  return ok({ destroyed: true });
});
