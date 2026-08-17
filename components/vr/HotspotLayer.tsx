'use client';

import { useEffect, useRef } from 'react';
import type { Hotspot, HotspotArrow } from '@/lib/types/tour';

// ---- Stable layering for the hotspot's flat, semi-transparent pieces -------
// Hotspots sit ~6 units from the camera, all mutually near-coplanar, so their
// draw order must be pinned explicitly or they flicker/half-render depending on
// camera angle.
//
// The offset below matters: sky-crossfade's two panorama spheres use
// renderOrder 0 and 1, so a hotspot left on 0/1 lands in the SAME sorting
// buckets as the sky. Whenever the active sky happens to be the renderOrder-1
// mesh (they alternate on every room transition), that sky is drawn AFTER the
// hotspots — which is how a hotspot could look wrong in one room and fine in
// the next, with no per-room difference in the data. Sitting above the sky's
// range keeps hotspots on top in every room, in every crossfade parity.
//
// Depth flags are deliberately left at A-Frame's defaults: hotspots writing
// depth is what stops the (much farther, depthWrite:false) sky sphere from
// painting over them. Forcing depthWrite:false here makes hotspots vanish
// entirely in rooms whose active sky sorts later.
const HOTSPOT_RENDER_ORDER_BASE = 10;

export function registerHotspotLayer() {
  const AFRAME = (window as unknown as { AFRAME?: any }).AFRAME;
  if (!AFRAME || AFRAME.components['hotspot-layer']) return;
  AFRAME.registerComponent('hotspot-layer', {
    schema: { order: { type: 'number', default: 0 } },
    init(this: { el: any; apply: () => void; onMeshSet: (e: any) => void }) {
      this.apply = this.apply.bind(this);
      // 'object3dset' is what A-Frame itself waits on when a component needs the
      // mesh that another component (geometry) creates — 'loaded' is the wrong
      // signal here and had already fired by the time this ran, so renderOrder
      // silently never landed and hotspots fell back into the sky's sort buckets.
      this.onMeshSet = (evt: any) => {
        if (evt.detail?.type === 'mesh' && evt.target === this.el) this.apply();
      };
      this.el.addEventListener('object3dset', this.onMeshSet);
      if (this.el.getObject3D('mesh')) this.apply();
    },
    update(this: { apply: () => void }) {
      this.apply();
    },
    remove(this: { el: any; onMeshSet: (e: any) => void }) {
      this.el.removeEventListener('object3dset', this.onMeshSet);
    },
    apply(this: { el: any; data: { order: number } }) {
      const mesh = this.el.getObject3D('mesh') as { renderOrder: number; material?: any } | null;
      if (!mesh?.material) return;
      mesh.renderOrder = HOTSPOT_RENDER_ORDER_BASE + this.data.order;
      // Safe only because renderOrder above puts hotspots past the sky's buckets:
      // they're painted after it regardless of depth, so skipping depth here just
      // removes the z-fighting between the hotspot's own near-coplanar layers.
      mesh.material.depthTest = false;
      mesh.material.depthWrite = false;
      mesh.material.needsUpdate = true;
    },
  });
}

// ---- Texture generation (cached, canvas-based) -----------------------------
const textureCache = new Map<string, string>();

function cachedTexture(
  key: string,
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void
): string {
  const cached = textureCache.get(key);
  if (cached) return cached;
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  draw(ctx, size);
  const url = canvas.toDataURL('image/png');
  textureCache.set(key, url);
  return url;
}

// Rotation (degrees) to aim the arrow in a given direction — now used to rotate
// the image WHEN IT'S BAKED into the texture, no longer via a rotation attribute in JSX.
const ARROW_DEG: Record<HotspotArrow, number> = { up: 0, right: -90, down: 180, left: 90 };

/**
 * The entire hotspot face — ambient glow, gradient coin, highlight, rim, and
 * icon — is baked into ONE texture per variant (info, or arrow per direction).
 * Previously each of these was a separate mesh overlapping nearly coplanar; that
 * caused the z-fighting that made half the hotspot look cut off. With a single
 * texture on a single plane, no other mesh (besides the pulse ring) can "fight"
 * over the depth buffer.
 */
