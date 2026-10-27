'use client';

import type { PhotoHotspot } from '@/lib/types/tour';

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// Lightbox for a 'photo' hotspot (backend hotspot_type "open_photo"). Unlike
// HotspotInfo, there's nothing to fetch — media_url/caption already live on
// the hotspot itself, straight from VrSceneDetailResource.
export default function HotspotPhotoModal({
  hotspot,
  onClose,
}: {
  hotspot: PhotoHotspot;
  onClose: () => void;
}) {
  const caption = hotspot.caption ?? hotspot.label;

  return (
    <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup foto"
          className="absolute right-3 top-3 z-10 rounded-full bg-black/45 p-2 text-white transition hover:bg-black/65"
        >
          <XIcon />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hotspot.media_url} alt={caption} className="max-h-[65vh] w-full object-contain" />
        </div>

        {caption && <p className="shrink-0 px-5 py-4 text-sm text-neutral-700">{caption}</p>}
      </div>
    </div>
  );
}
