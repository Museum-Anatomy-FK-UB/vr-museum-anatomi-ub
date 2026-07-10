'use client';

import { useEffect, useRef } from 'react';
import type { Hotspot, HotspotArrow } from '@/lib/types/tour';

// ---- Stable layering for the hotspot's flat, semi-transparent pieces -------
// Hotspots sit ~6 units from the camera. At that distance A-Frame's default
// near/far clipping gives the depth buffer poor precision, so any two
// near-coplanar transparent meshes (coin, rings, glow) can flicker or
// half-render depending on camera angle — this is what caused the
// "half cut" / "kotak" artifacts. Disabling depth test/write on these
// layers and forcing an explicit renderOrder makes the stacking
// deterministic regardless of GPU precision.
function registerLayerOrderComponent() {
  const AFRAME = (window as unknown as { AFRAME?: any }).AFRAME;
  if (!AFRAME || AFRAME.components['hotspot-layer']) return;
  AFRAME.registerComponent('hotspot-layer', {
    schema: { order: { type: 'number', default: 0 } },
    init(this: { el: any; apply: () => void }) {
      this.apply = this.apply.bind(this);
      if (this.el.getObject3D('mesh')) this.apply();
      this.el.addEventListener('loaded', this.apply);
    },
    apply(this: { el: any; data: { order: number } }) {
      const mesh = this.el.getObject3D('mesh') as { renderOrder: number; material?: any } | null;
      if (!mesh || !mesh.material) return;
      mesh.renderOrder = this.data.order;
      mesh.material.depthTest = false;
      mesh.material.depthWrite = false;
      mesh.material.needsUpdate = true;
    },
  });
}
if (typeof window !== 'undefined') registerLayerOrderComponent();

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

// Rotasi (derajat) untuk mengarahkan panah ke arah tertentu — sekarang
// dipakai untuk memutar gambar SAAT DIBAKAR ke texture, bukan lagi lewat
// atribut rotation di JSX.
const ARROW_DEG: Record<HotspotArrow, number> = { up: 0, right: -90, down: 180, left: 90 };

/**
 * Seluruh muka hotspot — glow ambient, koin gradasi, highlight, rim, dan
 * ikon — dibakar jadi SATU texture per varian (info, atau arrow per arah).
 * Sebelumnya tiap bagian ini adalah mesh terpisah yang saling tumpang
 * tindih nyaris sebidang; itu penyebab z-fighting yang bikin separuh
 * hotspot terlihat terpotong. Dengan satu texture di satu plane, tidak ada
 * lagi mesh lain (selain ring pulse) yang bisa "berebut" depth buffer.
 */
