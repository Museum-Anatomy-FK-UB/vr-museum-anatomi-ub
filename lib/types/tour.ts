// Tipe data VR Tour — diturunkan langsung dari kontrak di docs/API.md.
// Jangan ubah bentuknya tanpa konfirmasi ke tim Backend (Azkal/Akmal).

export type HotspotType = 'navigation' | 'info';

/** Arah panah untuk hotspot navigasi (default 'up'). */
export type HotspotArrow = 'up' | 'down' | 'left' | 'right';

interface BaseHotspot {
  id: string;
  type: HotspotType;
  /** Rotasi horizontal (derajat), -180..180 */
  yaw: number;
  /** Rotasi vertikal (derajat), -90..90 */
  pitch: number;
  label: string;
  /** Arah panah (hanya navigasi). Default 'up'. */
  arrow?: HotspotArrow;
}

/** Hotspot pindah ke ruang lain */
export interface NavHotspot extends BaseHotspot {
  type: 'navigation';
  target_scene_id: string;
}

/** Hotspot yang membuka panel info koleksi */
export interface InfoHotspot extends BaseHotspot {
  type: 'info';
  collection_id: string;
}

export type Hotspot = NavHotspot | InfoHotspot;

/** Ringkasan scene untuk halaman landing (GET /api/vr/scenes) */
export interface SceneSummary {
  id: string;
  title: string;
  thumbnail_url: string;
  order: number;
  /** Posisi pada denah museum, persen 0–100 (opsional; untuk overlay FloorplanMap) */
  map_x?: number;
  map_y?: number;
}

/** Detail scene + hotspot (GET /api/vr/scenes/:sceneId) */
export interface Scene {
  id: string;
  title: string;
  panorama_url: string;
  thumbnail_url: string;
  initial_yaw: number;
  initial_pitch: number;
  hotspots: Hotspot[];
  order?: number;
}
