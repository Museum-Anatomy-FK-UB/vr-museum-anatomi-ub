'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ExternalLinkHotspot, Hotspot, PhotoHotspot, Scene, SceneSummary } from '@/lib/types/tour';
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
import { registerVrHandStyle, registerXrPointer } from './xrPointer';
import {
  headYaw,
  registerVrLayer,
  VRInfoPanel,
  VRLoginPanel,
  VRNoticePanel,
  VRPhotoPanel,
  type VRNoticeAction,
} from './VRPanels';
import { registerVrMenuFollow, VRFloorplanPanel, VRLocationsPanel, VRMenuBar } from './VRMenu';
import LoadingScreen from '@/components/ui/LoadingScreen';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type XRScene = HTMLElement & {
  is(state: string): boolean;
  xrSession?: unknown;
  enterVR(): Promise<unknown>;
  exitVR(): Promise<unknown>;
};
const getSceneEl = () => document.querySelector('a-scene') as unknown as XRScene | null;

/** True only inside a REAL immersive WebXR session (e.g. on a Meta Quest). */
function isImmersive() {
  const sceneEl = getSceneEl();
  return !!sceneEl?.is('vr-mode') && !!sceneEl.xrSession;
}

/**
 * Which way (degrees around world Y) a room should be turned on arrival so its
 * intended front — the view `initial_yaw` defines — ends up where the visitor is
 * looking. In 2D that's 0: there the CAMERA is turned to the front instead (see
 * recenterLook). In a headset the camera IS the visitor's head and must never be
 * forced, so the room (panorama + hotspots together, so hotspots stay on their
 * objects) is turned to face them instead — the same "arrive looking at the right
 * thing" as in 2D, wherever they happened to be facing.
 */
function arrivalYawDeg(currentDeg: number): number {
  if (!isImmersive()) return 0;
  const cam = (getSceneEl() as unknown as { camera?: { getWorldQuaternion(q: unknown): unknown } } | null)?.camera;
  const THREE = (window as unknown as { AFRAME?: { THREE?: any } }).AFRAME?.THREE;
  if (!cam || !THREE) return currentDeg;
  // Looking (nearly) straight up or down there is no meaningful heading — it can
  // even flip 180° past the vertical — so keep the room's current orientation.
  const q = new THREE.Quaternion();
  cam.getWorldQuaternion(q);
  const pitch = new THREE.Euler().setFromQuaternion(q, 'YXZ').x;
  if (Math.abs(pitch) > (70 * Math.PI) / 180) return currentDeg;
  return (headYaw(cam, THREE) * 180) / Math.PI;
}

/**
 * Why "Mode VR" can't start here, or null if an immersive-vr session is possible.
 * A-Frame's own enterVR() must NOT be called without a headset: on a desktop it
 * falls back to a "VR mode" that only fullscreens the canvas, and every look
 * control here is disabled in vr-mode — which is exactly the "freeze" visitors saw.
 */
async function vrUnavailableReason(): Promise<string | null> {
  if (!window.isSecureContext) {
    return 'Mode VR hanya tersedia melalui koneksi aman (HTTPS).';
  }
  const xr = (navigator as Navigator & { xr?: { isSessionSupported(mode: string): Promise<boolean> } }).xr;
  const supported = await xr?.isSessionSupported('immersive-vr').catch(() => false);
  if (supported) return null;
  return 'Headset VR tidak terdeteksi. Buka alamat ini di browser headset VR (mis. Meta Quest Browser) untuk masuk ke Mode VR.';
}

