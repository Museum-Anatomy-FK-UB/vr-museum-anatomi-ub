import type { Scene, SceneSummary } from '@/lib/types/tour';

// Foto 360° LOKAL untuk testing (public/panorama/...). Diakses dari root URL.
// Nanti diganti URL storage server via API (lihat docs/API.md).
//
// Pakai varian "-web" (4096x2048, di-downscale dari original 5376x2688) untuk
// tekstur panorama di dalam scene — jauh lebih ringan di-decode/render sehingga
// drag terasa mulus, tanpa kehilangan ketajaman yang terasa di VR. Varian
// "-thumb" (640x320) khusus untuk kartu landing & galeri "All Location" —
// jangan pernah load foto 360 full-res cuma untuk thumbnail kecil.
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

// Posisi ruang pada denah (persen 0–100). Placeholder — nanti dari API/data FK.
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
