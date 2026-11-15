'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Archive,
  BookOpen,
  Clock3,
  Compass,
  FileText,
  Heart,
  Home,
  Hourglass,
  Image,
  Map as MapIcon,
  MapPin,
  Milestone,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const GROUPS: { title?: string; items: { href: string; label: string; icon: typeof Home }[] }[] = [
  {
    items: [
      { href: '/home', label: '首页', icon: Home },
      { href: '/timeline', label: '时间线', icon: Clock3 },
      { href: '/gallery', label: '画廊', icon: Image },
      { href: '/search', label: '搜索', icon: Search },
      { href: '/favorites', label: '收藏', icon: Heart },
      { href: '/archives', label: '归档', icon: Archive },
    ],
  },
  {
    title: '人生档案',
    items: [
      { href: '/milestones', label: '重要时刻', icon: Milestone },
      { href: '/people', label: '人物', icon: Users },
      { href: '/places', label: '地点', icon: MapPin },
      { href: '/chapters', label: '人生故事', icon: BookOpen },
      { href: '/stages', label: '人生阶段', icon: Compass },
      { href: '/map', label: '人生地图', icon: MapIcon },
      { href: '/memories', label: '年度纪念册', icon: FileText },
      { href: '/capsules', label: '记忆胶囊', icon: Hourglass },
      { href: '/report', label: '回顾报告', icon: Sparkles },
      { href: '/ai', label: 'AI 助手', icon: Sparkles },
    ],
  },
  {
    items: [
      { href: '/trash', label: '回收站', icon: Trash2 },
      { href: '/settings', label: '设置', icon: Settings },
    ],
  },
];

export function SideNav({ displayName }: { displayName: string }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[230px] flex-col border-r border-border bg-surface/60 backdrop-blur md:flex">
      <div className="flex items-center gap-2.5 px-6 pb-4 pt-7">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
          <span className="font-serif text-[17px] leading-none">忆</span>
        </div>
        <div>
          <div className="text-[15px] font-semibold tracking-wide">Evermemo</div>
          <div className="text-[11px] text-muted">人生数字档案馆</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
        {GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-3' : ''}>
            {group.title && (
              <div className="px-3.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted/70">
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] transition-colors',
                    active
                      ? 'bg-accent-soft font-medium text-accent'
                      : 'text-muted hover:bg-foreground/[0.04] hover:text-foreground'
                  )}
                >
                  <item.icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-6 py-4">
        <Link href="/entries/new" className="btn-primary w-full">
          ＋ 记录此刻
        </Link>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="truncate text-[12px] text-muted">你好，{displayName || '朋友'}</div>
          <ThemeToggle compact />
        </div>
      </div>
    </aside>
  );
}
