'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Hotspot, PhotoHotspot, Scene, SceneSummary } from '@/lib/types/tour';
import { getScene, getScenes, isRestrictedScene, isRestrictedUnlocked } from '@/lib/api';
import HotspotLayer, { registerHotspotLayer } from './HotspotLayer';
import HotspotInfo from './HotspotInfo';
import HotspotPhotoModal from './HotspotPhotoModal';
import SceneControlsBar from './SceneControlsBar';
import SceneGallery from './SceneGallery';
import FloorplanMap from './FloorplanMap';
import HotspotPicker from './HotspotPicker';
import RestrictedLoginModal from './RestrictedLoginModal';
import { registerIdleRotate } from './idleRotate';
import { registerSmoothDragLook } from './smoothDragLook';
import { registerSkyCrossfade } from './skyCrossfade';
import { registerScrollZoom } from './scrollZoom';
import { registerLittlePlanetIntro } from './littlePlanetIntro';
import LoadingScreen from '@/components/ui/LoadingScreen';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Rooms whose slug starts with "restricted-" require a login before entering,
// both via the door hotspot AND via a direct URL. `isRestrictedScene` /
// `isRestrictedUnlocked` live in lib/api.ts (same module that stores the
// Sanctum token and attaches it to requests), so the gate here and the actual
// fetch always agree on auth state.

/**
 * A-Frame initializes an entity's components asynchronously, so right after React
 * commits, `el.components[name]` can still be empty — giving up at that instant
 * would silently skip whatever depends on it. Poll briefly instead.
 */
async function waitForComponent(el: HTMLElement | null, name: string, timeoutMs = 3000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const component = (el as unknown as { components?: Record<string, any> } | null)?.components?.[name];
    if (component) return component;
    await wait(50);
  }
  return null;
}

/**
 * Re-center the look direction to (yaw 0, pitch 0) — world-yaw 0 is, by
 * definition, wherever the sky's rotation (initial_yaw) points its "front", so
 * this always lands on the intended establishing view regardless of which
 * direction the visitor was looking when they triggered the navigation.
 * Skipped in VR mode — forcing the camera against a headset's own head
 * tracking is disorienting, not "on point".
 */
function recenterLook(cam: HTMLElement, dur: number) {
  const sceneEl = document.querySelector('a-scene') as unknown as { is?: (s: string) => boolean } | null;
  if (sceneEl?.is?.('vr-mode') || sceneEl?.is?.('ar-mode')) return;

  const el = cam as unknown as {
    components?: Record<string, any>;
    __lookRaf?: number;
    __lookEnd?: ReturnType<typeof setTimeout>;
  };
  const look = el.components?.['look-controls'];
  if (!look?.yawObject || !look?.pitchObject) return;
  el.components?.['smooth-drag-look']?.resetDrag?.();

  if (el.__lookRaf) cancelAnimationFrame(el.__lookRaf);
  if (el.__lookEnd) clearTimeout(el.__lookEnd);
  const fromYaw = look.yawObject.rotation.y;
  const fromPitch = look.pitchObject.rotation.x;
  // Shortest angular path to 0 (wrap to [-PI, PI]) — otherwise a yaw that has
  // accumulated past a full turn would spin the long way around.
  const deltaYaw = Math.atan2(Math.sin(-fromYaw), Math.cos(-fromYaw));
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    look.yawObject.rotation.y = fromYaw + deltaYaw * eased;
    look.pitchObject.rotation.x = fromPitch - fromPitch * eased;
    if (t < 1) el.__lookRaf = requestAnimationFrame(step);
  };
  el.__lookRaf = requestAnimationFrame(step);
  // Guarantee the final orientation even if rAF is paused (backgrounded tab),
  // so the view can never be left stuck mid-turn.
  el.__lookEnd = setTimeout(() => {
    look.yawObject.rotation.y = 0;
    look.pitchObject.rotation.x = 0;
  }, dur + 60);
}

// Default names the calibration editor gives new hotspots ("Hotspot 1", …) were
// seeded into the backend as-is; they are not real captions, so don't show them.
const isDefaultHotspotLabel = (label: string) => /^hotspot\s*\d+$/i.test(label.trim());

