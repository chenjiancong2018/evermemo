'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/lib/api/client';
import type { EntryWithMeta } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export interface EntryPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  labels?: Record<string, string>;
  max?: number;
  /** 可选：每次点击选中/取消时给出对应选项的完整信息（id/title/occurredAt） */
  onPick?: (opt: { id: string; title: string; occurredAt: string }) => void;
}

/** 记录多选器：搜索用户自己的记录（排除回收站） */
export function EntryPicker({ selected, onChange, labels, max = 100, onPick }: EntryPickerProps) {
  const [options, setOptions] = useState<{ id: string; title: string; occurredAt: string }[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || loading) return;
    let cancelled = false;
    setLoading(true);
    api<{ items: EntryWithMeta[] }>(`/api/entries?page=1&page_size=50${q ? `&q=${encodeURIComponent(q)}` : ''}`)
      .then((r) => {
        if (cancelled) return;
        setOptions(
          r.items.map((e) => ({
            id: e.id,
            title: e.title || e.content.slice(0, 40) || '（无标题）',
            occurredAt: e.occurred_at.slice(0, 10),
          }))
        );
      })
      .catch(() => {
        /* 忽略 */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selectedIds = useMemo(() => new Set(selected), [selected]);
  const labelOf = (id: string) => labels?.[id] ?? options.find((o) => o.id === id)?.title ?? id.slice(0, 8);

  function toggle(id: string) {
    if (selectedIds.has(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < max) {
      onChange([...selected, id]);
      const opt = options.find((o) => o.id === id);
      if (opt && onPick) onPick(opt);
    }
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
          <span className="text-muted">关联记录（可选）</span>
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
              placeholder="搜索记录"
              className="!pl-8 !py-1.5 !text-[13px]"
              autoFocus
            />
          </div>
          <div className="mt-1 max-h-52 overflow-y-auto">
            {loading ? (
              <p className="px-2 py-3 text-center text-[12.5px] text-muted">加载中…</p>
            ) : options.length === 0 ? (
              <p className="px-2 py-3 text-center text-[12.5px] text-muted">没有匹配的记录</p>
            ) : (
              options.map((o) => {
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
                    <span className="min-w-0 truncate">{o.title}</span>
                    <span className="ml-2 shrink-0 text-[12px] text-muted">{o.occurredAt}</span>
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