function getHotspotFaceTexture(kind: 'info' | 'arrow' | 'door', arrowDeg = 0): string {
  const key = kind === 'arrow' ? `face-arrow-${arrowDeg}` : `face-${kind}`;
  return cachedTexture(key, 256, (ctx, size) => {
    const cx = size / 2;
    const cy = size / 2;
    const coinR = size * 0.32;

    // 1. Soft ambient glow (radial white -> transparent)
    const glow = ctx.createRadialGradient(cx, cy, coinR * 0.5, cx, cy, size * 0.5);
    glow.addColorStop(0, 'rgba(255,255,255,0.5)');
    glow.addColorStop(0.55, 'rgba(255,255,255,0.14)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    // 2. Radial-gradient coin (grey center -> near-black edge)
    const coin = ctx.createRadialGradient(cx, cy - size * 0.02, 0, cx, cy, coinR * 1.05);
    coin.addColorStop(0, '#3a3a3a');
    coin.addColorStop(0.6, '#1a1a1a');
    coin.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = coin;
    ctx.beginPath();
    ctx.arc(cx, cy, coinR, 0, Math.PI * 2);
    ctx.fill();

    // 3. Thin inner highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = size * 0.012;
    ctx.beginPath();
    ctx.arc(cx, cy, coinR * 0.88, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Glossy white rim
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = size * 0.045;
    ctx.beginPath();
    ctx.arc(cx, cy, coinR * 1.08, 0, Math.PI * 2);
    ctx.stroke();

    // 5. Icon — drawn crisp & precise (no longer geometry primitives)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#f4f4f2';

    if (kind === 'arrow') {
      ctx.rotate((arrowDeg * Math.PI) / 180);
      const s = coinR * 0.055; // shrunk (was 0.085 — too big vs the info icon)
      ctx.beginPath();
      ctx.moveTo(0, -9 * s);
      ctx.lineTo(9 * s, 7 * s);
      ctx.lineTo(0, 2.8 * s);
      ctx.lineTo(-9 * s, 7 * s);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'door') {
      // A simple door glyph: rounded-top panel + a knob, so an entrance reads
      // differently from a plain navigation arrow while staying the same coin.
      const w = coinR * 0.5;
      const h = coinR * 0.92;
      const x = -w / 2;
      const y = -h / 2;
      const r = w * 0.16;
      ctx.beginPath();
      ctx.moveTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
      // Knob — punched in the coin's dark tone so it reads as a door handle.
      ctx.fillStyle = '#141414';
      ctx.beginPath();
      ctx.arc(x + w - w * 0.24, 0, w * 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const dotR = coinR * 0.1;
      ctx.beginPath();
      ctx.arc(0, -coinR * 0.32, dotR, 0, Math.PI * 2);
      ctx.fill();

      const barW = coinR * 0.2;
      const barH = coinR * 0.48;
      const bx = -barW / 2;
      const by = -coinR * 0.05;
      const rad = barW / 2;
      ctx.beginPath();
      ctx.moveTo(bx + rad, by);
      ctx.arcTo(bx + barW, by, bx + barW, by + barH, rad);
      ctx.arcTo(bx + barW, by + barH, bx, by + barH, rad);
      ctx.arcTo(bx, by + barH, bx, by, rad);
      ctx.arcTo(bx, by, bx + barW, by, rad);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  });
}

/** Convert yaw/pitch (degrees) to a 3D position on a sphere of the given radius. */
export function toPosition(yaw: number, pitch: number, radius = 6): string {
  const y = (yaw * Math.PI) / 180;
  const p = (pitch * Math.PI) / 180;
  const x = radius * Math.cos(p) * Math.sin(y);
  const height = radius * Math.sin(p);
  const z = -radius * Math.cos(p) * Math.cos(y);
  return `${x.toFixed(2)} ${height.toFixed(2)} ${z.toFixed(2)}`;
}

function HotspotEntity({ hotspot, onActivate }: { hotspot: Hotspot; onActivate: () => void }) {
  const ref = useRef<HTMLElement>(null);

  // The A-Frame cursor emits a 'click' event (gaze/mouse) on the target entity.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onActivate();
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [onActivate]);

  // Three visual styles:
  // - tilted arrow: general room-to-room navigation (lies down like a floor marker)
  // - door: an UPRIGHT navigation hotspot for an entrance (variant === 'door')
  // - info: upright collection hotspot (with a nod animation)
  const isNav = hotspot.type === 'navigation';
  const isDoor = isNav && hotspot.variant === 'door';
  const isTiltedArrow = isNav && !isDoor;

  // Arrow angle: an explicit `arrow_deg` (free 0–360 rotation) wins over the
  // 4-way `arrow`; rounded so the baked-texture cache stays bounded.
  const arrowDeg =
    isTiltedArrow && hotspot.type === 'navigation'
      ? Math.round(hotspot.arrow_deg ?? ARROW_DEG[hotspot.arrow ?? 'up'])
      : 0;

  const faceTexture = isDoor
    ? getHotspotFaceTexture('door')
    : isTiltedArrow
    ? getHotspotFaceTexture('arrow', arrowDeg)
    : getHotspotFaceTexture('info');

  // Tilted-arrow hotspots "lie down" like a floor marker (instead of floating
  // upright facing the camera) — an X rotation on the local axis, still valid for
  // any yaw because the parent's Y rotation (billboard) doesn't change the child's
  // local X axis (still horizontal). STATIC, NO animation (no wobble/flip) — -78°
  // (not a full -90) so it tilts slightly, not perfectly flat, and its face stays
  // somewhat visible to the camera instead of lying completely flat.
  // Door and Info hotspots STAY upright facing the camera (rotation 0 0 0); Info
  // adds the nod animation, Door stays static.
  const NAV_TILT = -78;
  const flatRotation = isTiltedArrow ? `${NAV_TILT} 0 0` : '0 0 0';

  return (
    <a-entity
      ref={ref}
      class="clickable"
      position={toPosition(hotspot.yaw, hotspot.pitch)}
      rotation={`0 ${-hotspot.yaw} 0`}
      animation__enter="property: scale; startEvents: mouseenter; to: 1.28 1.28 1.28; dur: 160; easing: easeOutQuad"
      animation__leave="property: scale; startEvents: mouseleave; to: 1 1 1; dur: 160; easing: easeOutQuad"
    >
      {/* Transition group: grows on mount, shrinks on the 'hs-exit' event
          (emitted by VRScene when a room transition begins). */}
      <a-entity
        class="hs-anim"
        scale="0.001 0.001 0.001"
        animation__in="property: scale; from: 0.001 0.001 0.001; to: 1 1 1; dur: 400; easing: easeOutQuad"
        animation__out="property: scale; to: 0.001 0.001 0.001; dur: 220; easing: easeInQuad; startEvents: hs-exit"
      >
        {/* "Radar ping" ring — the only part that stays a separate mesh, because
            it animates continuously (scale/opacity). hotspot-layer keeps it
            stable "behind" the coin face. */}
        <a-ring
          hotspot-layer="order: 0"
          rotation={flatRotation}
          radius-inner="0.42"
          radius-outer="0.48"
          material="shader: flat; side: double; color: #ffffff; opacity: 0.7"
          animation__pulse="property: scale; from: 0.95 0.95 0.95; to: 1.55 1.55 1.55; loop: true; dur: 2200; easing: easeOutSine"
          animation__pulsefade="property: material.opacity; from: 0.7; to: 0; loop: true; dur: 2200; easing: easeOutSine"
        />

        {/* Hotspot face: glow + coin + rim + icon in ONE texture, ONE plane —
            no other mesh can z-fight anymore.
            Tilted arrow: STATIC tilted rotation (-78°, see NAV_TILT), no animation.
            Door: STATIC upright. Info: upright + nod animation. */}
        <a-image
          hotspot-layer="order: 1"
          src={faceTexture}
          width="1.05"
          height="1.05"
          material="shader: flat; side: double; transparent: true; alphaTest: 0.02"
          {...(isTiltedArrow
            ? { rotation: flatRotation }
            : isDoor
            ? { rotation: '0 0 0' }
            : {
                animation__tilt:
                  'property: rotation; from: -16 0 0; to: 16 0 0; dir: alternate; loop: true; dur: 2200; easing: easeInOutSine',
              })}
        />

        <a-text value={hotspot.label} align="center" position="0 0.74 0" width="5" color="#ffffff" />
      </a-entity>
    </a-entity>
  );
}

export default function HotspotLayer({
  hotspots,
  onNavigate,
  onInfo,
}: {
  hotspots: Hotspot[];
  onNavigate: (targetSceneId: string, transitionUrl?: string) => void;
  onInfo: (collectionId: string) => void;
}) {
  return (
    <>
      {hotspots.map((hotspot) => (
        <HotspotEntity
          key={hotspot.id}
          hotspot={hotspot}
          onActivate={() =>
            hotspot.type === 'navigation'
              ? onNavigate(hotspot.target_scene_id, hotspot.transition_url)
              : onInfo(hotspot.collection_id)
          }
        />
      ))}
    </>
  );
}