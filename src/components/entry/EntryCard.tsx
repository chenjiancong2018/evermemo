'use client';

import Link from 'next/link';
import { Archive, Heart, Star } from 'lucide-react';
import type { EntryWithMeta } from '@/lib/types';
import { ENTRY_TYPE_LABELS } from '@/lib/types';
import { cn, excerpt, formatDate } from '@/lib/utils';

/** 列表用记录卡片 */
export function EntryCard({ entry, href }: { entry: EntryWithMeta; href?: string }) {
  const body = (
    <article className="card group cursor-pointer p-4 transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">
              {ENTRY_TYPE_LABELS[entry.entry_type] ?? entry.entry_type}
            </span>
            <span className="text-[12px] text-muted">{formatDate(entry.occurred_at)}</span>
            {entry.mood && <span className="text-[12px] text-muted">· {entry.mood}</span>}
            {entry.is_favorite === 1 && <Heart size={13} className="fill-danger/80 text-danger/80" />}
            {entry.is_important === 1 && <Star size={13} className="fill-[#C9A227] text-[#C9A227]" />}
            {entry.is_archived === 1 && <Archive size={13} className="text-accent" />}
          </div>
          {entry.title && (
            <h3 className="mb-1 text-[15.5px] font-semibold leading-snug">{entry.title}</h3>
          )}
          {entry.content && (
            <p className={cn('text-[13.5px] leading-relaxed text-muted', entry.title ? 'line-clamp-2' : 'line-clamp-3')}>
              {excerpt(entry.content, 160)}
            </p>
          )}
          {entry.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {entry.tags.slice(0, 4).map((t) => (
                <span key={t.id} className="rounded-md bg-foreground/[0.045] px-1.5 py-0.5 text-[11px] text-muted">
                  #{t.name}
                </span>
              ))}
            </div>
          )}
        </div>
        {entry.media.length > 0 && (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-accent-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/media/${entry.media[0].id}/thumb`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {entry.media.length > 1 && (
              <span className="absolute bottom-1 right-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                +{entry.media.length - 1}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}
