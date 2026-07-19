// VR Tour data types — derived directly from the contract in docs/API.md.
// Do not change their shape without confirming with the Backend team (Azkal/Akmal).

export type HotspotType = 'navigation' | 'info';

/** Arrow direction for navigation hotspots (default 'up'). */
export type HotspotArrow = 'up' | 'down' | 'left' | 'right';

interface BaseHotspot {
  id: string;
  type: HotspotType;
  /** Horizontal rotation (degrees), -180..180 */
  yaw: number;
  /** Vertical rotation (degrees), -90..90 */
  pitch: number;
  label: string;
  /** Arrow direction (navigation only). Default 'up'. */
  arrow?: HotspotArrow;
}

/** Hotspot that moves to another room */
export interface NavHotspot extends BaseHotspot {
  type: 'navigation';
  target_scene_id: string;
}

/** Hotspot that opens the collection info panel */
export interface InfoHotspot extends BaseHotspot {
  type: 'info';
  collection_id: string;
}

export type Hotspot = NavHotspot | InfoHotspot;

/** Scene summary for the landing page (GET /api/vr/scenes) */
export interface SceneSummary {
  id: string;
  title: string;
  thumbnail_url: string;
  order: number;
  /** Position on the museum floor plan, percent 0–100 (optional; for the FloorplanMap overlay) */
  map_x?: number;
  map_y?: number;
}

/** Scene detail + hotspots (GET /api/vr/scenes/:sceneId) */
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
