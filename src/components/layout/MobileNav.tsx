'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Clock3, Image as ImageIcon, User, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/home', label: '首页', icon: Home },
  { href: '/timeline', label: '时间线', icon: Clock3 },
  { href: '/gallery', label: '画廊', icon: ImageIcon },
  { href: '/me', label: '我的', icon: User },
];

/** 移动端底部导航：中央突出的「＋」快速记录 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="grid grid-cols-5 items-end">
        {NAV.slice(0, 2).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2.5 text-[11px]',
                active ? 'text-accent' : 'text-muted'
              )}
            >
              <item.icon size={21} strokeWidth={active ? 2.2 : 1.7} />
              {item.label}
            </Link>
          );
        })}

        <Link href="/entries/new" className="flex flex-col items-center">
          <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 active:scale-95 transition-transform">
            <Plus size={26} />
          </span>
          <span className="mt-0.5 text-[11px] text-accent">记录</span>
        </Link>

        {NAV.slice(2).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2.5 text-[11px]',
                active ? 'text-accent' : 'text-muted'
              )}
            >
              <item.icon size={21} strokeWidth={active ? 2.2 : 1.7} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
