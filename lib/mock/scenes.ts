import type { Scene, SceneSummary } from '@/lib/types/tour';

// Foto 360° LOKAL untuk testing (public/panorama/...). Diakses dari root URL.
// Nanti diganti URL storage server via API (lihat docs/API.md).
const LOBBY = '/panorama/lobby/loby-ftp-360.jpg';
const POS1 = '/panorama/scenes/pos1-360.jpg';
const POS2 = '/panorama/scenes/pos2-360.jpg';
const POS3 = '/panorama/scenes/pos3-360.jpg';

export const mockScenes: Record<string, Scene> = {
  'ruang-lobby': {
    id: 'ruang-lobby',
    title: 'Lobby Museum',
    panorama_url: LOBBY,
    thumbnail_url: LOBBY,
    initial_yaw: 0,
    initial_pitch: 0,
    order: 1,
    hotspots: [
      { id: 'hs-lobby-1', type: 'navigation', yaw: 35, pitch: -5, label: 'Ruang Koleksi 1', target_scene_id: 'pos-1' },
      { id: 'hs-lobby-2', type: 'navigation', yaw: -45, pitch: -5, label: 'Ruang Koleksi 2', target_scene_id: 'pos-2' },
      { id: 'hs-lobby-3', type: 'navigation', yaw: 150, pitch: -5, label: 'Ruang Koleksi 3', target_scene_id: 'pos-3' },
    ],
  },
  'pos-1': {
    id: 'pos-1',
    title: 'Ruang Koleksi 1',
    panorama_url: POS1,
    thumbnail_url: POS1,
    initial_yaw: 0,
    initial_pitch: 0,
    order: 2,
    hotspots: [
      { id: 'hs-pos1-back', type: 'navigation', yaw: 180, pitch: -5, label: 'Kembali ke Lobby', target_scene_id: 'ruang-lobby' },
      { id: 'hs-pos1-next', type: 'navigation', yaw: 60, pitch: -5, label: 'Ruang Koleksi 2', target_scene_id: 'pos-2' },
      { id: 'hs-pos1-info', type: 'info', yaw: -30, pitch: -8, label: 'Tengkorak Manusia', collection_id: 'skull-001' },
    ],
  },
  'pos-2': {
    id: 'pos-2',
    title: 'Ruang Koleksi 2',
    panorama_url: POS2,
    thumbnail_url: POS2,
    initial_yaw: 0,
    initial_pitch: 0,
    order: 3,
    hotspots: [
      { id: 'hs-pos2-back', type: 'navigation', yaw: 180, pitch: -5, label: 'Kembali ke Lobby', target_scene_id: 'ruang-lobby' },
      { id: 'hs-pos2-next', type: 'navigation', yaw: 60, pitch: -5, label: 'Ruang Koleksi 3', target_scene_id: 'pos-3' },
      { id: 'hs-pos2-info', type: 'info', yaw: 0, pitch: -8, label: 'Jantung', collection_id: 'heart-001' },
    ],
  },
  'pos-3': {
    id: 'pos-3',
    title: 'Ruang Koleksi 3',
    panorama_url: POS3,
    thumbnail_url: POS3,
    initial_yaw: 0,
    initial_pitch: 0,
    order: 4,
    hotspots: [
      { id: 'hs-pos3-back', type: 'navigation', yaw: 180, pitch: -5, label: 'Kembali ke Lobby', target_scene_id: 'ruang-lobby' },
      { id: 'hs-pos3-next', type: 'navigation', yaw: 60, pitch: -5, label: 'Ruang Koleksi 1', target_scene_id: 'pos-1' },
      { id: 'hs-pos3-info', type: 'info', yaw: -20, pitch: -8, label: 'Tulang Paha', collection_id: 'femur-001' },
    ],
  },
};

export const mockSceneList: SceneSummary[] = Object.values(mockScenes)
  .map(({ id, title, thumbnail_url, order }) => ({ id, title, thumbnail_url, order: order ?? 0 }))
  .sort((a, b) => a.order - b.order);
