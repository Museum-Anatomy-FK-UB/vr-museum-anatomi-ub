'use client';

import type { SceneSummary } from '@/lib/types/tour';

// Galeri "All Location" — grid thumbnail semua ruang (ala 3DVista/FILKOM).
// Klik thumbnail → pindah ruang (dengan transisi) lalu tutup galeri.
export default function SceneGallery({
  scenes,
  currentId,
  onSelect,
  onClose,
}: {
  scenes: SceneSummary[];
  currentId: string | null;
  onSelect: (sceneId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col bg-black/75 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="text-lg font-medium text-white">Semua Lokasi</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup galeri"
          className="rounded-full bg-white/15 px-3 py-1.5 text-white transition hover:bg-white/25"
        >
          ✕
        </button>
      </div>

      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-4 overflow-y-auto px-6 pb-6 sm:grid-cols-3 lg:grid-cols-4">
        {scenes.map((scene) => {
          const active = scene.id === currentId;
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => onSelect(scene.id)}
              className={`group overflow-hidden rounded-lg border-2 text-left transition ${
                active ? 'border-brand-light' : 'border-transparent hover:border-white/40'
              }`}
            >
              <div className="aspect-[2/1] overflow-hidden bg-neutral-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={scene.thumbnail_url}
                  alt={scene.title}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
              <div className="flex items-center justify-between px-2 py-2">
                <span className={`text-sm ${active ? 'font-medium text-brand-light' : 'text-white'}`}>
                  {scene.title}
                </span>
                {active && <span className="text-[10px] text-brand-light">● aktif</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
