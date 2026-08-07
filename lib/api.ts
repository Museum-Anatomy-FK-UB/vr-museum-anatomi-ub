// API client — the SINGLE place that fetches from the backend.
// See docs/API.md for the contract and NEXT_PUBLIC_API_BASE_URL in .env.local.

import type { Scene, SceneSummary } from '@/lib/types/tour';
import type { Collection } from '@/lib/types/collection';
import { previewCollections, previewScenes, previewSceneList } from '@/lib/localPreviewData';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * TEMPORARY: serves lib/localPreviewData.ts instead of the backend, so the real
 * /vr route can be walked with real photos + calibrated hotspots before that
 * data exists in the backend. Off by default — only set in your own .env.local,
 * never in .env.example. Remove this flag + lib/localPreviewData.ts once the
 * backend has real rooms/hotspots/collections seeded.
 */
const LOCAL_PREVIEW = process.env.NEXT_PUBLIC_LOCAL_PREVIEW === 'true';

/** Extract `data` from a `{ data: ... }` response per the docs/API.md contract. */
async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Failed to load ${path} (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

/**
 * The backend's real primary key is a UUID; `slug_name` (e.g. "ruang-lobby")
 * is a separate human-readable field. Swap `id` for the slug here so the rest
 * of the app (URLs, floor plan, gallery) keeps working with pretty ids —
 * the backend's show() endpoints accept either form anyway.
 */
function useSlugAsId<T extends { id: string; slug_name?: string }>(item: T): T {
  return item.slug_name ? { ...item, id: item.slug_name } : item;
}

export async function getScenes(): Promise<SceneSummary[]> {
  if (LOCAL_PREVIEW) return previewSceneList;
  const scenes = await request<SceneSummary[]>('/vr/scenes');
  return scenes.map(useSlugAsId);
}

export async function getScene(sceneId: string): Promise<Scene> {
  if (LOCAL_PREVIEW) {
    const scene = previewScenes[sceneId];
    if (!scene) throw new Error(`Scene "${sceneId}" not found (local preview)`);
    return scene;
  }
  const scene = await request<Scene>(`/vr/scenes/${sceneId}`);
  return useSlugAsId(scene);
}

export async function getCollection(id: string): Promise<Collection> {
  if (LOCAL_PREVIEW) {
    const collection = previewCollections[id];
    if (!collection) throw new Error(`Collection "${id}" not found (local preview)`);
    return collection;
  }
  const collection = await request<Collection>(`/vr/collections/${id}`);
  return useSlugAsId(collection);
}
