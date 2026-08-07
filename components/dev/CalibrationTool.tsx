'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// DEV-ONLY TOOL. Not part of the shipped VR tour — this loads the raw local
// 360° photos directly (bypassing the backend API) so we can walk each real
// room and read precise yaw/pitch for every hotspot before handing the data
// off to the backend team to seed. Delete or keep out of production; gated
// by app/dev/calibrate/page.tsx (404s when NODE_ENV === 'production').
// ---------------------------------------------------------------------------

type Target = { id: string; label: string };
type RoomDef = { slug: string; title: string; file: string; targets: Target[] };
type Coords = { yaw: number; pitch: number };
type Captured = Record<string, Record<string, Coords>>;
type RoomMeta = { roll?: number; initial_yaw?: number };
type CapturedMeta = Record<string, RoomMeta>;

const STORAGE_KEY = 'vr-calibration-data';
const STORAGE_KEY_META = 'vr-calibration-meta';

// Graph confirmed 2026-08-06: Lobby -> 1 -> 2 -> 3 -> 5 (skip 4, 4 is a dead-end
// off 5) -> 6 -> 7 -> ... -> 17 in a chain. Restricted rooms' internal graph
// not defined yet — listed as loadable rooms with no preset checklist so ad hoc
// points can still be captured once that graph is confirmed.
const ROOMS: RoomDef[] = [
  {
    slug: 'lobby',
    title: 'Lobby (pintu tertutup)',
    file: '/panorama/lobby/lobby.JPG',
    targets: [{ id: 'enter', label: 'Masuk (arah pintu -> animasi buka -> ruang 1)' }],
  },
  {
    slug: 'lobby-open',
    title: 'Lobby (pintu terbuka — preview animasi)',
    file: '/panorama/lobby/lobby-animation-open.JPG',
    targets: [],
  },
  ...Array.from({ length: 17 }, (_, i) => i + 1).map((n): RoomDef => {
    const targets: Target[] = [];
    if (n === 1) {
      targets.push({ id: 'next-2', label: 'Next -> 2' }, { id: 'back-lobby', label: 'Back -> Lobby' });
    } else if (n === 3) {
      targets.push(
        { id: 'next-5', label: 'Next -> 5 (skip 4)' },
        { id: 'back-2', label: 'Back -> 2' },
        { id: 'info-1', label: 'Info hotspot #1' },
        { id: 'info-2', label: 'Info hotspot #2' },
      );
    } else if (n === 4) {
      targets.push({ id: 'back-5', label: 'Back -> 5 (dead-end room)' });
    } else if (n === 5) {
      targets.push(
        { id: 'next-6', label: 'Next -> 6' },
        { id: 'side-4', label: 'Side -> 4 (dead-end)' },
        { id: 'back-3', label: 'Back -> 3' },
      );
    } else if (n === 17) {
      targets.push({ id: 'back-16', label: 'Back -> 16' });
    } else {
      targets.push({ id: `next-${n + 1}`, label: `Next -> ${n + 1}` }, { id: `back-${n - 1}`, label: `Back -> ${n - 1}` });
    }
    return {
      slug: String(n),
      title: `Ruang ${n}`,
      file: `/panorama/scenes/${n}.JPG`,
      targets,
    };
  }),
  ...Array.from({ length: 9 }, (_, i) => i + 18).map(
    (n): RoomDef => ({
      slug: `restricted-${n}`,
      title: `Restricted ${n}`,
      file: `/panorama/scenes/restricted-${n}.JPG`,
      targets: [],
    }),
  ),
];

function loadCaptured(): Captured {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Captured) : {};
  } catch {
    return {};
  }
}

function loadMeta(): CapturedMeta {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_META);
    return raw ? (JSON.parse(raw) as CapturedMeta) : {};
  } catch {
    return {};
  }
}

