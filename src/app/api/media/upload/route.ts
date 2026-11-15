import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NextRequest } from 'next/server';
import { UPLOADS_DIR, MAX_IMAGE_BYTES } from '@/lib/config';
import { apiHandler, fail, ok, requireUser, assertSameOrigin, HttpError } from '@/lib/api/http';
import { createMedia } from '@/lib/db/media';
import { parseExifDateTime } from '@/lib/image/exif';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const FORMAT_EXT: Record<string, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
};

export const POST = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();

  const form = await req.formData();
  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (files.length === 0) return fail(400, 'NO_FILE', '请选择图片');
  if (files.length > 30) return fail(400, 'TOO_MANY', '一次最多上传 30 张图片');

  const entryId = (form.get('entry_id') as string | null) ?? null;
  const results = [];

  for (const file of files) {
    if (file.size <= 0) continue;
    if (file.size > MAX_IMAGE_BYTES) {
      throw new HttpError(400, 'TOO_LARGE', `图片「${file.name}」超过 20MB 限制`);
    }
    const declaredMime = file.type || 'image/jpeg';
    if (!EXT_BY_MIME[declaredMime]) {
      throw new HttpError(400, 'BAD_TYPE', `「${file.name}」不是支持的图片格式（JPG/PNG/WEBP）`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // 用 sharp 校验真实格式，防止伪装文件
    let sharpLib: typeof import('sharp') | null = null;
    let format = '';
    let width: number | null = null;
    let height: number | null = null;
    let exifBuf: Buffer | undefined;
    try {
      sharpLib = (await import('sharp')).default;
      const meta = await sharpLib(buffer).metadata();
      format = meta.format ?? '';
      width = meta.width ?? null;
      height = meta.height ?? null;
      exifBuf = meta.exif;
    } catch {
      throw new HttpError(400, 'BAD_IMAGE', `「${file.name}」不是有效的图片文件`);
    }
    const ext = FORMAT_EXT[format];
    if (!ext) {
      throw new HttpError(400, 'BAD_TYPE', `「${file.name}」不是支持的图片格式（JPG/PNG/WEBP）`);
    }

    const id = randomUUID();
    const relDir = user.id;
    const absDir = join(UPLOADS_DIR, relDir);
    mkdirSync(absDir, { recursive: true });

    const relPath = `${relDir}/${id}.${ext}`;
    writeFileSync(join(UPLOADS_DIR, relPath), buffer);

    // 缩略图（失败则降级为无缩略图，不阻断上传）
    let thumbnailPath: string | null = null;
    if (sharpLib) {
      try {
        const thumbDir = join(UPLOADS_DIR, relDir, 'thumbs');
        mkdirSync(thumbDir, { recursive: true });
        const relThumb = `${relDir}/thumbs/${id}.webp`;
        await sharpLib(buffer)
          .rotate()
          .resize({ width: 480, withoutEnlargement: true })
          .webp({ quality: 75 })
          .toFile(join(UPLOADS_DIR, relThumb));
        thumbnailPath = relThumb;
      } catch {
        thumbnailPath = null;
      }
    }

    // EXIF 拍摄时间
    const capturedAt = exifBuf ? parseExifDateTime(exifBuf) : null;

    const row = createMedia(user.id, {
      file_name: file.name,
      storage_path: relPath,
      mime_type: declaredMime,
      file_size: file.size,
      thumbnail_path: thumbnailPath,
      captured_at: capturedAt,
      entry_id: entryId,
      width,
      height,
    });
    results.push(row);
  }

  return ok({ items: results });
});
