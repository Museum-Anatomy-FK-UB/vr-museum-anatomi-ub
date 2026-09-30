'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PhotoHotspot } from '@/lib/types/tour';
import { useCollection } from '@/lib/hooks/useCollection';
import { login } from '@/lib/api';

// In-headset versions of the HTML overlays (HotspotInfo, HotspotPhotoModal, …).
// An immersive WebXR session only shows the WebGL canvas — any HTML modal opened
// while the visitor wears a Meta Quest is simply invisible, so clicking an info
// hotspot looked like it did nothing. These panels are real 3D entities placed in
// front of the visitor instead; outside VR the regular HTML modals are used.
//
// Text is drawn onto a canvas texture (the same technique as the hotspot faces in
// HotspotLayer) rather than with <a-text>: it needs no font download from the
// A-Frame CDN, handles every character the CMS can contain, and wraps/measures
// exactly, so the layout below never overlaps.

// ---- Layering ----------------------------------------------------------------
// Hotspots use renderOrder 10/11 with depthTest off (see HotspotLayer), so a
// panel must sort after them or hotspots would paint over it. Everything is
// forced into the transparent queue: three.js draws opaque meshes BEFORE the
// (transparent) sky spheres, which would then paint over an opaque panel.
const PANEL_RENDER_ORDER_BASE = 30;

export function registerVrLayer() {
  const AFRAME = (window as unknown as { AFRAME?: any }).AFRAME;
  if (!AFRAME || AFRAME.components['vr-layer']) return;
  AFRAME.registerComponent('vr-layer', {
    schema: { order: { type: 'number', default: 0 } },
    init(this: any) {
      this.apply = this.apply.bind(this);
      this.onSet = (evt: any) => {
        if (evt.target === this.el) this.apply();
      };
      this.el.addEventListener('object3dset', this.onSet);
      // The material component swaps in its own material AFTER the geometry's
      // mesh is set, and again once a texture arrives — re-apply at both points.
      this.el.addEventListener('loaded', this.apply);
      this.el.addEventListener('materialtextureloaded', this.apply);
      this.apply();
    },
    update(this: any) {
      this.apply();
    },
    remove(this: any) {
      this.el.removeEventListener('object3dset', this.onSet);
      this.el.removeEventListener('loaded', this.apply);
      this.el.removeEventListener('materialtextureloaded', this.apply);
    },
    apply(this: any) {
      const maxAniso = this.el.sceneEl?.renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
      Object.values(this.el.object3DMap as Record<string, any>).forEach((obj) => {
        obj.traverse?.((o: any) => {
          if (!o.material) return;
          o.renderOrder = PANEL_RENDER_ORDER_BASE + this.data.order;
          o.material.transparent = true;
          o.material.depthTest = false;
          o.material.depthWrite = false;
          // Small text seen at an angle stays legible with anisotropic filtering.
          if (o.material.map && o.material.map.anisotropy < Math.min(8, maxAniso)) {
            o.material.map.anisotropy = Math.min(8, maxAniso);
            o.material.map.needsUpdate = true;
          }
          o.material.needsUpdate = true;
        });
      });
    },
  });
}

// ---- Canvas drawing ------------------------------------------------------------
const PX_PER_M = 600; // ≈ the Quest's angular resolution at ~2m viewing distance
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

type TextBlock = {
  text: string;
  size: number; // px
  weight?: number;
  italic?: boolean;
  color: string;
  lineHeight: number; // px
  maxLines?: number;
  gapAfter?: number; // px
};

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const probe = line ? `${line} ${word}` : word;
      if (ctx.measureText(probe).width <= maxWidth || !line) line = probe;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function setFont(ctx: CanvasRenderingContext2D, b: TextBlock) {
  ctx.font = `${b.italic ? 'italic ' : ''}${b.weight ?? 400} ${b.size}px ${FONT}`;
}

