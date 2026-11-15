import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';

/** 入口：已登录 → 人生首页；未登录 → 登录页 */
export default async function RootPage() {
  const user = await getSessionUser();
  redirect(user ? '/home' : '/login');
}
