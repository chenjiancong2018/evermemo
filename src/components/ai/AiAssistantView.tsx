'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, CalendarRange, MessageCircle, CalendarDays, FileText, Trash2,
  Check, X, RotateCcw, Send, Link2, AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { useToast } from '@/components/ui/toast';
import { Spinner, EmptyState } from '@/components/ui/spinner';
import { MarkdownView } from '@/components/entry/MarkdownView';
import { ENTRY_TYPE_LABELS } from '@/lib/types';
import type { EntryWithMeta } from '@/lib/types';

interface AiConfig {
  configured: boolean;
  mock: boolean;
  model: string;
  apiBase: string;
}

interface Draft {
  id: string;
  kind: 'organize' | 'review' | 'ask' | 'yearly' | 'story';
  title: string;
  content: string;
  meta: string;
  source_entry_ids: string;
  status: 'pending' | 'applied' | 'discarded';
  is_mock: number;
  created_at: string;
}

interface Citation {
  id: string;
  title: string;
  occurred_at: string;
}

interface AskMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: string;
  is_mock: number;
  created_at: string;
}

interface YearlyMeta {
  year: number;
  keywords: string[];
  events: string[];
  travels: string[];
  photos: string[];
  quotes: string[];
}

type Tab = 'review' | 'ask' | 'yearly' | 'drafts';

const KIND_LABEL: Record<string, string> = {
  organize: '记录整理', review: '回顾', ask: '问答', yearly: '年度回顾', story: '故事整理',
};

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function AiAssistantView() {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('review');
  const [cfg, setCfg] = useState<AiConfig | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<AiConfig>('/api/ai/config')
      .then(setCfg)
      .catch(() => setCfg(null));
  }, []);

  const notConfigured = cfg && !cfg.configured && !cfg.mock;

  return (
    <div className="fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">AI 助手</h1>
        <p className="text-sm text-muted mt-1">
          AI 只做整理、回顾与问答，所有产出都是草稿，经你确认后才会应用——它永远不会替你改写记忆原文。
        </p>
      </div>

      {notConfigured && (
        <div className="card mb-6 border-accent-soft bg-accent-soft/40 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">AI 尚未配置</p>
            <p className="text-muted mt-1">
              在服务器环境变量中设置 <code className="text-xs bg-surface px-1 rounded">AI_API_BASE</code>、{' '}
              <code className="text-xs bg-surface px-1 rounded">AI_API_KEY</code>（可选{' '}
              <code className="text-xs bg-surface px-1 rounded">AI_MODEL</code>），重启后即可使用。
              开发环境可设置 <code className="text-xs bg-surface px-1 rounded">AI_MOCK=1</code> 体验流程（响应会带 [MOCK] 标记）。
              接口为 OpenAI 兼容格式（{'{base}'}/chat/completions 与 /embeddings），Key 只保存在服务端。
            </p>
          </div>
        </div>
      )}
      {cfg?.mock && (
        <div className="card mb-6 border-warning/30 bg-warning/5 p-3 text-sm text-muted flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> 当前处于 AI 模拟模式（AI_MOCK=1），所有回复均带 [MOCK] 标记，不会调用真实模型。
        </div>
      )}

      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {(
          [
            ['review', '回顾', CalendarRange],
            ['ask', '问答', MessageCircle],
            ['yearly', '年度回顾', CalendarDays],
            ['drafts', '草稿箱', FileText],
          ] as [Tab, string, typeof CalendarRange][]
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'review' && <ReviewTab busy={busy} setBusy={setBusy} toast={toast} />}
      {tab === 'ask' && <AskTab busy={busy} setBusy={setBusy} toast={toast} router={router} />}
      {tab === 'yearly' && <YearlyTab busy={busy} setBusy={setBusy} toast={toast} />}
      {tab === 'drafts' && <DraftsTab toast={toast} />}
    </div>
  );
}

/* ---------------- 回顾 ---------------- */

