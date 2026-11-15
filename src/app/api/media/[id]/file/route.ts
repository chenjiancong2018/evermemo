import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { UPLOADS_DIR } from '@/lib/config';
import { getSessionUser } from '@/lib/auth/session';
import { getMedia } from '@/lib/db/media';
import { fail } from '@/lib/api/http';

type Ctx = { params: Promise<Record<string, string>> };

/** 私有图片访问：校验登录 Cookie 后返回原图（供 <img> 直接引用） */
export async function GET(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return fail(401, 'UNAUTHORIZED', '请先登录');
  const { id } = await ctx.params;
  const media = getMedia(user.id, id);
  if (!media) return fail(404, 'NOT_FOUND', '图片不存在');

  const abs = join(UPLOADS_DIR, media.storage_path);
  try {
    const buf = readFileSync(abs);
    const size = statSync(abs).size;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': media.mime_type,
        'Content-Length': String(size),
        'Cache-Control': 'private, max-age=3600',
        'Vary': 'Cookie',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return fail(404, 'FILE_MISSING', '图片文件缺失');
  }
}
