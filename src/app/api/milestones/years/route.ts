import type { NextRequest } from 'next/server';
import { apiHandler, ok, requireUser } from '@/lib/api/http';
import { listMilestoneYears } from '@/lib/db/milestones';

/** GET /api/milestones/years — 有重要时刻的年份列表（降序） */
export const GET = apiHandler(async (_req: NextRequest) => {
  const user = await requireUser();
  const years = listMilestoneYears(user.id);
  return ok({ years });
});
