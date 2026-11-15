import { PlacesView } from '@/components/places/PlacesView';

export const dynamic = 'force-dynamic';

export default function PlacesPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="mb-1 text-[22px] font-semibold">地点</h1>
      <p className="mb-5 text-[13px] text-muted">走过的路，停留过的地方。</p>
      <PlacesView />
    </div>
  );
}
