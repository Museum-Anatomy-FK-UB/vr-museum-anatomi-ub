'use client';

import { useEffect, useState } from 'react';

type Coords = { yaw: number; pitch: number };

// Developer tool: a screen-center crosshair + a live yaw/pitch readout of the
// aimed point, then copy. Helps place hotspots on real photos without guessing numbers.
export default function HotspotPicker({
  sceneId,
  getCoords,
  onClose,
}: {
  sceneId: string;
  getCoords: () => Coords | null;
  onClose: () => void;
}) {
  const [coords, setCoords] = useState<Coords>({ yaw: 0, pitch: 0 });
  const [copied, setCopied] = useState(false);

  // Loop reading the camera direction each frame (updates as the user looks around).
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const c = getCoords();
      if (c) setCoords(c);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [getCoords]);

  const copy = () => {
    const text = `yaw: ${coords.yaw}, pitch: ${coords.pitch}`;
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {});
  };

  return (
    <>
      {/* Crosshair at the screen center */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <div className="relative h-8 w-8">
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/80" />
          <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/80" />
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-light" />
        </div>
      </div>

      {/* Panel readout */}
      <div className="pointer-events-auto absolute left-1/2 top-4 z-30 w-72 -translate-x-1/2 rounded-xl bg-black/75 p-3 text-white shadow-xl backdrop-blur">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium">Pick koordinat hotspot</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup picker"
            className="px-1 text-white/70 transition hover:text-white"
          >
            ✕
          </button>
        </div>
        <p className="text-[11px] text-white/60">Arahkan crosshair (tengah) ke titik, lalu Salin.</p>

        <div className="mt-2 flex items-center justify-between rounded-lg bg-white/10 px-3 py-2 font-mono text-sm">
          <span>
            yaw: <b className="text-brand-light">{coords.yaw}</b>°
          </span>
          <span>
            pitch: <b className="text-brand-light">{coords.pitch}</b>°
          </span>
        </div>

        <p className="mt-1 text-[11px] text-white/60">
          scene: <span className="font-mono">{sceneId}</span>
        </p>

        <button
          type="button"
          onClick={copy}
          className="mt-2 w-full rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-light"
        >
          {copied ? 'Tersalin ✓' : 'Salin yaw/pitch'}
        </button>
      </div>
    </>
  );
}
