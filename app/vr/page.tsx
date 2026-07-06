'use client';

import { useScenes } from '@/lib/hooks/useScene';
import SceneCard from '@/components/ui/SceneCard';

export default function VRLandingPage() {
  const { scenes, isLoading, error } = useScenes();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Virtual Museum 360°</p>
        <h1 className="mt-1 text-3xl font-semibold text-neutral-900">Museum Anatomi FK UB</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          Pilih ruang untuk memulai tur virtual. Gunakan mouse atau sentuhan untuk melihat sekeliling,
          dan aktifkan Mode VR untuk pengalaman imersif.
        </p>
      </header>

      {isLoading && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-[3/2] animate-pulse rounded-xl bg-neutral-200" />
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 p-4 text-red-700">
          Gagal memuat daftar ruang. Coba muat ulang halaman.
        </p>
      )}

      {scenes && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {scenes.map((scene) => (
            <SceneCard key={scene.id} scene={scene} />
          ))}
        </div>
      )}
    </main>
  );
}
