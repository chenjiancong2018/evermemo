'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Plus, Save, X } from 'lucide-react';
import { api } from '@/lib/api/client';
import type { EntryWithMeta } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { EntryPicker } from '@/components/archive/EntryPicker';

interface Item {
  entry: EntryWithMeta;
  sort_order: number;
}

interface Props {
  chapterId: string;
  initial: Item[];
}

/** 故事关联记录管理：排序（上移/下移/移除）+ 追加 + 保存 */
export function ChapterEntriesManager({ chapterId, initial }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  /** 本次选择会话中新增的 id（用于区分「移除」与「取消新增」） */
  const [sessionAdded, setSessionAdded] = useState<string[]>([]);

  const selected = items.map((i) => i.entry.id);
  const pickerSelected = [...selected, ...sessionAdded];

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setItems(next);
    setDirty(true);
  }

  function remove(index: number) {
    setItems(items.filter((_, i) => i !== index));
    setDirty(true);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await api(`/api/chapters/${chapterId}/entries`, {
        method: 'PUT',
        body: JSON.stringify({ entry_ids: items.map((i) => i.entry.id) }),
      });
      toast('排序已保存', 'success');
      setDirty(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {items.length === 0 && !pickerOpen ? (
        <div className="rounded-xl border border-dashed border-border py-8 text-center">
          <p className="text-[13px] text-muted">还没有关联的记录</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => setPickerOpen(true)}>
            <Plus size={15} />
            添加记录
          </Button>
        </div>
      ) : (
        <>
          <ol className="space-y-2">
            {items.map((item, i) => (
              <li
                key={item.entry.id}
                className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2.5"
              >
                <span className="w-6 shrink-0 text-center text-[12px] text-muted">{i + 1}</span>
                <button
                  type="button"
                  onClick={() => router.push(`/entries/${item.entry.id}`)}
                  className="min-w-0 flex-1 text-left text-[13.5px] hover:text-accent"
                >
                  <span className="font-medium">{item.entry.title || '（无标题）'}</span>
                  <span className="ml-2 text-[12px] text-muted">{item.entry.occurred_at.slice(0, 10)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded-lg p-1.5 text-muted hover:text-accent disabled:opacity-30"
                  aria-label="上移"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  className="rounded-lg p-1.5 text-muted hover:text-accent disabled:opacity-30"
                  aria-label="下移"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-lg p-1.5 text-muted hover:text-danger"
                  aria-label="移除"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ol>

          {pickerOpen && (
            <div className="mt-3">
              <EntryPicker
                selected={pickerSelected}
                onChange={(nextIds) => {
                  // 从选择会话中移除的 id：若是本次新增则撤销，否则忽略（真正移除走列表按钮）
                  const removed = pickerSelected.filter((id) => !nextIds.includes(id));
                  if (removed.length) {
                    setSessionAdded((prev) => prev.filter((id) => !removed.includes(id)));
                    setItems((prev) => prev.filter((i) => !removed.includes(i.entry.id)));
                    setDirty(true);
                  }
                }}
                onPick={(opt) => {
                  setSessionAdded((prev) => (prev.includes(opt.id) ? prev : [...prev, opt.id]));
                  const stub = {
                    id: opt.id,
                    title: opt.title,
                    occurred_at: opt.occurredAt,
                  } as EntryWithMeta;
                  setItems((prev) => (prev.some((i) => i.entry.id === opt.id) ? prev : [...prev, { entry: stub, sort_order: prev.length }]));
                  setDirty(true);
                }}
                labels={Object.fromEntries(items.map((i) => [i.entry.id, i.entry.title || '记录']))}
              />
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setPickerOpen((v) => !v)}>
              <Plus size={15} />
              添加记录
            </Button>
            <Button type="button" onClick={save} loading={saving} disabled={!dirty}>
              <Save size={15} />
              保存排序
            </Button>
            {dirty && <span className="text-[12px] text-muted">有未保存的更改</span>}
          </div>
        </>
      )}
    </div>
  );
}
