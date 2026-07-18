'use client';

import useSWR from 'swr';
import { getCollection } from '@/lib/api';

/** Detail of a single collection item (called when an info hotspot is clicked). */
export function useCollection(collectionId?: string) {
  const { data, error, isLoading } = useSWR(
    collectionId ? ['collection', collectionId] : null,
    () => getCollection(collectionId as string),
  );
  return { collection: data, isLoading, error };
}
