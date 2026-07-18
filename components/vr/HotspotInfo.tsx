'use client';

import { useCollection } from '@/lib/hooks/useCollection';
import MediaGallery from '@/components/ui/MediaGallery';
import AudioPlayer from '@/components/ui/AudioPlayer';

// Collection info panel that slides up from the bottom when an 'info' hotspot is clicked.
// Collection data is fetched from the API (via SWR) — nothing hardcoded.
export default function HotspotInfo({
  collectionId,
  onClose,
}: {
  collectionId: string;
  onClose: () => void;
}) {
  const { collection, isLoading, error } = useCollection(collectionId);

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white/95 p-5 shadow-2xl backdrop-blur sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96 sm:rounded-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          {isLoading && <p className="text-neutral-500">Memuat koleksi…</p>}
          {error && <p className="text-red-600">Gagal memuat koleksi.</p>}
          {collection && (
            <>
              <h2 className="text-lg font-medium text-neutral-900">{collection.name}</h2>
              {collection.latin_name && (
                <p className="text-sm italic text-neutral-500">{collection.latin_name}</p>
              )}
              {collection.category && (
                <span className="mt-1 inline-block rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">
                  {collection.category}
                </span>
              )}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup panel info"
          className="rounded-full px-2 py-1 text-neutral-500 hover:bg-neutral-100"
        >
          ✕
        </button>
      </div>

      {collection && (
        <div className="mt-3 space-y-3">
          <MediaGallery photos={collection.photos} alt={collection.name} />

          <p className="text-sm leading-relaxed text-neutral-700">{collection.description}</p>

          {collection.audio_url && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Voice over</p>
              <AudioPlayer src={collection.audio_url} />
            </div>
          )}

          {collection.portal_url && (
            <a
              href={collection.portal_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-brand hover:underline"
            >
              Selengkapnya di Web Portal →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
