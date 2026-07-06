'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Scene, SceneSummary } from '@/lib/types/tour';
import { getScene, getScenes } from '@/lib/api';
import HotspotLayer from './HotspotLayer';
import HotspotInfo from './HotspotInfo';
import VRModeButton from './VRModeButton';
import SceneControlsBar from './SceneControlsBar';
import SceneGallery from './SceneGallery';
import LoadingScreen from '@/components/ui/LoadingScreen';

const DEFAULT_FOV = 80;
const ZOOM_FOV = 45;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Preload + decode gambar panorama agar swap a-sky instan (tidak "pop" hitam). */
function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

function getFov(cam: HTMLElement): number {
  const data = (cam as unknown as { getAttribute(c: string): { fov?: number } | null }).getAttribute('camera');
  return data && typeof data.fov === 'number' ? data.fov : DEFAULT_FOV;
}

function setFov(cam: HTMLElement, v: number) {
  (cam as unknown as { setAttribute(c: string, p: string, v: unknown): void }).setAttribute('camera', 'fov', v);
}

/** Animasi FOV kamera (zoom) dengan easing — inti efek "masuk ruangan".
 *  rAF untuk kehalusan; setTimeout menjamin nilai akhir walau rAF di-pause
 *  (mis. tab background), supaya kamera tak pernah "nyangkut" zoom. */
function tweenFov(cam: HTMLElement, from: number, to: number, dur: number) {
  const el = cam as unknown as { __fovRaf?: number; __fovEnd?: ReturnType<typeof setTimeout> };
  if (el.__fovRaf) cancelAnimationFrame(el.__fovRaf);
  if (el.__fovEnd) clearTimeout(el.__fovEnd);
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    setFov(cam, from + (to - from) * eased);
    if (t < 1) el.__fovRaf = requestAnimationFrame(step);
  };
  el.__fovRaf = requestAnimationFrame(step);
  el.__fovEnd = setTimeout(() => setFov(cam, to), dur + 60);
}

