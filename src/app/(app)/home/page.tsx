import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { getHomeStats, getOnThisDay, getRecentEntries, getYearMonths } from '@/lib/db/dashboard';
import { listMilestones } from '@/lib/db/milestones';
import { EntryCard } from '@/components/entry/EntryCard';
import { EmptyState } from '@/components/ui/spinner';
import { ENTRY_TYPE_LABELS, IMPORTANCE_LABELS } from '@/lib/types';
import { excerpt } from '@/lib/utils';
import {
  BookOpen, Camera, Heart, Flame, Tags, ArrowRight, PenLine, Milestone,
} from 'lucide-react';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) return null;

  const [stats, onThisDay, recent, yearMonths, milestones] = await Promise.resolve([
    getHomeStats(user.id),
    getOnThisDay(user.id),
    getRecentEntries(user.id, 6),
    getYearMonths(user.id),
    listMilestones(user.id, { page: 1, page_size: 3 }),
  ]);

  const today = new Date();
  const todayCN = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const name = user.display_name || '朋友';

  const statCards = [
    { label: '全部记录', value: stats.totalEntries, icon: BookOpen },
    { label: '今年记录', value: stats.thisYearEntries, icon: PenLine },
    { label: '照片', value: stats.photos, icon: Camera },
    { label: '收藏', value: stats.favorites, icon: Heart },
    { label: '标签', value: stats.tags, icon: Tags },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* 欢迎区 */}
      <section className="card overflow-hidden">
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <p className="text-[13px] text-muted">
            {todayCN} · 星期{weekdays[today.getDay()]}
          </p>
          <h1 className="mt-1.5 text-[24px] font-semibold sm:text-[28px]">
            {greeting()}，{name}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            {stats.streak > 0 ? (
              <>
                你已经连续记录 <span className="font-semibold text-accent">{stats.streak}</span> 天，
                每一天都在成为独一无二的人生档案。
              </>
            ) : (
              '今天还没有记录，写下第一笔吧。'
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link href="/entries/new" className="btn-primary">
              <PenLine size={15} />
              记录此刻
            </Link>
            <Link href="/entries/new?type=photo" className="btn-secondary">
              <Camera size={15} />
              上传照片
            </Link>
          </div>
        </div>
      </section>

      {/* 真实统计 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {statCards.map((s) => (
          <div key={s.label} className="card flex items-center gap-3 px-4 py-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <s.icon size={17} />
            </div>
            <div className="min-w-0">
              <div className="text-[19px] font-semibold leading-none">{s.value}</div>
              <div className="mt-1 text-[12px] text-muted">{s.label}</div>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {/* 最近记忆 */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold">最近记忆</h2>
              <Link href="/timeline" className="inline-flex items-center gap-1 text-[13px] text-accent hover:underline">
                全部时间线 <ArrowRight size={13} />
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={<BookOpen size={30} />}
                  title="还没有任何记录"
                  hint="记录一次旅行、一顿晚餐，或只是此刻的心情，都可以从这里开始。"
                  action={
                    <Link href="/entries/new" className="btn-primary">
                      写下第一条记录
                    </Link>
                  }
                />
              </div>
            ) : (
              <div className="space-y-3">
                {recent.map((e) => (
                  <EntryCard key={e.id} entry={e} href={`/entries/${e.id}`} />
                ))}
              </div>
            )}
          </section>

          {/* 往年今日 */}
          {onThisDay.length > 0 && (
            <section>
              <h2 className="mb-3 text-[16px] font-semibold">往年今日</h2>
              <div className="space-y-3">
                {onThisDay.map((e) => (
                  <div key={e.id} className="card border-l-4 border-l-accent p-4">
                    <Link href={`/entries/${e.id}`} className="block">
                      <div className="mb-1 text-[12px] text-accent">
                        {Number(e.occurred_at.slice(0, 4))} 年 · {ENTRY_TYPE_LABELS[e.entry_type]}
                      </div>
                      <div className="text-[14px] font-medium leading-snug">
                        {e.title || excerptText(e.content) || '（无文字记录）'}
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 重要时刻 */}
          {milestones.items.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[16px] font-semibold">重要时刻</h2>
                <Link href="/milestones" className="inline-flex items-center gap-1 text-[13px] text-accent hover:underline">
                  全部时刻 <ArrowRight size={13} />
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {milestones.items.map((m) => (
                  <Link
                    key={m.id}
                    href="/milestones"
                    className="group card flex flex-col items-center overflow-hidden p-0"
                  >
                    <div className="relative w-full overflow-hidden rounded-t-[999px] bg-accent-soft">
                      {m.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/media/${m.cover.id}/thumb`}
                          alt=""
                          className="aspect-square w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center text-accent/60">
                          <Milestone size={34} />
                        </div>
                      )}
                    </div>
                    <div className="w-full px-4 pb-4 pt-3 text-center">
                      <div className="truncate text-[14px] font-semibold">{m.title}</div>
                      <div className="mt-1 text-[12px] text-muted">
                        {m.occurred_at.slice(0, 10)} · {IMPORTANCE_LABELS[m.importance]}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* 时间线预览 */}
        <aside className="space-y-6">
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">时间线</h2>
              <Link href="/timeline" className="text-[12.5px] text-accent hover:underline">
                查看全部
              </Link>
            </div>
            {yearMonths.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-muted">记录后会在这里出现年份</p>
            ) : (
              <div className="space-y-3">
                {yearMonths.slice(0, 6).map(({ year, months }) => (
                  <div key={year} className="flex items-start gap-3">
                    <div className="w-12 shrink-0 pt-0.5 text-[14px] font-semibold text-accent">{year}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {months.map((m) => (
                        <Link
                          key={m}
                          href={`/timeline?year=${year}&month=${m}`}
                          className="rounded-lg border border-border px-2 py-0.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent"
                        >
                          {m}月
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {stats.streak > 0 && (
            <section className="card flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-danger/10 text-danger">
                <Flame size={22} />
              </div>
              <div>
                <div className="text-[15px] font-semibold">连续记录 {stats.streak} 天</div>
                <div className="mt-0.5 text-[12.5px] text-muted">保持下去，记忆会回馈你</div>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function excerptText(md: string): string {
  return excerpt(md, 80);
}
