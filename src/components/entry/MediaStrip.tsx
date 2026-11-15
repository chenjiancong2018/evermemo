'use client';

import type { MediaRow } from '@/lib/types';

interface MediaStripProps {
  media: MediaRow[];
  /** 预览大图（点击回调，用于灯箱） */
  onPreview?: (media: MediaRow) => void;
  /** 移除（表单场景），不传则只展示 */
  onRemove?: (mediaId: string) => void;
}

/** 记录配图网格 */
export function MediaStrip({ media, onPreview, onRemove }: MediaStripProps) {
  if (media.length === 0) return null;
  const cols = media.length === 1 ? 'grid-cols-1' : media.length === 2 ? 'grid-cols-2' : 'grid-cols-3';
  return (
    <div className={`grid gap-2 ${cols}`}>
      {media.map((m) => (
        <div
          key={m.id}
          className="group/img relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-accent-soft"
          onClick={() => onPreview?.(m)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/media/${m.id}/thumb`}
            alt={m.caption || m.file_name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover/img:scale-105"
          />
          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(m.id);
              }}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[11px] text-white opacity-0 transition-opacity hover:bg-danger group-hover/img:opacity-100"
              aria-label="移除图片"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
