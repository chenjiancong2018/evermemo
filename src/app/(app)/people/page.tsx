import { PeopleView } from '@/components/people/PeopleView';

export const dynamic = 'force-dynamic';

export default function PeoplePage() {
  return (
    <div className="animate-fade-in">
      <h1 className="mb-1 text-[22px] font-semibold">人物</h1>
      <p className="mb-5 text-[13px] text-muted">生命中重要的人，和他们共同的故事。</p>
      <PeopleView />
    </div>
  );
}
