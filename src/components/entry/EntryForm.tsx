'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bold, Italic, Heading2, Quote, List, Link2, Code2, Eye, PenLine,
  Heart, Star, Trash2, CloudUpload, Archive, Sparkles, RotateCcw, X, Check,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { ENTRY_TYPE_LABELS, ENTRY_TYPES, MOODS, MOOD_COLORS } from '@/lib/types';
import type { EntryType, EntryWithMeta, MediaRow, Mood, TagRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { ArchivePicker } from '@/components/archive/ArchivePicker';
import { TagInput } from './TagInput';
import { ImageUploader } from './ImageUploader';
import { MarkdownView } from './MarkdownView';

interface EntryFormProps {
  mode: 'create' | 'edit';
  entry?: EntryWithMeta;
  allTags: TagRow[];
  /** 仅创建模式：URL ?type= 预设的记录类型 */
  initialType?: string;
}

interface DraftState {
  savedAt: string;
  title: string;
  content: string;
  entryType: string;
  occurredAt: string;
  mood: string | null;
  tags: string[];
  mediaIds: string[];
  peopleIds: string[];
  placesIds: string[];
  isFavorite: boolean;
  isImportant: boolean;
  isArchived: boolean;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function draftKey(mode: 'create' | 'edit', entryId?: string): string {
  return `evermemo:draft:${mode === 'edit' && entryId ? entryId : 'new'}`;
}

export function EntryForm({ mode, entry, allTags, initialType }: EntryFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(false);
  const [savedDraftAt, setSavedDraftAt] = useState<string | null>(null);

  const validInitialType =
    initialType && (ENTRY_TYPES as readonly string[]).includes(initialType) ? initialType : undefined;

  const [title, setTitle] = useState(entry?.title ?? '');
  const [content, setContent] = useState(entry?.content ?? '');
  const [entryType, setEntryType] = useState<string>(entry?.entry_type ?? validInitialType ?? 'diary');
  const [occurredDate, setOccurredDate] = useState(entry?.occurred_at?.slice(0, 10) ?? todayStr());
  const [occurredTime, setOccurredTime] = useState(
    entry?.occurred_at?.includes('T') ? entry.occurred_at.slice(11, 16) : ''
  );
  const [mood, setMood] = useState<string | null>(entry?.mood ?? null);
  const [tags, setTags] = useState<string[]>(entry?.tags.map((t) => t.name) ?? []);
  const [media, setMedia] = useState<MediaRow[]>(entry?.media ?? []);
  const [peopleIds, setPeopleIds] = useState<string[]>(entry?.people.map((p) => p.id) ?? []);
  const [placesIds, setPlacesIds] = useState<string[]>(entry?.places.map((p) => p.id) ?? []);
  const [isFavorite, setIsFavorite] = useState(entry?.is_favorite === 1);
  const [isImportant, setIsImportant] = useState(entry?.is_important === 1);
  const [isArchived, setIsArchived] = useState(entry?.is_archived === 1);

  // AI 整理建议（草稿，应用只是填表，最终保存由用户决定）
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDraft, setAiDraft] = useState<{
    draftId: string;
    title: string;
    tags: string[];
    entry_type: string;
    polished: string;
    mock: boolean;
  } | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [originalBeforeAi, setOriginalBeforeAi] = useState<{
    title: string;
    content: string;
    entryType: string;
    tags: string[];
  } | null>(null);

  async function onAiOrganize() {
    const raw = content.trim() || title.trim();
    if (!raw) {
      toast('先写点内容，AI 才能帮你整理', 'info');
      return;
    }
    setAiBusy(true);
    try {
      const res = await api<{
        draft: { id: string; is_mock: number };
        result: { title: string; tags: string[]; entry_type: string; polished: string; mock: boolean };
      }>('/api/ai/organize', {
        method: 'POST',
        body: JSON.stringify({ content: raw }),
      });
      setAiDraft({
        draftId: res.draft.id,
        title: res.result.title,
        tags: res.result.tags,
        entry_type: res.result.entry_type,
        polished: res.result.polished,
        mock: res.result.mock,
      });
      setAiPanelOpen(true);
      toast(res.result.mock ? 'AI 建议已生成（模拟模式）' : 'AI 建议已生成', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'AI 整理失败', 'error');
    } finally {
      setAiBusy(false);
    }
  }

  function onAiApply() {
    if (!aiDraft) return;
    setOriginalBeforeAi({ title, content, entryType, tags });
    setTitle(aiDraft.title);
    setContent(aiDraft.polished);
    if ((ENTRY_TYPES as readonly string[]).includes(aiDraft.entry_type)) setEntryType(aiDraft.entry_type);
    setTags((prev) => [...prev, ...aiDraft.tags.filter((t) => !prev.includes(t))]);
    api(`/api/ai/drafts/${aiDraft.draftId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'applied' }),
    }).catch(() => {});
    toast('已填入 AI 建议，检查后点“保存修改”生效（原内容可一键恢复）', 'info');
  }

  function onAiRevert() {
    if (!originalBeforeAi) return;
    setTitle(originalBeforeAi.title);
    setContent(originalBeforeAi.content);
    setEntryType(originalBeforeAi.entryType);
    setTags(originalBeforeAi.tags);
    setOriginalBeforeAi(null);
    toast('已恢复整理前的原文', 'info');
  }

  const key = draftKey(mode, entry?.id);

  // 草稿恢复（仅创建模式；编辑模式只在草稿比记录新时恢复）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const d = JSON.parse(raw) as DraftState;
      if (mode === 'edit' && entry && d.savedAt <= entry.updated_at) return;
      setTitle(d.title ?? '');
      setContent(d.content ?? '');
      setEntryType(d.entryType ?? 'diary');
      if (d.occurredAt) {
        setOccurredDate(d.occurredAt.slice(0, 10));
        setOccurredTime(d.occurredAt.includes('T') ? d.occurredAt.slice(11, 16) : '');
      }
      setMood(d.mood ?? null);
      setTags(d.tags ?? []);
      setMedia((d.mediaIds ?? []).map((id) => ({ id } as MediaRow)));
      setPeopleIds(d.peopleIds ?? []);
      setPlacesIds(d.placesIds ?? []);
      setIsFavorite(Boolean(d.isFavorite));
      setIsImportant(Boolean(d.isImportant));
      setIsArchived(Boolean(d.isArchived));
      setSavedDraftAt(d.savedAt);
      toast('已恢复未完成的草稿', 'info');
    } catch {
      /* 草稿损坏则忽略 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 草稿自动保存（防抖 800ms）
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const draft: DraftState = {
        savedAt: new Date().toISOString(),
        title,
        content,
        entryType,
        occurredAt: occurredDate + (occurredTime ? `T${occurredTime}` : ''),
        mood,
        tags,
        mediaIds: media.map((m) => m.id),
        peopleIds,
        placesIds,
        isFavorite,
        isImportant,
        isArchived,
      };
      try {
        localStorage.setItem(key, JSON.stringify(draft));
        setSavedDraftAt(draft.savedAt);
      } catch {
        /* 存储满则放弃草稿 */
      }
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [key, title, content, entryType, occurredDate, occurredTime, mood, tags, media, peopleIds, placesIds, isFavorite, isImportant, isArchived]);

  // Markdown 工具栏：包裹选区
  const applyWrap = useCallback((before: string, after = '', placeholder = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const selected = content.slice(s, e) || placeholder;
    const next = content.slice(0, s) + before + selected + after + content.slice(e);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  }, [content]);

  const insertLinePrefix = useCallback((prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s } = ta;
    const lineStart = content.lastIndexOf('\n', s - 1) + 1;
    const next = content.slice(0, lineStart) + prefix + content.slice(lineStart);
    setContent(next);
    requestAnimationFrame(() => ta.focus());
  }, [content]);

  async function onSubmit() {
    if (submitting) return;
    if (!occurredDate) {
      toast('请选择发生日期', 'error');
      return;
    }
    setSubmitting(true);
    const occurredAt = occurredDate + (occurredTime ? `T${occurredTime}` : '');
    const payload = {
      title,
      content,
      entry_type: entryType,
      occurred_at: occurredAt,
      mood,
      tags,
      media_ids: media.map((m) => m.id),
      people_ids: peopleIds,
      places_ids: placesIds,
      is_favorite: isFavorite,
      is_important: isImportant,
      is_archived: isArchived,
    };
    try {
      const saved = await api<EntryWithMeta>(
        mode === 'create' ? '/api/entries' : `/api/entries/${entry!.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PATCH',
          body: JSON.stringify(payload),
        }
      );
      localStorage.removeItem(key);
      toast(mode === 'create' ? '已记录这一刻' : '已保存修改', 'success');
      router.push(`/entries/${saved.id}`);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!entry || submitting) return;
    if (!window.confirm('删除这条记录？它会进入回收站，30 天内可恢复。')) return;
    try {
      await api(`/api/entries/${entry.id}`, { method: 'DELETE' });
      toast('已移入回收站', 'info');
      router.push('/timeline');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    }
  }

  const toolbar = [
    { icon: <Bold size={15} />, label: '加粗', run: () => applyWrap('**', '**', '加粗文字') },
    { icon: <Italic size={15} />, label: '斜体', run: () => applyWrap('*', '*', '斜体文字') },
    { icon: <Heading2 size={15} />, label: '小标题', run: () => insertLinePrefix('## ') },
    { icon: <Quote size={15} />, label: '引用', run: () => insertLinePrefix('> ') },
    { icon: <List size={15} />, label: '列表', run: () => insertLinePrefix('- ') },
    { icon: <Link2 size={15} />, label: '链接', run: () => applyWrap('[', '](https://)', '链接文字') },
    { icon: <Code2 size={15} />, label: '行内代码', run: () => applyWrap('`', '`', 'code') },
  ];

  const moodOptions = useMemo(() => MOODS as unknown as Mood[], []);

  return (
    <div className="mx-auto max-w-[760px]">
      {/* 类型选择 */}
      <div className="flex flex-wrap gap-1.5">
        {ENTRY_TYPES.map((t: EntryType) => (
          <button
            key={t}
            type="button"
            onClick={() => setEntryType(t)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[13px] transition-colors',
              entryType === t
                ? 'border-accent bg-accent text-white'
                : 'border-border bg-surface text-muted hover:border-accent/50 hover:text-accent'
            )}
          >
            {ENTRY_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="card mt-4 p-4 sm:p-6">
        {/* 标题 */}
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题（可选）"
          maxLength={200}
          className="!border-0 !bg-transparent !px-0 !text-[19px] !font-semibold !shadow-none !ring-0 placeholder:!font-normal"
        />

        {/* 日期与时间 */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={occurredDate}
            onChange={(e) => setOccurredDate(e.target.value)}
            className="!w-auto !px-3 !py-1.5 !text-[13px]"
            aria-label="发生日期"
          />
          <Input
            type="time"
            value={occurredTime}
            onChange={(e) => setOccurredTime(e.target.value)}
            className="!w-auto !px-3 !py-1.5 !text-[13px]"
            aria-label="发生时间（可选）"
          />
          <span className="text-[12px] text-muted">发生日期</span>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsFavorite((v) => !v)}
              className={cn(
                'rounded-lg p-2 transition-colors',
                isFavorite ? 'text-danger' : 'text-muted/50 hover:text-danger'
              )}
              title="收藏"
              aria-label="收藏"
            >
              <Heart size={17} className={isFavorite ? 'fill-danger' : ''} />
            </button>
            <button
              type="button"
              onClick={() => setIsImportant((v) => !v)}
              className={cn(
                'rounded-lg p-2 transition-colors',
                isImportant ? 'text-[#C9A227]' : 'text-muted/50 hover:text-[#C9A227]'
              )}
              title="重要"
              aria-label="标记重要"
            >
              <Star size={17} className={isImportant ? 'fill-[#C9A227]' : ''} />
            </button>
            <button
              type="button"
              onClick={() => setIsArchived((v) => !v)}
              className={cn(
                'rounded-lg p-2 transition-colors',
                isArchived ? 'text-accent' : 'text-muted/50 hover:text-accent'
              )}
              title="归档（不显示在时间线，可在归档中查看）"
              aria-label="归档"
            >
              <Archive size={17} />
            </button>
          </div>
        </div>

        {/* 心情 */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {moodOptions.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMood(mood === m ? null : m)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] transition-colors',
                mood === m
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border bg-surface text-muted hover:border-accent/50'
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: MOOD_COLORS[m] }} />
              {m}
            </button>
          ))}
        </div>

        {/* 正文 / 预览 */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-0.5">
              {!preview &&
                toolbar.map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={b.run}
                    title={b.label}
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                  >
                    {b.icon}
                  </button>
                ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onAiOrganize}
                disabled={aiBusy}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors',
                  aiBusy ? 'text-muted/50' : 'text-accent hover:bg-accent-soft'
                )}
                title="AI 整理：建议标题、标签与润色，仅作草稿"
              >
                <Sparkles size={14} />
                AI 整理
              </button>
              <button
                type="button"
                onClick={() => setPreview((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors',
                  preview ? 'bg-accent text-white' : 'text-muted hover:bg-accent-soft hover:text-accent'
                )}
              >
                {preview ? <PenLine size={14} /> : <Eye size={14} />}
                {preview ? '编辑' : '预览'}
              </button>
            </div>
          </div>

          {aiPanelOpen && aiDraft && (
            <div className="mb-3 rounded-xl border border-accent/30 bg-accent-soft/30 p-3.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent">
                  <Sparkles size={14} />
                  AI 整理建议{aiDraft.mock ? '（模拟）' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setAiPanelOpen(false)}
                  className="rounded p-1 text-muted hover:text-foreground"
                  aria-label="关闭 AI 建议"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="mt-2 space-y-2 text-[13px]">
                <p><span className="text-muted">标题：</span>{aiDraft.title}</p>
                <p><span className="text-muted">类型：</span>{ENTRY_TYPE_LABELS[aiDraft.entry_type as EntryType] ?? aiDraft.entry_type}</p>
                {aiDraft.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted">标签：</span>
                    {aiDraft.tags.map((t) => (
                      <span key={t} className="rounded-full bg-surface px-2 py-0.5 text-[12px] text-accent">#{t}</span>
                    ))}
                  </div>
                )}
                <div className="max-h-40 overflow-y-auto rounded-lg bg-surface/70 p-2.5 text-muted">
                  <MarkdownView content={aiDraft.polished} />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {!originalBeforeAi ? (
                  <button
                    type="button"
                    onClick={onAiApply}
                    className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] text-white hover:opacity-90"
                  >
                    应用建议（可恢复原文）
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-accent/10 px-3 py-1.5 text-[12.5px] text-accent">
                    <Check size={13} />
                    已应用，检查后保存修改
                  </span>
                )}
                {originalBeforeAi && (
                  <button
                    type="button"
                    onClick={onAiRevert}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[12.5px] text-muted hover:text-foreground"
                  >
                    <RotateCcw size={13} />
                    恢复原文
                  </button>
                )}
              </div>
            </div>
          )}

          {preview ? (
            <div className="min-h-[180px] rounded-xl border border-border bg-background/60 px-4 py-3">
              {content.trim() ? (
                <MarkdownView content={content} />
              ) : (
                <p className="py-6 text-center text-[13px] text-muted">还没有内容</p>
              )}
            </div>
          ) : (
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={'写下此刻…支持 Markdown（# 标题、**加粗**、- 列表）'}
              rows={10}
              className="!border-border !bg-transparent !text-[15px] !leading-relaxed focus:!border-accent"
            />
          )}
        </div>

        {/* 图片 */}
        <div className="mt-4">
          <ImageUploader media={media} onChange={setMedia} />
        </div>

        {/* 人物 / 地点 */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-[12.5px] text-muted">关联人物</Label>
            <ArchivePicker
              kind="people"
              selected={peopleIds}
              onChange={setPeopleIds}
              labels={Object.fromEntries((entry?.people ?? []).map((p) => [p.id, p.name]))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-[12.5px] text-muted">关联地点</Label>
            <ArchivePicker
              kind="places"
              selected={placesIds}
              onChange={setPlacesIds}
              labels={Object.fromEntries((entry?.places ?? []).map((p) => [p.id, p.name]))}
            />
          </div>
        </div>

        {/* 标签 */}
        <div className="mt-4 rounded-xl border border-border px-3 py-2.5">
          <TagInput value={tags} onChange={setTags} suggestions={allTags.map((t) => t.name)} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={onSubmit} loading={submitting} className="flex-1 sm:flex-none sm:px-10">
          {submitting ? '保存中…' : mode === 'create' ? '保存记录' : '保存修改'}
        </Button>
        {mode === 'edit' && entry && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={submitting}>
            <Trash2 size={15} />
            删除
          </Button>
        )}
        <span className="ml-auto hidden items-center gap-1 text-[12px] text-muted sm:flex">
          {savedDraftAt ? <CloudUpload size={13} className="text-accent" /> : null}
          {savedDraftAt
            ? `草稿已自动保存 ${new Date(savedDraftAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
            : '草稿自动保存，可随时离开'}
        </span>
      </div>
    </div>
  );
}
