'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarRange, FileBarChart2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { PrintButton } from '@/components/memories/PrintButton';
import { formatDateCN, groupTitle } from '@/lib/utils';
import { ENTRY_TYPE_LABELS, MOOD_COLORS, type EntryWithMeta, type Mood } from '@/lib/types';

interface RangePreset {
  key: string;
  label: string;
  from: string;
  to: string;
}

function shiftDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const PRESETS: RangePreset[] = [
  { key: 'this-year', label: '今年', from: `${new Date().getFullYear()}-01-01`, to: shiftDays(0) },
  { key: 'last-year', label: '去年', from: `${new Date().getFullYear() - 1}-01-01`, to: `${new Date().getFullYear() - 1}-12-31` },
  { key: 'recent-90', label: '最近 90 天', from: shiftDays(-90), to: shiftDays(0) },
  { key: 'recent-30', label: '最近 30 天', from: shiftDays(-30), to: shiftDays(0) },
];

interface ReportData {
  entries: EntryWithMeta[];
  total: number;
  photos: number;
  favorites: number;
  important: number;
  byMonth: { month: string; count: number }[];
  byType: { type: string; count: number }[];
  byMood: { mood: string; count: number }[];
  byTag: { tag: string; count: number }[];
  firstAt: string | null;
  lastAt: string | null;
  activeDays: number;
  longestStreak: number;
  topDay: { date: string; count: number } | null;
}

function compute(entries: EntryWithMeta[]): ReportData {
  const monthMap = new Map<string, number>();
  const typeMap = new Map<string, number>();
  const moodMap = new Map<string, number>();
  const tagMap = new Map<string, number>();
  const dayMap = new Map<string, number>();
  let photos = 0;
  let favorites = 0;
  let important = 0;
  for (const e of entries) {
    const month = e.occurred_at.slice(0, 7);
    monthMap.set(month, (monthMap.get(month) ?? 0) + 1);
    typeMap.set(e.entry_type, (typeMap.get(e.entry_type) ?? 0) + 1);
    if (e.mood) moodMap.set(e.mood, (moodMap.get(e.mood) ?? 0) + 1);
    for (const t of e.tags) tagMap.set(t.name, (tagMap.get(t.name) ?? 0) + 1);
    const day = e.occurred_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    photos += e.media.length;
    if (e.is_favorite) favorites += 1;
    if (e.is_important) important += 1;
  }
  // 连续记录天数（活跃日集合的最长连续段）
  const days = Array.from(dayMap.keys()).sort();
  let longestStreak = 0;
  let cur = 0;
  let prev: number | null = null;
  for (const d of days) {
    const t = new Date(d + 'T00:00:00').getTime();
    if (prev !== null && t - prev === 86400000) cur += 1;
    else cur = 1;
    longestStreak = Math.max(longestStreak, cur);
    prev = t;
  }
  const topDay = Array.from(dayMap.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
  return {
    entries,
    total: entries.length,
    photos,
    favorites,
    important,
    byMonth: Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count })),
    byType: Array.from(typeMap.entries()).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count })),
    byMood: Array.from(moodMap.entries()).sort((a, b) => b[1] - a[1]).map(([mood, count]) => ({ mood, count })),
    byTag: Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([tag, count]) => ({ tag, count })),
    firstAt: entries.length ? entries.map((e) => e.occurred_at).sort()[0] : null,
    lastAt: entries.length ? entries.map((e) => e.occurred_at).sort().at(-1)! : null,
    activeDays: dayMap.size,
    longestStreak,
    topDay: topDay ? { date: topDay[0], count: topDay[1] } : null,
  };
}