/** Lay out text blocks top-down within maxWidth; returns the lines and total height. */
function layoutBlocks(ctx: CanvasRenderingContext2D, blocks: TextBlock[], maxWidth: number, maxHeight = Infinity) {
  const out: { block: TextBlock; lines: string[] }[] = [];
  let h = 0;
  for (const block of blocks) {
    if (!block.text) continue;
    setFont(ctx, block);
    let lines = wrapLines(ctx, block.text, maxWidth);
    const room = Math.floor((maxHeight - h) / block.lineHeight);
    const cap = Math.max(0, Math.min(block.maxLines ?? Infinity, room));
    if (lines.length > cap) {
      lines = lines.slice(0, cap);
      if (cap > 0) {
        let last = lines[cap - 1];
        while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
        lines[cap - 1] = `${last.trimEnd()}…`;
      }
    }
    if (!lines.length) continue;
    out.push({ block, lines });
    h += lines.length * block.lineHeight + (block.gapAfter ?? 0);
  }
  return { out, height: h };
}

function drawBlocks(ctx: CanvasRenderingContext2D, laid: ReturnType<typeof layoutBlocks>, x: number, y: number) {
  ctx.textBaseline = 'top';
  let cy = y;
  for (const { block, lines } of laid.out) {
    setFont(ctx, block);
    ctx.fillStyle = block.color;
    for (const line of lines) {
      ctx.fillText(line, x, cy + (block.lineHeight - block.size) / 2);
      cy += block.lineHeight;
    }
    cy += block.gapAfter ?? 0;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function newCanvas(wM: number, hM: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(wM * PX_PER_M);
  canvas.height = Math.round(hM * PX_PER_M);
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

/** Dark card background shared by every panel (matches the footer bar's palette). */
function drawCard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  roundRect(ctx, 2, 2, w - 4, h - 4, 28);
  ctx.fillStyle = '#0f172a'; // opaque: hotspots behind must not ghost through
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.stroke();
  // Amber accent along the top edge, clipped to the rounded card.
  ctx.save();
  roundRect(ctx, 2, 2, w - 4, h - 4, 28);
  ctx.clip();
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(0, 0, w, 8);
  ctx.restore();
}

// ---- Shared pieces ---------------------------------------------------------------

/** A-Frame entities emit plain DOM 'click' events (see xr-pointer) — not React's. */
function useEntityClick<T extends HTMLElement>(onClick?: () => void) {
  const ref = useRef<T>(null);
  const handler = useRef(onClick);
  handler.current = onClick;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fn = () => handler.current?.();
    el.addEventListener('click', fn);
    return () => el.removeEventListener('click', fn);
  }, []);
  return ref;
}

type PanelPlacement = {
  distance?: number; // meters in front of the visitor
  drop?: number; // meters below eye level
  tilt?: number; // degrees the panel leans back (like a lectern), for tall panels
};

/** Where to put a panel: straight ahead of wherever the visitor is looking (level). */
function usePanelPose({ distance = 2, drop = 0.1, tilt = 0 }: PanelPlacement = {}) {
  const [pose] = useState(() => {
    const THREE = (window as unknown as { AFRAME?: any }).AFRAME?.THREE;
    const cam = (document.querySelector('a-scene') as unknown as { camera?: any } | null)?.camera;
    if (!THREE || !cam) return { position: `0 ${-drop} -${distance}`, rotation: `${-tilt} 0 0` };
    const pos = new THREE.Vector3();
    const dir = new THREE.Vector3();
    cam.getWorldPosition(pos);
    cam.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1); // looking straight up/down
    dir.normalize();
    const p = pos.clone().addScaledVector(dir, distance);
    const yawDeg = (Math.atan2(-dir.x, -dir.z) * 180) / Math.PI;
    return {
      position: `${p.x.toFixed(3)} ${(pos.y - drop).toFixed(3)} ${p.z.toFixed(3)}`,
      // A-Frame applies rotation in YXZ order: face the visitor, then lean back.
      rotation: `${-tilt} ${yawDeg.toFixed(2)} 0`,
    };
  });
  return pose;
}

function PanelRoot({ children, placement }: { children: React.ReactNode; placement?: PanelPlacement }) {
  const pose = usePanelPose(placement);
  return (
    <a-entity position={pose.position} rotation={pose.rotation}>
      {children}
    </a-entity>
  );
}

/** The card plane — also a .clickable so lasers stop on it instead of passing
 *  through to hotspots behind the panel (it has no click handler). */
