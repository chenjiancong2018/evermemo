'use client';

import { useMemo, useState } from 'react';
import { MediaStrip } from '@/components/entry/MediaStrip';
import { Lightbox, type LightboxMedia } from '@/components/gallery/Lightbox';
import type { MediaRow } from '@/lib/types';

interface EntryMediaProps {
  media: MediaRow[];
}

export function EntryMedia({ media }: EntryMediaProps) {
  const [items, setItems] = useState(media);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const lbItems: LightboxMedia[] = useMemo(
    () =>
      items.map((m) => ({
        id: m.id,
        entryId: m.entry_id,
        caption: m.caption,
        isFavorite: m.is_favorite === 1,
        capturedAt: m.captured_at,
        createdAt: m.created_at,
      })),
    [items]
  );

  if (items.length === 0) return null;

  return (
    <>
      <MediaStrip
        media={items}
        onPreview={(m) => setLightboxIndex(items.findIndex((x) => x.id === m.id))}
      />
      {lightboxIndex !== null && (
        <Lightbox
          items={lbItems}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onMediaChange={(id, patch) => {
            setItems((prev) =>
              prev.map((m) =>
                m.id === id
                  ? {
                      ...m,
                      caption: patch.caption !== undefined ? patch.caption : m.caption,
                      is_favorite:
                        patch.isFavorite !== undefined
                          ? patch.isFavorite
                            ? 1
                            : 0
                          : m.is_favorite,
                    }
                  : m
              )
            );
          }}
        />
      )}
    </>
  );
}
