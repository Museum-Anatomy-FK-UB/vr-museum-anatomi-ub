'use client';

import useSWR from 'swr';
import { getScenes } from '@/lib/api';

/** List of all rooms (the /vr landing page). */
export function useScenes() {
  const { data, error, isLoading } = useSWR('vr/scenes', getScenes);
  return { scenes: data, isLoading, error };
}