function CardPlane({ src, width, height, x = 0, y = 0 }: { src: string; width: number; height: number; x?: number; y?: number }) {
  return (
    <a-plane
      class="clickable"
      vr-layer="order: 0"
      position={`${x} ${y} 0`}
      width={width}
      height={height}
      src={src}
      material="shader: flat; transparent: true"
    />
  );
}

type ButtonVariant = 'default' | 'primary' | 'active';

// Button faces are cached per look — the keyboard re-labels its keys on Shift,
// and swapping back to an already-drawn face must not redraw a canvas.
const buttonTextures = new Map<string, string>();
function buttonTexture(label: string, width: number, height: number, variant: ButtonVariant): string {
  const key = `${label}|${width}|${height}|${variant}`;
  const cached = buttonTextures.get(key);
  if (cached) return cached;
  const { canvas, ctx } = newCanvas(width, height);
  const w = canvas.width;
  const h = canvas.height;
  const primary = variant === 'primary';
  const active = variant === 'active';
  roundRect(ctx, 3, 3, w - 6, h - 6, Math.min((h - 6) / 2, 22));
  ctx.fillStyle = primary ? '#fbbf24' : active ? 'rgba(251, 191, 36, 0.28)' : 'rgba(255, 255, 255, 0.12)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = primary || active ? '#fcd34d' : 'rgba(255, 255, 255, 0.35)';
  ctx.stroke();
  // Shrink the label until it fits (e.g. "Sembunyikan" on a narrow button).
  let size = Math.round(h * 0.42);
  ctx.font = `700 ${size}px ${FONT}`;
  while (size > 12 && ctx.measureText(label).width > w - 28) {
    size -= 1;
    ctx.font = `700 ${size}px ${FONT}`;
  }
  ctx.fillStyle = primary ? '#0a1226' : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, h / 2 + 1);
  const url = canvas.toDataURL('image/png');
  buttonTextures.set(key, url);
  return url;
}

function VRButton({
  label,
  x,
  y,
  width = 0.42,
  height = 0.12,
  primary = false,
  active = false,
  name,
  onClick,
}: {
  label: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  primary?: boolean;
  active?: boolean;
  name?: string; // stable identifier (data-name), e.g. for tests
  onClick: () => void;
}) {
  const ref = useEntityClick<HTMLElement>(onClick);
  const variant: ButtonVariant = primary ? 'primary' : active ? 'active' : 'default';
  const src = useMemo(() => buttonTexture(label, width, height, variant), [label, width, height, variant]);
  return (
    <a-plane
      ref={ref}
      class="clickable"
      data-name={name ?? label}
      vr-layer="order: 2"
      position={`${x} ${y} 0.01`}
      width={width}
      height={height}
      src={src}
      material="shader: flat; transparent: true"
      animation__enter="property: scale; startEvents: mouseenter; to: 1.08 1.08 1.08; dur: 120; easing: easeOutQuad"
      animation__leave="property: scale; startEvents: mouseleave; to: 1 1 1; dur: 120; easing: easeOutQuad"
    />
  );
}

/** Photo scaled to fit a box, kept hidden until its texture has loaded (no white flash). */
function FittedImage({ url, x, y, maxW, maxH }: { url: string; x: number; y: number; maxW: number; maxH: number }) {
  const ref = useRef<HTMLElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    setSize(null);
    const el = ref.current;
    if (!el) return;
    const onLoad = (evt: any) => {
      const img = evt.detail?.texture?.image;
      const iw = img?.naturalWidth || img?.videoWidth || img?.width;
      const ih = img?.naturalHeight || img?.videoHeight || img?.height;
      if (!iw || !ih) return;
      const scale = Math.min(maxW / iw, maxH / ih);
      setSize({ w: iw * scale, h: ih * scale });
    };
    el.addEventListener('materialtextureloaded', onLoad);
    return () => el.removeEventListener('materialtextureloaded', onLoad);
  }, [url, maxW, maxH]);
  return (
    <a-image
      ref={ref}
      vr-layer="order: 1"
      src={url}
      position={`${x} ${y} 0.005`}
      width={size?.w ?? maxW}
      height={size?.h ?? maxH}
      visible={size ? 'true' : 'false'}
      material="shader: flat; transparent: true"
    />
  );
}

// ---- Collection info ------------------------------------------------------------

