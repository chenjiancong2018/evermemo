import type { Metadata } from 'next';
import ArchivesView from '@/components/archives/ArchivesView';

export const metadata: Metadata = {
  title: '归档 · Evermemo',
};

export default function ArchivesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">归档</h1>
        <p className="mt-1 text-sm text-muted">被收起来的记忆，安静地待在这里。</p>
      </div>
      <ArchivesView />
    </div>
  );
}
