// API client — the SINGLE place that fetches from the backend.
// See docs/API.md for the contract and NEXT_PUBLIC_API_BASE_URL in .env.local.

import type { Scene, SceneSummary } from '@/lib/types/tour';
import type { Collection } from '@/lib/types/collection';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

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
  const scenes = await request<SceneSummary[]>('/vr/scenes');
  return scenes.map(useSlugAsId);
}

export async function getScene(sceneId: string): Promise<Scene> {
  const scene = await request<Scene>(`/vr/scenes/${sceneId}`);
  return useSlugAsId(scene);
}

export async function getCollection(id: string): Promise<Collection> {
  const collection = await request<Collection>(`/vr/collections/${id}`);
  return useSlugAsId(collection);
}
