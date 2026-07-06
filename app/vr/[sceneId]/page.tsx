'use client';

import dynamic from 'next/dynamic';
import LoadingScreen from '@/components/ui/LoadingScreen';

// A-Frame TIDAK kompatibel SSR → wajib dynamic import dengan ssr:false.
// VRScene mengelola sendiri load scene + transisi antar ruangan (a-scene persisten),
// jadi page ini cukup meneruskan sceneId dari URL sebagai titik masuk.
const VRScene = dynamic(() => import('@/components/vr/VRScene'), {
  ssr: false,
  loading: () => <LoadingScreen message="Memuat ruang…" />,
});

export default function ScenePage({ params }: { params: { sceneId: string } }) {
  return <VRScene initialSceneId={params.sceneId} />;
}
