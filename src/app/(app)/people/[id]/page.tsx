import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Camera, FileText, PenLine, UserRound } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { personWithMeta } from '@/lib/db/people';
import { PersonEntries } from '@/components/people/PersonEntries';

export const dynamic = 'force-dynamic';

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return null;

  const person = personWithMeta(id, user.id);
  if (!person) notFound();

  return (
    <div className="animate-fade-in mx-auto max-w-[760px] space-y-5">
      <Link href="/people" className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-accent">
        <ArrowLeft size={15} />
        返回人物
      </Link>

      <div className="card p-5 sm:p-8">
        <div className="flex items-center gap-4">
          {person.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/media/${person.avatar.id}/thumb`} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
              <UserRound size={26} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold">{person.name}</h1>
            <p className="mt-0.5 text-[13px] text-muted">
              {[person.nickname, person.relationship_type, person.first_met_at ? `初见 ${person.first_met_at.slice(0, 10)}` : null]
                .filter(Boolean)
                .join(' · ') || '人物档案'}
            </p>
          </div>
          <div className="ml-auto">
            <Link
              href={`/people/${person.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <PenLine size={14} />
              编辑
            </Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-background/70 px-3 py-3 text-center">
            <p className="text-[20px] font-semibold text-accent">{person.entryCount}</p>
            <p className="mt-0.5 flex items-center justify-center gap-1 text-[12px] text-muted">
              <FileText size={12} />
              相关记录
            </p>
          </div>
          <div className="rounded-xl bg-background/70 px-3 py-3 text-center">
            <p className="text-[20px] font-semibold text-accent">{person.photoCount}</p>
            <p className="mt-0.5 flex items-center justify-center gap-1 text-[12px] text-muted">
              <Camera size={12} />
              相关照片
            </p>
          </div>
          <div className="rounded-xl bg-background/70 px-3 py-3 text-center">
            <p className="text-[20px] font-semibold text-accent">{person.sharedMilestones.length}</p>
            <p className="mt-0.5 text-[12px] text-muted">共同重要时刻</p>
          </div>
        </div>

        {person.description && (
          <p className="mt-5 whitespace-pre-wrap text-[14px] leading-relaxed">{person.description}</p>
        )}

        {person.sharedMilestones.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-[13px] font-medium">共同的重要时刻</p>
            <div className="space-y-2">
              {person.sharedMilestones.map((ms) => (
                <Link
                  key={ms.id}
                  href="/milestones"
                  className="block rounded-xl border border-border bg-background/60 px-3 py-2.5 text-[13px] hover:border-accent/50"
                >
                  {ms.title}
                  <span className="ml-2 text-muted">{ms.occurred_at.slice(0, 10)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {person.notes && (
          <div className="mt-5 rounded-xl bg-accent-soft/50 px-4 py-3">
            <p className="mb-1 text-[12px] text-muted">备注</p>
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{person.notes}</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold">与 TA 相关的记录</h2>
        <PersonEntries personId={person.id} />
      </div>
    </div>
  );
}
