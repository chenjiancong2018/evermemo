'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import type { EntryWithMeta } from '@/lib/types';
import { Spinner } from '@/components/ui/spinner';
import { EntryCard } from '@/components/entry/EntryCard';

interface Props {
  personId: string;
}

/** 人物详情：相关记录无限滚动 */
export function PersonEntries({ personId }: Props) {
  const [items, setItems] = useState<EntryWithMeta[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const reqSeq = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (p: number) => {
      const seq = ++reqSeq.current;
      setLoading(true);
      try {
        const r = await api<{ items: EntryWithMeta[]; total: number; has_more: boolean }>(
          `/api/people/${personId}/entries?page=${p}&page_size=10`
        );
        if (seq !== reqSeq.current) return;
        setItems((prev) => (p === 1 ? r.items : [...prev, ...r.items]));
        setHasMore(r.has_more);
        setPage(p);
      } catch {
        /* 静默失败 */
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    },
    [personId]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) load(page + 1);
      },
      { rootMargin: '400px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, page, load]);

  if (items.length === 0 && loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="py-8 text-center text-[13px] text-muted">还没有与 TA 相关的记录。编辑记录时关联这位人物即可。</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((e) => (
        <EntryCard key={e.id} entry={e} href={`/entries/${e.id}`} />
      ))}
      <div ref={sentinelRef} className="h-px" />
      {loading && (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      )}
    </div>
  );
}
