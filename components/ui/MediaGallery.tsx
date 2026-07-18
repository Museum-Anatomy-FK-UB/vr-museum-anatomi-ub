'use client';

import { useEffect, useState } from 'react';
import type { CollectionPhoto } from '@/lib/types/collection';

// Collection photo gallery: main photo + caption + thumbnail strip (if >1 photo).
export default function MediaGallery({ photos, alt }: { photos: CollectionPhoto[]; alt: string }) {
  const [index, setIndex] = useState(0);

  // Reset to the first photo when the collection changes.
  useEffect(() => {
    setIndex(0);
  }, [photos]);

  if (photos.length === 0) return null;
  const active = photos[Math.min(index, photos.length - 1)];

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={active.url} alt={active.caption ?? alt} className="h-44 w-full object-cover" />
      </div>

      {active.caption && <p className="text-xs text-neutral-500">{active.caption}</p>}

      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, i) => (
            <button
              key={`${photo.url}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Foto ${i + 1}`}
              aria-current={i === index}
              className={`h-12 w-16 shrink-0 overflow-hidden rounded border-2 transition ${
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
