import type { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/api/http';
import { UPLOADS_DIR } from '@/lib/config';
import { buildPhotoZipEntry, dedupeFileName } from '@/lib/media/zipPath';

export const dynamic = 'force-dynamic';

/**
 * 照片打包导出（zip）：全部原始照片 + 缩略图可选。
 * 文件名含用户昵称，附件下载。yazl 纯 JS 流式打包，不占内存。
 */
export async function GET(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const includeThumbs = new URL(req.url).searchParams.get('thumbs') === '1';
  const db = getDb();
  const media = db
    .prepare(`SELECT id, storage_path, thumbnail_path, file_name, captured_at, created_at FROM media WHERE user_id = ? ORDER BY COALESCE(captured_at, created_at) DESC`)
    .all(user.id) as unknown as { id: string; storage_path: string; thumbnail_path: string | null; file_name: string; captured_at: string | null; created_at: string }[];
  if (media.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: { code: 'EMPTY', message: '还没有可导出的照片' } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { default: yazl } = await import('yazl');
  const zip = new yazl.ZipFile();
  const seen = new Set<string>();
  for (const m of media) {
    const rel = m.storage_path;
    const abs = path.join(UPLOADS_DIR, rel);
    if (fs.existsSync(abs) && !seen.has(rel)) {
      // 按拍摄日期分目录（EXIF 拍摄时间优先，缺失时回退上传时间）：
      // 照片/2026-11/20261108_原文件名.jpg
      const { dir, fileName } = buildPhotoZipEntry({
        id: m.id,
        file_name: m.file_name,
        captured_at: m.captured_at,
        created_at: m.created_at,
      });
      const finalName = dedupeFileName(dir, fileName, seen);
      seen.add(finalName);
      zip.addFile(abs, `照片/${finalName}`);
      if (includeThumbs && m.thumbnail_path) {
        const thumbAbs = path.join(UPLOADS_DIR, m.thumbnail_path);
        if (fs.existsSync(thumbAbs)) {
          zip.addFile(thumbAbs, `缩略图/${finalName}`);
        }
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `evermemo-photos-${today}.zip`;
  // yazl 的 outputStream 是 Node Readable，直接交给 Response（本项目 TS 环境里 BodyInit 即 Node Readable）
  const body = zip.outputStream as unknown as BodyInit;
  zip.end();
  return new Response(body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
