// VR Tour data types — derived directly from the contract in docs/API.md.
// Do not change their shape without confirming with the Backend team (Azkal/Akmal).

export type HotspotType = 'navigation' | 'info';

/** Arrow direction for navigation hotspots (default 'up'). */
export type HotspotArrow = 'up' | 'down' | 'left' | 'right';

/**
 * Visual style of a navigation hotspot:
 * - 'arrow' (default) — the floor-marker coin that lies down tilted, for
 *   general room-to-room movement.
 * - 'door' — an UPRIGHT coin facing the camera (like an info hotspot), for
 *   an entrance/door the visitor walks through (e.g. Lobby → Ruang 1).
 * Frontend-only presentational field, not part of the backend contract —
 * safe to omit/ignore (defaults to 'arrow'), same treatment as `transition_url`.
 */
export type NavHotspotVariant = 'arrow' | 'door';

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
  /**
   * Visual style — 'arrow' (tilted floor marker, default) or 'door' (upright,
   * facing the camera). See {@link NavHotspotVariant}. Frontend-only, optional.
   */
  variant?: NavHotspotVariant;
  /**
   * Arrow rotation in degrees (0–360) for the tilted 'arrow' variant, letting the
   * arrow point any direction — not just the 4 cardinal `arrow` values. When set,
   * it overrides `arrow`. 0 = points forward/away (toward the destination), turning
   * clockwise. Ignored for the 'door' variant. Frontend-only presentational field,
   * not part of the backend contract — safe to omit/ignore (falls back to `arrow`).
   */
  arrow_deg?: number;
  /**
   * Optional one-off image (e.g. a door opening) shown in place, at the
   * current scene's rotation, before crossfading to the target room. Frontend-only
   * proposal, not yet part of the backend contract — safe to omit/ignore.
   */
  transition_url?: string;
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
  /**
   * Horizon tilt correction (degrees, roll around the viewing axis) — compensates
   * for camera roll baked into the raw photo during capture, so the horizon
   * renders level. Proposed backend field, not yet in the contract — see
   * docs/API.md "Proposed additions". Optional; omit/0 = no correction.
   */
  horizon_roll?: number;
}
