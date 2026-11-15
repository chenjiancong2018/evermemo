import { FavoritesView } from '@/components/favorites/FavoritesView';

export const dynamic = 'force-dynamic';

export default function FavoritesPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="mb-1 text-[22px] font-semibold">收藏</h1>
      <p className="mb-5 text-[13px] text-muted">你点亮了心形的内容，都收在这里。</p>
      <FavoritesView />
    </div>
  );
}
