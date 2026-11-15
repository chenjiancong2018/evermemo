import { MilestonesView } from '@/components/milestones/MilestonesView';

export const dynamic = 'force-dynamic';

export default function MilestonesPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="mb-1 text-[22px] font-semibold">重要时刻</h1>
      <p className="mb-5 text-[13px] text-muted">人生中值得铭记的节点，历久弥新。</p>
      <MilestonesView />
    </div>
  );
}
