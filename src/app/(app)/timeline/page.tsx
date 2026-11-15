import { getSessionUser } from '@/lib/auth/session';
import { getYearMonths } from '@/lib/db/dashboard';
import { listTags } from '@/lib/db/tags';
import { TimelineView } from '@/components/timeline/TimelineView';

export const dynamic = 'force-dynamic';

export default async function TimelinePage() {
  const user = await getSessionUser();
  if (!user) return null;
  const [tags, yearMonths] = [listTags(user.id), getYearMonths(user.id)];
  return (
    <div className="animate-fade-in">
      <h1 className="mb-5 text-[22px] font-semibold">时间线</h1>
      <TimelineView allTags={tags} yearMonths={yearMonths} />
    </div>
  );
}
