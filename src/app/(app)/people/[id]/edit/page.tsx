import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { personWithMeta } from '@/lib/db/people';
import { PersonForm } from '@/components/people/PersonForm';

export const dynamic = 'force-dynamic';

export default async function PersonEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return null;

  const person = personWithMeta(id, user.id);
  if (!person) notFound();

  return (
    <div className="animate-fade-in mx-auto max-w-[640px] space-y-5">
      <Link href={`/people/${person.id}`} className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-accent">
        <ArrowLeft size={15} />
        返回 {person.name}
      </Link>
      <div className="card p-5 sm:p-8">
        <h1 className="mb-5 text-[18px] font-semibold">编辑人物</h1>
        <PersonForm person={person} standalone />
      </div>
    </div>
  );
}
