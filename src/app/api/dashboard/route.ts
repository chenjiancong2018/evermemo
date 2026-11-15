import type { NextRequest } from 'next/server';
import { apiHandler, ok, requireUser } from '@/lib/api/http';
import { getHomeStats, getOnThisDay, getRecentEntries, getYearMonths } from '@/lib/db/dashboard';

/** 人生首页数据 */
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await requireUser();
  return ok({
    stats: getHomeStats(user.id),
    onThisDay: getOnThisDay(user.id),
    recent: getRecentEntries(user.id, 6),
    yearMonths: getYearMonths(user.id),
  });
});