export function VRInfoPanel({ collectionId, onClose }: { collectionId: string; onClose: () => void }) {
  const { collection, isLoading, error } = useCollection(collectionId);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => setPhotoIndex(0), [collectionId]);
  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

  const photos = collection?.photos ?? [];
  const photo = photos[Math.min(photoIndex, Math.max(0, photos.length - 1))];
  const hasPhoto = !!photo;

  const W = 2.0;
  const H = 1.15;
  const IMG_W = 0.86;
  const IMG_H = 0.78;
  const pad = 0.07;

  // Card texture: re-drawn only when what it shows changes.
  const cardKey = `${collection?.id ?? ''}|${isLoading}|${!!error}|${hasPhoto}|${photo?.caption ?? ''}|${photoIndex}/${photos.length}`;
  const [card, setCard] = useState<{ key: string; src: string } | null>(null);
  useEffect(() => {
    const { canvas, ctx } = newCanvas(W, H);
    const w = canvas.width;
    const h = canvas.height;
    drawCard(ctx, w, h);
    const px = (m: number) => m * PX_PER_M;

    const textX = hasPhoto ? pad + IMG_W + pad : pad;
    const textW = W - textX - pad;
    const blocks: TextBlock[] = [];
    if (isLoading) blocks.push({ text: 'Memuat koleksi…', size: 30, color: '#cbd5e1', lineHeight: 40 });
    else if (error || !collection)
      blocks.push({ text: 'Gagal memuat koleksi.', size: 30, color: '#fca5a5', lineHeight: 40 });
    else {
      blocks.push({ text: collection.name, size: 40, weight: 800, color: '#ffffff', lineHeight: 50, maxLines: 2, gapAfter: 4 });
      if (collection.latin_name)
        blocks.push({ text: collection.latin_name, size: 24, italic: true, color: '#94a3b8', lineHeight: 32, maxLines: 1, gapAfter: 6 });
      if (collection.category)
        blocks.push({ text: collection.category.toUpperCase(), size: 20, weight: 700, color: '#fbbf24', lineHeight: 30, maxLines: 1, gapAfter: 12 });
      blocks.push({ text: collection.description, size: 24, color: '#e2e8f0', lineHeight: 34 });
    }
    // Leave room at the bottom for the button row.
    const laid = layoutBlocks(ctx, blocks, px(textW), px(H - pad * 2 - 0.16));
    drawBlocks(ctx, laid, px(textX), px(pad + 0.02));

    if (hasPhoto) {
      // Placeholder behind the photo (visible while loading or if it fails).
      roundRect(ctx, px(pad), px(pad + 0.02), px(IMG_W), px(IMG_H), 18);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fill();
      ctx.font = `400 22px ${FONT}`;
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Memuat foto…', px(pad + IMG_W / 2), px(pad + 0.02 + IMG_H / 2));
      ctx.textAlign = 'left';
      const cap = photo?.caption;
      const counter = photos.length > 1 ? `${photoIndex + 1} / ${photos.length}` : '';
      const capText = [counter, cap].filter(Boolean).join('  ·  ');
      if (capText) {
        const capLaid = layoutBlocks(
          ctx,
          [{ text: capText, size: 20, color: '#94a3b8', lineHeight: 28, maxLines: 2 }],
          px(IMG_W),
        );
        drawBlocks(ctx, capLaid, px(pad), px(pad + 0.02 + IMG_H + 0.02));
      }
    }
    setCard({ key: cardKey, src: canvas.toDataURL('image/png') });
    // cardKey captures everything drawn above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey]);

  const toggleAudio = () => {
    const url = collection?.audio_url;
    if (!url) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.addEventListener('ended', () => setPlaying(false));
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  // Panel-local coordinates (meters, origin at the card center).
  const left = -W / 2;
  const top = H / 2;
  const btnY = -H / 2 + pad + 0.06;

  return (
    <PanelRoot>
      {card && <CardPlane key={card.key} src={card.src} width={W} height={H} />}
      {hasPhoto && photo && (
        <FittedImage
          key={photo.url}
          url={photo.url}
          x={left + pad + IMG_W / 2}
          y={top - pad - 0.02 - IMG_H / 2}
          maxW={IMG_W}
          maxH={IMG_H}
        />
      )}
      {photos.length > 1 && (
        <>
          <VRButton label="‹ Foto" x={left + pad + 0.2} y={btnY} width={0.36}
            onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)} />
          <VRButton label="Foto ›" x={left + pad + 0.6} y={btnY} width={0.36}
            onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)} />
        </>
      )}
      {collection?.audio_url && (
        <VRButton
          key={playing ? 'pause' : 'play'}
          label={playing ? 'Jeda audio' : 'Putar audio'}
          x={W / 2 - pad - 0.62}
          y={btnY}
          width={0.4}
          onClick={toggleAudio}
        />
      )}
      <VRButton label="Tutup" x={W / 2 - pad - 0.17} y={btnY} width={0.34} primary onClick={onClose} />
    </PanelRoot>
  );
}

