'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Award, CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import type { ImportanceLevel, MilestoneWithMeta } from '@/lib/types';
import { IMPORTANCE_LABELS, IMPORTANCE_LEVELS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { CoverPicker } from '@/components/archive/CoverPicker';
import { ArchivePicker } from '@/components/archive/ArchivePicker';
import { EntryPicker } from '@/components/archive/EntryPicker';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface MilestoneFormProps {
  milestone?: MilestoneWithMeta;
  onSaved: () => void;
  onCancel: () => void;
}

function MilestoneForm({ milestone, onSaved, onCancel }: MilestoneFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState(milestone?.title ?? '');
  const [date, setDate] = useState(milestone?.occurred_at.slice(0, 10) ?? todayStr());
  const [importance, setImportance] = useState<ImportanceLevel>(milestone?.importance ?? 1);
  const [description, setDescription] = useState(milestone?.description ?? '');
  const [coverMediaId, setCoverMediaId] = useState<string | null>(milestone?.cover?.id ?? null);
  const [entryIds, setEntryIds] = useState<string[]>(milestone?.entries.map((e) => e.id) ?? []);
  const [personIds, setPersonIds] = useState<string[]>(milestone?.people.map((p) => p.id) ?? []);
  const [placeIds, setPlaceIds] = useState<string[]>(milestone?.places.map((p) => p.id) ?? []);

  async function submit() {
    if (submitting) return;
    if (!title.trim()) {
      toast('请输入标题', 'error');
      return;
    }
    if (!date) {
      toast('请选择发生日期', 'error');
      return;
    }
    setSubmitting(true);
    const payload = {
      title,
      description: description || null,
      occurred_at: date,
      cover_media_id: coverMediaId,
      importance,
      entry_ids: entryIds,
      person_ids: personIds,
      place_ids: placeIds,
    };
    try {
      await api(
        milestone ? `/api/milestones/${milestone.id}` : '/api/milestones',
        {
          method: milestone ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        }
      );
      toast(milestone ? '已保存修改' : '已创建重要时刻', 'success');
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1.5 block text-[12.5px] text-muted">标题</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="这一刻的名字，如「大学毕业」" maxLength={200} />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex-1">
          <Label className="mb-1.5 block text-[12.5px] text-muted">发生日期</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="发生日期" />
        </div>
        <div>
          <Label className="mb-1.5 block text-[12.5px] text-muted">重要程度</Label>
          <div className="flex gap-1.5">
            {IMPORTANCE_LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setImportance(lv)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[12.5px] transition-colors',
                  importance === lv
                    ? 'border-accent bg-accent text-white'
                    : 'border-border bg-surface text-muted hover:border-accent/50'
                )}
              >
                {IMPORTANCE_LABELS[lv]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block text-[12.5px] text-muted">描述</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="这一刻为什么重要…" />
      </div>
      <div>
        <Label className="mb-1.5 block text-[12.5px] text-muted">封面</Label>
        <CoverPicker mediaId={coverMediaId} current={milestone?.cover ?? null} onChange={(id) => setCoverMediaId(id)} />
      </div>
      <div>
        <Label className="mb-1.5 block text-[12.5px] text-muted">关联记录</Label>
        <EntryPicker
          selected={entryIds}
          onChange={setEntryIds}
          labels={Object.fromEntries((milestone?.entries ?? []).map((e) => [e.id, e.title || '记录']))}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-[12.5px] text-muted">关联人物</Label>
          <ArchivePicker
            kind="people"
            selected={personIds}
            onChange={setPersonIds}
            labels={Object.fromEntries((milestone?.people ?? []).map((p) => [p.id, p.name]))}
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-[12.5px] text-muted">关联地点</Label>
          <ArchivePicker
            kind="places"
            selected={placeIds}
            onChange={setPlaceIds}
            labels={Object.fromEntries((milestone?.places ?? []).map((p) => [p.id, p.name]))}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button type="button" onClick={submit} loading={submitting}>
          保存
        </Button>
      </div>
    </div>
  );
}

/** 纪念碑卡片：圆拱顶 + 年份 + 重要程度 */
function MonumentCard({ m, onOpen, onEdit }: { m: MilestoneWithMeta; onOpen: () => void; onEdit: () => void }) {
  return (
    <div className="group">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full overflow-hidden rounded-t-[999px] rounded-b-2xl border border-border bg-surface text-left shadow-sm transition-shadow hover:shadow-md"
        aria-label={`查看重要时刻：${m.title}`}
      >
        <div className="relative h-32 w-full overflow-hidden bg-accent-soft">
          {m.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/media/${m.cover.id}/thumb`} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Award size={30} className="text-accent/50" />
            </div>
          )}
        </div>
        <div className="px-3 pb-3 pt-2">
          <p className="truncate text-[14px] font-medium">{m.title}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
            <CalendarDays size={12} />
            {m.occurred_at.slice(0, 10)} · {IMPORTANCE_LABELS[m.importance]}
          </p>
        </div>
      </button>
      <div className="mt-1 flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-1.5 text-muted hover:text-accent"
          aria-label="编辑重要时刻"
          title="编辑"
        >
          <Pencil size={14} />
        </button>
      </div>
    </div>
  );
}

export function MilestonesView() {
  const router = useRouter();
  const { toast } = useToast();
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [items, setItems] = useState<MilestoneWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<MilestoneWithMeta | null>(null);
  const [editing, setEditing] = useState<MilestoneWithMeta | null>(null);

  const load = useCallback(async (y: number | null) => {
    setLoading(true);
    try {
      const r = await api<{ items: MilestoneWithMeta[] }>(
        `/api/milestones?page=1&page_size=100${y ? `&year=${y}` : ''}`
      );
      setItems(r.items);
    } catch (err) {
      toast(err instanceof Error ? err.message : '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    api<{ years: number[] }>('/api/milestones/years')
      .then((r) => setYears(r.years ?? []))
      .catch(() => {});
    load(null);
  }, [load]);

  async function onDelete(m: MilestoneWithMeta) {
    if (!window.confirm(`删除重要时刻「${m.title}」？关联的记录不会被删除。`)) return;
    try {
      await api(`/api/milestones/${m.id}`, { method: 'DELETE' });
      toast('已删除', 'info');
      setDetail(null);
      load(year);
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setYear(null);
              load(null);
            }}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[13px] transition-colors',
              year === null ? 'border-accent bg-accent text-white' : 'border-border bg-surface text-muted hover:border-accent/50'
            )}
          >
            全部
          </button>
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => {
                setYear(y);
                load(y);
              }}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-[13px] transition-colors',
                year === y ? 'border-accent bg-accent text-white' : 'border-border bg-surface text-muted hover:border-accent/50'
              )}
            >
              {y}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <Button type="button" onClick={() => setFormOpen(true)}>
            <Plus size={15} />
            新增重要时刻
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="card py-14 text-center">
          <Award size={30} className="mx-auto text-muted/50" />
          <p className="mt-3 text-[14px] text-muted">
            {year ? `${year} 年还没有重要时刻` : '还没有重要时刻。把人生中值得铭记的节点记下来吧。'}
          </p>
          <Button type="button" variant="secondary" className="mt-4" onClick={() => setFormOpen(true)}>
            <Plus size={15} />
            记下第一个
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => (
            <MonumentCard
              key={m.id}
              m={m}
              onOpen={() => setDetail(m)}
              onEdit={() => {
                setEditing(m);
                setDetail(null);
              }}
            />
          ))}
        </div>
      )}

      {/* 新建/编辑 */}
      <Dialog
        open={formOpen || Boolean(editing)}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? '编辑重要时刻' : '新增重要时刻'}
        wide
      >
        <MilestoneForm
          milestone={editing ?? undefined}
          onSaved={() => {
            setFormOpen(false);
            setEditing(null);
            load(year);
          }}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      </Dialog>

      {/* 详情 */}
      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.title} wide>
        {detail && (
          <div>
            {detail.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/media/${detail.cover.id}/file`} alt="" className="mb-3 max-h-64 w-full rounded-xl object-cover" />
            )}
            <p className="text-[13px] text-muted">
              {detail.occurred_at.slice(0, 10)} · {IMPORTANCE_LABELS[detail.importance]}
            </p>
            {detail.description && <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed">{detail.description}</p>}
            {detail.people.length > 0 && (
              <p className="mt-3 text-[13px]">
                <span className="text-muted">关联人物：</span>
                {detail.people.map((p) => p.name).join('、')}
              </p>
            )}
            {detail.places.length > 0 && (
              <p className="mt-1 text-[13px]">
                <span className="text-muted">关联地点：</span>
                {detail.places.map((p) => p.name).join('、')}
              </p>
            )}
            {detail.entries.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[13px] font-medium">关联记录（{detail.entries.length}）</p>
                <div className="space-y-2">
                  {detail.entries.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        setDetail(null);
                        router.push(`/entries/${e.id}`);
                      }}
                      className="block w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-left text-[13px] hover:border-accent/50"
                    >
                      <span className="font-medium">{e.title || '（无标题）'}</span>
                      <span className="ml-2 text-muted">{e.occurred_at.slice(0, 10)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="danger"
                onClick={() => onDelete(detail)}
              >
                <Trash2 size={15} />
                删除
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setEditing(detail);
                  setDetail(null);
                }}
              >
                <Pencil size={15} />
                编辑
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
