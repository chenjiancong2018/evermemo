import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getStatsPerYear } from '@/lib/db/dashboard';

export const metadata: Metadata = { title: '年度纪念册 · Evermemo' };
export const dynamic = 'force-dynamic';

export default async function MemoriesIndex() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const years = getStatsPerYear(user.id);
  const yearsDesc = [...years].reverse();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">年度纪念册</h1>
        <p className="mt-1 text-sm text-muted">每一年都值得被装订成册。点击任意年份，翻开那一年的回忆。</p>
      </div>
      {yearsDesc.length === 0 ? (
        <div className="card py-12 text-center text-sm text-muted">
          还没有记录，纪念册无从装订。先写下第一笔吧。
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {yearsDesc.map((y) => {
            return (
              <a
                key={y.year}
                href={`/memories/${y.year}`}
                className="card group flex flex-col gap-1 transition-colors hover:border-accent"
              >
                <span className="text-2xl font-semibold tabular-nums">{y.year}</span>
                <span className="text-xs text-muted">
                  {y.entries} 条记录 · {y.photos} 张照片
                </span>
                <span className="text-xs text-muted group-hover:text-accent">
                  {y.milestones > 0 ? `${y.milestones} 个重要时刻 · ` : ''}翻开这一年 →
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
