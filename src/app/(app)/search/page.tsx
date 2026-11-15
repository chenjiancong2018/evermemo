import { Suspense } from 'react';
import { SearchCenter } from '@/components/search/SearchCenter';

export const dynamic = 'force-dynamic';

export default function SearchPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="mb-1 text-[22px] font-semibold">搜索</h1>
      <p className="mb-5 text-[13px] text-muted">在全部记忆、人物、地点与人生故事中查找。</p>
      <Suspense fallback={null}>
        <SearchCenter />
      </Suspense>
    </div>
  );
}
