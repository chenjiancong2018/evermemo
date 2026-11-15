import type { NextRequest } from 'next/server';
import { apiHandler, ok, requireUser } from '@/lib/api/http';
import { listDrafts } from '@/lib/db/ai';

/** AI 草稿列表（?kind=organize|review|ask|yearly|story） */
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const kind = sp.get('kind');
  const valid = ['organize', 'review', 'ask', 'yearly', 'story'];
  const drafts = listDrafts(
    user.id,
    valid.includes(kind ?? '') ? (kind as 'organize' | 'review' | 'ask' | 'yearly' | 'story') : undefined,
    50
  );
  return ok({ drafts });
});