function ReviewTab({
  busy, setBusy, toast,
}: {
  busy: boolean; setBusy: (b: boolean) => void;
  toast: (msg: string, kind?: 'success' | 'error' | 'info') => void;
}) {
  const [preset, setPreset] = useState('week');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [result, setResult] = useState<Draft | null>(null);
  const [notEnough, setNotEnough] = useState<string | null>(null);

  const run = async (s: string, e: string) => {
    if (!s || !e) return;
    setBusy(true);
    setNotEnough(null);
    setResult(null);
    try {
      const res = await api<{ notEnough?: boolean; message?: string; draft?: Draft }>('/api/ai/review', {
        method: 'POST',
        body: JSON.stringify({ start: s, end: e, label: `${s} 至 ${e}` }),
      });
      if (res.notEnough) {
        setNotEnough(res.message ?? '这个时间段还没有记录。');
      } else if (res.draft) {
        setResult(res.draft);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '生成回顾失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (preset === 'custom') return;
    const today = todayStr();
    if (preset === 'today') { setStart(today); setEnd(today); }
    if (preset === 'week') { setStart(shiftDays(today, -6)); setEnd(today); }
    if (preset === 'month') { setStart(`${today.slice(0, 7)}-01`); setEnd(today); }
  }, [preset]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['today', 'week', 'month', 'custom'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`btn text-sm ${preset === p ? 'btn-primary' : 'btn-secondary'}`}
          >
            {{ today: '今天', week: '最近一周', month: '本月', custom: '自定义' }[p]}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" className="input-base w-40" value={start} onChange={(e) => setStart(e.target.value)} />
            <span className="text-muted">至</span>
            <input type="date" className="input-base w-40" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        )}
        <button
          className="btn btn-primary text-sm"
          disabled={busy || !start || !end}
          onClick={() => run(start, end)}
        >
          {busy ? <Spinner className="w-4 h-4" /> : '生成回顾'}
        </button>
      </div>

      {notEnough && (
        <div className="card p-6 text-center">
          <p className="text-muted">{notEnough}</p>
        </div>
      )}
      {result && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{result.title}</h2>
            {result.is_mock ? (
              <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded">MOCK</span>
            ) : null}
          </div>
          <MarkdownView content={result.content} />
          <div className="flex gap-2">
            <button
              className="btn btn-secondary text-sm"
              onClick={() => api(`/api/ai/drafts/${result.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'applied' }) })
                .then(() => toast('回顾已收藏到草稿箱', 'success'))}
            >
              <Check className="w-4 h-4" /> 收藏到草稿箱
            </button>
            <button
              className="btn btn-secondary text-sm"
              onClick={() => api(`/api/ai/drafts/${result.id}`, { method: 'DELETE' })
                .then(() => { setResult(null); toast('已丢弃', 'info'); })}
            >
              <X className="w-4 h-4" /> 丢弃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- 问答 ---------------- */

function AskTab({
  busy, setBusy, toast, router,
}: {
  busy: boolean; setBusy: (b: boolean) => void;
  toast: (msg: string, kind?: 'success' | 'error' | 'info') => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ messages: AskMessage[] }>('/api/ai/ask')
      .then((res) => setMessages(res.messages))
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const q = question.trim();
    if (!q || busy || loading) return;
    setQuestion('');
    setBusy(true);
    setLoading(true);
    const userMsg: AskMessage = { id: `local-${Date.now()}`, role: 'user', content: q, citations: '[]', is_mock: 0, created_at: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);
    try {
      const res = await api<{ message: AskMessage }>('/api/ai/ask', {
        method: 'POST',
        body: JSON.stringify({ question: q }),
      });
      setMessages((m) => [...m, res.message]);
    } catch (err) {
      toast(err instanceof Error ? err.message : '提问失败', 'error');
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  const clear = async () => {
    await api('/api/ai/ask', { method: 'DELETE' }).then(() => setMessages([])).catch(() => {});
  };

  return (
    <div className="flex flex-col" style={{ minHeight: 420 }}>
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1" style={{ maxHeight: 420 }}>
        {messages.length === 0 && (
          <EmptyState icon={<MessageCircle size={28} />} title="向你的记忆提问" hint="例如：我今年最开心的事是什么？我喜欢去哪些地方？" />
        )}
        {messages.map((m) => {
          const citations = (JSON.parse(m.citations || '[]') as Citation[]);
          return (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[85%] ${m.role === 'user' ? 'bg-accent text-surface' : 'bg-surface border border-border'} rounded-xl px-4 py-3 text-sm`}>
                {m.role === 'assistant' ? (
                  <>
                    <MarkdownView content={m.content} />
                    {m.is_mock ? <span className="text-xs opacity-60">（MOCK）</span> : null}
                    {citations.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-border/60 space-y-1">
                        <p className="text-xs text-muted mb-1">引用记录：</p>
                        {citations.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => router.push(`/entries/${c.id}`)}
                            className="flex items-center gap-1 text-xs text-accent hover:underline text-left"
                          >
                            <Link2 className="w-3 h-3 shrink-0" />
                            {c.title} · {c.occurred_at}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  m.content
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <input
          className="input-base flex-1"
          placeholder="问问你的人生记忆…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        />
        <button className="btn btn-primary" onClick={send} disabled={busy || loading}>
          {loading ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
        </button>
        <button className="btn btn-ghost text-muted" onClick={clear} title="清空对话">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- 年度回顾 ---------------- */

function YearlyTab({
  busy, setBusy, toast,
}: {
  busy: boolean; setBusy: (b: boolean) => void;
  toast: (msg: string, kind?: 'success' | 'error' | 'info') => void;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notEnough, setNotEnough] = useState<string | null>(null);
  const meta = draft ? (JSON.parse(draft.meta || '{}') as YearlyMeta) : null;

  const run = async () => {
    setBusy(true);
    setNotEnough(null);
    setDraft(null);
    try {
      const res = await api<{ notEnough?: boolean; message?: string; draft?: Draft }>('/api/ai/yearly', {
        method: 'POST',
        body: JSON.stringify({ year }),
      });
      if (res.notEnough) setNotEnough(res.message ?? '这一年还没有记录。');
      else if (res.draft) setDraft(res.draft);
    } catch (err) {
      toast(err instanceof Error ? err.message : '生成失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="input-base w-32"
          value={year}
          min={1900}
          max={2200}
          onChange={(e) => setYear(Number(e.target.value))}
        />
        <button className="btn btn-primary text-sm" onClick={run} disabled={busy}>
          {busy ? <Spinner className="w-4 h-4" /> : '生成年度回顾'}
        </button>
      </div>
      {notEnough && <div className="card p-6 text-center text-muted">{notEnough}</div>}
      {draft && meta && (
        <div className="card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{draft.title}</h2>
            {draft.is_mock ? <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded">MOCK</span> : null}
          </div>
          {meta.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {meta.keywords.map((k) => (
                <span key={k} className="text-sm bg-accent-soft text-accent px-2.5 py-1 rounded-full">{k}</span>
              ))}
            </div>
          )}
          {meta.events?.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted mb-2">重要事件</h3>
              <ul className="space-y-1 text-sm list-disc pl-5">
                {meta.events.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          {meta.travels?.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted mb-2">旅行回忆</h3>
              <ul className="space-y-1 text-sm list-disc pl-5">
                {meta.travels.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          {meta.quotes?.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted mb-2">你写过的文字</h3>
              <div className="space-y-2">
                {meta.quotes.map((q, i) => (
                  <blockquote key={i} className="border-l-2 border-accent-soft pl-3 text-sm italic text-muted">{q}</blockquote>
                ))}
              </div>
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-muted mb-2">年度故事</h3>
            <MarkdownView content={draft.content} />
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary text-sm"
              onClick={() => api(`/api/ai/drafts/${draft.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'applied' }) })
                .then(() => toast('已收藏到草稿箱', 'success'))}
            >
              <Check className="w-4 h-4" /> 收藏到草稿箱
            </button>
            <button
              className="btn btn-secondary text-sm"
              onClick={() => api(`/api/ai/drafts/${draft.id}`, { method: 'DELETE' }).then(() => { setDraft(null); toast('已丢弃', 'info'); })}
            >
              <X className="w-4 h-4" /> 丢弃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- 草稿箱 ---------------- */

function DraftsTab({ toast }: { toast: (msg: string, kind?: 'success' | 'error' | 'info') => void }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api<{ drafts: Draft[] }>('/api/ai/drafts')
      .then((res) => setDrafts(res.drafts.filter((d) => d.status === 'pending' || d.status === 'applied')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = async (id: string) => {
    if (!window.confirm('确定删除这个草稿吗？')) return;
    try {
      await api(`/api/ai/drafts/${id}`, { method: 'DELETE' });
      toast('已删除', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    }
  };

  if (loading) return <div className="py-10 flex justify-center"><Spinner /></div>;
  if (drafts.length === 0) {
    return <EmptyState icon={<FileText size={28} />} title="草稿箱是空的" hint="生成的回顾、年度总结都会先存在这里，由你决定是否采用。" />;
  }

  return (
    <div className="space-y-3">
      {drafts.map((d) => {
        const meta = JSON.parse(d.meta || '{}') as Record<string, unknown>;
        return (
          <div key={d.id} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs bg-accent-soft text-accent px-2 py-0.5 rounded whitespace-nowrap">{KIND_LABEL[d.kind] ?? d.kind}</span>
                <h3 className="font-medium truncate">{d.title || '（无标题）'}</h3>
                {d.is_mock ? <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded">MOCK</span> : null}
                <span className="text-xs text-muted">{new Date(d.created_at).toLocaleString('zh-CN')}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button className="btn btn-ghost p-1.5" title="删除" onClick={() => del(d.id)}>
                  <Trash2 className="w-4 h-4 text-muted" />
                </button>
              </div>
            </div>
            <div className="mt-2 text-sm text-muted line-clamp-3 whitespace-pre-wrap">{d.content.slice(0, 300)}</div>
            {Object.keys(meta).length > 0 && (
              <div className="mt-2 text-xs text-muted truncate">
                {Object.entries(meta).map(([k, v]) => `${k}: ${Array.isArray(v) ? `${v.length} 项` : String(v).slice(0, 60)}`).join(' · ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
