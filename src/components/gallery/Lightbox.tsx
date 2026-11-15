'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Heart, Link2, PencilLine, X } from 'lucide-react';
import { api } from '@/lib/api/client';
import type { MediaRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

export interface LightboxMedia {
  id: string;
  entryId: string | null;
  caption: string | null;
  isFavorite: boolean;
  capturedAt: string | null;
  createdAt: string;
}

interface LightboxProps {
  items: LightboxMedia[];
  initialIndex?: number;
  onClose: () => void;
  /** 关闭时重置索引 */
  onMediaChange?: (id: string, patch: { caption?: string; isFavorite?: boolean }) => void;
}

export function Lightbox({ items, initialIndex = 0, onClose, onMediaChange }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [editingCaption, setEditingCaption] = useState(false);
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const item = items[Math.min(index, items.length - 1)];

  const prev = useCallback(
    () => setIndex((i) => (i - 1 + items.length) % items.length),
    [items.length]
  );
  const next = useCallback(
    () => setIndex((i) => (i + 1) % items.length),
    [items.length]
  );

  useEffect(() => {
    setCaption(item?.caption ?? '');
    setEditingCaption(false);
  }, [index, item?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next]);

  async function toggleFavorite() {
    if (!item) return;
    try {
      await api(`/api/media/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_favorite: !item.isFavorite }),
      });
      onMediaChange?.(item.id, { isFavorite: !item.isFavorite });
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error');
    }
  }

  async function saveCaption() {
    if (!item) return;
    setSaving(true);
    try {
      const trimmed = caption.trim();
      await api(`/api/media/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ caption: trimmed }),
      });
      onMediaChange?.(item.id, { caption: trimmed });
      setEditingCaption(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!item) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/92 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 顶栏 */}
      <div
        className="flex items-center gap-3 px-4 py-3 text-white/90"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="rounded-full p-2 transition-colors hover:bg-white/10"
          aria-label="关闭"
        >
          <X size={20} />
        </button>
        <span className="text-[13px] text-white/60">
          {index + 1} / {items.length}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {item.entryId && (
            <button
              onClick={() => {
                onClose();
                router.push(`/entries/${item.entryId}`);
              }}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] transition-colors hover:bg-white/10"
            >
              <Link2 size={15} />
              查看记录
            </button>
          )}
          <button
            onClick={toggleFavorite}
            className={cn(
              'rounded-full p-2 transition-colors hover:bg-white/10',
              item.isFavorite && 'text-[#E8B4A0]'
            )}
            aria-label={item.isFavorite ? '取消收藏' : '收藏'}
          >
            <Heart size={19} fill={item.isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* 图片 */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2" onClick={onClose}>
        {items.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-2 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 sm:left-5"
            aria-label="上一张"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={item.id}
          src={`/api/media/${item.id}/file`}
          alt={item.caption ?? '照片'}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        {items.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-2 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 sm:right-5"
            aria-label="下一张"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {/* 底栏：说明 */}
      <div className="px-4 pb-4 pt-3" onClick={(e) => e.stopPropagation()}>
        {editingCaption ? (
          <div className="mx-auto flex max-w-2xl gap-2">
            <input
              autoFocus
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveCaption();
                if (e.key === 'Escape') setEditingCaption(false);
              }}
              placeholder="写一句照片说明…"
              className="w-full rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-[14px] text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none"
            />
            <button
              onClick={saveCaption}
              disabled={saving}
              className="rounded-xl bg-white px-4 py-2 text-[13px] font-medium text-black disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-3 text-center">
            <p className="min-h-[20px] text-[13.5px] text-white/80">
              {item.caption || '（无说明）'}
            </p>
            <button
              onClick={() => setEditingCaption(true)}
              className="shrink-0 rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="编辑说明"
            >
              <PencilLine size={14} />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
