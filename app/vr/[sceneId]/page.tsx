'use client';

import dynamic from 'next/dynamic';
import LoadingScreen from '@/components/ui/LoadingScreen';

// A-Frame is NOT SSR-compatible → it must be dynamically imported with ssr:false.
// VRScene handles scene loading + room transitions itself (persistent a-scene),
// so this page just passes the sceneId from the URL as the entry point.
const VRScene = dynamic(() => import('@/components/vr/VRScene'), {
  ssr: false,
  loading: () => <LoadingScreen message="Memuat ruang…" />,
});

export default function ScenePage({ params }: { params: { sceneId: string } }) {
  return <VRScene initialSceneId={params.sceneId} />;
}
