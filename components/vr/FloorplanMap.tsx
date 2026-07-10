'use client';

import type { SceneSummary } from '@/lib/types/tour';

// Overlay denah museum (placeholder) — titik per ruang, klik → pindah ruang.
// Posisi titik dari map_x/map_y (persen). Denah asli menyusul dari FK/API.
export default function FloorplanMap({
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
  const withCoords = scenes.filter((s) => s.map_x != null && s.map_y != null);
  const current = scenes.find((s) => s.id === currentId);

  return (
    <div className="pointer-events-auto absolute bottom-24 right-4 z-20 w-64 rounded-xl bg-black/70 p-3 shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">Denah Museum</span>
          <span className="rounded bg-white/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/70">
            placeholder
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup denah"
          className="px-1 text-white/70 transition hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-white/20 bg-neutral-700/40">
        {/* Garis outline placeholder */}
        <div className="absolute inset-3 rounded border border-dashed border-white/15" />

        {withCoords.map((s) => {
          const active = s.id === currentId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              title={s.title}
              aria-label={s.title}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${s.map_x}%`, top: `${s.map_y}%` }}
            >
              <span className="relative flex h-5 w-5 items-center justify-center">
                {active && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-light/60" />
                )}
                <span
                  className={`relative flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] font-semibold transition ${
                    active
                      ? 'border-white bg-brand-light text-white'
                      : 'border-white/70 bg-black/60 text-white/90 hover:bg-black/80'
                  }`}
                >
                  {s.order}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 truncate text-center text-xs text-white/85">{current?.title ?? '—'}</p>
    </div>
  );
}
