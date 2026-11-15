import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok } from '@/lib/api/http';
import { getSessionUser } from '@/lib/auth/session';

/** 当前登录用户信息 */
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return fail(401, 'UNAUTHORIZED', '请先登录');
  return ok({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    bio: user.bio,
    timezone: user.timezone,
    locale: user.locale,
    created_at: user.created_at,
  });
});