// ---- Single photo ----------------------------------------------------------------

export function VRPhotoPanel({ hotspot, onClose }: { hotspot: PhotoHotspot; onClose: () => void }) {
  const caption = hotspot.caption ?? hotspot.label;
  const W = 2.1;
  const IMG_W = 1.94;
  const IMG_H = 1.05;
  const pad = 0.08;

  const [layout] = useState(() => {
    // Measure the caption first so the card is exactly as tall as it needs to be.
    const probe = newCanvas(W, 1).ctx;
    const block: TextBlock = { text: caption, size: 26, color: '#e2e8f0', lineHeight: 36, maxLines: 3 };
    const capH = caption ? layoutBlocks(probe, [block], (IMG_W) * PX_PER_M).height / PX_PER_M : 0;
    const H = pad + IMG_H + (capH ? 0.04 + capH : 0) + 0.06 + 0.12 + pad;
    const { canvas, ctx } = newCanvas(W, H);
    drawCard(ctx, canvas.width, canvas.height);
    roundRect(ctx, pad * PX_PER_M, pad * PX_PER_M, IMG_W * PX_PER_M, IMG_H * PX_PER_M, 18);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fill();
    ctx.font = `400 24px ${FONT}`;
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Memuat foto…', (pad + IMG_W / 2) * PX_PER_M, (pad + IMG_H / 2) * PX_PER_M);
    ctx.textAlign = 'left';
    if (caption) {
      drawBlocks(ctx, layoutBlocks(ctx, [block], IMG_W * PX_PER_M), pad * PX_PER_M, (pad + IMG_H + 0.04) * PX_PER_M);
    }
    return { H, src: canvas.toDataURL('image/png') };
  });

  const { H, src } = layout;
  return (
    <PanelRoot>
      <CardPlane src={src} width={W} height={H} />
      <FittedImage url={hotspot.media_url} x={0} y={H / 2 - pad - IMG_H / 2} maxW={IMG_W} maxH={IMG_H} />
      <VRButton label="Tutup" x={W / 2 - pad - 0.17} y={-H / 2 + pad + 0.06} width={0.34} primary onClick={onClose} />
    </PanelRoot>
  );
}

// ---- Notice (things that can't happen inside the headset) ------------------------

export type VRNoticeAction = { label: string; onClick: () => void; primary?: boolean };

export function VRNoticePanel({ title, message, actions }: { title: string; message: string; actions: VRNoticeAction[] }) {
  const W = 1.6;
  const pad = 0.08;
  const [layout] = useState(() => {
    const blocks: TextBlock[] = [
      { text: title, size: 36, weight: 800, color: '#ffffff', lineHeight: 46, maxLines: 2, gapAfter: 10 },
      { text: message, size: 26, color: '#e2e8f0', lineHeight: 36, maxLines: 6 },
    ];
    const probe = newCanvas(W, 1).ctx;
    const textH = layoutBlocks(probe, blocks, (W - pad * 2) * PX_PER_M).height / PX_PER_M;
    const H = pad + textH + 0.08 + 0.12 + pad;
    const { canvas, ctx } = newCanvas(W, H);
    drawCard(ctx, canvas.width, canvas.height);
    drawBlocks(ctx, layoutBlocks(ctx, blocks, (W - pad * 2) * PX_PER_M), pad * PX_PER_M, pad * PX_PER_M);
    return { H, src: canvas.toDataURL('image/png') };
  });
  const { H, src } = layout;
  const btnW = 0.62;
  const gap = 0.06;
  const rowW = actions.length * btnW + (actions.length - 1) * gap;
  return (
    <PanelRoot>
      <CardPlane src={src} width={W} height={H} />
      {actions.map((a, i) => (
        <VRButton
          key={a.label}
          label={a.label}
          primary={a.primary}
          width={btnW}
          x={-rowW / 2 + btnW / 2 + i * (btnW + gap)}
          y={-H / 2 + pad + 0.06}
          onClick={a.onClick}
        />
      ))}
    </PanelRoot>
  );
}

