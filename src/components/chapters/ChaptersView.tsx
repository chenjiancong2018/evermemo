'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, PenLine, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import type { ChapterRow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { ChapterForm } from './ChapterForm';

export function ChaptersView() {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<ChapterRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ChapterRow | null>(null);

  async function load(query: string) {
    setLoading(true);
    try {
      const r = await api<{ items: ChapterRow[] }>(
        `/api/chapters?page=1&page_size=100${query ? `&q=${encodeURIComponent(query)}` : ''}`
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

  async function onDelete(c: ChapterRow) {
    if (!window.confirm(`删除人生故事「${c.title}」？关联的记录不会被删除。`)) return;
    try {
      await api(`/api/chapters/${c.id}`, { method: 'DELETE' });
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
            placeholder="搜索故事"
            className="!pl-9"
            aria-label="搜索人生故事"
          />
        </div>
        <div className="ml-auto">
          <Button type="button" onClick={() => setFormOpen(true)}>
            <Plus size={15} />
            新增故事
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="card py-14 text-center">
          <BookOpen size={30} className="mx-auto text-muted/50" />
          <p className="mt-3 text-[14px] text-muted">还没有人生故事。把散落的记忆串成故事吧。</p>
          <Button type="button" variant="secondary" className="mt-4" onClick={() => setFormOpen(true)}>
            <Plus size={15} />
            写下第一个故事
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <div key={c.id} className="card group relative overflow-hidden p-0">
              <button type="button" onClick={() => router.push(`/chapters/${c.id}`)} className="block w-full text-left">
                {c.cover_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/media/${c.cover_path}/thumb`} alt="" className="h-28 w-full object-cover" />
                ) : (
                  <div className="flex h-28 w-full items-center justify-center bg-accent-soft">
                    <BookOpen size={24} className="text-accent/50" />
                  </div>
                )}
                <div className="p-4">
                  <p className="truncate text-[14.5px] font-medium">{c.title}</p>
                  <p className="mt-0.5 truncate text-[12.5px] text-muted">
                    {[c.start_date ?? null, c.end_date ?? null].filter(Boolean).join(' ~ ') || '人生故事'}
                  </p>
                </div>
              </button>
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  className="rounded-lg bg-black/50 p-1.5 text-white hover:bg-accent"
                  aria-label="编辑故事"
                  title="编辑"
                >
                  <PenLine size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(c)}
                  className="rounded-lg bg-black/50 p-1.5 text-white hover:bg-danger"
                  aria-label="删除故事"
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
        title={editing ? '编辑人生故事' : '新增人生故事'}
        wide
      >
        <ChapterForm
          chapter={editing ?? undefined}
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
