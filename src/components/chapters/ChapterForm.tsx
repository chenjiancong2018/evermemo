'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';
import type { ChapterRow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { CoverPicker } from '@/components/archive/CoverPicker';

export interface ChapterFormProps {
  chapter?: ChapterRow;
  onSaved?: () => void;
  onCancel?: () => void;
  standalone?: boolean;
}

export function ChapterForm({ chapter, onSaved, onCancel, standalone = false }: ChapterFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState(chapter?.title ?? '');
  const [startDate, setStartDate] = useState(chapter?.start_date ?? '');
  const [endDate, setEndDate] = useState(chapter?.end_date ?? '');
  const [description, setDescription] = useState(chapter?.description ?? '');
  const [content, setContent] = useState(chapter?.content ?? '');
  const [coverMediaId, setCoverMediaId] = useState<string | null>(chapter?.cover_path ?? null);

  async function submit() {
    if (submitting) return;
    if (!title.trim()) {
      toast('请输入标题', 'error');
      return;
    }
    setSubmitting(true);
    const payload = {
      title,
      start_date: startDate || null,
      end_date: endDate || null,
      description: description || null,
      content: content || null,
      cover_media_id: coverMediaId,
    };
    try {
      const saved = await api<ChapterRow>(chapter ? `/api/chapters/${chapter.id}` : '/api/chapters', {
        method: chapter ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      toast(chapter ? '已保存修改' : '已创建人生故事', 'success');
      if (standalone) {
        router.push(`/chapters/${saved.id}`);
        router.refresh();
      } else {
        onSaved?.();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1.5 block text-[12.5px] text-muted">标题</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：我的大学四年" maxLength={200} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-[12.5px] text-muted">开始日期（可选）</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="开始日期" />
        </div>
        <div>
          <Label className="mb-1.5 block text-[12.5px] text-muted">结束日期（可选）</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="结束日期" />
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block text-[12.5px] text-muted">简介</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="一段话概括这个故事…" />
      </div>
      <div>
        <Label className="mb-1.5 block text-[12.5px] text-muted">正文（可选，支持 Markdown）</Label>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="写下这个故事…" />
      </div>
      <div>
        <Label className="mb-1.5 block text-[12.5px] text-muted">封面</Label>
        <CoverPicker mediaId={coverMediaId} onChange={(id) => setCoverMediaId(id)} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="button" onClick={submit} loading={submitting}>
          保存
        </Button>
      </div>
    </div>
  );
}
