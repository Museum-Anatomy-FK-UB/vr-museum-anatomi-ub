// TEMPORARY local preview data — assembled from yaw/pitch captured via
// /dev/calibrate against the real photos in public/panorama/, so the real
// /vr route can be walked end-to-end before this becomes backend seed data.
//
// Activated only when NEXT_PUBLIC_LOCAL_PREVIEW=true (see lib/api.ts) — off
// by default, never set in .env.example. Delete this file + the flag once the
// backend has real rooms/hotspots/collections seeded.
//
// Room names/labels below are PLACEHOLDERS (real names not decided yet).
// Restricted rooms (18-26) are intentionally excluded — their graph hasn't
// been defined yet.

import type { Collection } from '@/lib/types/collection';
import type { Hotspot, Scene, SceneSummary } from '@/lib/types/tour';

type CapturedCoords = { yaw: number; pitch: number };
type CapturedRoom = Record<string, CapturedCoords>;

// Captured 2026-08-06 via /dev/calibrate.
const CAPTURED: Record<string, CapturedRoom> = {
  lobby: { enter: { yaw: 0, pitch: -1 } },
  '1': { 'next-2': { yaw: 52, pitch: -22 }, 'back-lobby': { yaw: -178, pitch: -7 } },
  '2': { 'next-3': { yaw: -51, pitch: -32 }, 'back-1': { yaw: -172, pitch: -22 } },
  '3': {
    'info-1': { yaw: -25, pitch: 5 },
    'info-2': { yaw: 2, pitch: -20 },
    'next-5': { yaw: -137, pitch: -23 },
    'back-2': { yaw: 143, pitch: -35 },
  },
  '4': { 'back-5': { yaw: -83, pitch: -43 } },
  '5': {
    'next-6': { yaw: 139, pitch: -31 },
    'back-3': { yaw: -120, pitch: -20 },
    'side-4': { yaw: 177, pitch: -46 },
  },
  '6': { 'next-7': { yaw: 150, pitch: -39 }, 'back-5': { yaw: -133, pitch: -43 } },
  '7': { 'next-8': { yaw: 94, pitch: -31 }, 'back-6': { yaw: -96, pitch: -40 } },
  '8': { 'next-9': { yaw: 88, pitch: -27 }, 'back-7': { yaw: -93, pitch: -30 } },
  '9': { 'next-10': { yaw: -87, pitch: -27 }, 'back-8': { yaw: 78, pitch: -31 } },
  '10': { 'next-11': { yaw: 111, pitch: -29 }, 'back-9': { yaw: 80, pitch: -28 } },
  '11': { 'next-12': { yaw: 104, pitch: -46 }, 'back-10': { yaw: -99, pitch: -30 } },
  '12': { 'next-13': { yaw: 89, pitch: -23 }, 'back-11': { yaw: -156, pitch: -46 } },
  '13': { 'next-14': { yaw: 85, pitch: -25 }, 'back-12': { yaw: -99, pitch: -26 } },
  '14': { 'next-15': { yaw: 82, pitch: -27 }, 'back-13': { yaw: -91, pitch: -28 } },
  '15': { 'next-16': { yaw: 83, pitch: -29 }, 'back-14': { yaw: 171, pitch: -30 } },
  '16': { 'next-17': { yaw: 104, pitch: -29 }, 'back-15': { yaw: 78, pitch: -21 } },
  '17': { 'back-16': { yaw: -126, pitch: -26 } },
};

type RoomMeta = { roll?: number; initial_yaw?: number };

// Captured 2026-08-06 via /dev/calibrate's Roll slider + "Initial facing" capture.
// Restricted rooms (18-26) have initial_yaw captured too, but aren't wired into
// previewScenes yet — their hotspot graph hasn't been defined.
const ROOM_META: Record<string, RoomMeta> = {
  // initial_yaw was originally captured near-default (2°, facing the tree — see
  // the "Masuk" hotspot symptom this whole recalibration started from). Reset
  // to face the entrance/door, matching the "Masuk" hotspot's own yaw (-90).
  lobby: { roll: 1.5, initial_yaw: -90 },
  '1': { roll: 1.5, initial_yaw: -37 },
  '2': { roll: 1, initial_yaw: -25 },
  '3': { roll: 0.5, initial_yaw: -83 },
  '4': { roll: 3, initial_yaw: -93 },
  '5': { roll: 3, initial_yaw: -75 },
  '6': { roll: 3, initial_yaw: -117 },
  '7': { roll: 3, initial_yaw: -93 },
  '8': { roll: 3, initial_yaw: -94 },
  '9': { roll: 3.5, initial_yaw: -88 },
  '10': { roll: 3.5, initial_yaw: -94 },
  '11': { roll: 3, initial_yaw: -85 },
  '12': { roll: 3, initial_yaw: -88 },
  '13': { roll: 3.5, initial_yaw: -97 },
  '14': { roll: 4, initial_yaw: -3 },
  '15': { roll: 1.5, initial_yaw: -92 },
  '16': { roll: 1, initial_yaw: -96 },
  '17': { roll: 1.5, initial_yaw: -93 },
};

const ROOM_ORDER = ['lobby', ...Array.from({ length: 17 }, (_, i) => String(i + 1))];

const LOBBY_DOOR_OPEN_URL = '/panorama/lobby/lobby-animation-open.JPG';

function panoramaUrl(slug: string): string {
  return slug === 'lobby' ? '/panorama/lobby/lobby.JPG' : `/panorama/scenes/${slug}.JPG`;
}

