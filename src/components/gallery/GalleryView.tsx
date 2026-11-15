'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Heart, Search as SearchIcon } from 'lucide-react';
import { api, qs } from '@/lib/api/client';
import type { MediaRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/spinner';
import { Lightbox, type LightboxMedia } from '@/components/gallery/Lightbox';

interface MediaListResult {
  items: MediaRow[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

const PAGE_SIZE = 48;

export function GalleryView() {
  const [items, setItems] = useState<MediaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onlyFav, setOnlyFav] = useState(false);
  const [q, setQ] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const reqSeq = useRef(0);

  const load = useCallback(
    async (targetPage: number, reset: boolean) => {
      const seq = ++reqSeq.current;
      if (reset) setLoading(true);
      try {
        const res = await api<MediaListResult>(
          `/api/media${qs({
            page: targetPage,
            page_size: PAGE_SIZE,
            favorite: onlyFav ? '1' : undefined,
            q: q.trim() || undefined,
          })}`
        );
        if (seq !== reqSeq.current) return;
        setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
        setPage(targetPage);
        setHasMore(res.has_more);
      } catch {
        /* 静默失败，保留已有内容 */
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    },
    [onlyFav, q]
  );

  useEffect(() => {
    void load(1, true);
  }, [load]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          void load(page + 1, false);
        }
      },
      { rootMargin: '500px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, page, load]);

  const lbItems: LightboxMedia[] = items.map((m) => ({
    id: m.id,
    entryId: m.entry_id,
    caption: m.caption,
    isFavorite: m.is_favorite === 1,
    capturedAt: m.captured_at,
    createdAt: m.created_at,
  }));

  return (
    <div className="space-y-4">
      {/* 筛选 */}
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[180px] flex-1">
          <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索照片说明…"
            className="input-base !pl-9"
          />
        </div>
        <button
          onClick={() => setOnlyFav((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] transition-colors',
            onlyFav
              ? 'border-[#E8B4A0] bg-[#E8B4A0]/10 text-[#C98F74]'
              : 'border-border text-muted hover:text-accent'
          )}
        >
          <Heart size={14} fill={onlyFav ? 'currentColor' : 'none'} />
          只看收藏
        </button>
        <span className="ml-auto text-[12px] text-muted">{total} 张照片</span>
      </div>

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton aspect-square rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Camera size={30} />}
            title={onlyFav || q ? '没有符合条件的照片' : '画廊还是空的'}
            hint={onlyFav || q ? '试试调整筛选条件' : '在记录里上传照片，它们会出现在这里'}
          />
        </div>
      ) : (
        <div className="masonry">
          {items.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setLightboxIndex(items.findIndex((x) => x.id === m.id))}
              className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl bg-accent-soft text-left"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/media/${m.id}/thumb`}
                alt={m.caption || m.file_name}
                loading="lazy"
                className="w-full transition-transform duration-300 group-hover:scale-[1.03]"
                style={{ aspectRatio: `${m.width || 4} / ${m.height || 3}` }}
              />
              {(m.caption || m.is_favorite) && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6">
                  {m.is_favorite && (
                    <Heart size={13} className="shrink-0 text-[#E8B4A0]" fill="currentColor" />
                  )}
                  {m.caption && (
                    <span className="truncate text-[12px] text-white/90">{m.caption}</span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-6">
        {loading && items.length > 0 && (
          <div className="py-3 text-center text-[12.5px] text-muted">加载中…</div>
        )}
        {!hasMore && items.length > 0 && (
          <div className="py-3 text-center text-[12px] text-muted/70">—— 已到照片的尽头 ——</div>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          items={lbItems}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onMediaChange={(id, patch) => {
            setItems((prev) =>
              prev.map((m) =>
                m.id === id
                  ? {
                      ...m,
                      caption: patch.caption !== undefined ? patch.caption : m.caption,
                      is_favorite:
                        patch.isFavorite !== undefined
                          ? patch.isFavorite
                            ? 1
                            : 0
                          : m.is_favorite,
                    }
                  : m
              )
            );
          }}
        />
      )}
    </div>
  );
}
