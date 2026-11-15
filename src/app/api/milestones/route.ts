import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser } from '@/lib/api/http';
import { milestoneCreateSchema } from '@/lib/api/schemas';
import { createMilestone, listMilestones } from '@/lib/db/milestones';

/** GET /api/milestones — 重要时刻列表（可 ?year= 按年份浏览） */
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const yearRaw = sp.get('year');
  const year = yearRaw ? Number(yearRaw) : undefined;
  if (year !== undefined && (!Number.isInteger(year) || year < 1900 || year > 2200)) {
    return fail(400, 'VALIDATION', '年份参数不合法');
  }
  const result = listMilestones(user.id, { page: 1, page_size: 100, year });
  return ok(result);
});

/** POST /api/milestones — 新增重要时刻 */
export const POST = apiHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = milestoneCreateSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const milestone = createMilestone(user.id, parsed.data);
  return ok(milestone);
});
