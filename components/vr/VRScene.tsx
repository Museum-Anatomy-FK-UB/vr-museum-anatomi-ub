'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Scene, SceneSummary } from '@/lib/types/tour';
import { getScene, getScenes, USE_MOCK } from '@/lib/api';
import HotspotLayer from './HotspotLayer';
import HotspotInfo from './HotspotInfo';
import VRModeButton from './VRModeButton';
import SceneControlsBar from './SceneControlsBar';
import SceneGallery from './SceneGallery';
import FloorplanMap from './FloorplanMap';
import HotspotPicker from './HotspotPicker';
import { registerIdleRotate } from './idleRotate';
import { registerSmoothDragLook } from './smoothDragLook';
import { registerSkyCrossfade } from './skyCrossfade';
import { registerScrollZoom } from './scrollZoom';
import LoadingScreen from '@/components/ui/LoadingScreen';

const DEFAULT_FOV = 80;
const ZOOM_FOV = 45;

// Tool "Pick koordinat" hanya untuk mode testing (mock) — auto-hilang di produksi.
const PICKER_ENABLED = USE_MOCK;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const [floorplanOpen, setFloorplanOpen] = useState(false);
  const [hotspotsVisible, setHotspotsVisible] = useState(true);
  const [pickerActive, setPickerActive] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLElement>(null);
  const cameraRef = useRef<HTMLElement>(null);
  const cursorRef = useRef<HTMLElement>(null);
  const transitioningRef = useRef(false);
  const didIntroRef = useRef(false);
  const currentIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentIdRef.current = activeScene?.id ?? null;
  }, [activeScene]);

  // 1) Load A-Frame di client (mendaftarkan custom element ke window) +
  //    registrasi komponen idle-rotate SEBELUM <a-scene> mount.
  useEffect(() => {
    let mounted = true;
    import('aframe').then(() => {
      registerIdleRotate();
      registerSmoothDragLook();
      registerSkyCrossfade();
      registerScrollZoom();
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Batasi pixel ratio render (maks 1.5) — di layar high-DPI/retina A-Frame default
  // render 2–3× pixel → berat & patah-patah. Cap ini menaikkan FPS supaya geser mulus.
  useEffect(() => {
    if (!ready) return;
    const sceneEl = document.querySelector('a-scene') as unknown as {
      hasLoaded?: boolean;
      renderer?: { setPixelRatio(v: number): void };
      addEventListener: (t: string, cb: () => void, o?: unknown) => void;
      removeEventListener: (t: string, cb: () => void) => void;
    } | null;
    if (!sceneEl) return;
    const apply = () => sceneEl.renderer?.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    if (sceneEl.hasLoaded) apply();
    else sceneEl.addEventListener('loaded', apply, { once: true });
    window.addEventListener('resize', apply);
    return () => {
      sceneEl.removeEventListener('loaded', apply);
      window.removeEventListener('resize', apply);
    };
  }, [ready]);

  // Cursor per mode (tanpa dot di desktop):
  // - Desktop: TANPA dot — klik & hover hotspot ditangani raycast manual di
  //   komponen smooth-drag-look (lepas tanpa geser = klik di posisi pointer).
  // - VR (Cardboard): dot gaze dimunculkan + raycaster + fuse aktif
  //   (satu-satunya cara "klik" pakai pandangan).
  useEffect(() => {
    if (!ready) return;
    const sceneEl = document.querySelector('a-scene');
    const gaze = cursorRef.current as unknown as { setAttribute(c: string, p?: unknown, v?: unknown): void } | null;
    if (!sceneEl || !gaze) return;
    const enter = () => {
      gaze.setAttribute('visible', true);
      gaze.setAttribute('raycaster', 'enabled', true);
    };
    const exit = () => {
      gaze.setAttribute('visible', false);
      gaze.setAttribute('raycaster', 'enabled', false);
    };
    sceneEl.addEventListener('enter-vr', enter);
    sceneEl.addEventListener('exit-vr', exit);
    return () => {
      sceneEl.removeEventListener('enter-vr', enter);
      sceneEl.removeEventListener('exit-vr', exit);
    };
  }, [ready]);

  // 2) Load scene awal + daftar semua ruang (untuk galeri "All Location").
  useEffect(() => {
    if (!ready) return;
    let mounted = true;
    getScene(initialSceneId)
      .then(async (scene) => {
        const sky = skyRef.current as unknown as { components?: Record<string, any> } | null;
        await sky?.components?.['sky-crossfade']?.setInitial(scene.panorama_url, scene.initial_yaw ?? 0);
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

  // Transisi pindah ruangan: BLEND antar dua panorama (dissolve, tanpa hitam).
  // Efek "maju" dikerjakan oleh sky-crossfade dengan MENDORONG bola panorama
  // LAMA ke arah pandang — kamera/FOV TIDAK disentuh sama sekali, jadi panorama
  // baru diam total sejak awal (tidak ikut zoom, tidak ada "patah" di akhir).
  // Hotspot ikut transisi: yang lama menyusut dulu (event hs-exit), yang baru
  // tumbuh masuk di tengah blend — tidak hilang/muncul mendadak.
  const navigateTo = useCallback(async (targetId: string) => {
    if (transitioningRef.current || targetId === currentIdRef.current) return;
    transitioningRef.current = true;
    const cam = cameraRef.current;
    const sky = skyRef.current as unknown as { components?: Record<string, any> } | null;
    try {
      const next = await getScene(targetId);

      setActiveCollectionId(null);

      // Hotspot lama menyusut keluar (220ms)
      document.querySelectorAll('a-entity.hs-anim').forEach((el) => {
        (el as unknown as { emit?: (n: string) => void }).emit?.('hs-exit');
      });

      // Hentikan lerp scroll-zoom yang sedang berjalan (FOV user dipertahankan)
      if (cam) {
        (cam as unknown as { components?: Record<string, any> }).components?.['scroll-zoom']?.cancel?.();
      }

      // Blend panorama lama -> baru (700ms) + dorongan "maju" di panorama lama
      const blend = sky?.components?.['sky-crossfade']?.crossfadeTo(next.panorama_url, next.initial_yaw ?? 0, 700);

      // Swap hotspot & URL di tengah blend (hotspot lama sudah menyusut habis;
      // yang baru mount lalu tumbuh masuk selama sisa blend)
      await wait(300);
      setActiveScene(next);
      window.history.replaceState(null, '', `/vr/${targetId}`);

      await blend;
    } finally {
      transitioningRef.current = false;
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!document.fullscreenElement) el?.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, []);

  // Baca yaw/pitch dari arah kamera (untuk tool Pick koordinat).
  const getPickerCoords = useCallback(() => {
    const camEl = cameraRef.current as unknown as { getObject3D?: (n: string) => any } | null;
    const cam = camEl?.getObject3D?.('camera');
    const THREE = (window as unknown as { AFRAME?: { THREE?: any } }).AFRAME?.THREE;
    if (!cam || !THREE) return null;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const yaw = (Math.atan2(dir.x, -dir.z) * 180) / Math.PI;
    const pitch = (Math.asin(Math.max(-1, Math.min(1, dir.y))) * 180) / Math.PI;
    return { yaw: Math.round(yaw), pitch: Math.round(pitch) };
  }, []);

  // Matikan auto-rotate saat mode Pick aktif (biar crosshair tak bergeser sendiri).
  useEffect(() => {
    if (!ready) return;
    const cam = cameraRef.current as unknown as { setAttribute(c: string, p: string, v: unknown): void } | null;
    cam?.setAttribute('idle-rotate', 'enabled', !pickerActive);
  }, [pickerActive, ready]);

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
        renderer="colorManagement: true; antialias: false; precision: medium"
        style={{ width: '100%', height: '100%' }}
      >
        <a-entity ref={skyRef} sky-crossfade="" />

        {/* position 0 0 0: kamera WAJIB di pusat bola (default a-camera 1.6m
            membuat hotspot & koordinat Pick meleset vertikal — sphere hotspot,
            sky, dan nadir logo semuanya berpusat di origin). */}
        <a-camera
          ref={cameraRef}
          position="0 0 0"
          idle-rotate="speed: 0.08; delay: 4000"
          smooth-drag-look=""
          scroll-zoom=""
          look-controls="mouseEnabled: false; touchEnabled: false"
          wasd-controls="enabled: false"
        >
          {/* Dot/reticle gaze — HANYA untuk mode VR (Cardboard); di desktop
              disembunyikan & raycaster-nya mati (klik pakai mouse langsung). */}
          <a-entity
            ref={cursorRef}
            visible="false"
            cursor="fuse: true; fuseTimeout: 1000"
            raycaster="objects: .clickable; enabled: false"
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

        {/* Nadir patch — tutup tripod di titik bawah foto 360 dgn logo UB.
            Selalu lurus ke bawah terlepas dari initial_yaw tiap scene, karena
            titik nadir tidak berubah posisi akibat rotasi yaw sky.
            Pakai PNG (bukan SVG) — SVG lama gagal menjaga transparansi saat
            dirasterisasi jadi tekstur WebGL (area di luar badge malah jadi
            hitam), dan bentuk badge-nya sendiri custom/tak-beraturan (bukan
            oktagon rapi) sehingga tak bisa dipotong rapi pakai geometri
            lingkaran. PNG ini (2000x2000, RGBA, confirmed 4 sudut alpha=0)
            punya alpha channel valid, jadi cukup geometri PERSEGI biasa —
            alpha PNG sendiri yang membentuk siluet badge dgn presisi. */}
        <a-plane
          position="0 -4.7 0"
          rotation="-90 0 0"
          width="6"
          height="6"
          material="src: /panorama/logo/Logo_Universitas_Brawijaya.png; transparent: true; alphaTest: 0.05; shader: flat; side: double"
        />
      </a-scene>

      {/* Bar atas — tombol kembali (+ Pick koordinat di mode testing) + Mode VR */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto flex flex-col items-start gap-2">
          <Link
            href="/vr"
            className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-neutral-900 shadow-md backdrop-blur transition hover:bg-white"
          >
            ← Semua Ruang
          </Link>
          {PICKER_ENABLED && (
            <button
              type="button"
              onClick={() => setPickerActive((v) => !v)}
              className={`rounded-full px-4 py-2 text-sm font-medium shadow-md backdrop-blur transition ${
                pickerActive ? 'bg-brand text-white' : 'bg-white/90 text-neutral-900 hover:bg-white'
              }`}
            >
              {pickerActive ? '● Pick aktif' : 'Pick koordinat'}
            </button>
          )}
        </div>
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
        onToggleFloorplan={() => setFloorplanOpen((v) => !v)}
        floorplanOpen={floorplanOpen}
        onToggleFullscreen={toggleFullscreen}
        hotspotsVisible={hotspotsVisible}
        onToggleHotspots={() => setHotspotsVisible((v) => !v)}
      />

      {floorplanOpen && (
        <FloorplanMap
          scenes={sceneList}
          currentId={activeScene?.id ?? null}
          onSelect={(id) => navigateTo(id)}
          onClose={() => setFloorplanOpen(false)}
        />
      )}

      {pickerActive && activeScene && (
        <HotspotPicker
          sceneId={activeScene.id}
          getCoords={getPickerCoords}
          onClose={() => setPickerActive(false)}
        />
      )}

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
