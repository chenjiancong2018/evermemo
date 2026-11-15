import { ChaptersView } from '@/components/chapters/ChaptersView';

export const dynamic = 'force-dynamic';

export default function ChaptersPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="mb-1 text-[22px] font-semibold">人生故事</h1>
      <p className="mb-5 text-[13px] text-muted">把散落的记忆串成一段一段的故事。</p>
      <ChaptersView />
    </div>
  );
}