// ---- Restricted-area login ------------------------------------------------------
// A form that works INSIDE the headset: HTML inputs are invisible in an immersive
// session and the Quest's system keyboard doesn't open there, so the visitor
// types on a virtual keyboard with the laser (trigger) or a pinch. A paired
// Bluetooth keyboard works too. Uses the same login() as the HTML form, so the
// token/unlock state ends up exactly as after a normal login.

/**
 * A plane whose texture is a canvas redrawn IN PLACE whenever `version` changes.
 * (A new data-URL `src` per keystroke would leave every decoded image in
 * A-Frame's texture-source cache for good — megabytes per key press.)
 */
function CanvasPlane({
  width,
  height,
  version,
  draw,
}: {
  width: number;
  height: number;
  version: string;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const store = useRef<{ canvas: HTMLCanvasElement; texture: any } | null>(null);

  useEffect(() => {
    const el = ref.current as any;
    const THREE = (window as unknown as { AFRAME?: any }).AFRAME?.THREE;
    if (!el || !THREE) return;
    const { canvas } = newCanvas(width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    store.current = { canvas, texture };
    const attach = () => {
      const mesh = el.getObject3D('mesh');
      if (!mesh?.material || mesh.material.map === texture) return;
      mesh.material.map = texture;
      mesh.material.needsUpdate = true;
    };
    attach();
    el.addEventListener('loaded', attach);
    el.addEventListener('object3dset', attach);
    return () => {
      el.removeEventListener('loaded', attach);
      el.removeEventListener('object3dset', attach);
      texture.dispose();
      store.current = null;
    };
  }, [width, height]);

  useEffect(() => {
    const s = store.current;
    if (!s) return;
    const ctx = s.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
    draw(ctx, s.canvas.width, s.canvas.height);
    s.texture.needsUpdate = true;
    // `version` stands for everything `draw` renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, width, height]);

  return (
    <a-plane
      ref={ref}
      class="clickable"
      vr-layer="order: 0"
      width={width}
      height={height}
      material="shader: flat; transparent: true"
    />
  );
}

/** Invisible hit area (e.g. over a text field drawn on the card). */
function HitArea({ x, y, width, height, name, onClick }: {
  x: number; y: number; width: number; height: number; name: string; onClick: () => void;
}) {
  const ref = useEntityClick<HTMLElement>(onClick);
  return (
    <a-plane
      ref={ref}
      class="clickable"
      data-name={name}
      vr-layer="order: 1"
      position={`${x} ${y} 0.005`}
      width={width}
      height={height}
      material="shader: flat; transparent: true; opacity: 0"
    />
  );
}

type KeyDef = { label: string; value?: string; action?: 'shift' | 'backspace' | 'symbols' | 'letters'; w?: number };
const chars = (s: string): KeyDef[] => Array.from(s).map((c) => ({ label: c }));
const LETTER_ROWS: KeyDef[][] = [
  chars('1234567890'),
  chars('qwertyuiop'),
  chars('asdfghjkl'),
  [{ label: '⇧', action: 'shift', w: 1.6 }, ...chars('zxcvbnm'), { label: '⌫', action: 'backspace', w: 1.6 }],
  [
    { label: '#+=', action: 'symbols', w: 1.6 },
    ...chars('@.'),
    { label: 'Spasi', value: ' ', w: 3 },
    ...chars('-_'),
    { label: '.com', value: '.com', w: 1.6 },
  ],
];
const SYMBOL_ROWS: KeyDef[][] = [
  chars('1234567890'),
  chars('!@#$%^&*()'),
  chars('-_+=/\\:;\'"'),
  [...chars('[]{}<>,?'), { label: '⌫', action: 'backspace', w: 1.6 }],
  [
    { label: 'ABC', action: 'letters', w: 1.6 },
    ...chars('~`'),
    { label: 'Spasi', value: ' ', w: 3 },
    ...chars('|.'),
    { label: '.com', value: '.com', w: 1.6 },
  ],
];

type LoginField = 'email' | 'password';

export function VRLoginPanel({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focus, setFocus] = useState<LoginField>('email');
  const [shift, setShift] = useState(false);
  const [symbols, setSymbols] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Latest values for the keyboard/physical-key handlers (stable callbacks).
  const live = useRef({ email, password, focus, shift, busy });
  live.current = { email, password, focus, shift, busy };

  const type = (text: string) => {
    if (live.current.busy) return;
    setError(null);
    if (live.current.focus === 'email') setEmail((v) => (v + text).slice(0, 254));
    else setPassword((v) => (v + text).slice(0, 128));
  };
  const backspace = () => {
    if (live.current.busy) return;
    if (live.current.focus === 'email') setEmail((v) => v.slice(0, -1));
    else setPassword((v) => v.slice(0, -1));
  };
  const submit = () => {
    const { email: e, password: p, busy: b } = live.current;
    if (b) return;
    if (!e.trim() || !p) {
      setError('Isi email dan password terlebih dahulu.');
      setFocus(!e.trim() ? 'email' : 'password');
      return;
    }
    setBusy(true);
    setError(null);
    login(e.trim(), p)
      .then(() => onSuccess())
      .catch((err: unknown) => {
        setError(err instanceof Error && err.message ? err.message : 'Login gagal. Coba lagi.');
        setBusy(false);
      });
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  const pressKey = (k: KeyDef) => {
    switch (k.action) {
      case 'shift':
        setShift((v) => !v);
        return;
      case 'backspace':
        backspace();
        return;
      case 'symbols':
        setSymbols(true);
        return;
      case 'letters':
        setSymbols(false);
        return;
    }
    const raw = k.value ?? k.label;
    type(live.current.shift && raw.length === 1 ? raw.toUpperCase() : raw);
    if (live.current.shift) setShift(false); // one-shot, like a phone keyboard
  };

  // A physical (e.g. Bluetooth) keyboard types into the focused field too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') submitRef.current();
      else if (e.key === 'Backspace') backspace();
      else if (e.key === 'Tab') setFocus((f) => (f === 'email' ? 'password' : 'email'));
      else if (e.key.length === 1) type(e.key);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // type/backspace only touch refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Layout (meters, panel-local; y measured down from the top edge) ----
  const W = 1.62;
  const pad = 0.07;
  const KW = 0.128; // one key unit
  const KH = 0.105;
  const GAP = 0.014;
  const SHOW_W = 0.3; // "Tampilkan" button beside the password field
  const T_TITLE = pad;
  const T_EMAIL_LABEL = 0.165;
  const T_EMAIL_BOX = 0.21;
  const T_PASS_LABEL = 0.34;
  const T_PASS_BOX = 0.385;
  const BOX_H = 0.1;
  const T_MESSAGE = 0.5;
  const T_KEYS = 0.57;
  const T_ACTIONS = T_KEYS + 5 * KH + 4 * GAP + 0.045;
  const H = T_ACTIONS + 0.12 + pad;
  const top = H / 2;
  const yOf = (t: number, h: number) => top - t - h / 2; // center y of a box starting at t
  const passBoxW = W - pad * 2 - SHOW_W - 0.02;

  const shownPassword = showPassword ? password : '•'.repeat(password.length);
  const version = JSON.stringify([email, shownPassword, focus, error, busy]);
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const px = (m: number) => m * PX_PER_M;
    drawCard(ctx, w, h);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = `800 34px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Login area terbatas', px(pad), px(T_TITLE));

    const field = (label: string, value: string, t: number, boxW: number, focused: boolean, placeholder: string) => {
      ctx.font = `600 20px ${FONT}`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(label, px(pad), px(t - 0.045));
      roundRect(ctx, px(pad), px(t), px(boxW), px(BOX_H), 14);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.fill();
      ctx.lineWidth = focused ? 4 : 2;
      ctx.strokeStyle = focused ? '#fbbf24' : 'rgba(255, 255, 255, 0.25)';
      ctx.stroke();
      const inner = px(boxW) - 36;
      ctx.font = `400 28px ${FONT}`;
      ctx.textBaseline = 'middle';
      const cy = px(t + BOX_H / 2);
      if (!value && !focused) {
        ctx.fillStyle = '#64748b';
        ctx.fillText(placeholder, px(pad) + 18, cy);
      } else {
        // Keep the END of long input visible (that's where typing happens).
        let shown = value;
        while (shown && ctx.measureText(`${shown}|`).width > inner) shown = shown.slice(1);
        if (shown !== value) shown = `…${shown.slice(1)}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(shown, px(pad) + 18, cy);
        if (focused) {
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(px(pad) + 20 + ctx.measureText(shown).width, cy - 16, 3, 32);
        }
      }
      ctx.textBaseline = 'top';
    };
    field('Email', email, T_EMAIL_BOX, W - pad * 2, focus === 'email', 'nama@contoh.com');
    field('Password', shownPassword, T_PASS_BOX, passBoxW, focus === 'password', 'Password');

    ctx.font = `${error ? 600 : 400} 21px ${FONT}`;
    ctx.fillStyle = error ? '#fca5a5' : '#94a3b8';
    const message = busy
      ? 'Memeriksa…'
      : error ?? 'Arahkan laser ke tombol, lalu tekan trigger (atau pinch) untuk mengetik.';
    const laid = layoutBlocks(ctx, [{ text: message, size: 21, color: ctx.fillStyle as string, lineHeight: 28, maxLines: 2, weight: error ? 600 : 400 }], px(W - pad * 2));
    drawBlocks(ctx, laid, px(pad), px(T_MESSAGE));
  };

  const rows = symbols ? SYMBOL_ROWS : LETTER_ROWS;
  const keyWidth = (k: KeyDef) => (k.w ?? 1) * KW + ((k.w ?? 1) - 1) * GAP;

  return (
    <PanelRoot placement={{ distance: 1.7, drop: 0.3, tilt: 18 }}>
      <CanvasPlane width={W} height={H} version={version} draw={draw} />
      <HitArea name="field-email" x={0} y={yOf(T_EMAIL_BOX, BOX_H)} width={W - pad * 2} height={BOX_H}
        onClick={() => setFocus('email')} />
      <HitArea name="field-password" x={-W / 2 + pad + passBoxW / 2} y={yOf(T_PASS_BOX, BOX_H)} width={passBoxW} height={BOX_H}
        onClick={() => setFocus('password')} />
      <VRButton
        name="toggle-password"
        label={showPassword ? 'Sembunyikan' : 'Tampilkan'}
        x={W / 2 - pad - SHOW_W / 2}
        y={yOf(T_PASS_BOX, BOX_H)}
        width={SHOW_W}
        height={BOX_H}
        onClick={() => setShowPassword((v) => !v)}
      />

      {rows.map((row, r) => {
        const rowW = row.reduce((sum, k) => sum + keyWidth(k), 0) + GAP * (row.length - 1);
        let x = -rowW / 2;
        return row.map((k, i) => {
          const kw = keyWidth(k);
          const cx = x + kw / 2;
          x += kw + GAP;
          const label = shift && !k.action && k.label.length === 1 ? k.label.toUpperCase() : k.label;
          return (
            <VRButton
              // Keyed by position so switching layers re-labels instead of remounting.
              key={`${r}-${i}`}
              name={`key-${k.action ?? k.label}`}
              label={label}
              x={cx}
              y={yOf(T_KEYS + r * (KH + GAP), KH)}
              width={kw}
              height={KH}
              active={k.action === 'shift' && shift}
              onClick={() => pressKey(k)}
            />
          );
        });
      })}

      <VRButton name="cancel" label="Batal" x={-0.36} y={yOf(T_ACTIONS, 0.12)} width={0.56} onClick={onCancel} />
      <VRButton name="submit" label={busy ? 'Memproses…' : 'Masuk'} x={0.36} y={yOf(T_ACTIONS, 0.12)} width={0.56} primary
        onClick={submit} />
    </PanelRoot>
  );
}
