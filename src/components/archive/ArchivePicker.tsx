'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/lib/api/client';
import type { PersonRow, PlaceRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export interface PickOption {
  id: string;
  name: string;
  sub?: string;
}

export interface ArchivePickerProps {
  kind: 'people' | 'places';
  selected: string[];
  onChange: (ids: string[]) => void;
  /** 编辑模式：即使列表中缺某 id 也显示（用 id 兜底） */
  labels?: Record<string, string>;
  max?: number;
}

/** 人物/地点多选器：远端列表 + 本地筛选 + chips 多选 */
export function ArchivePicker({ kind, selected, onChange, labels, max = 30 }: ArchivePickerProps) {
  const [options, setOptions] = useState<PickOption[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || options.length > 0) return;
    let cancelled = false;
    setLoading(true);
    api<{ items: (PersonRow | PlaceRow)[] }>(`/api/${kind}?page=1&page_size=100`)
      .then((r) => {
        if (cancelled) return;
        const items: PickOption[] = r.items.map((x) => {
          if (kind === 'people') {
            const p = x as PersonRow;
            return { id: p.id, name: p.name, sub: p.nickname || undefined };
          }
          const pl = x as PlaceRow;
          return { id: pl.id, name: pl.name, sub: pl.city || undefined };
        });
        setOptions(items);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);

  // 点击外部关闭
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => o.name.toLowerCase().includes(t) || (o.sub ?? '').toLowerCase().includes(t));
  }, [options, q]);

  const selectedIds = new Set(selected);
  const labelOf = (id: string) => labels?.[id] ?? options.find((o) => o.id === id)?.name ?? id.slice(0, 8);

  function toggle(id: string) {
    if (selectedIds.has(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < max) onChange([...selected, id]);
  }

  return (
    <div ref={rootRef} className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className={cn(
          'flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border border-border bg-transparent px-3 py-2 text-[13px] transition-colors',
          open ? 'border-accent' : 'hover:border-accent/50'
        )}
      >
        {selected.length === 0 ? (
          <span className="text-muted">{kind === 'people' ? '关联人物（可选）' : '关联地点（可选）'}</span>
        ) : (
          selected.map((id) => (
            <span
              key={id}
              onClick={(e) => {
                e.stopPropagation();
                toggle(id);
              }}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-accent hover:bg-accent hover:text-white"
              title="点击移除"
            >
              {labelOf(id)}
              <span className="text-[11px] opacity-70">✕</span>
            </span>
          ))
        )}
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-surface p-2 shadow-lg">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`搜索${kind === 'people' ? '人物' : '地点'}`}
              className="!pl-8 !py-1.5 !text-[13px]"
              autoFocus
            />
          </div>
          <div className="mt-1 max-h-52 overflow-y-auto">
            {error ? (
              <p className="px-2 py-3 text-center text-[12.5px] text-muted">加载失败，请稍后重试</p>
            ) : loading ? (
              <p className="px-2 py-3 text-center text-[12.5px] text-muted">加载中…</p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-[12.5px] text-muted">
                {options.length === 0 ? `还没有${kind === 'people' ? '人物' : '地点'}档案，先去创建吧` : '没有匹配项'}
              </p>
            ) : (
              filtered.map((o) => {
                const active = selectedIds.has(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(o.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
                      active ? 'bg-accent-soft text-accent' : 'hover:bg-background'
                    )}
                  >
                    <span>
                      {o.name}
                      {o.sub ? <span className="ml-1.5 text-[12px] text-muted">{o.sub}</span> : null}
                    </span>
                    {active && <span className="text-accent">✓</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