// Info hotspots with no collection linked yet (backend sends collection_id: null)
// would open an empty/failing panel, so they are hidden until the data exists.
function presentableHotspots(hotspots: Hotspot[]): Hotspot[] {
  return hotspots
    .filter((h) => h.type !== 'info' || !!h.collection_id)
    .map((h) => (isDefaultHotspotLabel(h.label) ? { ...h, label: '' } : h));
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
  const [activePhotoHotspot, setActivePhotoHotspot] = useState<PhotoHotspot | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [floorplanOpen, setFloorplanOpen] = useState(false);
  const [hotspotsVisible, setHotspotsVisible] = useState(true);
  const [pickerActive, setPickerActive] = useState(false);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingSceneId, setPendingSceneId] = useState<string | null>(null);

  const router = useRouter();

  const containerRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLElement>(null);
  const cameraRef = useRef<HTMLElement>(null);
  const planetRef = useRef<HTMLElement>(null);
  const cursorRef = useRef<HTMLElement>(null);
  const transitioningRef = useRef(false);
  const didIntroRef = useRef(false);
  const currentIdRef = useRef<string | null>(null);
  const activeSceneRef = useRef<Scene | null>(null);

  const visibleHotspots = useMemo(
    () => presentableHotspots(activeScene?.hotspots ?? []),
    [activeScene],
  );

  useEffect(() => {
    currentIdRef.current = activeScene?.id ?? null;
    activeSceneRef.current = activeScene;
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
      registerHotspotLayer();
      registerLittlePlanetIntro();
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

  // Load a scene as the FIRST panorama (setInitial, not a crossfade). Reused on
  // mount and after a successful restricted-area login (direct-URL case).
  const startScene = useCallback(async (id: string) => {
    try {
      const scene = await getScene(id);
      // Wait for the component rather than reading it optionally: if it isn't ready
      // yet the panorama would silently never load at all.
      const sky = await waitForComponent(skyRef.current, 'sky-crossfade');
      await sky?.setInitial(scene.panorama_url, scene.initial_yaw ?? 0, scene.horizon_roll ?? 0);
      setActiveScene(scene);
    } catch {
      setLoadError(true);
    }
  }, []);

  // 2) Load the initial scene (gated for restricted rooms) + the list of all rooms.
  useEffect(() => {
    if (!ready) return;
    let mounted = true;
    if (isRestrictedScene(initialSceneId) && !isRestrictedUnlocked()) {
      // Direct URL into a restricted room: block it and require login first.
      setPendingSceneId(initialSceneId);
      setLoginOpen(true);
    } else {
      startScene(initialSceneId);
    }
    getScenes()
      .then((list) => {
        if (mounted) setSceneList(list);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [ready, initialSceneId, startScene]);

  // 3) Intro reveal: "Little Planet" opening — the panorama starts curled into a
  //    small planet seen from above, then unrolls into the normal view. Only on
  //    the first room of a visit; moving between rooms uses the crossfade instead.
  useEffect(() => {
    if (!activeScene || didIntroRef.current) return;
    const cam = cameraRef.current;
    const skyEl = skyRef.current as unknown as { components?: Record<string, any> } | null;
    if (!cam) return;
    didIntroRef.current = true;

    let cancelled = false;

    (async () => {
      const planet = await waitForComponent(planetRef.current, 'little-planet-intro');
      const sky = skyEl?.components?.['sky-crossfade'];
      const activeMesh = sky ? (sky.activeIsA ? sky.meshA : sky.meshB) : null;
      const texture = activeMesh?.material?.map;
      if (cancelled) return;

      if (!planet || !texture) {
        // Nothing to project (texture failed to load) — just lift the curtain.
        setCoverDuration(900);
        setCovered(false);
        return;
      }

      // The intro quad covers the whole viewport, so the black curtain can go
      // immediately — the planet itself is the reveal.
      setCoverDuration(300);
      setCovered(false);
      setIntroPlaying(true);

      await planet.runIntro({
        texture,
        skyYaw: activeMesh.rotation.y,
        skyRoll: activeMesh.rotation.z,
      });
      if (cancelled) return;

      // The intro ends looking straight ahead and level; snap the real camera to
      // match so the handoff is invisible even if the visitor dragged mid-intro.
      const look = (cam as unknown as { components?: Record<string, any> }).components?.[
        'look-controls'
      ];
      if (look?.yawObject && look?.pitchObject) {
        look.yawObject.rotation.y = 0;
        look.pitchObject.rotation.x = 0;
      }
      setIntroPlaying(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeScene]);

  // Room transition: BLEND between the two panoramas (dissolve, no black).
  // The "push forward" effect is done by sky-crossfade PUSHING the OLD panorama
  // sphere toward the view direction — the camera/FOV is NOT touched at all, so the
  // new panorama is completely still from the start (no zoom, no "snap" at the end).
  // Hotspots follow the transition: the old ones shrink out first (hs-exit event),
  // the new ones grow in mid-blend — no abrupt appear/disappear.
  const navigateTo = useCallback(async (targetId: string, transitionUrl?: string) => {
    if (transitioningRef.current || targetId === currentIdRef.current) return;
    // Restricted rooms require a login first (also blocks the door hotspot).
    if (isRestrictedScene(targetId) && !isRestrictedUnlocked()) {
      setPendingSceneId(targetId);
      setLoginOpen(true);
      return;
    }
    transitioningRef.current = true;
    const cam = cameraRef.current;
    const sky = skyRef.current as unknown as { components?: Record<string, any> } | null;
    try {
      // Optional one-off frame (e.g. a door opening) shown in place, at the
      // current scene's own rotation, before the real crossfade to the target room.
      // PURE DISSOLVE (push = 0): the closed→open door photos are the same view,
      // so there must be no "forward" motion here — only the later crossfade into
      // the target room (below) pushes forward.
      if (transitionUrl) {
        await sky?.components?.['sky-crossfade']?.crossfadeTo(
          transitionUrl,
          activeSceneRef.current?.initial_yaw ?? 0,
          500,
          activeSceneRef.current?.horizon_roll ?? 0,
          0,
        );
        await wait(350);
      }

      const next = await getScene(targetId);

      setActiveCollectionId(null);
      setActivePhotoHotspot(null);

      // Old hotspots shrink out (220ms)
      document.querySelectorAll('a-entity.hs-anim').forEach((el) => {
        (el as unknown as { emit?: (n: string) => void }).emit?.('hs-exit');
      });

      // Stop any running scroll-zoom lerp (keep the user's FOV)
      if (cam) {
        (cam as unknown as { components?: Record<string, any> }).components?.['scroll-zoom']?.cancel?.();
      }

      // Blend old panorama -> new (700ms) + "push forward" on the old panorama
      const blend = sky?.components?.['sky-crossfade']?.crossfadeTo(
        next.panorama_url,
        next.initial_yaw ?? 0,
        700,
        next.horizon_roll ?? 0,
      );

      // Re-orient the view to the new room's intended facing at the same pace
      // as the blend, so by the time the room is fully visible you're already
      // looking at the right thing — not wherever you happened to be facing
      // before clicking the hotspot.
      if (cam) recenterLook(cam, 700);

      // Swap hotspots & URL mid-blend (old hotspots have fully shrunk away;
      // the new ones mount and grow in during the rest of the blend)
      await wait(300);
      setActiveScene(next);
      window.history.replaceState(null, '', `/vr/${next.id}`);

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

  // Enter VR / Cardboard — replicates A-Frame's built-in enter-VR button, which
  // we hide (see globals.css) so VR is triggered from the footer control bar instead.
  const enterVR = useCallback(() => {
    const sceneEl = document.querySelector('a-scene') as unknown as { enterVR?: () => void } | null;
    sceneEl?.enterVR?.();
  }, []);

  // Restricted-area login handlers. `login()` (lib/api.ts) already marks the
  // session unlocked (+ stores the bearer token) before this fires.
  const onLoginSuccess = () => {
    setLoginOpen(false);
    const target = pendingSceneId;
    setPendingSceneId(null);
    if (!target) return;
    if (!currentIdRef.current) startScene(target); // direct-URL: nothing loaded yet
    else navigateTo(target); // door hotspot: navigate in-tour
  };
  const onLoginClose = () => {
    setLoginOpen(false);
    const wasDirect = !currentIdRef.current;
    setPendingSceneId(null);
    // Door-hotspot case (wasDirect === false): the scene never changed, so just
    // closing the modal keeps the visitor exactly where they were (e.g. /vr/17).
    // Direct-URL bypass case (wasDirect === true): nothing is loaded here — send
    // them back to the room they came from if possible, otherwise the main tour.
    if (wasDirect) {
      if (window.history.length > 1) router.back();
      else router.replace('/vr');
    }
  };

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

  // Disable auto-rotate while Pick mode is active (so the crosshair doesn't drift)
  // and during the intro (the shader drives the view, the camera must stay put).
  useEffect(() => {
    if (!ready) return;
    const cam = cameraRef.current as unknown as { setAttribute(c: string, p: string, v: unknown): void } | null;
    cam?.setAttribute('idle-rotate', 'enabled', !pickerActive && !introPlaying);
  }, [pickerActive, introPlaying, ready]);

  if (!ready) return <LoadingScreen message="Menyiapkan mesin VR…" />;

  if (loadError) {
    return (
      <main className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-[#0a1226] p-6 text-center">
        {/* Faint amber glow behind the 404 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(circle at 50% 42%, rgba(251,191,36,0.10), transparent 55%)' }}
        />

        {/* Logos */}
        <div className="relative flex items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/panorama/logo/Logo_Universitas_Brawijaya.png" alt="Universitas Brawijaya" className="h-14 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/panorama/logo/Logo_FKUB.webp" alt="FK UB" className="h-14 w-auto" />
        </div>

        {/* 404 */}
        <div className="relative flex flex-col items-center">
          <span className="text-7xl font-black leading-none tracking-tight text-amber-400 drop-shadow-[0_4px_24px_rgba(251,191,36,0.35)] sm:text-8xl">
            404
          </span>
          <p className="mt-3 text-xl font-semibold text-white">Ruang tidak ditemukan</p>
          <p className="mt-1.5 max-w-xs text-sm text-white/55">
            Tautan yang Anda buka tidak tersedia atau sudah dipindahkan.
          </p>
        </div>

        <Link
          href="/vr"
          className="relative rounded-xl bg-amber-400 px-6 py-2.5 text-sm font-bold text-[#0a1226] transition hover:bg-amber-300"
        >
          Kembali ke awal tur
        </Link>
      </main>
    );
  }

  // First room by order_index — no hardcoded fallback; simply a no-op until sceneList loads.
  const mainSceneId = sceneList[0]?.id;

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

          {/* Little Planet intro quad — a child of the camera, 1 unit in front, so
              it always fills the view. Hidden except while the intro plays. */}
          <a-entity ref={planetRef} little-planet-intro="" position="0 0 -1" />
        </a-camera>

        {/* Held back during the intro so the hotspots play their grow-in animation
            when the planet finishes unrolling, rather than popping in fully grown
            behind the intro quad. */}
        {hotspotsVisible && activeScene && !introPlaying && (
          <HotspotLayer
            key={activeScene.id}
            hotspots={visibleHotspots}
            onNavigate={navigateTo}
            onInfo={setActiveCollectionId}
            onPhoto={setActivePhotoHotspot}
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

      {/* Brand — top-left: FK UB logo + museum name */}
      <div className="pointer-events-none absolute left-5 top-5 z-20 flex flex-col items-start gap-2.5 drop-shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/panorama/logo/Logo_FKUB.webp" alt="Logo FK UB" className="h-16 w-auto md:h-20" />
        <div className="max-w-[75vw] leading-tight text-white sm:max-w-none">
          <p className="text-sm font-bold tracking-wide sm:text-base md:text-lg">MUSEUM ANATOMY FAKULTAS KEDOKTERAN</p>
          <p className="text-xs font-medium text-white/85 sm:text-sm md:text-base">UNIVERSITAS BRAWIJAYA</p>
        </div>
      </div>

      {/* Room title — bottom-left. Bigger + responsive; hidden on small screens
          where it would collide with the centered control bar. */}
      <div className="pointer-events-none absolute bottom-5 left-5 z-20 hidden sm:block">
        <h1 className="text-3xl font-semibold text-white drop-shadow-lg md:text-4xl">
          {activeScene?.title ?? 'Memuat…'}
        </h1>
      </div>

      {/* Footer control bar */}
      <SceneControlsBar
        onMainLocation={() => {
          if (!mainSceneId) return;
          setGalleryOpen(false);
          navigateTo(mainSceneId);
        }}
        onOpenGallery={() => setGalleryOpen(true)}
        onToggleFloorplan={() => setFloorplanOpen((v) => !v)}
        floorplanOpen={floorplanOpen}
        onToggleFullscreen={toggleFullscreen}
        onEnterVR={enterVR}
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

      {activeScene && activePhotoHotspot && (
        <HotspotPhotoModal hotspot={activePhotoHotspot} onClose={() => setActivePhotoHotspot(null)} />
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
      {!activeScene && !loginOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
        </div>
      )}

      {/* Restricted-area login gate */}
      {loginOpen && <RestrictedLoginModal onSuccess={onLoginSuccess} onClose={onLoginClose} />}
    </div>
  );
}
