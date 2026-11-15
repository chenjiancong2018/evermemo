import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, PenLine } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { chapterWithMeta } from '@/lib/db/chapters';
import { MarkdownView } from '@/components/entry/MarkdownView';
import { ChapterEntriesManager } from '@/components/chapters/ChapterEntriesManager';
import { ChapterAiButton } from '@/components/chapters/ChapterAiButton';

export const dynamic = 'force-dynamic';

export default async function ChapterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return null;

  const chapter = chapterWithMeta(id, user.id);
  if (!chapter) notFound();

  const dateRange = [chapter.start_date ?? null, chapter.end_date ?? null].filter(Boolean).join(' ~ ');

  return (
    <div className="animate-fade-in mx-auto max-w-[760px] space-y-5">
      <Link href="/chapters" className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-accent">
        <ArrowLeft size={15} />
        返回人生故事
      </Link>

      <div className="card overflow-hidden p-0">
        {chapter.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/media/${chapter.cover.id}/file`} alt="" className="max-h-64 w-full object-cover" />
        )}
        <div className="p-5 sm:p-8">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-semibold">{chapter.title}</h1>
            <div className="ml-auto flex items-center gap-2">
              <ChapterAiButton chapterId={chapter.id} entryIds={chapter.entries.map((e) => e.id)} />
              <Link
                href={`/chapters/${chapter.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-accent hover:text-accent"
              >
                <PenLine size={14} />
                编辑
              </Link>
            </div>
          </div>
          {dateRange && (
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
              <CalendarDays size={14} />
              {dateRange}
            </p>
          )}
          {chapter.description && <p className="mt-4 text-[14px] leading-relaxed text-muted">{chapter.description}</p>}
          {chapter.content && (
            <div className="md-body mt-4 border-t border-border pt-4">
              <MarkdownView content={chapter.content} />
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold">故事里的记录（{chapter.entries.length}）</h2>
        <ChapterEntriesManager
          chapterId={chapter.id}
          initial={chapter.entries.map((e) => ({ entry: e, sort_order: e.sort_order }))}
        />
      </div>
    </div>
  );
}
