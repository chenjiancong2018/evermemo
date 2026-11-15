'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import { api, qs } from '@/lib/api/client';
import type { EntryWithMeta, TagRow } from '@/lib/types';
import { ENTRY_TYPE_LABELS, ENTRY_TYPES, MOODS } from '@/lib/types';
import { cn, groupKey, groupTitle } from '@/lib/utils';
import { EntryCard } from '@/components/entry/EntryCard';
import { EmptyState, PageLoading } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

interface ListResult {
  items: EntryWithMeta[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

interface YearMonth {
  year: number;
  months: number[];
}

interface TimelineViewProps {
  allTags: TagRow[];
  yearMonths: YearMonth[];
}

type ViewMode = 'day' | 'month' | 'year';

const PAGE_SIZE = 30;

export function TimelineView({ allTags, yearMonths }: TimelineViewProps) {
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewMode>('day');
  const [type, setType] = useState('');
  const [mood, setMood] = useState('');
  const [tag, setTag] = useState('');
  const [year, setYear] = useState(searchParams.get('year') ?? '');
  const [month, setMonth] = useState(searchParams.get('month') ?? '');
  const [favorite, setFavorite] = useState(false);
  const [important, setImportant] = useState(false);
  const [archived, setArchived] = useState(searchParams.get('archived') === '1');
  const [showFilters, setShowFilters] = useState(searchParams.get('archived') === '1');

  const [items, setItems] = useState<EntryWithMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const sentinelRef = useRef<HTMLDivElement>(null);
  const reqSeq = useRef(0);

  const load = useCallback(
    async (targetPage: number, reset: boolean) => {
      const seq = ++reqSeq.current;
      if (reset) setLoading(true);
      setError('');
      try {
        const res = await api<ListResult>(
          `/api/entries${qs({
            page: targetPage,
            page_size: PAGE_SIZE,
            type,
            mood,
            tag,
            year: year || undefined,
            month: month || undefined,
            favorite: favorite ? '1' : undefined,
            important: important ? '1' : undefined,
            archived: archived ? '1' : undefined,
          })}`
        );
        if (seq !== reqSeq.current) return;
        setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
        setPage(targetPage);
        setHasMore(res.has_more);
      } catch (err) {
        if (seq !== reqSeq.current) return;
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    },
    [type, mood, tag, year, month, favorite, important, archived]
  );

  // 筛选变化时重新加载
  useEffect(() => {
    void load(1, true);
  }, [load]);

  // 滚动加载
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          void load(page + 1, false);
        }
      },
      { rootMargin: '400px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, page, load]);

  const groups = useMemo(() => {
    const map = new Map<string, EntryWithMeta[]>();
    for (const e of items) {
      const k = groupKey(e.occurred_at, view);
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [items, view]);

  const hasActiveFilters = Boolean(type || mood || tag || year || month || favorite || important || archived);

  function clearFilters() {
    setType('');
    setMood('');
    setTag('');
    setYear('');
    setMonth('');
    setFavorite(false);
    setImportant(false);
    setArchived(false);
  }

  const monthsOfYear = yearMonths.find((y) => y.year === Number(year))?.months ?? [];

  return (
    <div className="space-y-4">
      {/* 视图与筛选 */}
      <div className="card sticky top-0 z-30 bg-surface/95 p-3 backdrop-blur md:static md:top-auto">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-accent-soft p-0.5">
            {(['day', 'month', 'year'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'rounded-[10px] px-3 py-1.5 text-[12.5px] transition-colors',
                  view === v ? 'bg-accent text-white' : 'text-muted hover:text-accent'
                )}
              >
                {v === 'day' ? '日' : v === 'month' ? '月' : '年'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setMonth('');
              }}
              className="input-base !w-auto !px-2.5 !py-1.5 !text-[12.5px]"
              aria-label="年份"
            >
              <option value="">全部年份</option>
              {yearMonths.map((y) => (
                <option key={y.year} value={y.year}>
                  {y.year} 年
                </option>
              ))}
            </select>
            {year && (
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="input-base !w-auto !px-2.5 !py-1.5 !text-[12.5px]"
                aria-label="月份"
              >
                <option value="">全部月份</option>
                {monthsOfYear.map((m) => (
                  <option key={m} value={m}>
                    {m} 月
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12.5px] transition-colors',
              showFilters || hasActiveFilters
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border text-muted hover:text-accent'
            )}
          >
            <SlidersHorizontal size={14} />
            筛选{hasActiveFilters ? ' · 已启用' : ''}
          </button>

          <span className="ml-auto text-[12px] text-muted">共 {total} 条</span>
        </div>

        {showFilters && (
          <div className="animate-fade-in mt-3 space-y-2.5 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-muted">类型</span>
              {ENTRY_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(type === t ? '' : t)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[12px] transition-colors',
                    type === t ? 'border-accent bg-accent text-white' : 'border-border text-muted hover:text-accent'
                  )}
                >
                  {ENTRY_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-muted">心情</span>
              {MOODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMood(mood === m ? '' : m)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[12px] transition-colors',
                    mood === m ? 'border-accent bg-accent text-white' : 'border-border text-muted hover:text-accent'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-muted">标签</span>
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="input-base !w-auto !px-2.5 !py-1 !text-[12px]"
              >
                <option value="">全部</option>
                {allTags.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] text-muted has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent">
                <input
                  type="checkbox"
                  checked={favorite}
                  onChange={(e) => setFavorite(e.target.checked)}
                  className="accent-[#777D66]"
                />
                收藏
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] text-muted has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent">
                <input
                  type="checkbox"
                  checked={important}
                  onChange={(e) => setImportant(e.target.checked)}
                  className="accent-[#777D66]"
                />
                重要
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] text-muted has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent">
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(e) => setArchived(e.target.checked)}
                  className="accent-[#777D66]"
                />
                归档
              </label>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[12px] text-danger hover:underline"
                >
                  <X size={12} />
                  清除筛选
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 列表 */}
      {loading && items.length === 0 ? (
        <PageLoading />
      ) : error ? (
        <div className="card p-6 text-center text-[13.5px] text-danger">{error}</div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            title={hasActiveFilters ? '没有符合筛选的记录' : '时间线还是空的'}
            hint={hasActiveFilters ? '试试调整筛选条件' : '记录下此刻，时间线会从今天开始生长'}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([key, groupItems]) => (
            <section key={key}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-[15px] font-semibold">{groupTitle(key, view)}</h2>
                <div className="h-px flex-1 bg-border" />
                <span className="text-[12px] text-muted">{groupItems.length} 条</span>
              </div>
              <div className="space-y-3">
                {groupItems.map((e) => (
                  <EntryCard key={e.id} entry={e} href={`/entries/${e.id}`} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-10">
        {loading && items.length > 0 && (
          <div className="flex justify-center py-4 text-[12.5px] text-muted">加载中…</div>
        )}
        {!hasMore && items.length > 0 && (
          <div className="pt-4 text-center text-[12px] text-muted/70">—— 已到时间的尽头 ——</div>
        )}
      </div>
    </div>
  );
}
