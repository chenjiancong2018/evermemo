import { getSessionUser } from '@/lib/auth/session';
import { listTags } from '@/lib/db/tags';
import { EntryForm } from '@/components/entry/EntryForm';

export const dynamic = 'force-dynamic';

export default async function NewEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const { type } = await searchParams;
  const tags = listTags(user.id);
  return (
    <div className="animate-fade-in mx-auto max-w-[720px]">
      <EntryForm mode="create" allTags={tags} initialType={type} />
    </div>
  );
}
