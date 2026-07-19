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

// The "Pick coordinate" tool is testing-mode only (mock) — auto-hidden in production.
const PICKER_ENABLED = USE_MOCK;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setFov(cam: HTMLElement, v: number) {
  (cam as unknown as { setAttribute(c: string, p: string, v: unknown): void }).setAttribute('camera', 'fov', v);
}

/** Camera FOV (zoom) animation with easing — the core of the "entering a room" effect.
 *  rAF for smoothness; setTimeout guarantees the final value even if rAF is paused
 *  (e.g. background tab), so the camera never gets "stuck" zoomed. */
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

// PERSISTENT A-Frame scene: the a-scene is not torn down when switching rooms —
// the panorama & hotspots are swapped in place while animated (zoom + fade) for a
// smooth 3DVista-like transition. MUST be dynamically imported with ssr:false (A-Frame is anti-SSR).
export default function VRScene({ initialSceneId }: { initialSceneId: string }) {
  const [ready, setReady] = useState(false);
  const [activeScene, setActiveScene] = useState<Scene | null>(null);
  const [sceneList, setSceneList] = useState<SceneSummary[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [covered, setCovered] = useState(true); // initial black overlay (for the intro reveal)
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

  // 1) Load A-Frame on the client (registers the custom elements on window) +
  //    register the idle-rotate component BEFORE the <a-scene> mounts.
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

  // Cap the render pixel ratio (max 1.5) — on high-DPI/retina screens A-Frame renders
  // 2–3× the pixels by default → heavy & choppy. This cap raises FPS so dragging is smooth.
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

  // Cursor per mode (no dot on desktop):
  // - Desktop: NO dot — hotspot click & hover are handled by manual raycasting in
  //   the smooth-drag-look component (release without dragging = click at pointer).
  // - VR (Cardboard): show the gaze dot + raycaster + fuse (the only way to "click"
  //   with your gaze).
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

  // 2) Load the initial scene + the list of all rooms (for the "All Location" gallery).
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

  // 3) Intro reveal: once the first scene appears, lift the black curtain while zooming out.
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

  // Room transition: BLEND between the two panoramas (dissolve, no black).
  // The "push forward" effect is done by sky-crossfade PUSHING the OLD panorama
  // sphere toward the view direction — the camera/FOV is NOT touched at all, so the
  // new panorama is completely still from the start (no zoom, no "snap" at the end).
  // Hotspots follow the transition: the old ones shrink out first (hs-exit event),
  // the new ones grow in mid-blend — no abrupt appear/disappear.
  const navigateTo = useCallback(async (targetId: string) => {
    if (transitioningRef.current || targetId === currentIdRef.current) return;
    transitioningRef.current = true;
    const cam = cameraRef.current;
    const sky = skyRef.current as unknown as { components?: Record<string, any> } | null;
    try {
      const next = await getScene(targetId);

      setActiveCollectionId(null);

      // Old hotspots shrink out (220ms)
      document.querySelectorAll('a-entity.hs-anim').forEach((el) => {
        (el as unknown as { emit?: (n: string) => void }).emit?.('hs-exit');
      });

      // Stop any running scroll-zoom lerp (keep the user's FOV)
      if (cam) {
        (cam as unknown as { components?: Record<string, any> }).components?.['scroll-zoom']?.cancel?.();
      }

      // Blend old panorama -> new (700ms) + "push forward" on the old panorama
      const blend = sky?.components?.['sky-crossfade']?.crossfadeTo(next.panorama_url, next.initial_yaw ?? 0, 700);

      // Swap hotspots & URL mid-blend (old hotspots have fully shrunk away;
      // the new ones mount and grow in during the rest of the blend)
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

  // Read yaw/pitch from the camera direction (for the Pick coordinate tool).
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

  // Disable auto-rotate while Pick mode is active (so the crosshair doesn't drift).
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

        {/* position 0 0 0: the camera MUST sit at the sphere center (a-camera's
            default 1.6m makes hotspots & Pick coordinates miss vertically — the
            hotspot sphere, sky, and nadir logo are all centered at the origin). */}
        <a-camera
          ref={cameraRef}
          position="0 0 0"
          idle-rotate="speed: 0.08; delay: 4000"
          smooth-drag-look=""
          scroll-zoom=""
          look-controls="mouseEnabled: false; touchEnabled: false"
          wasd-controls="enabled: false"
        >
          {/* Gaze dot/reticle — ONLY for VR mode (Cardboard); on desktop it's
              hidden & its raycaster is off (clicking is done with the mouse directly). */}
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

        {/* Nadir patch — covers the tripod at the bottom of the 360° photo with the
            UB logo. Always points straight down regardless of each scene's initial_yaw,
            because the nadir point doesn't move when the sky is rotated on yaw.
            Uses a PNG (not SVG) — the old SVG failed to keep transparency when
            rasterized into a WebGL texture (the area outside the badge turned black),
            and the badge shape itself is custom/irregular (not a clean octagon) so it
            can't be cropped cleanly with circle geometry. This PNG (2000x2000, RGBA,
            confirmed all 4 corners alpha=0) has a valid alpha channel, so a plain
            SQUARE geometry is enough — the PNG's own alpha forms the badge silhouette precisely. */}
        <a-plane
          position="0 -4.7 0"
          rotation="-90 0 0"
          width="6"
          height="6"
          material="src: /panorama/logo/Logo_Universitas_Brawijaya.png; transparent: true; alphaTest: 0.05; shader: flat; side: double"
        />
      </a-scene>

      {/* Top bar — back button (+ Pick coordinate in testing mode) + VR Mode */}
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

      {/* Room title — bottom-left, FILKOM style */}
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

      {/* Transition curtain — black fade when switching/entering rooms */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 bg-black"
        style={{
          opacity: covered ? 1 : 0,
          transition: `opacity ${coverDuration}ms ease-in-out`,
        }}
      />

      {/* Spinner while the initial scene isn't ready (on top of the black curtain) */}
      {!activeScene && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
        </div>
      )}
    </div>
  );
}
