'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, Star, Trash2, PenLine } from 'lucide-react';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

interface EntryActionsProps {
  entryId: string;
  initialFavorite: boolean;
  initialImportant: boolean;
}

export function EntryActions({ entryId, initialFavorite, initialImportant }: EntryActionsProps) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [important, setImportant] = useState(initialImportant);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function patch(payload: { is_favorite?: boolean; is_important?: boolean }) {
    setBusy(true);
    try {
      await api(`/api/entries/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (payload.is_favorite !== undefined) setFavorite(payload.is_favorite);
      if (payload.is_important !== undefined) setImportant(payload.is_important);
      toast('已保存', 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('删除后记录会进入回收站，30 天后可彻底清除。确定删除吗？')) return;
    setBusy(true);
    try {
      await api(`/api/entries/${entryId}`, { method: 'DELETE' });
      toast('已移入回收站', 'success');
      router.push('/timeline');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error');
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => void patch({ is_favorite: !favorite })}
        disabled={busy}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] transition-colors disabled:opacity-50',
          favorite
            ? 'border-[#E8B4A0] bg-[#E8B4A0]/10 text-[#C98F74]'
            : 'border-border text-muted hover:text-accent'
        )}
      >
        <Heart size={15} fill={favorite ? 'currentColor' : 'none'} />
        {favorite ? '已收藏' : '收藏'}
      </button>
      <button
        onClick={() => void patch({ is_important: !important })}
        disabled={busy}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] transition-colors disabled:opacity-50',
          important
            ? 'border-accent bg-accent-soft text-accent'
            : 'border-border text-muted hover:text-accent'
        )}
      >
        <Star size={15} fill={important ? 'currentColor' : 'none'} />
        {important ? '已标记' : '标记重要'}
      </button>
      <Link
        href={`/entries/${entryId}/edit`}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] text-muted transition-colors hover:text-accent"
      >
        <PenLine size={15} />
        编辑
      </Link>
      <button
        onClick={() => void handleDelete()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] text-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
      >
        <Trash2 size={15} />
        删除
      </button>
    </div>
  );
}
