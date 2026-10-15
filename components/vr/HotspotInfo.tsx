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

// Collection info — a centered, light (white) modal over a dark backdrop. Shown
// when an 'info' hotspot is clicked; data via SWR.
// Layout: photo on the left (shown whole, never cropped), title + description on
// the right. The card has a fixed, moderate height so it never swallows the
// whole tour; a long description scrolls inside its own column instead. On
// narrow screens the photo sits on top and the text scrolls below it.
export default function HotspotInfo({
  collectionId,
  onClose,
}: {
  collectionId: string;
  onClose: () => void;
}) {
  const { collection, isLoading, error } = useCollection(collectionId);
  const hasPhotos = !!collection && collection.photos.length > 0;

  return (
    <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center p-4">
      {/* Backdrop — click to close */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

      {/* Modal card (white) */}
      <div
        className={`relative z-10 flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${
          hasPhotos ? 'max-h-[85vh] max-w-4xl md:h-[min(520px,78vh)] md:flex-row' : 'max-h-[70vh] max-w-lg'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup panel info"
          className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-neutral-500 shadow-sm transition hover:bg-neutral-100 hover:text-neutral-800"
        >
          <XIcon />
        </button>

        {/* Left — photo(s) */}
        {hasPhotos && (
          <div className="h-72 shrink-0 bg-neutral-50 p-4 md:h-auto md:w-[52%] md:p-5">
            <MediaGallery photos={collection.photos} alt={collection.name} />
          </div>
        )}

        {/* Right — title + scrollable description */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-neutral-200 px-6 py-5 pr-14">
            {isLoading && <p className="text-sm text-neutral-500">Memuat koleksi…</p>}
            {error && <p className="text-sm text-red-600">Gagal memuat koleksi.</p>}
            {collection && (
              <>
                <h2 className="text-lg font-bold leading-snug text-neutral-900">{collection.name}</h2>
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

          {collection && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-700">{collection.description}</p>

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
    </div>
  );
}
