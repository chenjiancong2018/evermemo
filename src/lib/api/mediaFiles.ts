import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { NextRequest } from 'next/server';
import { UPLOADS_DIR } from '@/lib/config';
import type { MediaRow } from '@/lib/types';

/** 删除媒体行对应的磁盘文件（不存在则忽略） */
export function unlinkMediaFiles(media: MediaRow | null): void {
  if (!media) return;
  for (const p of [media.storage_path, media.thumbnail_path]) {
    if (!p) continue;
    try {
      unlinkSync(join(UPLOADS_DIR, p));
    } catch {
      /* 文件已不存在 */
    }
  }
}
