import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { ToastProvider } from '@/components/ui/toast';

/** 认证区：已登录则直接进首页 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (user) redirect('/home');
  return (
    <ToastProvider>
      <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </ToastProvider>
  );
}
