'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Hotspot } from '@/lib/types/tour';
import HotspotLayer, { registerHotspotLayer, toPosition } from '@/components/vr/HotspotLayer';
import { calibrationSeed } from '@/lib/calibrationSeed';

// ---------------------------------------------------------------------------
// DEV-ONLY TOOL. Not part of the shipped VR tour — this loads the raw local
// 360° photos directly (bypassing the backend API) so we can walk each real
// room and place hotspots visually (WYSIWYG) before handing the data off to the
// backend team to seed. Gated by app/dev/calibrate/page.tsx (404s in production).
//
// What it does:
//  - Aim the crosshair and "Tambah hotspot" to drop one where you're looking.
//  - Pick each hotspot's type (navigation / info / door), its target room (or
//    collection id), its label, and — for navigation — rotate the arrow freely.
//  - See a LIVE preview of every hotspot rendered exactly as it will look in the
//    tour (same HotspotLayer), so you place & aim by eye instead of guessing.
//  - Export ready-to-use JSON. yaw/pitch are WORLD-space (what the tour uses
//    directly as hotspot.yaw/pitch — no correction needed).
// ---------------------------------------------------------------------------

type HotspotKind = 'navigation' | 'info' | 'door';
type EditorHotspot = {
  id: string;
  kind: HotspotKind;
  yaw: number;
  pitch: number;
  label: string;
  target?: string; // target room slug (navigation / door)
  collection_id?: string; // (info)
  arrow_deg?: number; // (navigation)
};
type Coords = { yaw: number; pitch: number };
type RoomDef = { slug: string; title: string; file: string };
type RoomMeta = { roll?: number; initial_yaw?: number };

const STORAGE_KEY = 'vr-calibration-hotspots-v2';
const STORAGE_KEY_META = 'vr-calibration-meta';

// Loadable photos. Slugs match the tour's slugs so exported `target` values are
// usable as-is. 'lobby-open' is only the door-open animation frame (not a room).
const ROOMS: RoomDef[] = [
  { slug: 'lobby', title: 'Lobby (pintu tertutup)', file: '/panorama/lobby/lobby.JPG' },
  { slug: 'lobby-open', title: 'Lobby (pintu terbuka — preview animasi)', file: '/panorama/lobby/lobby-animation-open.JPG' },
  ...Array.from({ length: 17 }, (_, i) => i + 1).map((n): RoomDef => ({
    slug: String(n),
    title: `Ruang ${n}`,
    file: `/panorama/scenes/${n}.JPG`,
  })),
  ...Array.from({ length: 9 }, (_, i) => i + 18).map((n): RoomDef => ({
    slug: `restricted-${n}`,
    title: `Restricted ${n}`,
    file: `/panorama/scenes/restricted-${n}.JPG`,
  })),
];

// Rooms that make sense as navigation targets (everything except the animation frame).
const TARGET_ROOMS = ROOMS.filter((r) => r.slug !== 'lobby-open');

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Map an editor hotspot to the real tour Hotspot type so the live preview uses
 *  the exact same renderer (HotspotLayer) as the shipped tour. */
function toTourHotspot(h: EditorHotspot): Hotspot {
  if (h.kind === 'info') {
    return {
      id: h.id,
      type: 'info',
      yaw: h.yaw,
      pitch: h.pitch,
      label: h.label,
      collection_id: h.collection_id ?? '',
    };
  }
  return {
    id: h.id,
    type: 'navigation',
    yaw: h.yaw,
    pitch: h.pitch,
    label: h.label,
    target_scene_id: h.target ?? '',
    ...(h.kind === 'door' ? { variant: 'door' as const } : {}),
    ...(h.kind === 'navigation' && h.arrow_deg !== undefined ? { arrow_deg: h.arrow_deg } : {}),
  };
}

/** Reverse of toTourHotspot — turn a tour Hotspot (from the seed) into an editor row. */
function fromTourHotspot(h: Hotspot): EditorHotspot {
  if (h.type === 'info') {
    return { id: h.id, kind: 'info', yaw: h.yaw, pitch: h.pitch, label: h.label, collection_id: h.collection_id };
  }
  if (h.type === 'navigation') {
    return {
      id: h.id,
      kind: h.variant === 'door' ? 'door' : 'navigation',
      yaw: h.yaw,
      pitch: h.pitch,
      label: h.label,
      target: h.target_scene_id,
      arrow_deg: h.arrow_deg,
    };
  }
  // 'photo' / 'external_link' — CMS-managed backend types this dev editor doesn't
  // create or edit. Shown as a plain marker rather than crashing on the mismatch.
  return { id: h.id, kind: 'info', yaw: h.yaw, pitch: h.pitch, label: h.label, collection_id: '' };
}

