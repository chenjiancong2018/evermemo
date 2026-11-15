'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import type { MediaRow } from '@/lib/types';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export interface CoverPickerProps {
  /** 当前封面 media.id（可空） */
  mediaId: string | null;
  /** 封面已上传时的 MediaRow 元数据（编辑模式由服务端提供） */
  current?: MediaRow | null;
  onChange: (mediaId: string | null, media?: MediaRow) => void;
  /** 方形头像样式 */
  round?: boolean;
}

/** 单张封面/头像选择：上传或移除，一次一张 */
export function CoverPicker({ mediaId, current, onChange, round = false }: CoverPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<MediaRow | null>(current ?? null);
  const { toast } = useToast();

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      toast('请选择 JPG、PNG 或 WebP 图片', 'error');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/media/upload', { method: 'POST', body: form });
      const env = await res.json();
      if (env.ok && env.data?.items?.length) {
        const row = env.data.items[0] as MediaRow;
        setPreview(row);
        onChange(row.id, row);
      } else {
        throw new Error(env.error?.message ?? '上传失败');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '上传失败', 'error');
    } finally {
      setUploading(false);
    }
  }

  function remove() {
    setPreview(null);
    onChange(null);
  }

  const mediaRef = preview?.id ?? mediaId;
  const src = mediaRef ? `/api/media/${mediaRef}/thumb` : null;
  const hasImage = Boolean(mediaRef);

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFiles}
      />
      <div
        className={cn(
          'relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden border-2 border-dashed border-border bg-background/60',
          round ? 'rounded-full' : 'rounded-xl',
          hasImage && 'border-solid border-accent/40'
        )}
      >
        {uploading ? (
          <Loader2 size={20} className="animate-spin text-accent" />
        ) : src ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className={cn('h-full w-full', round ? 'rounded-full object-cover' : 'object-cover')} />
            <button
              type="button"
              onClick={remove}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-danger"
              aria-label="移除封面"
            >
              <X size={11} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted hover:text-accent"
          >
            <ImagePlus size={18} />
            <span className="text-[11px]">上传图片</span>
          </button>
        )}
      </div>
      {hasImage && !uploading && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-[12.5px] text-muted hover:text-accent hover:underline"
        >
          更换
        </button>
      )}
    </div>
  );
}
