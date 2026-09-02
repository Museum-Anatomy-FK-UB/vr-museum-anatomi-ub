'use client';

import { useCollection } from '@/lib/hooks/useCollection';
import MediaGallery from '@/components/ui/MediaGallery';
import AudioPlayer from '@/components/ui/AudioPlayer';

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// Collection info — a centered, light (white) modal for readability, over a dark
// backdrop so it stands out. Shown when an 'info' hotspot is clicked; data via SWR.
export default function HotspotInfo({
  collectionId,
  onClose,
}: {
  collectionId: string;
  onClose: () => void;
}) {
  const { collection, isLoading, error } = useCollection(collectionId);

  return (
    <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center p-4">
      {/* Backdrop — click to close */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

      {/* Modal card (white) */}
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup panel info"
          className="absolute right-3 top-3 z-10 rounded-full p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
        >
          <XIcon />
        </button>

        {/* Header */}
        <div className="shrink-0 border-b border-neutral-200 px-6 py-5 pr-14">
          {isLoading && <p className="text-sm text-neutral-500">Memuat koleksi…</p>}
          {error && <p className="text-sm text-red-600">Gagal memuat koleksi.</p>}
          {collection && (
            <>
              <h2 className="text-lg font-bold text-neutral-900">{collection.name}</h2>
              {collection.latin_name && (
                <p className="mt-0.5 text-sm italic text-neutral-500">{collection.latin_name}</p>
              )}
              {collection.category && (
                <span className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  {collection.category}
                </span>
              )}
            </>
          )}
        </div>

        {/* Body */}
        {collection && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <MediaGallery photos={collection.photos} alt={collection.name} />

            <p className="text-sm leading-relaxed text-neutral-700">{collection.description}</p>

            {collection.audio_url && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Voice over</p>
                <AudioPlayer src={collection.audio_url} />
              </div>
            )}

            {collection.portal_url && (
              <a
                href={collection.portal_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm font-semibold text-amber-700 transition hover:text-amber-800"
              >
                Selengkapnya di Web Portal →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
