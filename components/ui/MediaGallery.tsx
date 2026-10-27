'use client';

import { useEffect, useState } from 'react';
import type { CollectionPhoto } from '@/lib/types/collection';

// Collection photo gallery: main photo + caption + thumbnail strip (if >1 photo).
// It fills the height its parent gives it, and the main photo is shown WHOLE
// (object-contain, letterboxed) — collection photos come in every aspect ratio
// and cropping would cut off the very object they document.
export default function MediaGallery({ photos, alt }: { photos: CollectionPhoto[]; alt: string }) {
  const [index, setIndex] = useState(0);

  // Reset to the first photo when the collection changes.
  useEffect(() => {
    setIndex(0);
  }, [photos]);

  if (photos.length === 0) return null;
  const active = photos[Math.min(index, photos.length - 1)];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-neutral-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={active.url} alt={active.caption ?? alt} className="absolute inset-0 h-full w-full object-contain" />
      </div>

      {active.caption && <p className="shrink-0 text-xs text-neutral-500">{active.caption}</p>}

      {photos.length > 1 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
          {photos.map((photo, i) => (
            <button
              key={`${photo.url}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Foto ${i + 1}`}
              aria-current={i === index}
              className={`h-12 w-16 shrink-0 overflow-hidden rounded border-2 bg-neutral-900 transition ${
                i === index ? 'border-brand' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.caption ?? `${alt} ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
