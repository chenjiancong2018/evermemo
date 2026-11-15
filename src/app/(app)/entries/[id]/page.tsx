import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, Clock } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { entryWithMeta } from '@/lib/db/entries';
import { ENTRY_TYPE_LABELS, MOOD_COLORS } from '@/lib/types';
import { formatDateCN, formatDateTime } from '@/lib/utils';
import { MarkdownView } from '@/components/entry/MarkdownView';
import { EntryMedia } from '@/components/entry/EntryMedia';
import { EntryActions } from '@/components/entry/EntryActions';

export const dynamic = 'force-dynamic';

export default async function EntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return null;

  const entry = entryWithMeta(id, user.id);
  if (!entry || entry.deleted_at) notFound();

  const moodColor = entry.mood ? MOOD_COLORS[entry.mood] : null;
  const hasTime = /T\d{2}:\d{2}/.test(entry.occurred_at);

  return (
    <div className="animate-fade-in mx-auto max-w-[760px] space-y-5">
      <Link
        href="/timeline"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft size={15} />
        返回时间线
      </Link>

      <article className="card p-5 sm:p-8">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] text-accent">
              {ENTRY_TYPE_LABELS[entry.entry_type]}
            </span>
            {entry.is_favorite && (
              <span className="rounded-full bg-[#E8B4A0]/15 px-2.5 py-0.5 text-[12px] text-[#C98F74]">
                已收藏
              </span>
            )}
            {entry.is_important && (
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] text-accent">
                重要
              </span>
            )}
          </div>

          {entry.title && <h1 className="text-[24px] font-semibold leading-snug">{entry.title}</h1>}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} />
              {formatDateCN(entry.occurred_at)}
            </span>
            {hasTime && (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} />
                {formatDateTime(entry.occurred_at).split(' ')[1]}
              </span>
            )}
            {moodColor && entry.mood && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: moodColor }}
                />
                {entry.mood}
              </span>
            )}
          </div>

          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {entry.tags.map((t) => (
                <Link
                  key={t.id}
                  href={`/timeline?tag=${encodeURIComponent(t.name)}`}
                  className="rounded-lg border border-border px-2 py-0.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  #{t.name}
                </Link>
              ))}
            </div>
          )}
        </header>

        {entry.media.length > 0 && (
          <div className="mt-5">
            <EntryMedia media={entry.media} />
          </div>
        )}

        {entry.content && (
          <div className="md-body mt-5 border-t border-border pt-5">
            <MarkdownView content={entry.content} />
          </div>
        )}

        <footer className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <EntryActions
            entryId={entry.id}
            initialFavorite={entry.is_favorite === 1}
            initialImportant={entry.is_important === 1}
          />
          <div className="text-[11.5px] text-muted/70">
            创建于 {formatDateTime(entry.created_at)}
            {entry.updated_at !== entry.created_at && <> · 更新于 {formatDateTime(entry.updated_at)}</>}
          </div>
        </footer>
      </article>
    </div>
  );
}
