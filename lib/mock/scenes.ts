import type { Scene, SceneSummary } from '@/lib/types/tour';

// LOCAL 360° photos for testing (public/panorama/...). Served from the root URL.
// Will be replaced by server storage URLs via the API (see docs/API.md).
//
// Use the "-web" variant (4096x2048, downscaled from the original 5376x2688) for
// the in-scene panorama texture — much lighter to decode/render so dragging feels
// smooth, without losing sharpness in VR. The "-thumb" variant (640x320) is only
// for the landing cards & the "All Location" gallery — never load a full-res 360°
// photo just for a small thumbnail.
const LOBBY = '/panorama/lobby/loby-ftp-360-web.jpg';
const LOBBY_THUMB = '/panorama/lobby/loby-ftp-360-thumb.jpg';
const POS1 = '/panorama/scenes/pos1-360-web.jpg';
const POS1_THUMB = '/panorama/scenes/pos1-360-thumb.jpg';
const POS2 = '/panorama/scenes/pos2-360-web.jpg';
const POS2_THUMB = '/panorama/scenes/pos2-360-thumb.jpg';
const POS3 = '/panorama/scenes/pos3-360-web.jpg';
const POS3_THUMB = '/panorama/scenes/pos3-360-thumb.jpg';

export const mockScenes: Record<string, Scene> = {
  'ruang-lobby': {
    id: 'ruang-lobby',
    title: 'Lobby Museum',
    panorama_url: LOBBY,
    thumbnail_url: LOBBY_THUMB,
    initial_yaw: 0,
    initial_pitch: 0,
    order: 1,
    hotspots: [
      { id: 'hs-lobby-1', type: 'navigation', yaw: 35, pitch: -5, label: 'Ruang Koleksi 1', target_scene_id: 'pos-1', arrow: 'left' },
      { id: 'hs-lobby-2', type: 'navigation', yaw: -45, pitch: -5, label: 'Ruang Koleksi 2', target_scene_id: 'pos-2', arrow: 'up' },
      { id: 'hs-lobby-3', type: 'navigation', yaw: 150, pitch: -5, label: 'Ruang Koleksi 3', target_scene_id: 'pos-3', arrow: 'right' },
    ],
  },
  'pos-1': {
    id: 'pos-1',
    title: 'Ruang Koleksi 1',
    panorama_url: POS1,
    thumbnail_url: POS1_THUMB,
    initial_yaw: 0,
    initial_pitch: 0,
    order: 2,
    hotspots: [
      { id: 'hs-pos1-back', type: 'navigation', yaw: 180, pitch: -5, label: 'Kembali ke Lobby', target_scene_id: 'ruang-lobby', arrow: 'down' },
      { id: 'hs-pos1-next', type: 'navigation', yaw: 60, pitch: -5, label: 'Ruang Koleksi 2', target_scene_id: 'pos-2', arrow: 'right' },
      { id: 'hs-pos1-info', type: 'info', yaw: -30, pitch: -8, label: 'Tengkorak Manusia', collection_id: 'skull-001' },
    ],
  },
  'pos-2': {
    id: 'pos-2',
    title: 'Ruang Koleksi 2',
    panorama_url: POS2,
    thumbnail_url: POS2_THUMB,
    initial_yaw: 0,
    initial_pitch: 0,
    order: 3,
    hotspots: [
      { id: 'hs-pos2-back', type: 'navigation', yaw: 180, pitch: -5, label: 'Kembali ke Lobby', target_scene_id: 'ruang-lobby', arrow: 'down' },
      { id: 'hs-pos2-next', type: 'navigation', yaw: 60, pitch: -5, label: 'Ruang Koleksi 3', target_scene_id: 'pos-3', arrow: 'right' },
      { id: 'hs-pos2-info', type: 'info', yaw: 0, pitch: -8, label: 'Jantung', collection_id: 'heart-001' },
    ],
  },
  'pos-3': {
    id: 'pos-3',
    title: 'Ruang Koleksi 3',
    panorama_url: POS3,
    thumbnail_url: POS3_THUMB,
    initial_yaw: 0,
    initial_pitch: 0,
    order: 4,
    hotspots: [
      { id: 'hs-pos3-back', type: 'navigation', yaw: 180, pitch: -5, label: 'Kembali ke Lobby', target_scene_id: 'ruang-lobby', arrow: 'down' },
      { id: 'hs-pos3-next', type: 'navigation', yaw: 60, pitch: -5, label: 'Ruang Koleksi 1', target_scene_id: 'pos-1', arrow: 'right' },
      { id: 'hs-pos3-info', type: 'info', yaw: -20, pitch: -8, label: 'Tulang Paha', collection_id: 'femur-001' },
    ],
  },
};

// Room positions on the floor plan (percent 0–100). Placeholder — later from API/FK data.
const MAP_COORDS: Record<string, { map_x: number; map_y: number }> = {
  'ruang-lobby': { map_x: 50, map_y: 82 },
  'pos-1': { map_x: 24, map_y: 48 },
  'pos-2': { map_x: 50, map_y: 26 },
  'pos-3': { map_x: 76, map_y: 48 },
};

export const mockSceneList: SceneSummary[] = Object.values(mockScenes)
  .map(({ id, title, thumbnail_url, order }) => ({
    id,
    title,
    thumbnail_url,
    order: order ?? 0,
    ...MAP_COORDS[id],
  }))
  .sort((a, b) => a.order - b.order);