// Something a hotspot asks for that can't happen inside the headset (another
// website) — the visitor is offered to leave VR for it.
type VRNotice = { kind: 'external'; hotspot: ExternalLinkHotspot };

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
  const [inVR, setInVR] = useState(false);
  const [vrNotice, setVrNotice] = useState<VRNotice | null>(null);
  // Restricted room the visitor is logging in for, from inside the headset.
  const [vrLoginSceneId, setVrLoginSceneId] = useState<string | null>(null);
  const vrLoginSceneIdRef = useRef<string | null>(null);
  vrLoginSceneIdRef.current = vrLoginSceneId;
  // How far the current room is turned to face the visitor (VR only, degrees —
  // see arrivalYawDeg). Applied to the panorama AND the hotspot layer.
  const [worldYaw, setWorldYaw] = useState(0);
  const worldYawRef = useRef(0);
  // VR menu bar: closed (just the small "Menu" button) unless opened.
  const [vrMenuOpen, setVrMenuOpen] = useState(false);
  // Small on-screen message (outside VR), optionally with a link to open.
  const [toast, setToast] = useState<{ message: string; href?: string; newTab?: boolean } | null>(null);

  const router = useRouter();

  const containerRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLElement>(null);
  const cameraRef = useRef<HTMLElement>(null);
  const planetRef = useRef<HTMLElement>(null);
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
      registerXrPointer();
      registerVrLayer();
      registerVrMenuFollow();
      registerVrHandStyle();
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
    // A-Frame's exitVR() resets the pixel ratio to the full devicePixelRatio.
    sceneEl.addEventListener('exit-vr', apply);
    return () => {
      sceneEl.removeEventListener('loaded', apply);
      sceneEl.removeEventListener('exit-vr', apply);
      window.removeEventListener('resize', apply);
    };
  }, [ready]);

  // Input per mode:
  // - Desktop/mobile browser: hotspot click & hover are handled by manual
  //   raycasting in the smooth-drag-look component (no cursor dot).
  // - Immersive VR (Meta Quest etc.): the xr-pointer component owns everything —
  //   controller/hand lasers, trigger/pinch to click, and the gaze reticle only
  //   when there is nothing to point with (see xrPointer.ts).
  // This effect tracks whether a real XR session is running, so the in-headset
  // panels are used instead of the (invisible there) HTML modals.
  useEffect(() => {
    if (!ready) return;
    const sceneEl = getSceneEl();
    if (!sceneEl) return;
    const enter = () => {
      if (!sceneEl.xrSession) return;
      setInVR(true);
      setToast(null);
      setVrMenuOpen(false);
      // The little-planet intro is a flat quad sized to the 2D camera — it has no
      // meaning in stereo, so jump straight to the room if it's still playing.
      (planetRef.current as unknown as { components?: Record<string, any> } | null)?.components?.[
        'little-planet-intro'
      ]?.finish?.();
    };
    const exit = () => {
      setInVR(false);
      setVrNotice(null);
      setVrMenuOpen(false);
      // Back in 2D: undo the VR-only room turn and land on the room's intended
      // view, exactly as after a 2D navigation.
      const scene = activeSceneRef.current;
      if (worldYawRef.current !== 0 && scene) {
        (skyRef.current as unknown as { components?: Record<string, any> } | null)?.components?.[
          'sky-crossfade'
        ]?.setYaw(scene.initial_yaw ?? 0, scene.horizon_roll ?? 0);
        worldYawRef.current = 0;
        setWorldYaw(0);
      }
      const look = (cameraRef.current as unknown as { components?: Record<string, any> } | null)?.components?.[
        'look-controls'
      ];
      if (look?.yawObject && look?.pitchObject) {
        look.yawObject.rotation.y = 0;
        look.pitchObject.rotation.x = 0;
      }
      // Leaving VR mid-login continues in the regular HTML form.
      const loginSceneId = vrLoginSceneIdRef.current;
      if (loginSceneId) {
        setVrLoginSceneId(null);
        setPendingSceneId(loginSceneId);
        setLoginOpen(true);
      }
    };
    // B / Y on a controller (emitted by xr-pointer) opens/closes the VR menu.
    const toggleMenu = () => setVrMenuOpen((v) => !v);
    sceneEl.addEventListener('enter-vr', enter);
    sceneEl.addEventListener('exit-vr', exit);
    sceneEl.addEventListener('vr-menu-toggle', toggleMenu);
    return () => {
      sceneEl.removeEventListener('enter-vr', enter);
      sceneEl.removeEventListener('exit-vr', exit);
      sceneEl.removeEventListener('vr-menu-toggle', toggleMenu);
    };
  }, [ready]);

  // The on-screen toast fades away on its own unless it carries a link to click.
  useEffect(() => {
    if (!toast || toast.href) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

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
      // The HTML login form is invisible inside the headset — log in there instead.
      if (isImmersive()) {
        setVrLoginSceneId(targetId);
        return;
      }
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
          (activeSceneRef.current?.initial_yaw ?? 0) + worldYawRef.current,
          500,
          activeSceneRef.current?.horizon_roll ?? 0,
          0,
        );
        await wait(350);
      }

      const next = await getScene(targetId);

      setActiveCollectionId(null);
      setActivePhotoHotspot(null);
      setVrNotice(null);
      setVrLoginSceneId(null);
      // In the headset, menu panels would stand in front of the new room, and
      // the open menu bar would sit over its floor arrows.
      if (isImmersive()) {
        setGalleryOpen(false);
        setFloorplanOpen(false);
        setVrMenuOpen(false);
      }

      // Old hotspots shrink out (220ms)
      document.querySelectorAll('a-entity.hs-anim').forEach((el) => {
        (el as unknown as { emit?: (n: string) => void }).emit?.('hs-exit');
      });

      // Stop any running scroll-zoom lerp (keep the user's FOV)
      if (cam) {
        (cam as unknown as { components?: Record<string, any> }).components?.['scroll-zoom']?.cancel?.();
      }

      // VR: turn the new room so its front faces wherever the visitor is looking
      // (0 in 2D — the camera is re-centered below instead).
      const yawOffset = arrivalYawDeg(worldYawRef.current);

      // Blend old panorama -> new (700ms) + "push forward" on the old panorama
      const blend = sky?.components?.['sky-crossfade']?.crossfadeTo(
        next.panorama_url,
        (next.initial_yaw ?? 0) + yawOffset,
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
      worldYawRef.current = yawOffset;
      setWorldYaw(yawOffset);
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

  // Enter immersive VR (Meta Quest / any WebXR headset) — replaces A-Frame's
  // built-in enter-VR button, which we hide (see globals.css) so VR is triggered
  // from the footer control bar instead. Without a headset it explains why rather
  // than letting A-Frame fall into its fullscreen pseudo-VR (see vrUnavailableReason).
  const enterVR = useCallback(async () => {
    const sceneEl = getSceneEl();
    if (!sceneEl || sceneEl.is('vr-mode')) return;
    const reason = await vrUnavailableReason();
    if (reason) {
      setToast({ message: reason });
      return;
    }
    try {
      await sceneEl.enterVR();
    } catch {
      setToast({ message: 'Gagal masuk ke Mode VR. Pastikan headset aktif, lalu coba lagi.' });
    }
  }, []);

  // External links can't open inside the headset (the browser tab stays hidden
  // behind the VR session), so in VR the visitor is offered to leave VR first.
  const openExternal = useCallback((hotspot: ExternalLinkHotspot) => {
    if (isImmersive()) {
      setVrNotice({ kind: 'external', hotspot });
      return;
    }
    window.open(hotspot.url, hotspot.open_in_new_tab === false ? '_self' : '_blank', 'noopener,noreferrer');
  }, []);

  const exitVRThen = (after: () => void) => {
    setVrNotice(null);
    const sceneEl = getSceneEl();
    if (!sceneEl) return;
    sceneEl.exitVR().then(after, after);
  };

  const vrNoticeContent = (notice: VRNotice): { title: string; message: string; actions: VRNoticeAction[] } => {
    const cancel: VRNoticeAction = { label: 'Batal', onClick: () => setVrNotice(null) };
    const { hotspot } = notice;
    return {
      title: hotspot.label || 'Tautan eksternal',
      message: 'Tautan ini dibuka di browser, di luar tur VR. Keluar dari Mode VR untuk membukanya.',
      actions: [
        cancel,
        {
          label: 'Keluar VR',
          primary: true,
          // A real click on the link afterwards (not window.open from here) —
          // popup blockers don't treat the end of a VR session as a user gesture.
          onClick: () =>
            exitVRThen(() =>
              setToast({
                message: hotspot.label || 'Tautan eksternal',
                href: hotspot.url,
                newTab: hotspot.open_in_new_tab !== false,
              }),
            ),
        },
      ],
    };
  };

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

  // One VR panel at a time: opening a menu panel closes whatever else is up.
  const closeVrPanels = () => {
    setActiveCollectionId(null);
    setActivePhotoHotspot(null);
    setVrNotice(null);
    setGalleryOpen(false);
    setFloorplanOpen(false);
  };

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black">
      <a-scene
        embedded
        vr-mode-ui="enabled: true"
        loading-screen="enabled: false"
        renderer="colorManagement: true; antialias: false; precision: medium"
        // 'local' (not A-Frame's default 'local-floor'): the XR origin is the
        // visitor's own head, so their eyes sit at the center of the panorama
        // sphere like the desktop camera does. With 'local-floor' the headset
        // reports the real standing height (~1.6m) and every hotspot drifts off
        // the object it marks in the photo.
        // 'hand-tracking': the Quest only reports tracked hands (and their pinch
        // = select) to a page that asks for them — without it, putting the
        // controllers down leaves the visitor with no way to point at anything.
        webxr="referenceSpaceType: local; requiredFeatures: local; optionalFeatures: hand-tracking"
        // A-Frame's "F" shortcut calls enterVR() directly, bypassing the headset
        // check in enterVR below (and freezing the view on a desktop).
        keyboard-shortcuts="enterVR: false"
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
          {/* Gaze reticle — shown by xr-pointer only in VR when there is no
              controller/hand to point with (e.g. Cardboard). Purely visual: the
              dwell-to-click logic lives in xr-pointer. */}
          <a-entity
            id="vr-gaze-reticle"
            visible="false"
            vr-layer="order: 25"
            position="0 0 -1"
            geometry="primitive: ring; radiusInner: 0.012; radiusOuter: 0.02"
            material="color: #ffffff; shader: flat; opacity: 0.9"
          />

          {/* Little Planet intro quad — a child of the camera, 1 unit in front, so
              it always fills the view. Hidden except while the intro plays. */}
          <a-entity ref={planetRef} little-planet-intro="" position="0 0 -1" />
        </a-camera>

        {/* Held back during the intro so the hotspots play their grow-in animation
            when the planet finishes unrolling, rather than popping in fully grown
            behind the intro quad. */}
        {/* Turned together with the panorama (worldYaw, VR only) so hotspots
            stay on the objects they mark. */}
        <a-entity rotation={`0 ${worldYaw} 0`}>
          {hotspotsVisible && activeScene && !introPlaying && (
            <HotspotLayer
              key={activeScene.id}
              hotspots={visibleHotspots}
              onNavigate={navigateTo}
              onInfo={setActiveCollectionId}
              onPhoto={setActivePhotoHotspot}
              onExternalLink={openExternal}
            />
          )}
        </a-entity>

        {/* Controller/hand lasers + trigger/pinch clicks inside an XR session. */}
        <a-entity xr-pointer="reticle: #vr-gaze-reticle" />
        {/* What the visitor holds, drawn in VR — visual only, all clicking goes
            through xr-pointer above. Quest Touch controller models while
            controllers are in use; the visitor's own tracked hands (like in the
            Quest home) while using hand tracking. Each shows only while that
            kind of input is active. */}
        <a-entity meta-touch-controls="hand: left" vr-hand-style="" />
        <a-entity meta-touch-controls="hand: right" vr-hand-style="" />
        <a-entity hand-tracking-controls="hand: left; modelColor: #e8eefc; modelOpacity: 0.9" vr-hand-style="" />
        <a-entity hand-tracking-controls="hand: right; modelColor: #e8eefc; modelOpacity: 0.9" vr-hand-style="" />

        {/* In-headset panels (HTML modals are invisible during an XR session).
            At most one at a time; the most recent request wins. */}
        {inVR &&
          (vrLoginSceneId ? (
            <VRLoginPanel
              key={vrLoginSceneId}
              onCancel={() => setVrLoginSceneId(null)}
              onSuccess={() => {
                // login() has already stored the token + unlocked the area.
                const target = vrLoginSceneId;
                setVrLoginSceneId(null);
                navigateTo(target);
              }}
            />
          ) : vrNotice ? (
            <VRNoticePanel key={JSON.stringify(vrNotice)} {...vrNoticeContent(vrNotice)} />
          ) : activePhotoHotspot ? (
            <VRPhotoPanel
              key={activePhotoHotspot.id}
              hotspot={activePhotoHotspot}
              onClose={() => setActivePhotoHotspot(null)}
            />
          ) : activeCollectionId ? (
            <VRInfoPanel
              key={activeCollectionId}
              collectionId={activeCollectionId}
              onClose={() => setActiveCollectionId(null)}
            />
          ) : galleryOpen ? (
            <VRLocationsPanel
              scenes={sceneList}
              currentId={activeScene?.id ?? null}
              onSelect={(id) => {
                setGalleryOpen(false);
                navigateTo(id);
              }}
              onClose={() => setGalleryOpen(false)}
            />
          ) : floorplanOpen ? (
            <VRFloorplanPanel
              scenes={sceneList}
              currentId={activeScene?.id ?? null}
              onSelect={(id) => {
                setFloorplanOpen(false);
                navigateTo(id);
              }}
              onClose={() => setFloorplanOpen(false)}
            />
          ) : null)}

        {/* The footer bar's actions: a small "Menu" button riding on the left
            controller / hand opens the bar in front of the chest (or B / Y).
            Hidden while the login keyboard is up. */}
        {inVR && !vrLoginSceneId && (
          <VRMenuBar
            expanded={vrMenuOpen}
            onToggleMenu={() => setVrMenuOpen((v) => !v)}
            hotspotsVisible={hotspotsVisible}
            open={galleryOpen ? 'locations' : floorplanOpen ? 'floorplan' : null}
            onMainLocation={() => {
              if (mainSceneId) navigateTo(mainSceneId);
            }}
            // The bar gets out of the way once a panel opens (it would sit
            // right under it); Show/Hide Hotspot keeps it so the effect is seen.
            onAllLocations={() => {
              const opening = !galleryOpen;
              closeVrPanels();
              setGalleryOpen(opening);
              setVrMenuOpen(false);
            }}
            onFloorplan={() => {
              const opening = !floorplanOpen;
              closeVrPanels();
              setFloorplanOpen(opening);
              setVrMenuOpen(false);
            }}
            onToggleHotspots={() => setHotspotsVisible((v) => !v)}
            onExitVR={() => getSceneEl()?.exitVR()}
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

      {!inVR && floorplanOpen && (
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

      {!inVR && galleryOpen && (
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

      {!inVR && activeScene && activeCollectionId && (
        <HotspotInfo collectionId={activeCollectionId} onClose={() => setActiveCollectionId(null)} />
      )}

      {!inVR && activeScene && activePhotoHotspot && (
        <HotspotPhotoModal hotspot={activePhotoHotspot} onClose={() => setActivePhotoHotspot(null)} />
      )}

      {/* Toast — e.g. "no headset detected", or the link to open after leaving VR */}
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-24 z-40 flex justify-center px-4 md:top-6">
          <div
            role="status"
            className="pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border border-white/10 bg-[#161d33]/95 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur-md"
          >
            <p className="flex-1 leading-relaxed">
              {toast.message}
              {toast.href && (
                <a
                  href={toast.href}
                  target={toast.newTab ? '_blank' : '_self'}
                  rel="noopener noreferrer"
                  onClick={() => setToast(null)}
                  className="mt-2 block font-semibold text-amber-400 hover:text-amber-300"
                >
                  Buka tautan →
                </a>
              )}
            </p>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Tutup pesan"
              className="-mr-1 rounded-full px-2 text-white/60 transition hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
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