export default function ReportView() {
  const { toast } = useToast();
  const [preset, setPreset] = useState<string>('this-year');
  const [from, setFrom] = useState(PRESETS[0].from);
  const [to, setTo] = useState(PRESETS[0].to);
  const [custom, setCustom] = useState(false);
  const [title, setTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);

  const applyPreset = (key: string) => {
    setPreset(key);
    const p = PRESETS.find((x) => x.key === key)!;
    setFrom(p.from);
    setTo(p.to);
  };

  const generate = async () => {
    if (!from || !to) return toast('请选择报告的时间范围', 'error');
    setGenerating(true);
    try {
      // page_size 上限 100，分页拉全量（报告最多 10 页即 1000 条）
      const all: EntryWithMeta[] = [];
      for (let page = 1; page <= 10; page++) {
        const data = await api<{ items: EntryWithMeta[]; total: number; has_more: boolean }>(
          `/api/entries?from=${from}&to=${to}&page=${page}&page_size=100`
        );
        all.push(...data.items);
        if (!data.has_more) break;
      }
      setReport(compute(all));
    } catch (err) {
      toast(err instanceof Error ? err.message : '生成失败', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 配置面板（打印时隐藏） */}
      <div className="no-print card">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <CalendarRange size={15} className="text-accent" /> 选择报告范围
        </h2>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setCustom(false);
                  applyPreset(p.key);
                }}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  !custom && preset === p.key
                    ? 'bg-accent text-white'
                    : 'border border-border text-muted hover:border-accent hover:text-accent'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setCustom(true)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                custom ? 'bg-accent text-white' : 'border border-border text-muted hover:border-accent hover:text-accent'
              }`}
            >
              自定义
            </button>
          </div>
          {custom && (
            <div className="flex flex-wrap items-center gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="!w-auto" />
              <span className="text-xs text-muted">至</span>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="!w-auto" />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="报告标题（可选）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              className="max-w-xs"
            />
            <Button onClick={() => void generate()} loading={generating}>
              <FileBarChart2 size={14} /> 生成报告
            </Button>
          </div>
        </div>
      </div>

      {report && (
        <div className="album-page flex flex-col gap-5">
          {/* 报告头（打印保留） */}
          <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h1 className="text-2xl font-semibold">{title || '人生回顾报告'}</h1>
              <p className="mt-1 text-sm text-muted">
                {report.firstAt ? `${formatDateCN(report.firstAt)} 至 ${formatDateCN(report.lastAt!)}` : '该区间没有记录'} · Evermemo
              </p>
            </div>
            <div className="no-print flex items-center gap-2">
              <a
                href={`/api/export/pdf/report?from=${from}&to=${to}&title=${encodeURIComponent(title || '人生回顾报告')}`}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:border-accent hover:text-accent"
              >
                下载 PDF
              </a>
              <PrintButton />
            </div>
          </div>

          {report.total === 0 ? (
            <div className="card py-10 text-center text-sm text-muted">
              这段时间还没有记录。换个范围试试，或者先写下几笔。
            </div>
          ) : (
            <>
              {/* 概览 */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['记录', report.total],
                  ['照片', report.photos],
                  ['收藏', report.favorites],
                  ['重要', report.important],
                  ['活跃天数', report.activeDays],
                  ['最长连续', `${report.longestStreak} 天`],
                ].map(([label, value]) => (
                  <div key={label} className="card !py-3">
                    <p className="text-xs text-muted">{label}</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>

              {/* 月度分布 */}
              {report.byMonth.length > 0 && (
                <section className="card">
                  <h2 className="mb-3 text-sm font-medium">月度足迹</h2>
                  <div className="flex items-end gap-1.5" style={{ height: 120 }}>
                    {report.byMonth.map((m) => {
                      const max = Math.max(...report.byMonth.map((x) => x.count));
                      return (
                        <div key={m.month} className="flex flex-1 flex-col items-center gap-1" title={`${m.month}：${m.count} 条`}>
                          <span className="text-[10px] tabular-nums text-muted">{m.count}</span>
                          <div
                            className="w-full rounded-t bg-accent/70"
                            style={{ height: `${Math.max(4, (m.count / max) * 96)}px` }}
                          />
                          <span className="text-[10px] tabular-nums text-muted">{m.month.slice(5)}月</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 类型与心情 */}
              <div className="grid gap-3 sm:grid-cols-2">
                {report.byType.length > 0 && (
                  <section className="card">
                    <h2 className="mb-3 text-sm font-medium">记录类型</h2>
                    <div className="flex flex-col gap-2">
                      {report.byType.map((t) => (
                        <div key={t.type} className="flex items-center gap-2">
                          <span className="w-12 shrink-0 text-xs text-muted">{ENTRY_TYPE_LABELS[t.type as keyof typeof ENTRY_TYPE_LABELS]}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-accent-soft">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${(t.count / report.total) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted">{t.count}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {report.byMood.length > 0 && (
                  <section className="card">
                    <h2 className="mb-3 text-sm font-medium">心情分布</h2>
                    <div className="flex flex-col gap-2">
                      {report.byMood.map((m) => (
                        <div key={m.mood} className="flex items-center gap-2">
                          <span className="flex w-12 shrink-0 items-center gap-1 text-xs text-muted">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: MOOD_COLORS[m.mood as Mood] }}
                            />
                            {m.mood}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-accent-soft">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${(m.count / report.total) * 100}%`, background: MOOD_COLORS[m.mood as Mood] }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted">{m.count}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* 标签 */}
              {report.byTag.length > 0 && (
                <section className="card">
                  <h2 className="mb-3 text-sm font-medium">高频标签</h2>
                  <div className="flex flex-wrap gap-2">
                    {report.byTag.map((t) => (
                      <span key={t.tag} className="rounded-full bg-accent-soft px-3 py-1 text-xs">
                        #{t.tag} <span className="tabular-nums text-muted">×{t.count}</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* 高光 */}
              {report.topDay && (
                <section className="card">
                  <h2 className="mb-2 text-sm font-medium">高光时刻</h2>
                  <p className="text-sm text-muted">
                    记录最多的一天是 {formatDateCN(report.topDay.date)}
                    <span className="no-print">
                      （<Link href={`/timeline?date=${report.topDay.date}`} className="font-medium text-accent hover:underline">
                        查看这一天
                      </Link>）
                    </span>
                    ，当天写下了 {report.topDay.count} 条记录。
                  </p>
                </section>
              )}

              <p className="pb-4 text-center text-xs text-muted">Evermemo · 人生回顾报告 · 生成于 {formatDateCN(new Date().toISOString().slice(0, 10))}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