export default function CalibrationTool() {
  const [ready, setReady] = useState(false);
  const [roomSlug, setRoomSlug] = useState('lobby');
  const [captured, setCaptured] = useState<Captured>({});
  const [meta, setMeta] = useState<CapturedMeta>({});
  const [live, setLive] = useState<Coords>({ yaw: 0, pitch: 0 });
  const cameraRef = useRef<HTMLElement>(null);

  const room = useMemo(() => ROOMS.find((r) => r.slug === roomSlug)!, [roomSlug]);
  const roomMeta = meta[roomSlug] ?? {};
  const roll = roomMeta.roll ?? 0;
  const initialYaw = roomMeta.initial_yaw ?? 0;

  useEffect(() => {
    let mounted = true;
    import('aframe').then(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setCaptured(loadCaptured());
    setMeta(loadMeta());
  }, []);

  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    const loop = () => {
      const camEl = cameraRef.current as unknown as { getObject3D?: (n: string) => any } | null;
      const cam = camEl?.getObject3D?.('camera');
      const THREE = (window as unknown as { AFRAME?: { THREE?: any } }).AFRAME?.THREE;
      if (cam && THREE) {
        const dir = new THREE.Vector3();
        cam.getWorldDirection(dir);
        const yaw = Math.round((Math.atan2(dir.x, -dir.z) * 180) / Math.PI);
        const pitch = Math.round((Math.asin(Math.max(-1, Math.min(1, dir.y))) * 180) / Math.PI);
        setLive({ yaw, pitch });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  const persist = (next: Captured) => {
    setCaptured(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // best-effort — calibration data is also visible/copyable on screen
    }
  };

  const persistMeta = (next: CapturedMeta) => {
    setMeta(next);
    try {
      window.localStorage.setItem(STORAGE_KEY_META, JSON.stringify(next));
    } catch {
      // best-effort
    }
  };

  const setRoll = (value: number) => {
    persistMeta({ ...meta, [roomSlug]: { ...roomMeta, roll: value } });
  };

  const captureInitialYaw = () => {
    persistMeta({ ...meta, [roomSlug]: { ...roomMeta, initial_yaw: live.yaw } });
  };

  const capture = (targetId: string) => {
    const next: Captured = { ...captured, [roomSlug]: { ...(captured[roomSlug] ?? {}), [targetId]: live } };
    persist(next);
  };

  const clearTarget = (targetId: string) => {
    const roomData = { ...(captured[roomSlug] ?? {}) };
    delete roomData[targetId];
    persist({ ...captured, [roomSlug]: roomData });
  };

  const exportJson = useMemo(
    () => JSON.stringify({ hotspots: captured, roomMeta: meta }, null, 2),
    [captured, meta],
  );

  const copyExport = () => {
    navigator.clipboard?.writeText(exportJson).catch(() => {});
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        Menyiapkan mesin VR…
      </div>
    );
  }

  const doneCount = Object.values(captured).reduce((sum, r) => sum + Object.keys(r).length, 0);

  return (
    <div className="fixed inset-0 flex bg-black text-white">
      {/* 3D viewer */}
      <div className="relative flex-1">
        <a-scene
          embedded
          loading-screen="enabled: false"
          renderer="colorManagement: true; antialias: false; precision: medium"
          style={{ width: '100%', height: '100%' }}
        >
          {/* rotation MUST match production's sky-crossfade exactly (y = initial_yaw,
              z = roll correction) — any mismatch here silently misaligns every
              hotspot captured against this room (this is what caused the Lobby
              "Masuk" hotspot to land near the tree instead of the door). */}
          <a-sky key={room.file} src={room.file} rotation={`0 ${initialYaw} ${roll}`} />
          <a-camera ref={cameraRef} position="0 0 0" look-controls="reverseMouseDrag: false" wasd-controls="enabled: false" />
        </a-scene>

        {/* Crosshair */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-8 w-8">
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/80" />
            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/80" />
            <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-light" />
          </div>
        </div>

        {/* Live readout */}
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-xl bg-black/75 px-4 py-2 font-mono text-sm backdrop-blur">
          yaw: <b className="text-brand-light">{live.yaw}</b>° &nbsp; pitch: <b className="text-brand-light">{live.pitch}</b>°
        </div>

        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-black/75 px-3 py-1.5 font-mono text-xs backdrop-blur">
          {room.file}
        </div>
      </div>

      {/* Sidebar */}
      <div className="flex w-80 flex-col overflow-y-auto border-l border-white/10 bg-neutral-950 p-4">
        <h1 className="text-sm font-semibold uppercase tracking-wide text-brand-light">Kalibrasi Hotspot (dev only)</h1>
        <p className="mt-1 text-xs text-white/50">{doneCount} titik tersimpan (localStorage)</p>

        <label className="mt-4 block text-xs text-white/60">Ruang</label>
        <select
          value={roomSlug}
          onChange={(e) => setRoomSlug(e.target.value)}
          className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm"
        >
          <optgroup label="Lobby">
            {ROOMS.filter((r) => r.slug === 'lobby' || r.slug === 'lobby-open').map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.title}
              </option>
            ))}
          </optgroup>
          <optgroup label="Ruang 1-17">
            {ROOMS.filter((r) => /^\d+$/.test(r.slug)).map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.title}
              </option>
            ))}
          </optgroup>
          <optgroup label="Restricted">
            {ROOMS.filter((r) => r.slug.startsWith('restricted-')).map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.title}
              </option>
            ))}
          </optgroup>
        </select>

        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Roll (kemiringan horizon)</span>
            <span className="font-mono text-[11px] text-brand-light">{roll}°</span>
          </div>
          <input
            type="range"
            min={-20}
            max={20}
            step={0.5}
            value={roll}
            onChange={(e) => setRoll(Number(e.target.value))}
            className="mt-1.5 w-full"
          />
          <p className="mt-1 text-[10px] text-white/40">
            Geser sampai garis lantai/langit-langit kelihatan rata (level), bukan miring.
          </p>
        </div>

        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">Initial facing (arah pas masuk ruang)</span>
            {roomMeta.initial_yaw !== undefined && <span className="text-[10px] text-emerald-400">✓</span>}
          </div>
          {roomMeta.initial_yaw !== undefined ? (
            <p className="mt-1 font-mono text-[11px] text-white/70">yaw {roomMeta.initial_yaw}</p>
          ) : (
            <p className="mt-1 text-[10px] text-white/40">Belum di-set — default 0.</p>
          )}
          <button
            type="button"
            onClick={captureInitialYaw}
            className="mt-1.5 w-full rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium hover:bg-white/20"
          >
            Simpan arah sekarang sebagai initial facing
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {room.targets.length === 0 && (
            <p className="text-xs text-white/40">
              Belum ada checklist untuk ruang ini — arahkan & catat manual kalau perlu.
            </p>
          )}
          {room.targets.map((t) => {
            const value = captured[roomSlug]?.[t.id];
            return (
              <div key={t.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{t.label}</span>
                  {value && <span className="text-[10px] text-emerald-400">✓</span>}
                </div>
                {value ? (
                  <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-white/70">
                    <span>
                      yaw {value.yaw}, pitch {value.pitch}
                    </span>
                    <button
                      type="button"
                      onClick={() => clearTarget(t.id)}
                      className="text-white/40 hover:text-red-400"
                    >
                      hapus
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => capture(t.id)}
                    className="mt-1.5 w-full rounded-md bg-brand px-2 py-1 text-[11px] font-medium hover:bg-brand-light"
                  >
                    Capture di sini
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-auto pt-4">
          <button
            type="button"
            onClick={copyExport}
            className="w-full rounded-lg bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/20"
          >
            Copy semua hasil (JSON)
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Hapus semua data kalibrasi tersimpan?')) {
                persist({});
                persistMeta({});
              }
            }}
            className="mt-1.5 w-full rounded-lg px-3 py-1.5 text-[11px] text-white/40 hover:text-red-400"
          >
            Reset semua
          </button>
        </div>
      </div>
    </div>
  );
}
