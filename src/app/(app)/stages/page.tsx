import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Camera, FileText, Flag, Sparkles } from 'lucide-react';
import { getFirstEntryAt, getStatsPerYear } from '@/lib/db/dashboard';
import { getHomeStats } from '@/lib/db/dashboard';
import { listChapters } from '@/lib/db/chapters';
import { listMilestones } from '@/lib/db/milestones';
import { formatDateCN } from '@/lib/utils';

export const metadata: Metadata = { title: '人生阶段 · Evermemo' };
export const dynamic = 'force-dynamic';

export default async function StagesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const years = getStatsPerYear(user.id);
  const firstAt = getFirstEntryAt(user.id);
  const stats = getHomeStats(user.id);
  const chapters = listChapters(user.id, { page: 1, page_size: 50 });
  const milestones = listMilestones(user.id, { page: 1, page_size: 200 });
  const maxEntries = Math.max(1, ...years.map((y) => y.entries));

  // 总天数：第一条记录至今
  const totalDays = firstAt ? Math.max(1, Math.ceil((Date.now() - new Date(firstAt).getTime()) / 86400000)) : 0;

  const yearLookup = new Map(years.map((y) => [y.year, y]));
  const firstYear = years[0]?.year;
  const lastYear = years[years.length - 1]?.year ?? new Date().getFullYear();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">人生阶段</h1>
        <p className="mt-1 text-sm text-muted">把时间轴铺开，看见自己走过的路。</p>
      </div>

      {/* 总览 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="card">
          <p className="text-xs text-muted">第一条记录</p>
          <p className="mt-1 text-lg font-semibold">{firstAt ? formatDateCN(firstAt) : '—'}</p>
        </div>
        <div className="card">
          <p className="text-xs text-muted">记录时长</p>
          <p className="mt-1 text-lg font-semibold">{totalDays ? `${Math.floor(totalDays / 365)} 年 ${totalDays % 365} 天` : '—'}</p>
        </div>
        <div className="card">
          <p className="text-xs text-muted">全部记录</p>
          <p className="mt-1 text-lg font-semibold">{stats.totalEntries}</p>
        </div>
        <div className="card">
          <p className="text-xs text-muted">照片</p>
          <p className="mt-1 text-lg font-semibold">{stats.photos}</p>
        </div>
        <div className="card">
          <p className="text-xs text-muted">人生故事</p>
          <p className="mt-1 text-lg font-semibold">{chapters.total}</p>
        </div>
      </div>

      {years.length === 0 ? (
        <div className="card py-10 text-center text-sm text-muted">还没有任何记录，时间轴是空白的。写下第一笔吧。</div>
      ) : (
        <div className="card">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-medium">
            <Flag size={15} className="text-accent" /> 年度足迹
          </h2>
          <div className="flex flex-col gap-1">
            {years.map((y) => (
              <Link
                key={y.year}
                href={`/timeline?year=${y.year}`}
                className="group grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent-soft/50"
              >
                <span className="text-sm font-medium tabular-nums">{y.year}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-accent-soft">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${Math.max(4, (y.entries / maxEntries) * 100)}%` }}
                    />
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <FileText size={11} /> {y.entries}
                  </span>
                  {y.photos > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <Camera size={11} /> {y.photos}
                    </span>
                  )}
                  {y.milestones > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted" title="重要时刻">
                      <Sparkles size={11} /> {y.milestones}
                    </span>
                  )}
                  {y.chapterEntries > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted" title="属于人生故事">
                      <BookOpen size={11} /> {y.chapterEntries}
                    </span>
                  )}
                </div>
                <span className="hidden text-xs text-muted group-hover:text-accent sm:block">查看这一年 →</span>
              </Link>
            ))}
          </div>
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
            {firstYear === lastYear ? '记录集中在同一年。' : `从 ${firstYear} 到 ${lastYear}，共 ${years.length} 个年份有记录。`}
            点击任一年份跳转到对应时间线。
          </p>
        </div>
      )}

      {/* 人生故事阶段 */}
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <BookOpen size={15} className="text-accent" /> 人生阶段（人生故事）
          </h2>
          <Link href="/chapters" className="text-xs text-accent hover:underline">
            管理人生故事 →
          </Link>
        </div>
        {chapters.items.length === 0 ? (
          <p className="text-sm text-muted">
            还没有人生故事。把一段日子写成故事，它就会成为时间轴上的一个阶段。
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {chapters.items.map((c) => {
              const startYear = c.start_date ? Number(c.start_date.slice(0, 4)) : null;
              const endYear = c.end_date ? Number(c.end_date.slice(0, 4)) : null;
              // 计算该故事在年度轴上的覆盖宽度（相对总跨度）
              const spanStart = startYear && firstYear ? Math.max(0, startYear - firstYear) : 0;
              const spanEnd = endYear && firstYear ? Math.max(spanStart, endYear - firstYear) : spanStart;
              const totalSpan = Math.max(1, (lastYear ?? new Date().getFullYear()) - (firstYear ?? new Date().getFullYear()));
              const leftPct = (spanStart / totalSpan) * 100;
              const widthPct = Math.max(6, ((spanEnd - spanStart + 1) / totalSpan) * 100);
              return (
                <Link
                  key={c.id}
                  href={`/chapters/${c.id}`}
                  className="group flex flex-col gap-1.5 rounded-lg px-2 py-2 hover:bg-accent-soft/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.title}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {[c.start_date, c.end_date].filter(Boolean).join(' ~ ')}
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-accent-soft">
                    <div
                      className="absolute top-0 h-full rounded-full bg-accent/70 transition-colors group-hover:bg-accent"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    />
                  </div>
                  {c.description && <p className="line-clamp-1 text-xs text-muted">{c.description}</p>}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* 重要时刻标记 */}
      {milestones.items.length > 0 && (
        <div className="card">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Sparkles size={15} className="text-accent" /> 重要时刻（{milestones.total}）
          </h2>
          <div className="flex flex-wrap gap-2">
            {milestones.items.map((m) => (
              <Link
                key={m.id}
                href="/milestones"
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
              >
                {m.title} · {m.occurred_at.slice(0, 4)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 空白年份说明（长年无记录的年份列表） */}
      {firstYear && lastYear && lastYear - firstYear > years.length && (
        <p className="text-center text-xs text-muted">
          其中 {lastYear - firstYear + 1 - years.length} 个年份还没有记录——人生允许留白。
        </p>
      )}
    </div>
  );
}
