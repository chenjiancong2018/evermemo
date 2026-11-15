import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import ReportView from '@/components/report/ReportView';

export const metadata: Metadata = { title: '回顾报告 · Evermemo' };

export default async function ReportPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">回顾报告</h1>
        <p className="mt-1 text-sm text-muted">选择一段时间，生成一份属于自己的回顾报告，可以打印或导出 PDF。</p>
      </div>
      <ReportView />
    </div>
  );
}
