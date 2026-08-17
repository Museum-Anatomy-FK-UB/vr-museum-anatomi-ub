// TEMPORARY local preview data — built from lib/calibrationSeed.ts (the single
// source shared with /dev/calibrate). yaw/pitch are WORLD-space and used
// directly, so there is NO yaw correction / initial_yaw subtraction anymore
// (that legacy transform is gone — the editor now captures world-space directly).
//
// Activated only when NEXT_PUBLIC_LOCAL_PREVIEW=true (see lib/api.ts) — off by
// default. Delete this file + the flag once the backend seeds the real data.

import type { Collection } from '@/lib/types/collection';
import type { Hotspot, Scene, SceneSummary } from '@/lib/types/tour';
import { calibrationSeed } from '@/lib/calibrationSeed';

// Public rooms shown in the tour + the "All Location" gallery / floor plan, in order.
const PUBLIC_ORDER = ['lobby', ...Array.from({ length: 17 }, (_, i) => String(i + 1))];
// Restricted rooms: reachable (so the Ruang 17 door doesn't dead-end) but NOT
// listed in the public gallery/floor plan.
const RESTRICTED_ORDER = Array.from({ length: 9 }, (_, i) => `restricted-${i + 18}`);
const ALL_ORDER = [...PUBLIC_ORDER, ...RESTRICTED_ORDER];

// One-off door-opening frame shown in place before entering Ruang 1 — frontend
// only (not captured by the editor), re-attached to the Lobby's door hotspot here.
const LOBBY_DOOR_OPEN_URL = '/panorama/lobby/lobby-animation-open.JPG';

function panoramaUrl(slug: string): string {
  return slug === 'lobby' ? '/panorama/lobby/lobby.JPG' : `/panorama/scenes/${slug}.JPG`;
}

function roomTitle(slug: string): string {
  if (slug === 'lobby') return 'Lobby';
  if (slug.startsWith('restricted-')) return `Restricted ${slug.split('-')[1]}`;
  return `Ruang ${slug}`;
}

/** Re-attach the Lobby door's one-off transition frame (see LOBBY_DOOR_OPEN_URL). */
function withLobbyTransition(slug: string, hotspots: Hotspot[]): Hotspot[] {
  if (slug !== 'lobby') return hotspots;
  return hotspots.map((h) =>
    h.type === 'navigation' && h.variant === 'door' ? { ...h, transition_url: LOBBY_DOOR_OPEN_URL } : h,
  );
}

function buildScene(slug: string, order: number): Scene {
  const room = calibrationSeed.rooms[slug];
  return {
    id: slug,
    title: roomTitle(slug),
    panorama_url: panoramaUrl(slug),
    thumbnail_url: panoramaUrl(slug), // no separate optimized thumb yet — see public/panorama/README.md
    initial_yaw: room?.initial_yaw ?? 0,
    initial_pitch: 0,
    horizon_roll: room?.roll ?? 0,
    order,
    hotspots: withLobbyTransition(slug, room?.hotspots ?? []),
  };
}

// Every loadable room (public + restricted) so navigation never throws.
export const previewScenes: Record<string, Scene> = Object.fromEntries(
  ALL_ORDER.map((slug, i) => [slug, buildScene(slug, i + 1)]),
);

// Only public rooms appear in the landing/gallery/floor-plan list.
export const previewSceneList: SceneSummary[] = PUBLIC_ORDER.map((slug, i) => {
  const s = previewScenes[slug];
  return { id: s.id, title: s.title, thumbnail_url: s.thumbnail_url, order: i + 1 };
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
