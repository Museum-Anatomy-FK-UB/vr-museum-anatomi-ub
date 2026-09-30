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

// --- Restricted-area auth (Sanctum bearer token) ----------------------------
// The backend's `AuthenticateRestrictedVrRoom` middleware requires a valid
// Sanctum token on `GET /vr/scenes/{id}` whenever that room's `is_restricted`
// is true; anonymous requests get a 401. This is the ONE place that owns that
// session state (unlock flag + token) so the gate (VRScene) and the fetch layer
// (below) always agree. Session-only: a fresh tab/browser needs to log in again.
const AUTH_TOKEN_KEY = 'vr-auth-token';
const RESTRICTED_UNLOCKED_KEY = 'vr-restricted-unlocked';

export const isRestrictedScene = (id: string): boolean => id.startsWith('restricted-');

export function isRestrictedUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(RESTRICTED_UNLOCKED_KEY) === '1';
  } catch {
    return false;
  }
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Marks the restricted area unlocked for this session and stores the Sanctum
 *  token (preview mode has none — there's nothing real to send). */
function markRestrictedUnlocked(token: string | null): void {
  try {
    window.sessionStorage.setItem(RESTRICTED_UNLOCKED_KEY, '1');
    if (token) window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // best-effort
  }
}

/** Clears the unlock + token — used when the backend rejects the token (401),
 *  so the visitor is asked to log in again instead of staying "unlocked" with
 *  a token that no longer works (expired/revoked). */
export function clearRestrictedAuth(): void {
  try {
    window.sessionStorage.removeItem(RESTRICTED_UNLOCKED_KEY);
    window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // best-effort
  }
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Extract `data` from a `{ data: ... }` response per the docs/API.md contract. */
async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  if (!res.ok) {
    if (res.status === 401) clearRestrictedAuth();
    throw new Error(`Failed to load ${path} (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

// The backend now always returns the slug as `id` directly (VrSceneSummaryResource /
// VrSceneDetailResource / CollectionResource all do `'id' => $this->slug_name`), so
// no client-side remapping is needed anymore — the response is used as-is.

export async function getScenes(): Promise<SceneSummary[]> {
  if (LOCAL_PREVIEW) return previewSceneList;
  return request<SceneSummary[]>('/vr/scenes');
}

export async function getScene(sceneId: string): Promise<Scene> {
  if (LOCAL_PREVIEW) {
    const scene = previewScenes[sceneId];
    if (!scene) throw new Error(`Scene "${sceneId}" not found (local preview)`);
    return scene;
  }
  return request<Scene>(`/vr/scenes/${sceneId}`);
}

export async function getCollection(id: string): Promise<Collection> {
  if (LOCAL_PREVIEW) {
    const collection = previewCollections[id];
    if (!collection) throw new Error(`Collection "${id}" not found (local preview)`);
    return collection;
  }
  return request<Collection>(`/vr/collections/${id}`);
}

/**
 * Authenticate for the restricted area. Posts to the backend's `/login`
 * (Laravel Sanctum) and, on success, stores the bearer `token` it returns so
 * later `GET /vr/scenes/restricted-*` requests can authenticate — that route
 * requires it (see `AuthenticateRestrictedVrRoom` on the backend).
 */
export async function login(email: string, password: string): Promise<void> {
  if (LOCAL_PREVIEW) {
    // Preview/demo: no backend running. Accept any valid-looking credentials so the
    // restricted-area gate can be demonstrated end-to-end. Real validation happens
    // against the backend in production (the branch below).
    await new Promise((r) => setTimeout(r, 500));
    if (!/.+@.+\..+/.test(email) || password.length < 4) {
      throw new Error('Email atau password tidak valid.');
    }
    markRestrictedUnlocked(null);
    return;
  }
  const res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Email atau password salah.');
  const json = (await res.json()) as { token?: string };
  if (!json.token) throw new Error('Login berhasil, tetapi server tidak mengirim token.');
  markRestrictedUnlocked(json.token);
}