/** The bundled seed (lib/calibrationSeed.ts) as editor state — the default shown
 *  when localStorage is empty, so a fresh visit never loses the mapped hotspots. */
function seedToByRoom(): Record<string, EditorHotspot[]> {
  const out: Record<string, EditorHotspot[]> = {};
  for (const [slug, room] of Object.entries(calibrationSeed.rooms)) {
    out[slug] = room.hotspots.map(fromTourHotspot);
  }
  return out;
}
function seedToMeta(): Record<string, RoomMeta> {
  const out: Record<string, RoomMeta> = {};
  for (const [slug, room] of Object.entries(calibrationSeed.rooms)) {
    out[slug] = { roll: room.roll, initial_yaw: room.initial_yaw };
  }
  return out;
}

/** Wrap an angle to [-180, 180). */
function normalizeYaw(deg: number): number {
  let y = deg % 360;
  if (y < -180) y += 360;
  if (y > 180) y -= 360;
  return y;
}

export default function CalibrationTool() {
  const [ready, setReady] = useState(false);
  const [roomSlug, setRoomSlug] = useState('lobby');
  const [byRoom, setByRoom] = useState<Record<string, EditorHotspot[]>>({});
  const [meta, setMeta] = useState<Record<string, RoomMeta>>({});
  const [live, setLive] = useState<Coords>({ yaw: 0, pitch: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cameraRef = useRef<HTMLElement>(null);

  const room = useMemo(() => ROOMS.find((r) => r.slug === roomSlug)!, [roomSlug]);
  const roomMeta = meta[roomSlug] ?? {};
  const roll = roomMeta.roll ?? 0;
  const initialYaw = roomMeta.initial_yaw ?? 0;
  const hotspots = byRoom[roomSlug] ?? [];
  const selected = hotspots.find((h) => h.id === selectedId) ?? null;

  // 1) Load A-Frame + register the hotspot renderer used by the preview.
  useEffect(() => {
    let mounted = true;
    import('aframe').then(() => {
      registerHotspotLayer();
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Load saved edits from localStorage; fall back to the bundled seed so the
  // mapped hotspots/positions are never lost on a fresh visit or new browser.
  useEffect(() => {
    const storedHs = loadJSON<Record<string, EditorHotspot[]>>(STORAGE_KEY, {});
    const storedMeta = loadJSON<Record<string, RoomMeta>>(STORAGE_KEY_META, {});
    setByRoom(Object.keys(storedHs).length ? storedHs : seedToByRoom());
    setMeta(Object.keys(storedMeta).length ? storedMeta : seedToMeta());
  }, []);

  // Live yaw/pitch readout from the camera direction.
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

  const persist = (next: Record<string, EditorHotspot[]>) => {
    setByRoom(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // best-effort — data is also copyable via Export
    }
  };
  const persistMeta = (next: Record<string, RoomMeta>) => {
    setMeta(next);
    try {
      window.localStorage.setItem(STORAGE_KEY_META, JSON.stringify(next));
    } catch {
      // best-effort
    }
  };

  const setRoll = (value: number) => persistMeta({ ...meta, [roomSlug]: { ...roomMeta, roll: value } });

  // Setting the initial facing rotates the sky/photo by initial_yaw. Hotspots live
  // in world space, so without compensation they'd appear to slide across the photo.
  // Rotate this room's hotspots by -delta so they stay glued to the same spot.
  const captureInitialYaw = () => {
    const oldIY = roomMeta.initial_yaw ?? 0;
    const newIY = live.yaw;
    const delta = newIY - oldIY;
    if (delta !== 0) {
      const rotated = (byRoom[roomSlug] ?? []).map((h) => ({ ...h, yaw: normalizeYaw(h.yaw - delta) }));
      persist({ ...byRoom, [roomSlug]: rotated });
    }
    persistMeta({ ...meta, [roomSlug]: { ...roomMeta, initial_yaw: newIY } });
  };

  const updateHotspots = (next: EditorHotspot[]) => persist({ ...byRoom, [roomSlug]: next });

  const addHotspot = () => {
    const n = hotspots.length + 1;
    const h: EditorHotspot = {
      id: `${roomSlug}-hs-${Date.now().toString(36)}`,
      kind: 'navigation',
      yaw: live.yaw,
      pitch: live.pitch,
      label: `Hotspot ${n}`,
      target: '',
      arrow_deg: 0,
    };
    updateHotspots([...hotspots, h]);
    setSelectedId(h.id);
  };

  const patchHotspot = (id: string, patch: Partial<EditorHotspot>) =>
    updateHotspots(hotspots.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  const reaimHotspot = (id: string) => patchHotspot(id, { yaw: live.yaw, pitch: live.pitch });

  const deleteHotspot = (id: string) => {
    updateHotspots(hotspots.filter((h) => h.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const exportJson = useMemo(() => {
    const rooms: Record<string, unknown> = {};
    for (const r of ROOMS) {
      const hs = byRoom[r.slug] ?? [];
      const m = meta[r.slug] ?? {};
      if (hs.length === 0 && m.initial_yaw === undefined && m.roll === undefined) continue;
      rooms[r.slug] = {
        initial_yaw: m.initial_yaw ?? 0,
        roll: m.roll ?? 0,
        hotspots: hs.map((h) => toTourHotspot(h)),
      };
    }
    return JSON.stringify(
      {
        version: 2,
        note: 'yaw/pitch WORLD-space — pakai langsung sebagai hotspot.yaw/pitch (tanpa koreksi -90). arrow_deg = rotasi panah (derajat) untuk hotspot navigasi.',
        rooms,
      },
      null,
      2,
    );
  }, [byRoom, meta]);

  const copyExport = () => navigator.clipboard?.writeText(exportJson).catch(() => {});

  if (!ready) {
    return <div className="flex h-screen items-center justify-center bg-black text-white">Menyiapkan mesin VR…</div>;
  }

  const totalCount = Object.values(byRoom).reduce((s, r) => s + r.length, 0);
  const previewHotspots: Hotspot[] = hotspots.map(toTourHotspot);

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
          {/* rotation MUST match production's sky-crossfade (y = initial_yaw, z = roll). */}
          <a-sky key={room.file} src={room.file} rotation={`0 ${initialYaw} ${roll}`} />
          <a-camera ref={cameraRef} position="0 0 0" look-controls="reverseMouseDrag: false" wasd-controls="enabled: false" />

          {/* LIVE hotspot preview — same renderer as the tour. */}
          <HotspotLayer key={roomSlug} hotspots={previewHotspots} onNavigate={() => {}} onInfo={() => {}} onPhoto={() => {}} onExternalLink={() => {}} />

          {/* Selection halo around the hotspot currently being edited. */}
          {selected && (
            <a-ring
              position={toPosition(selected.yaw, selected.pitch, 5.85)}
              rotation={`0 ${-selected.yaw} 0`}
              radius-inner="0.62"
              radius-outer="0.72"
              material="shader: flat; side: double; color: #22d3ee; opacity: 0.95; transparent: true"
            />
          )}
        </a-scene>

        {/* Crosshair */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-8 w-8">
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/80" />
            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/80" />
            <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-light" />
          </div>
        </div>

        {/* Live readout + quick add */}
        <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-black/75 px-4 py-2 backdrop-blur">
          <span className="font-mono text-sm">
            yaw: <b className="text-brand-light">{live.yaw}</b>° &nbsp; pitch: <b className="text-brand-light">{live.pitch}</b>°
          </span>
          <button
            type="button"
            onClick={addHotspot}
            className="rounded-md bg-brand px-3 py-1 text-xs font-semibold hover:bg-brand-light"
          >
            + Tambah hotspot di sini
          </button>
        </div>

        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-black/75 px-3 py-1.5 font-mono text-xs backdrop-blur">
          {room.file}
        </div>
      </div>

      {/* Sidebar */}
      <div className="flex w-96 flex-col overflow-y-auto border-l border-white/10 bg-neutral-950 p-4">
        <h1 className="text-sm font-semibold uppercase tracking-wide text-brand-light">Editor Hotspot (dev only)</h1>
        <p className="mt-1 text-xs text-white/50">{hotspots.length} di ruang ini · {totalCount} total (localStorage)</p>

        <label className="mt-4 block text-xs text-white/60">Ruang</label>
        <select
          value={roomSlug}
          onChange={(e) => {
            setRoomSlug(e.target.value);
            setSelectedId(null);
          }}
          className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-sm"
        >
          <optgroup label="Lobby">
            {ROOMS.filter((r) => r.slug === 'lobby' || r.slug === 'lobby-open').map((r) => (
              <option key={r.slug} value={r.slug}>{r.title}</option>
            ))}
          </optgroup>
          <optgroup label="Ruang 1-17">
            {ROOMS.filter((r) => /^\d+$/.test(r.slug)).map((r) => (
              <option key={r.slug} value={r.slug}>{r.title}</option>
            ))}
          </optgroup>
          <optgroup label="Restricted">
            {ROOMS.filter((r) => r.slug.startsWith('restricted-')).map((r) => (
              <option key={r.slug} value={r.slug}>{r.title}</option>
            ))}
          </optgroup>
        </select>

        {/* Roll */}
        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Roll (kemiringan horizon)</span>
            <span className="font-mono text-[11px] text-brand-light">{roll}°</span>
          </div>
          <input type="range" min={-20} max={20} step={0.5} value={roll} onChange={(e) => setRoll(Number(e.target.value))} className="mt-1.5 w-full" />
          <p className="mt-1 text-[10px] text-white/40">Geser sampai garis lantai/langit-langit terlihat rata.</p>
        </div>

        {/* Initial facing */}
        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">Initial facing (arah pas masuk)</span>
            {roomMeta.initial_yaw !== undefined && <span className="text-[10px] text-emerald-400">✓ yaw {roomMeta.initial_yaw}</span>}
          </div>
          <button type="button" onClick={captureInitialYaw} className="mt-1.5 w-full rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium hover:bg-white/20">
            Simpan arah sekarang sebagai initial facing
          </button>
        </div>

        {/* Hotspot list */}
        <div className="mt-4 space-y-2">
          {hotspots.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/15 p-3 text-center text-xs text-white/40">
              Belum ada hotspot. Arahkan crosshair lalu klik “+ Tambah hotspot di sini”.
            </p>
          )}
          {hotspots.map((h) => {
            const active = h.id === selectedId;
            return (
              <div
                key={h.id}
                className={`rounded-lg border p-2.5 ${active ? 'border-cyan-400/70 bg-cyan-400/10' : 'border-white/10 bg-white/5'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => setSelectedId(active ? null : h.id)} className="flex-1 text-left text-xs font-semibold">
                    {h.label || '(tanpa label)'}
                  </button>
                  <span className="font-mono text-[10px] text-white/40">
                    y{h.yaw} p{h.pitch}
                  </span>
                  <button type="button" onClick={() => deleteHotspot(h.id)} className="text-white/40 hover:text-red-400" aria-label="Hapus hotspot">
                    ✕
                  </button>
                </div>

                {active && (
                  <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
                    {/* Type */}
                    <div className="flex gap-1">
                      {(['navigation', 'info', 'door'] as HotspotKind[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => patchHotspot(h.id, { kind: k })}
                          className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium ${h.kind === k ? 'bg-brand text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                        >
                          {k === 'navigation' ? 'Navigasi' : k === 'info' ? 'Info' : 'Pintu'}
                        </button>
                      ))}
                    </div>

                    {/* Label */}
                    <input
                      value={h.label}
                      onChange={(e) => patchHotspot(h.id, { label: e.target.value })}
                      placeholder="Label"
                      className="w-full rounded-md bg-white/10 px-2 py-1 text-xs"
                    />

                    {/* Target / collection */}
                    {h.kind === 'info' ? (
                      <input
                        value={h.collection_id ?? ''}
                        onChange={(e) => patchHotspot(h.id, { collection_id: e.target.value })}
                        placeholder="collection_id (mis. skull-001)"
                        className="w-full rounded-md bg-white/10 px-2 py-1 text-xs"
                      />
                    ) : (
                      <select
                        value={h.target ?? ''}
                        onChange={(e) => patchHotspot(h.id, { target: e.target.value })}
                        className="w-full rounded-md bg-white/10 px-2 py-1 text-xs"
                      >
                        <option value="">— pilih ruang tujuan —</option>
                        {TARGET_ROOMS.map((r) => (
                          <option key={r.slug} value={r.slug}>
                            {r.title} ({r.slug})
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Arrow rotation (navigation only) */}
                    {h.kind === 'navigation' && (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-white/60">Arah panah</span>
                          <span className="font-mono text-[11px] text-brand-light">{h.arrow_deg ?? 0}°</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={360}
                          step={1}
                          value={h.arrow_deg ?? 0}
                          onChange={(e) => patchHotspot(h.id, { arrow_deg: Number(e.target.value) })}
                          className="mt-1 w-full"
                        />
                        <div className="mt-1 flex gap-1">
                          {[
                            ['Maju', 0],
                            ['Kanan', 90],
                            ['Balik', 180],
                            ['Kiri', 270],
                          ].map(([lbl, deg]) => (
                            <button
                              key={deg as number}
                              type="button"
                              onClick={() => patchHotspot(h.id, { arrow_deg: deg as number })}
                              className="flex-1 rounded bg-white/10 px-1 py-0.5 text-[10px] hover:bg-white/20"
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => reaimHotspot(h.id)}
                      className="w-full rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium hover:bg-white/20"
                    >
                      Aim ulang ke crosshair sekarang (y{live.yaw} p{live.pitch})
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Export / reset */}
        <div className="mt-auto pt-4">
          <button type="button" onClick={copyExport} className="w-full rounded-lg bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/20">
            Copy semua hasil (JSON)
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Kembalikan semua ke data awal (seed)? Perubahan tersimpan akan diganti.')) {
                persist(seedToByRoom());
                persistMeta(seedToMeta());
                setSelectedId(null);
              }
            }}
            className="mt-1.5 w-full rounded-lg px-3 py-1.5 text-[11px] text-white/40 hover:text-red-400"
          >
            Reset ke data awal (seed)
          </button>
        </div>
      </div>
    </div>
  );
}
