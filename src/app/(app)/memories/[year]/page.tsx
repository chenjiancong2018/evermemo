import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/auth/session';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { getStatsPerYear } from '@/lib/db/dashboard';
import { listEntries } from '@/lib/db/entries';
import { listMedia } from '@/lib/db/media';
import { listMilestones } from '@/lib/db/milestones';
import { listChapters } from '@/lib/db/chapters';
import { groupKey, groupTitle, formatDateCN } from '@/lib/utils';
import { ENTRY_TYPE_LABELS, MOOD_COLORS } from '@/lib/types';
import type { EntryWithMeta } from '@/lib/types';
import { PrintButton } from '@/components/memories/PrintButton';

export const metadata: Metadata = { title: '年度纪念册 · Evermemo' };
export const dynamic = 'force-dynamic';

export default async function MemoriesYearPage({ params }: { params: Promise<Record<string, string>> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const { year } = await params;
  const y = Number(year);
  if (!Number.isInteger(y) || y < 1970 || y > 2200) notFound();

  const entries = listEntries(user.id, { page: 1, page_size: 500, year: y });
  const media = listMedia(user.id, { page: 1, page_size: 500, year: String(y) });
  const milestones = listMilestones(user.id, { page: 1, page_size: 100, year: y });
  const chapters = listChapters(user.id, { page: 1, page_size: 100 });
  // 与该年有交集的阶段
  const yearChapters = chapters.items.filter((c) => {
    const s = c.start_date ? Number(c.start_date.slice(0, 4)) : null;
    const e = c.end_date ? Number(c.end_date.slice(0, 4)) : null;
    if (!s && !e) return false;
    return (s === null || s <= y) && (e === null || e >= y);
  });
  const allYears = getStatsPerYear(user.id).map((s) => s.year);
  const prevYear = allYears.filter((v) => v < y).sort((a, b) => b - a)[0];
  const nextYear = allYears.filter((v) => v > y).sort((a, b) => a - b)[0];
  const hasYear = allYears.includes(y);

  // 按日期分组
  const groups = new Map<string, EntryWithMeta[]>();
  for (const e of entries.items) {
    const k = groupKey(e.occurred_at, 'day');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }

  if (!hasYear && entries.total === 0 && media.total === 0 && milestones.total === 0) {
    return (
      <div className="card py-12 text-center text-sm text-muted">
        {y} 年没有任何记录。
        <div className="mt-3">
          <Link href="/memories" className="text-accent hover:underline">
            返回纪念册
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="album-page flex flex-col gap-5">
      {/* 页眉（打印时保留） */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold tabular-nums">{y}</h1>
            <p className="text-sm text-muted">年度数字纪念册 · Evermemo</p>
          </div>
        </div>
        <div className="no-print flex items-center gap-2">
          {prevYear && (
            <Link
              href={`/memories/${prevYear}`}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:border-accent hover:text-accent"
            >
              <ArrowLeft size={13} className="inline" /> {prevYear}
            </Link>
          )}
          <Link href="/memories" className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:border-accent hover:text-accent">
            目录
          </Link>
          {nextYear && (
            <Link
              href={`/memories/${nextYear}`}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:border-accent hover:text-accent"
            >
              {nextYear} <ArrowRight size={13} className="inline" />
            </Link>
          )}
          <a
            href={`/api/export/pdf/memories?year=${y}`}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:border-accent hover:text-accent"
          >
            下载 PDF
          </a>
          <PrintButton />
        </div>
      </div>

      {/* 数据概览 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card !py-3">
          <p className="text-xs text-muted">记录</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{entries.total}</p>
        </div>
        <div className="card !py-3">
          <p className="text-xs text-muted">照片</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{media.total}</p>
        </div>
        <div className="card !py-3">
          <p className="text-xs text-muted">重要时刻</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{milestones.total}</p>
        </div>
        <div className="card !py-3">
          <p className="text-xs text-muted">人生故事</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{yearChapters.length}</p>
        </div>
      </div>

      {/* 重要时刻 */}
      {milestones.items.length > 0 && (
        <section className="card">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Sparkles size={15} className="text-accent" /> 这一年的重要时刻
          </h2>
          <div className="flex flex-col gap-2">
            {milestones.items.map((m) => (
              <div key={m.id} className="flex items-baseline gap-3">
                <span className="shrink-0 text-xs tabular-nums text-muted">{formatDateCN(m.occurred_at)}</span>
                <div>
                  <p className="text-sm font-medium">{m.title}</p>
                  {m.description && <p className="text-xs text-muted">{m.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 照片墙 */}
      {media.items.length > 0 && (
        <section className="card">
          <h2 className="mb-3 text-sm font-medium">这一年的照片（{media.total}）</h2>
          <div className="album-photos columns-2 gap-3 sm:columns-3 lg:columns-4 [&>a]:mb-3">
            {media.items.map((m) => (
              <a key={m.id} href={`/gallery`} className="album-photo block break-inside-avoid">
                <img
                  src={`/api/media/${m.id}/file`}
                  alt={m.caption || '照片'}
                  className="w-full rounded-lg object-cover"
                  style={{ aspectRatio: m.width && m.height ? `${m.width} / ${m.height}` : undefined }}
                />
                {m.caption && <p className="mt-1 text-xs text-muted">{m.caption}</p>}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* 人生故事 */}
      {yearChapters.length > 0 && (
        <section className="card">
          <h2 className="mb-3 text-sm font-medium">这一年的故事</h2>
          <div className="flex flex-col gap-2">
            {yearChapters.map((c) => (
              <Link key={c.id} href={`/chapters/${c.id}`} className="no-print rounded-lg px-2 py-1.5 text-sm hover:bg-accent-soft/50">
                <span className="font-medium">{c.title}</span>
                <span className="ml-2 text-xs text-muted">
                  {[c.start_date, c.end_date].filter(Boolean).join(' ~ ')}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 记录全文 */}
      <section>
        <h2 className="mb-3 text-sm font-medium">记录全文（{entries.total}）</h2>
        <div className="flex flex-col gap-4">
          {Array.from(groups.entries()).map(([key, list]) => (
            <div key={key}>
              <h3 className="mb-2 text-xs font-medium text-muted">{groupTitle(key, 'day')}</h3>
              <div className="flex flex-col gap-2">
                {list.map((e) => (
                  <article key={e.id} className="album-entry card">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="rounded-full bg-accent-soft px-2 py-0.5">{ENTRY_TYPE_LABELS[e.entry_type]}</span>
                      {e.mood && (
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ background: MOOD_COLORS[e.mood as keyof typeof MOOD_COLORS] }} />
                          {e.mood}
                        </span>
                      )}
                      {e.title && <span className="font-medium text-foreground">{e.title}</span>}
                    </div>
                    {e.content && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{e.content}</p>}
                    {e.tags.length > 0 && (
                      <p className="mt-2 text-xs text-muted">{e.tags.map((t) => `#${t.name}`).join(' ')}</p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="pb-4 text-center text-xs text-muted">Evermemo · 人生数字档案馆 · {y} 年纪念册</p>
    </div>
  );
}
