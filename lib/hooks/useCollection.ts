'use client';

import useSWR from 'swr';
import { getCollection } from '@/lib/api';

/** Detail satu item koleksi (dipanggil saat hotspot info diklik). */
export function useCollection(collectionId?: string) {
  const { data, error, isLoading } = useSWR(
    collectionId ? ['collection', collectionId] : null,
    () => getCollection(collectionId as string),
  );
  return { collection: data, isLoading, error };
}
