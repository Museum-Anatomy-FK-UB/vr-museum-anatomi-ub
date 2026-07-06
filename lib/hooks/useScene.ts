'use client';

import useSWR from 'swr';
import { getScene, getScenes } from '@/lib/api';

/** Daftar semua ruang (halaman landing /vr). */
export function useScenes() {
  const { data, error, isLoading } = useSWR('vr/scenes', getScenes);
  return { scenes: data, isLoading, error };
}

/** Detail satu scene + hotspot. */
export function useScene(sceneId?: string) {
  const { data, error, isLoading } = useSWR(
    sceneId ? ['vr/scene', sceneId] : null,
    () => getScene(sceneId as string),
  );
  return { scene: data, isLoading, error };
}
