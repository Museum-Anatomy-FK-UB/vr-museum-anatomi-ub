// API client — SATU-SATUNYA tempat fetch ke backend.
// Selama endpoint backend belum siap, otomatis pakai mock (lib/mock).
// Begitu API live: isi NEXT_PUBLIC_API_BASE_URL & set NEXT_PUBLIC_USE_MOCK=false,
// komponen tidak perlu diubah sama sekali.

import type { Scene, SceneSummary } from '@/lib/types/tour';
import type { Collection } from '@/lib/types/collection';
import { mockScenes, mockSceneList } from '@/lib/mock/scenes';
import { mockCollections } from '@/lib/mock/collections';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true' || !BASE_URL;

/** Simulasi latensi jaringan supaya loading state ikut teruji saat mock. */
function mock<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Ambil `data` dari response `{ data: ... }` sesuai kontrak docs/API.md. */
async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Gagal memuat ${path} (HTTP ${res.status})`);
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
    if (!scene) throw new Error(`Scene "${sceneId}" tidak ditemukan`);
    return mock(scene);
  }
  return request<Scene>(`/vr/scenes/${sceneId}`);
}

export async function getCollection(id: string): Promise<Collection> {
  if (USE_MOCK) {
    const collection = mockCollections[id];
    if (!collection) throw new Error(`Koleksi "${id}" tidak ditemukan`);
    return mock(collection);
  }
  return request<Collection>(`/collections/${id}`);
}
