import type { SessionUser } from '@/lib/auth/session';
import { SideNav } from './SideNav';
import { MobileNav } from './MobileNav';

/** 应用外壳：桌面左侧导航 + 移动端底部导航 */
export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <SideNav displayName={user.display_name} />
      <main className="min-h-dvh md:pl-[230px]">
        <div className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-5 md:px-8 md:pb-12 md:pt-8">
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
