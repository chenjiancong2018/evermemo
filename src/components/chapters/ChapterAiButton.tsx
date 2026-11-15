'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X, Check } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';
import { MarkdownView } from '@/components/entry/MarkdownView';
import { Dialog } from '@/components/ui/dialog';

interface Props {
  chapterId: string;
  entryIds: string[];
}

export function ChapterAiButton({ chapterId, entryIds }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ id: string; title: string; content: string; is_mock: number } | null>(null);
  const [applying, setApplying] = useState(false);

  const generate = async () => {
    if (entryIds.length === 0) {
      toast('先给这个故事添加记录，AI 才能整理', 'info');
      return;
    }
    setOpen(true);
    setBusy(true);
    setDraft(null);
    try {
      const res = await api<{ draft: { id: string; title: string; content: string; is_mock: number } }>(
        '/api/ai/story',
        { method: 'POST', body: JSON.stringify({ entry_ids: entryIds }) }
      );
      setDraft(res.draft);
    } catch (err) {
      toast(err instanceof Error ? err.message : '生成失败', 'error');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!draft) return;
    if (!window.confirm('把 AI 整理的正文写入这个故事？当前正文会被替换（建议先复制备份原文）。')) return;
    setApplying(true);
    try {
      await api(`/api/chapters/${chapterId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: draft.content }),
      });
      await api(`/api/ai/drafts/${draft.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'applied' }) });
      toast('已写入故事正文', 'success');
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '应用失败', 'error');
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={generate}
        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 px-3 py-1.5 text-[13px] text-accent transition-colors hover:bg-accent-soft"
        title="AI 故事整理：基于关联记录生成故事草稿"
      >
        <Sparkles size={14} />
        AI 整理
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title={draft ? draft.title : 'AI 故事整理'} wide>
        {busy ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : draft ? (
          <div className="space-y-4">
            {draft.is_mock ? (
              <p className="text-[12px] bg-warning/10 text-warning rounded px-2 py-1 inline-block">模拟模式（MOCK）</p>
            ) : null}
            <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-border bg-background/60 p-4">
              <MarkdownView content={draft.content} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={apply}
                disabled={applying}
                className="btn btn-primary text-sm"
              >
                {applying ? <Spinner className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                应用为正文
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-secondary text-sm"
              >
                收藏到草稿箱并关闭
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-ghost text-sm"
              >
                <X className="w-4 h-4" /> 关闭
              </button>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted">生成失败，请重试。</p>
        )}
      </Dialog>
    </>
  );
}