function getHotspotFaceTexture(kind: 'info' | 'arrow', arrowDeg = 0): string {
  const key = kind === 'arrow' ? `face-arrow-${arrowDeg}` : 'face-info';
  return cachedTexture(key, 256, (ctx, size) => {
    const cx = size / 2;
    const cy = size / 2;
    const coinR = size * 0.32;

    // 1. Glow ambient lembut (radial putih -> transparan)
    const glow = ctx.createRadialGradient(cx, cy, coinR * 0.5, cx, cy, size * 0.5);
    glow.addColorStop(0, 'rgba(255,255,255,0.5)');
    glow.addColorStop(0.55, 'rgba(255,255,255,0.14)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    // 2. Koin gradasi radial (abu tengah -> nyaris hitam tepi)
    const coin = ctx.createRadialGradient(cx, cy - size * 0.02, 0, cx, cy, coinR * 1.05);
    coin.addColorStop(0, '#3a3a3a');
    coin.addColorStop(0.6, '#1a1a1a');
    coin.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = coin;
    ctx.beginPath();
    ctx.arc(cx, cy, coinR, 0, Math.PI * 2);
    ctx.fill();

    // 3. Highlight tipis di dalam
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = size * 0.012;
    ctx.beginPath();
    ctx.arc(cx, cy, coinR * 0.88, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Rim putih mengkilap
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = size * 0.045;
    ctx.beginPath();
    ctx.arc(cx, cy, coinR * 1.08, 0, Math.PI * 2);
    ctx.stroke();

    // 5. Ikon — digambar tajam & presisi (bukan primitif geometry lagi)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#f4f4f2';

    if (kind === 'arrow') {
      ctx.rotate((arrowDeg * Math.PI) / 180);
      const s = coinR * 0.055; // diperkecil (sebelumnya 0.085 — kegedean vs ikon info)
      ctx.beginPath();
      ctx.moveTo(0, -9 * s);
      ctx.lineTo(9 * s, 7 * s);
      ctx.lineTo(0, 2.8 * s);
      ctx.lineTo(-9 * s, 7 * s);
      ctx.closePath();
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

/** Konversi yaw/pitch (derajat) ke posisi 3D pada bola dengan radius tertentu. */
function toPosition(yaw: number, pitch: number, radius = 6): string {
  const y = (yaw * Math.PI) / 180;
  const p = (pitch * Math.PI) / 180;
  const x = radius * Math.cos(p) * Math.sin(y);
  const height = radius * Math.sin(p);
  const z = -radius * Math.cos(p) * Math.cos(y);
  return `${x.toFixed(2)} ${height.toFixed(2)} ${z.toFixed(2)}`;
}

function HotspotEntity({ hotspot, onActivate }: { hotspot: Hotspot; onActivate: () => void }) {
  const ref = useRef<HTMLElement>(null);

  // A-Frame cursor memancarkan event 'click' (gaze/mouse) pada entity target.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onActivate();
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [onActivate]);

  const isArrow = hotspot.type === 'navigation';
  const faceTexture = isArrow
    ? getHotspotFaceTexture('arrow', ARROW_DEG[hotspot.arrow ?? 'up'])
    : getHotspotFaceTexture('info');

  // Hotspot navigasi "tidur" rebah spt marker lantai (bukan melayang tegak
  // menghadap kamera) — rotasi X di sumbu lokal, tetap valid utk yaw berapa
  // pun krn rotasi Y induk (billboard) tidak mengubah arah sumbu X lokal
  // anak (masih horizontal). STATIS, TANPA animasi (tidak goyang/flip) —
  // -78° (bukan -90 penuh) supaya sedikit miring, tidak rata/lurus total,
  // dan mukanya tetap agak terlihat dari kamera alih-alih rebah datar.
  // Hotspot info TETAP tegak menghadap kamera + animasi mengangguk (tidak diubah).
  const NAV_TILT = -78;
  const flatRotation = isArrow ? `${NAV_TILT} 0 0` : '0 0 0';

  return (
    <a-entity
      ref={ref}
      class="clickable"
      position={toPosition(hotspot.yaw, hotspot.pitch)}
      rotation={`0 ${-hotspot.yaw} 0`}
      animation__enter="property: scale; startEvents: mouseenter; to: 1.28 1.28 1.28; dur: 160; easing: easeOutQuad"
      animation__leave="property: scale; startEvents: mouseleave; to: 1 1 1; dur: 160; easing: easeOutQuad"
    >
      {/* Grup transisi: tumbuh saat mount, menyusut saat event 'hs-exit'
          (dipancarkan VRScene saat mulai pindah ruangan). */}
      <a-entity
        class="hs-anim"
        scale="0.001 0.001 0.001"
        animation__in="property: scale; from: 0.001 0.001 0.001; to: 1 1 1; dur: 400; easing: easeOutQuad"
        animation__out="property: scale; to: 0.001 0.001 0.001; dur: 220; easing: easeInQuad; startEvents: hs-exit"
      >
        {/* Ring "radar ping" — satu-satunya bagian yang tetap mesh terpisah,
            karena beranimasi terus-menerus (scale/opacity). hotspot-layer
            menjaga posisinya tetap stabil "di belakang" muka koin. */}
        <a-ring
          hotspot-layer="order: 0"
          rotation={flatRotation}
          radius-inner="0.42"
          radius-outer="0.48"
          material="shader: flat; side: double; color: #ffffff; opacity: 0.7"
          animation__pulse="property: scale; from: 0.95 0.95 0.95; to: 1.55 1.55 1.55; loop: true; dur: 2200; easing: easeOutSine"
          animation__pulsefade="property: material.opacity; from: 0.7; to: 0; loop: true; dur: 2200; easing: easeOutSine"
        />

        {/* Muka hotspot: glow + koin + rim + ikon dalam SATU texture, SATU
            plane — tidak ada lagi mesh lain yang bisa saling z-fight.
            Navigasi: rotasi STATIS miring (-78°, lihat NAV_TILT), tanpa
            animasi — tidak goyang/flip. Info: tegak + animasi mengangguk. */}
        <a-image
          hotspot-layer="order: 1"
          src={faceTexture}
          width="1.05"
          height="1.05"
          material="shader: flat; side: double; transparent: true; alphaTest: 0.02"
          {...(isArrow
            ? { rotation: flatRotation }
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
  onNavigate: (targetSceneId: string) => void;
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
              ? onNavigate(hotspot.target_scene_id)
              : onInfo(hotspot.collection_id)
          }
        />
      ))}
    </>
  );
}