'use client';

import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { api, qs } from '@/lib/api/client';
import { ENTRY_TYPE_LABELS } from '@/lib/types';
import type { EntryWithMeta } from '@/lib/types';
import { formatDateCN } from '@/lib/utils';
import { EmptyState, PageLoading } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';

interface TrashResult {
  items: EntryWithMeta[];
  total: number;
}

export function TrashView() {
  const [items, setItems] = useState<EntryWithMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<TrashResult>(`/api/entries${qs({ trash: '1', page_size: 100 })}`);
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      toast(err instanceof Error ? err.message : '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(id: string) {
    setBusyId(id);
    try {
      await api(`/api/entries/${id}/restore`, { method: 'POST' });
      toast('已恢复记录', 'success');
      setItems((prev) => prev.filter((e) => e.id !== id));
      setTotal((t) => t - 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : '恢复失败', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function purge(id: string) {
    if (!window.confirm('彻底删除后无法恢复，包括这条记录里的照片。确定吗？')) return;
    setBusyId(id);
    try {
      await api(`/api/entries/${id}/purge`, { method: 'POST' });
      toast('已彻底删除', 'success');
      setItems((prev) => prev.filter((e) => e.id !== id));
      setTotal((t) => t - 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-4">
      <div className="card p-4 text-[13px] leading-relaxed text-muted">
        删除的记录会在这里保留，可随时恢复。目前共 {total} 条。为保护隐私，本版本不自动清空回收站。
        {total > items.length && `（仅显示最近 ${items.length} 条）`}
      </div>

      {items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Trash2 size={30} />}
            title="回收站是空的"
            hint="删除的记录会先来到这里"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((e) => (
            <div key={e.id} className="card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11.5px] text-accent">
                    {ENTRY_TYPE_LABELS[e.entry_type]}
                  </span>
                  <span className="text-[14px] font-medium">
                    {e.title || '（无标题）'}
                  </span>
                </div>
                <div className="mt-1 text-[12px] text-muted">
                  发生于 {formatDateCN(e.occurred_at)}
                  {e.deleted_at && <> · 删除于 {formatDateCN(e.deleted_at)}</>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => void restore(e.id)}
                  disabled={busyId === e.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[12.5px] text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  <RotateCcw size={14} />
                  恢复
                </button>
                <button
                  onClick={() => void purge(e.id)}
                  disabled={busyId === e.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[12.5px] text-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  彻底删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
