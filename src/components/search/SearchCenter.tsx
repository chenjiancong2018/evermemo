'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { api } from '@/lib/api/client';
import type { ChapterRow, EntryWithMeta, PersonRow, PlaceRow } from '@/lib/types';
import { ENTRY_TYPE_LABELS, ENTRY_TYPES, MOODS } from '@/lib/types';
import type { TagWithCount } from '@/lib/db/tags';
import { Input } from '@/components/ui/input';
import { Spinner, EmptyState } from '@/components/ui/spinner';
import { EntryCard } from '@/components/entry/EntryCard';

type Group = 'entries' | 'people' | 'places' | 'chapters';
type Tab = 'all' | Group;

interface Agg {
  entries: { items: EntryWithMeta[]; total: number };
  people: { items: PersonRow[]; total: number };
  places: { items: PlaceRow[]; total: number };
  chapters: { items: ChapterRow[]; total: number };
}

interface AggResp {
  entries: EntryWithMeta[];
  entries_total: number;
  people: PersonRow[];
  people_total: number;
  places: PlaceRow[];
  places_total: number;
  chapters: ChapterRow[];
  chapters_total: number;
}

export function SearchCenter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [applied, setApplied] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [data, setData] = useState<Agg | null>(null);
  const [loading, setLoading] = useState(false);
  const [semantic, setSemantic] = useState(false);
  const [semData, setSemData] = useState<{
    mode: string;
    note?: string;
    hits: { score: number; entry: EntryWithMeta }[];
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqSeq = useRef(0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setApplied(q.trim()), 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  useEffect(() => {
    if (!applied || !semantic) {
      setSemData(null);
      return;
    }
    const seq = ++reqSeq.current;
    setLoading(true);
    api<{ mode: string; note?: string; hits: { score: number; entry: EntryWithMeta }[] }>('/api/ai/semantic-search', {
      method: 'POST',
      body: JSON.stringify({ query: applied }),
    })
      .then((res) => {
        if (seq !== reqSeq.current) return;
        setSemData(res);
      })
      .catch(() => {
        if (seq === reqSeq.current) setSemData(null);
      })
      .finally(() => {
        if (seq === reqSeq.current) setLoading(false);
      });
  }, [applied, semantic]);

  useEffect(() => {
    if (!applied || semantic) {
      setData(null);
      return;
    }
    const seq = ++reqSeq.current;
    setLoading(true);
    api<AggResp>(`/api/search?q=${encodeURIComponent(applied)}`)
      .then((res) => {
        if (seq !== reqSeq.current) return;
        setData({
          entries: { items: res.entries, total: res.entries_total },
          people: { items: res.people, total: res.people_total },
          places: { items: res.places, total: res.places_total },
          chapters: { items: res.chapters, total: res.chapters_total },
        });
      })
      .catch(() => {
        if (seq === reqSeq.current) setData(null);
      })
      .finally(() => {
        if (seq === reqSeq.current) setLoading(false);
      });
  }, [applied, semantic]);

  const total = data
    ? data.entries.total + data.people.total + data.places.total + data.chapters.total
    : 0;

  function clearQ() {
    setQ('');
    setApplied('');
  }

  return (
    <div className="animate-fade-in">
      <div className="mx-auto mb-6 max-w-[560px]">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索记忆、人物、地点、故事…"
            className="pl-10 pr-10"
            aria-label="搜索"
          />
          {q && (
            <button
              type="button"
              onClick={clearQ}
              aria-label="清除搜索"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSemantic((s) => !s)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] transition-colors ${
              semantic ? 'bg-accent text-white' : 'border border-border text-muted hover:border-accent hover:text-accent'
            }`}
          >
            <Sparkles size={13} />
            语义搜索
          </button>
          {semantic && (
            <span className="text-[12px] text-muted">
              按意思相似度查找（配置 AI 后启用向量检索，未配置时自动退回关键词）
            </span>
          )}
        </div>
      </div>

      {semantic && applied ? (
        loading && !semData ? (
          <div className="py-16">
            <Spinner />
          </div>
        ) : !semData ? (
          <EmptyState icon={<Search size={28} />} title="搜索失败" hint="请稍后再试。" />
        ) : (
          <div>
            {semData.note && (
              <div className="mb-4 card p-3 text-[13px] text-muted flex items-center gap-2">
                <Sparkles size={14} className="text-accent" />
                {semData.note}
                <span className="text-[11px] text-muted/70">模式：{semData.mode === 'vector' ? '向量语义' : semData.mode === 'mock' ? '模拟' : '关键词'}</span>
              </div>
            )}
            {semData.hits.length === 0 ? (
              <EmptyState icon={<Search size={28} />} title="没有语义相近的记录" hint={`“${applied}” 附近没有找到相关内容，试试更具体的描述。`} />
            ) : (
              <div className="space-y-3">
                {semData.hits.map((h) => (
                  <div key={h.entry.id} className="card p-0 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => router.push(`/entries/${h.entry.id}`)}
                      className="w-full text-left hover:bg-accent-soft/30 transition-colors"
                    >
                      <div className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-[15px]">{h.entry.title || '（无标题）'}</span>
                          <span className="text-[11px] text-muted shrink-0">相似度 {(h.score * 100).toFixed(0)}%</span>
                        </div>
                        <p className="mt-0.5 text-[13px] text-muted line-clamp-2">{h.entry.content}</p>
                        <p className="mt-1 text-[12px] text-muted/70">
                          {ENTRY_TYPE_LABELS[h.entry.entry_type]} · {h.entry.occurred_at.slice(0, 10)}
                        </p>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      ) : !applied ? (
        <EmptyState
          icon={<Search size={28} />}
          title="搜索你的人生"
          hint="输入关键词，在全部记忆、人物档案、地点档案与人生故事中查找。"
        />
      ) : loading && !data ? (
        <div className="py-16">
          <Spinner />
        </div>
      ) : !data ? (
        <EmptyState icon={<Search size={28} />} title="搜索失败" hint="请稍后再试。" />
      ) : total === 0 ? (
        <EmptyState icon={<Search size={28} />} title="没有找到相关的内容" hint={`“${applied}” 没有匹配任何记忆、人物、地点或故事。`} />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-1">
            {(
              [
                ['all', `全部（${total}）`],
                ['entries', `记录（${data.entries.total}）`],
                ['people', `人物（${data.people.total}）`],
                ['places', `地点（${data.places.total}）`],
                ['chapters', `故事（${data.chapters.total}）`],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
                  tab === key ? 'bg-accent text-white' : 'border border-border text-muted hover:border-accent hover:text-accent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'all' && data.entries.total > 0 && (
            <Section title="记录" count={data.entries.total}>
              {data.entries.items.map((e) => (
                <HitRow
                  key={e.id}
                  label={e.title || e.content.slice(0, 60) || '（无标题）'}
                  sub={`${ENTRY_TYPE_LABELS[e.entry_type]} · ${e.occurred_at.slice(0, 10)}`}
                  onClick={() => router.push(`/entries/${e.id}`)}
                />
              ))}
              {data.entries.total > 10 && (
                <MoreRow onClick={() => setTab('entries')}>查看全部 {data.entries.total} 条记录（含筛选）</MoreRow>
              )}
            </Section>
          )}

          {tab === 'entries' && <EntriesTab q={applied} />}

          {(tab === 'all' || tab === 'people') && data.people.total > 0 && (
            <Section title="人物" count={data.people.total}>
              {data.people.items.map((p) => (
                <HitRow
                  key={p.id}
                  label={p.name}
                  sub={[p.nickname, p.relationship_type].filter(Boolean).join(' · ')}
                  onClick={() => router.push(`/people/${p.id}`)}
                />
              ))}
              {tab === 'all' && data.people.total > 10 && (
                <MoreRow onClick={() => setTab('people')}>查看全部 {data.people.total} 位人物</MoreRow>
              )}
            </Section>
          )}

          {(tab === 'all' || tab === 'places') && data.places.total > 0 && (
            <Section title="地点" count={data.places.total}>
              {data.places.items.map((p) => (
                <HitRow
                  key={p.id}
                  label={p.name}
                  sub={[p.city, p.country].filter(Boolean).join(' · ')}
                  onClick={() => router.push(`/places/${p.id}`)}
                />
              ))}
              {tab === 'all' && data.places.total > 10 && (
                <MoreRow onClick={() => setTab('places')}>查看全部 {data.places.total} 个地点</MoreRow>
              )}
            </Section>
          )}

          {(tab === 'all' || tab === 'chapters') && data.chapters.total > 0 && (
            <Section title="人生故事" count={data.chapters.total}>
              {data.chapters.items.map((c) => (
                <HitRow
                  key={c.id}
                  label={c.title}
                  sub={c.description || [c.start_date, c.end_date].filter(Boolean).join(' ~ ')}
                  onClick={() => router.push(`/chapters/${c.id}`)}
                />
              ))}
              {tab === 'all' && data.chapters.total > 10 && (
                <MoreRow onClick={() => setTab('chapters')}>查看全部 {data.chapters.total} 个故事</MoreRow>
              )}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

/** 记录 Tab：完整分页 + 高级筛选（类型/心情/标签/收藏/重要/人物/地点） */
function EntriesTab({ q }: { q: string }) {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [type, setType] = useState('');
  const [mood, setMood] = useState('');
  const [tag, setTag] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [important, setImportant] = useState(false);
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [items, setItems] = useState<EntryWithMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const reqSeq = useRef(0);
  const sentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api<{ items: TagWithCount[] }>('/api/tags').then((d) => setTags(d.items)).catch(() => {});
  }, []);

  const load = useCallback(
    async (reset: boolean) => {
      const seq = ++reqSeq.current;
      const p = reset ? 1 : page;
      const params = new URLSearchParams({ q, page: String(p), page_size: '20' });
      if (type) params.set('type', type);
      if (mood) params.set('mood', mood);
      if (tag) params.set('tag', tag);
      if (favorite) params.set('favorite', '1');
      if (important) params.set('important', '1');
      try {
        const data = await api<{ items: EntryWithMeta[]; total: number }>(`/api/entries?${params}`);
        if (seq !== reqSeq.current) return;
        setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
        setTotal(data.total);
        setHasMore(reset ? data.items.length < data.total : data.items.length === 20);
        if (reset) setPage(1);
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    },
    [q, page, type, mood, tag, favorite, important]
  );

  useEffect(() => {
    setLoading(true);
    load(true);
  }, [load]);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (es) => {
        if (es[0].isIntersecting) setPage((p) => p + 1);
      },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  useEffect(() => {
    if (page > 1) load(false);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilters = Boolean(type || mood || tag || favorite || important);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <SlidersHorizontal size={14} />
          筛选{hasFilters ? '（已启用）' : ''}
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setType('');
              setMood('');
              setTag('');
              setFavorite(false);
              setImportant(false);
            }}
            className="text-[13px] text-muted hover:text-danger"
          >
            清除筛选
          </button>
        )}
        <span className="ml-auto text-[12px] text-muted">{total} 条结果</span>
      </div>

      {filtersOpen && (
        <div className="card mb-4 space-y-3 p-4">
          <div className="flex flex-wrap gap-1.5">
            {ENTRY_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(type === t ? '' : t)}
                className={`rounded-full px-3 py-1 text-[12.5px] transition-colors ${
                  type === t ? 'bg-accent text-white' : 'border border-border text-muted hover:border-accent hover:text-accent'
                }`}
              >
                {ENTRY_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMood(mood === m ? '' : m)}
                className={`rounded-full px-3 py-1 text-[12.5px] transition-colors ${
                  mood === m ? 'bg-accent text-white' : 'border border-border text-muted hover:border-accent hover:text-accent'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="input-base h-9 w-auto rounded-lg px-3 text-[13px]"
              aria-label="按标签筛选"
            >
              <option value="">全部标签</option>
              {tags.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}（{t.entry_count}）
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={favorite}
                onChange={(e) => setFavorite(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              仅收藏
            </label>
            <label className="flex items-center gap-1.5 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={important}
                onChange={(e) => setImportant(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              仅重要
            </label>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-10">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Search size={26} />} title="没有符合筛选的记录" hint="换个关键词或清除筛选试试。" />
      ) : (
        <div className="space-y-3">
          {items.map((e) => (
            <EntryCard key={e.id} entry={e} href={`/entries/${e.id}`} />
          ))}
        </div>
      )}

      {hasMore && !loading && <div ref={sentinel} className="h-10" />}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-muted">
        {title} · {count}
      </h2>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">{children}</div>
    </section>
  );
}

function HitRow({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent-soft/40"
    >
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{label}</span>
      {sub && <span className="shrink-0 text-[12px] text-muted">{sub}</span>}
    </button>
  );
}

function MoreRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-4 py-3 text-center text-[13px] text-accent transition-colors hover:bg-accent-soft/40"
    >
      {children}
    </button>
  );
}