function roomTitle(slug: string): string {
  return slug === 'lobby' ? 'Lobby' : `Ruang ${slug}`;
}

/** Wrap to [-180, 180). */
function normalizeYaw(deg: number): number {
  let y = deg % 360;
  if (y < -180) y += 360;
  if (y > 180) y -= 360;
  return y;
}

/**
 * One-time correction: everything in CAPTURED above was captured through
 * /dev/calibrate before its sky had a stray `rotation="0 -90 0"` (a bug — fixed
 * now, production always renders at rotation.y = initial_yaw = 0 for these
 * rooms). Worked out from the sky's rotation math (texture-yaw = world-yaw +
 * rotation.y, invariant across rotation changes): with calibration's rotation
 * at -90° and production's at 0°, production_yaw = captured_yaw + (-90 - 0) =
 * captured_yaw - 90. Sanity-checked against the Lobby report: captured
 * "enter" yaw 0 (aimed at the door in the tool) becomes -90 here, which is
 * where the door actually sits relative to the tree at world-yaw 0 — matches
 * the reported "hotspot lands near the tree, not the door".
 * Drop this once rooms are re-verified/re-captured in the fixed tool.
 */
const YAW_CORRECTION_DEG = -90;

/**
 * Hotspots are placed in WORLD space (toPosition in HotspotLayer.tsx does not
 * know or care about the sky's rotation), but what we captured is really a
 * texture-relative direction — stable regardless of how the sky is rotated.
 * `initial_yaw` was captured/added *after* the hotspot yaws above, and it
 * rotates the sky per room, so it must be subtracted here to keep hotspots
 * visually attached to the same physical spot (e.g. "Masuk" staying on the
 * door) instead of drifting by exactly the room's initial_yaw.
 */
function toWorldYaw(textureYaw: number, roomInitialYaw: number): number {
  return normalizeYaw(textureYaw - roomInitialYaw);
}

/** Turn one captured target ("next-5", "back-lobby", "side-4", "info-2", "enter") into a Hotspot. */
function buildHotspot(roomSlug: string, targetId: string, coords: CapturedCoords, roomInitialYaw: number): Hotspot {
  const textureYaw = normalizeYaw(coords.yaw + YAW_CORRECTION_DEG);
  const yaw = toWorldYaw(textureYaw, roomInitialYaw);
  const { pitch } = coords;

  if (targetId === 'enter') {
    return {
      id: `${roomSlug}-${targetId}`,
      type: 'navigation',
      yaw,
      pitch,
      label: 'Masuk',
      arrow: 'up',
      target_scene_id: '1',
      transition_url: LOBBY_DOOR_OPEN_URL,
    };
  }

  const [kind, ...rest] = targetId.split('-');
  const suffix = rest.join('-'); // room number, or "lobby"

  if (kind === 'info') {
    return {
      id: `${roomSlug}-${targetId}`,
      type: 'info',
      yaw,
      pitch,
      label: `Koleksi ${suffix} (placeholder)`,
      collection_id: `placeholder-${roomSlug}-info-${suffix}`,
    };
  }

  // next / back / side — all navigation, differ only in label/arrow.
  const label = kind === 'back' ? (suffix === 'lobby' ? 'Kembali ke Lobby' : 'Kembali') : roomTitle(suffix);
  const arrow = kind === 'back' ? 'down' : kind === 'side' ? 'right' : 'up';

  return {
    id: `${roomSlug}-${targetId}`,
    type: 'navigation',
    yaw,
    pitch,
    label,
    arrow,
    target_scene_id: suffix,
  };
}

function buildScene(slug: string, order: number): Scene {
  const meta = ROOM_META[slug] ?? {};
  const initialYaw = meta.initial_yaw ?? 0;
  const targets = CAPTURED[slug] ?? {};
  const hotspots = Object.entries(targets).map(([targetId, coords]) =>
    buildHotspot(slug, targetId, coords, initialYaw),
  );

  return {
    id: slug,
    title: roomTitle(slug),
    panorama_url: panoramaUrl(slug),
    thumbnail_url: panoramaUrl(slug), // no separate optimized thumb yet — see public/panorama/README.md
    initial_yaw: initialYaw,
    initial_pitch: 0,
    horizon_roll: meta.roll ?? 0,
    order,
    hotspots,
  };
}

export const previewScenes: Record<string, Scene> = Object.fromEntries(
  ROOM_ORDER.map((slug, i) => [slug, buildScene(slug, i + 1)]),
);

export const previewSceneList: SceneSummary[] = ROOM_ORDER.map((slug) => {
  const s = previewScenes[slug];
  return { id: s.id, title: s.title, thumbnail_url: s.thumbnail_url, order: s.order! };
});

export const previewCollections: Record<string, Collection> = {
  'placeholder-3-info-1': {
    id: 'placeholder-3-info-1',
    name: 'Koleksi 1 — Ruang 3 (placeholder)',
    description: 'Konten koleksi ini belum final — placeholder untuk preview lokal, menunggu data asli dari FK.',
    photos: [],
    audio_url: null,
    video_url: null,
    portal_url: null,
  },
  'placeholder-3-info-2': {
    id: 'placeholder-3-info-2',
    name: 'Koleksi 2 — Ruang 3 (placeholder)',
    description: 'Konten koleksi ini belum final — placeholder untuk preview lokal, menunggu data asli dari FK.',
    photos: [],
    audio_url: null,
    video_url: null,
    portal_url: null,
  },
};
