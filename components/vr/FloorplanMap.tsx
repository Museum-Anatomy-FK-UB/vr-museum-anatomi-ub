'use client';

import type { SceneSummary } from '@/lib/types/tour';

// Museum floor plan — a centered modal (not a side panel): a clickable location
// list on the left (the list scrolls internally), a map area with pins on the
// right, plus a legend. Pins come from map_x/map_y (percent) when the backend
// provides them; until then the map area shows a blueprint-style placeholder.

// UB palette: deep navy + gold. Kept deliberate so the dialog reads as branded,
// not a generic dark box.
const GRID_BG: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
  backgroundSize: '30px 30px',
};

function XIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function PinIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

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

  return (
    <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center p-4">
      {/* Backdrop — dims the scene, click to close (modal, not full-screen). */}
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} aria-hidden />

      {/* Modal card — wide, short, dark-navy fill. */}
      <div className="relative z-10 flex max-h-[74vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141a2e]/95 shadow-2xl">
        {/* Body — mobile: stack (map on top) & scroll; desktop: two columns */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:grid md:gap-5 md:overflow-hidden md:p-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
          {/* Left — location list (desktop). On mobile it sits BELOW the map (order-2). */}
          <div className="order-2 flex min-h-0 flex-col md:order-none">
            <h3 className="mb-3 shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Daftar Lokasi</h3>
            <ul className="space-y-1 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1.5">
              {scenes.map((s) => {
                const active = s.id === currentId;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(s.id)}
                      className={`relative flex w-full items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-left ring-1 ring-inset transition ${
                        active ? 'ring-amber-400/60' : 'ring-transparent hover:ring-white/10'
                      }`}
                    >
                      {/* Room preview image on the right, faded into the card on the left */}
                      <span className="pointer-events-none absolute inset-0" aria-hidden>
                        <img
                          src={s.thumbnail_url}
                          alt=""
                          loading="lazy"
                          className="absolute inset-y-0 right-0 h-full w-2/3 object-cover"
                        />
                        <span
                          className="absolute inset-0"
                          style={{
                            background: active
                              ? 'linear-gradient(90deg, #d99a00 0%, rgba(245,158,11,0.82) 32%, rgba(245,158,11,0.12) 72%, rgba(245,158,11,0) 100%)'
                              : 'linear-gradient(90deg, #141a2e 0%, #141a2e 40%, rgba(20,26,46,0.55) 72%, rgba(20,26,46,0.1) 100%)',
                          }}
                        />
                      </span>

                      <span
                        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          active ? 'bg-white text-amber-600 shadow' : 'bg-white/10 text-white/75'
                        }`}
                      >
                        {s.order}
                      </span>
                      <span className="relative z-10 min-w-0">
                        <span className={`block truncate text-sm font-semibold ${active ? 'text-neutral-900' : 'text-white/90'}`}>
                          {s.title}
                        </span>
                        {active && <span className="block text-xs font-medium text-neutral-800">Anda di sini</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Map area. On mobile it goes ON TOP (order-1) with a fixed height so its
              absolute children never overlap the list; on desktop it fills the right column. */}
          <div className="relative order-1 h-56 shrink-0 md:order-none md:h-auto md:min-h-[220px]">
            {/* Map surface (fill + grid + border) */}
            <div className="absolute inset-0 rounded-xl border border-white/10 bg-[#0a1428]" style={GRID_BG} />
              {/* Floor label — honest single-floor tag, adds product feel */}
              <span className="absolute left-3 top-3 rounded-md bg-black/45 px-2.5 py-1 text-xs font-medium text-white/70 ring-1 ring-white/10">
                Lantai 1
              </span>

              {withCoords.length > 0 ? (
                withCoords.map((s) => {
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
                      <span className="relative flex h-7 w-7 items-center justify-center">
                        {active && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/50" />}
                        <span
                          className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition ${
                            active ? 'border-white bg-amber-400 text-[#0a1226]' : 'border-white/70 bg-black/60 text-white hover:bg-black/80'
                          }`}
                        >
                          {s.order}
                        </span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <PinIcon className="h-8 w-8 text-white/20" />
                  <p className="text-sm text-white/45">Peta denah interaktif menyusul.</p>
                  <p className="text-xs text-white/30">Sementara ini, pilih lokasi dari daftar di samping.</p>
                </div>
              )}
            {/* Legend — floating pill at the bottom-center, no "Legenda" label */}
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-5 whitespace-nowrap rounded-full border border-white/10 bg-black/55 px-5 py-2.5 text-sm text-white/80 backdrop-blur">
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full bg-amber-400" /> Lokasi Anda
              </span>
              <span className="flex items-center gap-2">
                <PinIcon className="h-4 w-4 text-white/60" /> Titik Lokasi
              </span>
            </div>

            {/* Notch — rounded-square "socket" bitten out of the top-right corner
                (fill matches the modal so it reads as a corner cutout), with the
                close button nested inside it and a small gap all around. */}
            <div className="absolute right-0 top-0 h-[56px] w-[56px] rounded-bl-[30px] rounded-tr-xl bg-[#141a2e]" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup denah"
              className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-lg text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              <XIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
