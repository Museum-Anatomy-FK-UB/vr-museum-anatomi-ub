// API client — the SINGLE place that fetches from the backend.
// While the backend endpoints aren't ready, it automatically uses the mock (lib/mock).
// Once the API is live: set NEXT_PUBLIC_API_BASE_URL & NEXT_PUBLIC_USE_MOCK=false,
// no component needs to change at all.

import type { Scene, SceneSummary } from '@/lib/types/tour';
import type { Collection } from '@/lib/types/collection';
import { mockScenes, mockSceneList } from '@/lib/mock/scenes';
import { mockCollections } from '@/lib/mock/collections';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
/** true = use the local mock (lib/mock). Active if set explicitly or BASE_URL is empty. */
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true' || !BASE_URL;

/** Simulate network latency so loading states get exercised while mocking. */
function mock<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Extract `data` from a `{ data: ... }` response per the docs/API.md contract. */
async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Failed to load ${path} (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

export async function getScenes(): Promise<SceneSummary[]> {
  if (USE_MOCK) return mock(mockSceneList);
  return request<SceneSummary[]>('/vr/scenes');
}

export async function getScene(sceneId: string): Promise<Scene> {
  if (USE_MOCK) {
    const scene = mockScenes[sceneId];
    if (!scene) throw new Error(`Scene "${sceneId}" not found`);
    return mock(scene);
  }
  return request<Scene>(`/vr/scenes/${sceneId}`);
}

export async function getCollection(id: string): Promise<Collection> {
  if (USE_MOCK) {
    const collection = mockCollections[id];
    if (!collection) throw new Error(`Collection "${id}" not found`);
    return mock(collection);
  }
  return request<Collection>(`/collections/${id}`);
}
