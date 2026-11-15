import Link from 'next/link';
import {
  Archive,
  BookOpen,
  ChevronRight,
  Compass,
  FileText,
  Heart,
  Hourglass,
  Map as MapIcon,
  MapPin,
  Milestone,
  Settings,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const GROUPS: { title: string; items: { href: string; label: string; desc: string; icon: typeof Heart }[] }[] = [
  {
    title: '人生档案',
    items: [
      { href: '/milestones', label: '重要时刻', desc: '值得铭记的纪念碑', icon: Milestone },
      { href: '/people', label: '人物', desc: '生命中重要的人', icon: Users },
      { href: '/places', label: '地点', desc: '走过的每一个地方', icon: MapPin },
      { href: '/chapters', label: '人生故事', desc: '串起记忆的篇章', icon: BookOpen },
      { href: '/stages', label: '人生阶段', desc: '时间轴上的足迹分布', icon: Compass },
      { href: '/map', label: '人生地图', desc: '在地图上回顾足迹', icon: MapIcon },
      { href: '/memories', label: '年度纪念册', desc: '把一年装订成册', icon: FileText },
      { href: '/capsules', label: '记忆胶囊', desc: '写给未来的一封信', icon: Hourglass },
      { href: '/report', label: '回顾报告', desc: '生成可打印的报告', icon: Sparkles },
      { href: '/ai', label: 'AI 助手', desc: '回顾、问答与年度总结', icon: Sparkles },
    ],
  },
  {
    title: '更多',
    items: [
      { href: '/favorites', label: '收藏', desc: '点亮心形的内容', icon: Heart },
      { href: '/archives', label: '归档', desc: '安静退场的记忆', icon: Archive },
      { href: '/trash', label: '回收站', desc: '删除的记录可在此恢复', icon: Trash2 },
      { href: '/settings', label: '设置', desc: '资料、密码、数据导出', icon: Settings },
    ],
  },
];

export default async function MePage() {
  const user = await getSessionUser();
  if (!user) return null;

  return (
    <div className="animate-fade-in">
      <div className="card mb-5 flex items-center gap-3 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-[18px] font-medium text-white">
          {(user.display_name || user.email || '我').slice(0, 1)}
        </div>
        <div>
          <div className="text-[16px] font-semibold">{user.display_name || '朋友'}</div>
          <div className="text-[12px] text-muted">{user.email}</div>
        </div>
      </div>

      {GROUPS.map((group) => (
        <div key={group.title} className="mb-5">
          <h2 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wider text-muted">{group.title}</h2>
          <div className="card overflow-hidden p-0">
            {group.items.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent-soft/40 ${
                  i > 0 ? 'border-t border-border' : ''
                }`}
              >
                <item.icon size={18} className="text-accent" />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium">{item.label}</div>
                  <div className="truncate text-[12px] text-muted">{item.desc}</div>
                </div>
                <ChevronRight size={16} className="text-muted" />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
