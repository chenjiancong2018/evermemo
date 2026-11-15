import { TrashView } from '@/components/trash/TrashView';

export const dynamic = 'force-dynamic';

export default function TrashPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="mb-5 text-[22px] font-semibold">回收站</h1>
      <TrashView />
    </div>
  );
}
