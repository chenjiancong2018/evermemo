'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import type { EntryWithMeta, MediaRow } from '@/lib/types';
import { EntryCard } from '@/components/entry/EntryCard';
import { Spinner, EmptyState } from '@/components/ui/spinner';
import { Heart } from 'lucide-react';

type Tab = 'entries' | 'photos';

export function FavoritesView() {
  const [tab, setTab] = useState<Tab>('entries');
  const [entries, setEntries] = useState<EntryWithMeta[]>([]);
  const [photos, setPhotos] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalE, setTotalE] = useState(0);
  const [totalP, setTotalP] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const reqSeq = useRef(0);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const loadEntries = useCallback(async (reset: boolean) => {
    const seq = ++reqSeq.current;
    const p = reset ? 1 : page;
    if (!reset) setLoadingMore(true);
    try {
      const data = await api<{ items: EntryWithMeta[]; total: number }>(
        `/api/entries?favorite=1&page=${p}&page_size=20`
      );
      if (seq !== reqSeq.current) return;
      setEntries((prev) => (reset ? data.items : [...prev, ...data.items]));
      setTotalE(data.total);
      setHasMore(data.items.length === 20 && data.items.length + (reset ? 0 : (p - 1) * 20) < data.total);
      if (reset) setPage(1);
    } finally {
      if (seq === reqSeq.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [page]);

  const loadPhotos = useCallback(async (reset: boolean) => {
    const seq = ++reqSeq.current;
    const p = reset ? 1 : page;
    if (!reset) setLoadingMore(true);
    try {
      const data = await api<{ items: MediaRow[]; total: number }>(
        `/api/media?favorite=1&page=${p}&page_size=30`
      );
      if (seq !== reqSeq.current) return;
      setPhotos((prev) => (reset ? data.items : [...prev, ...data.items]));
      setTotalP(data.total);
      setHasMore(data.items.length === 30);
      if (reset) setPage(1);
    } finally {
      if (seq === reqSeq.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [page]);

  useEffect(() => {
    setLoading(true);
    if (tab === 'entries') loadEntries(true);
    else loadPhotos(true);
  }, [tab, loadEntries, loadPhotos]);

  // 预取两个 Tab 的计数，让未激活 Tab 的数字也正确
  useEffect(() => {
    api<{ total: number }>('/api/entries?favorite=1&page=1&page_size=1')
      .then((d) => setTotalE(d.total))
      .catch(() => {});
    api<{ total: number }>('/api/media?favorite=1&page=1&page_size=1')
      .then((d) => setTotalP(d.total))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((p) => p + 1);
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  useEffect(() => {
    if (page > 1) {
      if (tab === 'entries') loadEntries(false);
      else loadPhotos(false);
    }
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = tab === 'entries' ? totalE : totalP;

  return (
    <div>
      <div className="mb-5 flex gap-1 rounded-xl border border-border bg-surface p-1">
        {(
          [
            ['entries', '收藏的记录'],
            ['photos', '收藏的照片'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
              tab === key ? 'bg-accent text-white' : 'text-muted hover:text-accent'
            }`}
          >
            {label}（{key === 'entries' ? totalE : totalP}）
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16">
          <Spinner />
        </div>
      ) : count === 0 ? (
        <EmptyState
          icon={<Heart size={28} />}
          title="还没有收藏"
          hint="在记录或照片上点亮心形，它们就会出现在这里。"
        />
      ) : tab === 'entries' ? (
        <div className="space-y-3">
          {entries.map((e) => (
            <EntryCard key={e.id} entry={e} href={`/entries/${e.id}`} />
          ))}
        </div>
      ) : (
        <div className="masonry">
          {photos.map((m) => (
            <div key={m.id} className="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/media/${m.id}/thumb`}
                alt={m.caption || '收藏照片'}
                className="w-full"
                style={m.width && m.height ? { aspectRatio: `${m.width}/${m.height}` } : undefined}
                loading="lazy"
              />
              {m.caption && <p className="px-3 py-2 text-[12px] text-muted">{m.caption}</p>}
            </div>
          ))}
        </div>
      )}

      {hasMore && !loading && <div ref={sentinel} className="h-10" />}
      {loadingMore && (
        <div className="py-6">
          <Spinner />
        </div>
      )}
    </div>
  );
}