// Scene A-Frame PERSISTEN: a-scene tidak dibongkar saat pindah ruangan — panorama
// & hotspot di-swap di tempat sambil dianimasikan (zoom + fade) supaya transisi
// mulus ala 3DVista. WAJIB dynamic import ssr:false dari page (A-Frame anti-SSR).
export default function VRScene({ initialSceneId }: { initialSceneId: string }) {
  const [ready, setReady] = useState(false);
  const [activeScene, setActiveScene] = useState<Scene | null>(null);
  const [sceneList, setSceneList] = useState<SceneSummary[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [covered, setCovered] = useState(true); // overlay hitam awal (untuk intro reveal)
  const [coverDuration, setCoverDuration] = useState(750);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [hotspotsVisible, setHotspotsVisible] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLElement>(null);
  const transitioningRef = useRef(false);
  const didIntroRef = useRef(false);
  const currentIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentIdRef.current = activeScene?.id ?? null;
  }, [activeScene]);

  // 1) Load A-Frame di client (mendaftarkan custom element ke window).
  useEffect(() => {
    let mounted = true;
    import('aframe').then(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // 2) Load scene awal + daftar semua ruang (untuk galeri "All Location").
  useEffect(() => {
    if (!ready) return;
    let mounted = true;
    getScene(initialSceneId)
      .then(async (scene) => {
        await preloadImage(scene.panorama_url);
        if (mounted) setActiveScene(scene);
      })
      .catch(() => {
        if (mounted) setLoadError(true);
      });
    getScenes()
      .then((list) => {
        if (mounted) setSceneList(list);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [ready, initialSceneId]);

  // 3) Intro reveal: begitu scene pertama tampil, buka tirai hitam sambil zoom-out.
  useEffect(() => {
    if (!activeScene || didIntroRef.current) return;
    const cam = cameraRef.current;
    if (!cam) return;
    didIntroRef.current = true;
    setFov(cam, ZOOM_FOV);
    const t = setTimeout(() => {
      setCoverDuration(900);
      setCovered(false);
      tweenFov(cam, ZOOM_FOV, DEFAULT_FOV, 900);
    }, 30);
    return () => clearTimeout(t);
  }, [activeScene]);

  // Transisi pindah ruangan: zoom-in + fade-out → swap → fade-in + zoom-out reveal.
  const navigateTo = useCallback(async (targetId: string) => {
    if (transitioningRef.current || targetId === currentIdRef.current) return;
    transitioningRef.current = true;
    const cam = cameraRef.current;
    try {
      const next = await getScene(targetId);
      await preloadImage(next.panorama_url);

      // Tutup: zoom masuk + gelapkan layar
      setCoverDuration(500);
      setCovered(true);
      if (cam) tweenFov(cam, getFov(cam), ZOOM_FOV, 500);
      await wait(500);

      // Swap panorama + hotspot saat layar tertutup
      setActiveCollectionId(null);
      setActiveScene(next);
      window.history.replaceState(null, '', `/vr/${targetId}`);
      await wait(80);

      // Buka: reveal sambil zoom keluar
      if (cam) setFov(cam, ZOOM_FOV);
      setCoverDuration(750);
      setCovered(false);
      if (cam) tweenFov(cam, ZOOM_FOV, DEFAULT_FOV, 750);
      await wait(750);
    } catch {
      setCovered(false);
    } finally {
      transitioningRef.current = false;
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!document.fullscreenElement) el?.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, []);

  if (!ready) return <LoadingScreen message="Menyiapkan mesin VR…" />;

  if (loadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg text-neutral-800">Ruang tidak ditemukan.</p>
        <Link href="/vr" className="text-brand hover:underline">
          ← Kembali ke daftar ruang
        </Link>
      </main>
    );
  }

  const mainSceneId = sceneList[0]?.id ?? 'ruang-lobby';

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black">
      <a-scene
        embedded
        vr-mode-ui="enabled: true"
        loading-screen="enabled: false"
        renderer="colorManagement: true"
        style={{ width: '100%', height: '100%' }}
      >
        <a-sky
          src={activeScene?.panorama_url ?? ''}
          rotation={`0 ${activeScene?.initial_yaw ?? 0} 0`}
        />

        <a-camera ref={cameraRef} look-controls="reverseMouseDrag: true" wasd-controls="enabled: false">
          <a-entity
            cursor="fuse: true; fuseTimeout: 1000"
            raycaster="objects: .clickable"
            position="0 0 -1"
            geometry="primitive: ring; radiusInner: 0.015; radiusOuter: 0.025"
            material="color: #ffffff; shader: flat; opacity: 0.9"
          />
        </a-camera>

        {hotspotsVisible && activeScene && (
          <HotspotLayer
            key={activeScene.id}
            hotspots={activeScene.hotspots}
            onNavigate={navigateTo}
            onInfo={setActiveCollectionId}
          />
        )}
      </a-scene>

      {/* Bar atas — tombol kembali + Mode VR */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <Link
          href="/vr"
          className="pointer-events-auto rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-neutral-900 shadow-md backdrop-blur transition hover:bg-white"
        >
          ← Semua Ruang
        </Link>
        <VRModeButton />
      </div>

      {/* Judul ruang — kiri bawah ala FILKOM */}
      <div className="pointer-events-none absolute bottom-5 left-5 z-20">
        <h1 className="text-2xl font-semibold text-white drop-shadow-lg">
          {activeScene?.title ?? 'Memuat…'}
        </h1>
        <p className="text-sm italic text-white/80 drop-shadow-lg">Museum Anatomi FK UB</p>
      </div>

      {/* Footer control bar */}
      <SceneControlsBar
        onMainLocation={() => {
          setGalleryOpen(false);
          navigateTo(mainSceneId);
        }}
        onOpenGallery={() => setGalleryOpen(true)}
        onToggleFullscreen={toggleFullscreen}
        hotspotsVisible={hotspotsVisible}
        onToggleHotspots={() => setHotspotsVisible((v) => !v)}
      />

      {galleryOpen && (
        <SceneGallery
          scenes={sceneList}
          currentId={activeScene?.id ?? null}
          onSelect={(id) => {
            setGalleryOpen(false);
            navigateTo(id);
          }}
          onClose={() => setGalleryOpen(false)}
        />
      )}

      {activeScene && activeCollectionId && (
        <HotspotInfo collectionId={activeCollectionId} onClose={() => setActiveCollectionId(null)} />
      )}

      {/* Tirai transisi — fade hitam saat pindah/masuk ruangan */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 bg-black"
        style={{
          opacity: covered ? 1 : 0,
          transition: `opacity ${coverDuration}ms ease-in-out`,
        }}
      />

      {/* Spinner saat scene awal belum siap (di atas tirai hitam) */}
      {!activeScene && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
        </div>
      )}
    </div>
  );
}
