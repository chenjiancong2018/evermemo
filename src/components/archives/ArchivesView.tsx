'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, ArchiveRestore, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import type { EntryWithMeta } from '@/lib/types';
import { ENTRY_TYPE_LABELS, MOOD_COLORS } from '@/lib/types';
import { EmptyState, Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';

export default function ArchivesView() {
  const { toast } = useToast();
  const router = useRouter();
  const [items, setItems] = useState<EntryWithMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const reqSeq = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (p: number, reset: boolean) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    try {
      const data = await api<{ items: EntryWithMeta[]; total: number; has_more: boolean }>(
        `/api/entries?archived=1&page=${p}&page_size=20`
      );
      if (seq !== reqSeq.current) return;
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setTotal(data.total);
      setHasMore(data.has_more);
      setPage(p);
    } catch (err) {
      toast(err instanceof Error ? err.message : '加载失败', 'error');
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load(1, true);
  }, [load]);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void load(page + 1, false);
      },
      { rootMargin: '400px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, page, load]);

  const unarchive = async (id: string) => {
    setBusyId(id);
    try {
      await api(`/api/entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: false }),
      });
      toast('已取消归档，回到时间线', 'success');
      setItems((prev) => prev.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('把这条记录移入回收站？可随时从回收站恢复。')) return;
    setBusyId(id);
    try {
      await api(`/api/entries/${id}`, { method: 'DELETE' });
      toast('已移入回收站', 'success');
      setItems((prev) => prev.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {loading && items.length === 0 ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Archive size={22} className="text-muted" />}
          title="还没有归档的记录"
          hint="编辑记录时点「归档」按钮，就可以把它收进这里，从时间线里安静退场。"
        />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">
            共 {total} 条归档记录，不显示在时间线中。
            <span className="ml-1 inline-flex items-center gap-1">
              <ArrowLeft size={11} className="text-accent" /> 取消归档即回到时间线
            </span>
          </p>
          {items.map((e) => (
            <div
              key={e.id}
              className="card flex items-start gap-3 p-3.5 transition-colors hover:border-accent/40"
            >
              <Link href={`/entries/${e.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">
                    {ENTRY_TYPE_LABELS[e.entry_type]}
                  </span>
                  <span className="text-xs text-muted">{e.occurred_at.slice(0, 10)}</span>
                  {e.mood && (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: MOOD_COLORS[e.mood] }}
                      title={e.mood}
                    />
                  )}
                  {e.title ? (
                    <span className="truncate text-sm font-medium">{e.title}</span>
                  ) : (
                    <span className="truncate text-sm text-muted">（无标题）</span>
                  )}
                </div>
                {e.content && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                    {e.content.replace(/[#*`>\-[\]]/g, ' ').slice(0, 120)}
                  </p>
                )}
              </Link>
              <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                <button
                  onClick={() => void unarchive(e.id)}
                  disabled={busyId === e.id}
                  title="取消归档（回到时间线）"
                  className={cn(
                    'rounded p-1.5 text-muted transition-colors hover:bg-accent-soft hover:text-accent',
                    busyId === e.id && 'opacity-50'
                  )}
                >
                  <ArchiveRestore size={15} />
                </button>
                <button
                  onClick={() => void remove(e.id)}
                  disabled={busyId === e.id}
                  title="移入回收站"
                  className="rounded p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          <div ref={sentinelRef} className="h-1" />
          {loading && items.length > 0 && (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          )}
          {!hasMore && items.length > 0 && (
            <p className="py-4 text-center text-xs text-muted">已到底了</p>
          )}
        </div>
      )}
    </div>
  );
}
