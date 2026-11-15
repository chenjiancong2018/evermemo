import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import MapView from '@/components/map/MapView';

export const metadata: Metadata = { title: '人生地图 · Evermemo' };

export default async function MapPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">人生地图</h1>
        <p className="mt-1 text-sm text-muted">去过的地方，都在这张地图上。地图服务可替换，离线时自动降级为地点列表。</p>
      </div>
      <MapView />
    </div>
  );
}
