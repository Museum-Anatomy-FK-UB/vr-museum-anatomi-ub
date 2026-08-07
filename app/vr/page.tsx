'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useScenes } from '@/lib/hooks/useScene';
import LoadingScreen from '@/components/ui/LoadingScreen';

// There is no room-picker landing page — visitors go straight into the tour.
// The entry room is whichever room the API orders first (never hardcoded), and
// browsing all rooms is done from inside the tour via "All Location".
export default function VREntryPage() {
  const router = useRouter();
  const { scenes, error } = useScenes();

  useEffect(() => {
    const first = scenes?.[0];
    if (first) router.replace(`/vr/${first.id}`);
  }, [scenes, router]);

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg text-neutral-800">Gagal memuat tur virtual.</p>
        <p className="text-sm text-neutral-500">Coba muat ulang halaman.</p>
      </main>
    );
  }

  return <LoadingScreen message="Menyiapkan tur virtual…" />;
}
