'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PenLine, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { api } from '@/lib/api/client';
import type { PersonRow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { PersonForm } from './PersonForm';

export function PeopleView() {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<PersonRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PersonRow | null>(null);

  async function load(query: string) {
    setLoading(true);
    try {
      const r = await api<{ items: PersonRow[] }>(
        `/api/people?page=1&page_size=100${query ? `&q=${encodeURIComponent(query)}` : ''}`
      );
      setItems(r.items);
    } catch (err) {
      toast(err instanceof Error ? err.message : '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(p: PersonRow) {
    if (!window.confirm(`删除「${p.name}」的人物档案？相关记录不会被删除。`)) return;
    try {
      await api(`/api/people/${p.id}`, { method: 'DELETE' });
      toast('已删除', 'info');
      load(q);
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              load(e.target.value);
            }}
            placeholder="搜索姓名、昵称、关系"
            className="!pl-9"
            aria-label="搜索人物"
          />
        </div>
        <div className="ml-auto">
          <Button type="button" onClick={() => setFormOpen(true)}>
            <Plus size={15} />
            新增人物
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="card py-14 text-center">
          <UserRound size={30} className="mx-auto text-muted/50" />
          <p className="mt-3 text-[14px] text-muted">还没有人物档案。把生命中重要的人记下来吧。</p>
          <Button type="button" variant="secondary" className="mt-4" onClick={() => setFormOpen(true)}>
            <Plus size={15} />
            新增人物
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div key={p.id} className="card group relative p-4">
              <button
                type="button"
                onClick={() => router.push(`/people/${p.id}`)}
                className="flex w-full items-center gap-3 text-left"
              >
                {p.avatar_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/media/${p.avatar_path}/thumb`} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <UserRound size={20} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium">{p.name}</p>
                  <p className="mt-0.5 truncate text-[12.5px] text-muted">
                    {[p.relationship_type, p.first_met_at ? `初见 ${p.first_met_at.slice(0, 4)}` : null]
                      .filter(Boolean)
                      .join(' · ') || '人物档案'}
                  </p>
                </div>
              </button>
              <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className="rounded-lg p-1.5 text-muted hover:text-accent"
                  aria-label="编辑人物"
                  title="编辑"
                >
                  <PenLine size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  className="rounded-lg p-1.5 text-muted hover:text-danger"
                  aria-label="删除人物"
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={formOpen || Boolean(editing)}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? '编辑人物' : '新增人物'}
      >
        <PersonForm
          person={editing ?? undefined}
          onSaved={() => {
            setFormOpen(false);
            setEditing(null);
            load(q);
          }}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      </Dialog>
    </div>
  );
}
