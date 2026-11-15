import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { placeWithMeta } from '@/lib/db/places';
import { PlaceForm } from '@/components/places/PlaceForm';

export const dynamic = 'force-dynamic';

export default async function PlaceEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return null;

  const place = placeWithMeta(id, user.id);
  if (!place) notFound();

  return (
    <div className="animate-fade-in mx-auto max-w-[640px] space-y-5">
      <Link href={`/places/${place.id}`} className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-accent">
        <ArrowLeft size={15} />
        返回 {place.name}
      </Link>
      <div className="card p-5 sm:p-8">
        <h1 className="mb-5 text-[18px] font-semibold">编辑地点</h1>
        <PlaceForm place={place} standalone />
      </div>
    </div>
  );
}
