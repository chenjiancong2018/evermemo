import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import CapsulesView from '@/components/capsules/CapsulesView';

export const metadata: Metadata = { title: '记忆胶囊 · Evermemo' };

export default async function CapsulesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">记忆胶囊</h1>
        <p className="mt-1 text-sm text-muted">
          写一封信，封存起来。在约定的日期到来之前，连你自己也无法打开。
        </p>
      </div>
      <CapsulesView />
    </div>
  );
}
