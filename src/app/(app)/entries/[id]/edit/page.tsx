import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { entryWithMeta } from '@/lib/db/entries';
import { listTags } from '@/lib/db/tags';
import { EntryForm } from '@/components/entry/EntryForm';

export const dynamic = 'force-dynamic';

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return null;

  const entry = entryWithMeta(id, user.id);
  if (!entry || entry.deleted_at) notFound();
  const tags = listTags(user.id);

  return (
    <div className="animate-fade-in mx-auto max-w-[720px] space-y-4">
      <Link
        href={`/entries/${entry.id}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft size={15} />
        返回记录
      </Link>
      <EntryForm mode="edit" entry={entry} allTags={tags} />
    </div>
  );
}
