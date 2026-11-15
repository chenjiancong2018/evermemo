/**
 * 照片 ZIP 内的路径规划：按拍摄日期分目录。
 *
 * 规则（与 /api/export/photos 一致）：
 * - 拍摄日期优先取 EXIF 拍摄时间（captured_at），缺失时回退上传时间（created_at）
 * - 目录为「YYYY-MM」，无日期时归入「未知日期」
 * - 文件名前缀「YYYYMMDD_」，同名时追加 _1、_2 后缀
 */

export interface PhotoZipMeta {
  id: string;
  file_name: string | null;
  captured_at: string | null;
  created_at: string;
}

export interface PhotoZipEntry {
  /** 目录，不含末尾斜杠，如 2026-11 或 未知日期 */
  dir: string;
  /** 文件名，已含日期前缀 */
  fileName: string;
  /** 是否为未知日期（无可用日期） */
  undated: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function photoDateOf(meta: Pick<PhotoZipMeta, 'captured_at' | 'created_at'>): string {
  const captured = (meta.captured_at ?? '').slice(0, 10);
  if (DATE_RE.test(captured)) return captured;
  const created = (meta.created_at ?? '').slice(0, 10);
  if (DATE_RE.test(created)) return created;
  return '';
}

/** 根据媒体元数据计算 zip 内目录与文件名（未做重名处理，重名由调用方加后缀）。 */
export function buildPhotoZipEntry(meta: PhotoZipMeta): PhotoZipEntry {
  const date = photoDateOf(meta);
  const base = meta.file_name && meta.file_name.trim() ? meta.file_name : `${meta.id}.jpg`;
  if (!date) {
    return { dir: '未知日期', fileName: base, undated: true };
  }
  return {
    dir: date.slice(0, 7),
    fileName: `${date.replace(/-/g, '')}_${base}`,
    undated: false,
  };
}

/** 在目录内为文件名去重：`a.jpg` 重复时变为 `a_1.jpg`。 */
export function dedupeFileName(dir: string, fileName: string, seen: Set<string>): string {
  let candidate = `${dir}/${fileName}`;
  let n = 1;
  while (seen.has(candidate)) {
    candidate = `${dir}/${fileName.replace(/(\.[^.]+)$/, `_${n}$1`)}`;
    n += 1;
  }
  return candidate;
}
