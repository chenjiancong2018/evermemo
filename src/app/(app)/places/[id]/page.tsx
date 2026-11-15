import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Camera, FileText, MapPin, PenLine } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { placeWithMeta } from '@/lib/db/places';
import { PlaceEntries } from '@/components/places/PlaceEntries';

export const dynamic = 'force-dynamic';

export default async function PlaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return null;

  const place = placeWithMeta(id, user.id);
  if (!place) notFound();

  return (
    <div className="animate-fade-in mx-auto max-w-[760px] space-y-5">
      <Link href="/places" className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-accent">
        <ArrowLeft size={15} />
        返回地点
      </Link>

      <div className="card overflow-hidden p-0">
        {place.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/media/${place.cover.id}/file`} alt="" className="max-h-64 w-full object-cover" />
        ) : (
          <div className="flex h-32 items-center justify-center bg-accent-soft">
            <MapPin size={28} className="text-accent/50" />
          </div>
        )}
        <div className="p-5 sm:p-8">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-semibold">{place.name}</h1>
            <div className="ml-auto">
              <Link
                href={`/places/${place.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-accent hover:text-accent"
              >
                <PenLine size={14} />
                编辑
              </Link>
            </div>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {[place.country, place.city, place.address].filter(Boolean).join(' · ') || '地点档案'}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-background/70 px-3 py-3 text-center">
              <p className="text-[20px] font-semibold text-accent">{place.entryCount}</p>
              <p className="mt-0.5 flex items-center justify-center gap-1 text-[12px] text-muted">
                <FileText size={12} />
                相关记录
              </p>
            </div>
            <div className="rounded-xl bg-background/70 px-3 py-3 text-center">
              <p className="text-[20px] font-semibold text-accent">{place.photoCount}</p>
              <p className="mt-0.5 flex items-center justify-center gap-1 text-[12px] text-muted">
                <Camera size={12} />
                相关照片
              </p>
            </div>
          </div>

          {place.description && (
            <p className="mt-5 whitespace-pre-wrap text-[14px] leading-relaxed">{place.description}</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold">与这里相关的记录</h2>
        <PlaceEntries placeId={place.id} />
      </div>
    </div>
  );
}
