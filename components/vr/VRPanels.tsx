'use client';

import { useEffect, useRef, useState } from 'react';
import type { PhotoHotspot } from '@/lib/types/tour';
import { useCollection } from '@/lib/hooks/useCollection';

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

/** Where to put a panel: straight ahead of wherever the visitor is looking (level). */
function usePanelPose(distance = 2) {
  const [pose] = useState(() => {
    const THREE = (window as unknown as { AFRAME?: any }).AFRAME?.THREE;
    const cam = (document.querySelector('a-scene') as unknown as { camera?: any } | null)?.camera;
    if (!THREE || !cam) return { position: `0 0 -${distance}`, rotation: '0 0 0' };
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
      position: `${p.x.toFixed(3)} ${(pos.y - 0.1).toFixed(3)} ${p.z.toFixed(3)}`,
      rotation: `0 ${yawDeg.toFixed(2)} 0`,
    };
  });
  return pose;
}

function PanelRoot({ children }: { children: React.ReactNode }) {
  const pose = usePanelPose();
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

function VRButton({
  label,
  x,
  y,
  width = 0.42,
  primary = false,
  onClick,
}: {
  label: string;
  x: number;
  y: number;
  width?: number;
  primary?: boolean;
  onClick: () => void;
}) {
  const ref = useEntityClick<HTMLElement>(onClick);
  const height = 0.12;
  const [src] = useState(() => {
    const { canvas, ctx } = newCanvas(width, height);
    const w = canvas.width;
    const h = canvas.height;
    roundRect(ctx, 3, 3, w - 6, h - 6, (h - 6) / 2);
    ctx.fillStyle = primary ? '#fbbf24' : 'rgba(255, 255, 255, 0.12)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = primary ? '#fcd34d' : 'rgba(255, 255, 255, 0.35)';
    ctx.stroke();
    ctx.font = `700 ${Math.round(h * 0.42)}px ${FONT}`;
    ctx.fillStyle = primary ? '#0a1226' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2 + 1);
    return canvas.toDataURL('image/png');
  });
  return (
    <a-plane
      ref={ref}
      class="clickable"
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
