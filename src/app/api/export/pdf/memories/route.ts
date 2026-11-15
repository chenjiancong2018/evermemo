import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { apiHandler, requireUser, fail } from '@/lib/api/http';
import { listEntries } from '@/lib/db/entries';
import { listMedia } from '@/lib/db/media';
import { listMilestones } from '@/lib/db/milestones';
import { listChapters } from '@/lib/db/chapters';
import { buildAlbumPdf, type AlbumPhoto } from '@/lib/pdf/buildPdf';
import { UPLOADS_DIR } from '@/lib/config';

export const GET = apiHandler(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const y = Number(url.searchParams.get('year'));
  if (!Number.isInteger(y) || y < 1970 || y > 2200) return fail(400, 'VALIDATION', '年份不正确');

  const entries = listEntries(user.id, { page: 1, page_size: 500, year: y });
  const media = listMedia(user.id, { page: 1, page_size: 500, year: String(y) });
  const milestones = listMilestones(user.id, { page: 1, page_size: 100, year: y });
  const chapters = listChapters(user.id, { page: 1, page_size: 100 });
  const yearChapters = chapters.items.filter((c) => {
    const s = c.start_date ? Number(c.start_date.slice(0, 4)) : null;
    const e = c.end_date ? Number(c.end_date.slice(0, 4)) : null;
    if (!s && !e) return false;
    return (s === null || s <= y) && (e === null || e >= y);
  });

  // 读入这一年的照片字节用于照片墙（单本最多 60 张，缺失/损坏的文件跳过）
  // 优先用缩略图并压成 JPEG（900px 宽、q78）控制 PDF 体积；缩略图缺失则回退原图。
  const photos: AlbumPhoto[] = [];
  for (const m of media.items.slice(0, 60)) {
    try {
      const thumbPath = m.thumbnail_path ? join(UPLOADS_DIR, m.thumbnail_path) : null;
      const source = thumbPath && existsSync(thumbPath) ? thumbPath : join(UPLOADS_DIR, m.storage_path);
      let buffer: Buffer;
      try {
        buffer = await sharp(source).rotate().resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
      } catch {
        buffer = readFileSync(source);
      }
      photos.push({
        buffer,
        date: (m.captured_at ?? m.created_at).slice(0, 10),
        caption: m.caption ?? '',
      });
    } catch {
      /* 文件缺失则跳过 */
    }
  }

  const pdf = await buildAlbumPdf({
    year: y,
    entries: entries.items,
    photoCount: media.total,
    milestoneCount: milestones.total,
    chapterCount: yearChapters.length,
    userName: user.display_name,
    photos,
  });
  return new NextResponse(Readable.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="evermemo-album-${y}.pdf"`,
    },
  });
});
