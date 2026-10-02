'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SceneSummary } from '@/lib/types/tour';
import {
  CardPlane,
  FONT,
  PanelRoot,
  VRButton,
  drawCard,
  headYaw,
  newCanvas,
  roundRect,
  useEntityClick,
} from './VRPanels';

// The footer control bar, inside the headset. HTML is invisible during an XR
// session, so the same actions (Main Location, All Location, Denah, show/hide
// hotspots) live on a bar floating BELOW the visitor's line of sight. Fullscreen /
// Mode VR make no sense inside VR, so that slot becomes "Keluar VR".
//
// Closed by default: only a small "Menu" button sits low (~62° down), under the
// floor arrows (which lie ~20–49° down). It only catches lasers while the
// visitor's gaze is on it (see vr-menu-follow), so a laser from a hand at the hip
// to a floor arrow — which passes right through that spot — is never blocked.
// It opens with that button (laser + trigger, hand + pinch, or gaze) or with
// B / Y on a controller (see xr-pointer), and closes again on navigation.
// The open bar's background lets lasers through — only its buttons catch them.

// ---- Lazy-follow placement --------------------------------------------------------
// The bar stays put while the visitor looks around nearby, and only swings round
// to their new heading once they've turned well away from it (like the Quest's own
// menus). Following every small head turn would make it impossible to aim at.
export function registerVrMenuFollow() {
  const AFRAME = (window as unknown as { AFRAME?: any }).AFRAME;
  if (!AFRAME || AFRAME.components['vr-menu-follow']) return;
  const THREE = AFRAME.THREE;
  const DEG = Math.PI / 180;
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

  AFRAME.registerComponent('vr-menu-follow', {
    schema: {
      distance: { default: 0.8 }, // meters from the eyes — within easy laser reach
      pitch: { default: -62 }, // degrees below the line of sight (faces the eyes)
      threshold: { default: 40 }, // degrees of head turn before it follows
      // The menu's own area (panel-local meters) — it takes the laser only while
      // the visitor's GAZE falls inside it (plus a margin).
      regionW: { default: 0.62 },
      regionTop: { default: 0.08 },
      regionBottom: { default: -0.08 },
      margin: { default: 0.03 },
      smooth: { default: 220 }, // ms time-constant of the follow motion
    },
    init(this: any) {
      this.yaw = null;
      this.turning = false;
      this.head = new THREE.Vector3();
      this.target = new THREE.Vector3();
      this.quat = new THREE.Quaternion();
      this.euler = new THREE.Euler();
      this.active = null;
      this.inv = new THREE.Matrix4();
      this.o = new THREE.Vector3();
      this.d = new THREE.Vector3();
    },
    tick(this: any, _t: number, dt: number) {
      const cam = this.el.sceneEl.camera;
      if (!cam) return;
      cam.getWorldPosition(this.head);
      const yawHead = headYaw(cam, THREE);
      const first = this.yaw === null;
      if (first) this.yaw = yawHead;

      const diff = wrap(yawHead - this.yaw);
      // No meaningful heading while looking (nearly) straight up/down — don't
      // start swinging the bar around on it.
      cam.getWorldQuaternion(this.quat);
      const steep = Math.abs(this.euler.setFromQuaternion(this.quat, 'YXZ').x) > 70 * DEG;

      if (!steep && Math.abs(diff) > this.data.threshold * DEG) this.turning = true;
      const alpha = first ? 1 : 1 - Math.exp(-(dt || 16) / this.data.smooth);
      if (this.turning) {
        this.yaw = wrap(this.yaw + diff * alpha);
        if (Math.abs(diff) < 2 * DEG) this.turning = false;
      }

      const pitch = this.data.pitch * DEG;
      const ahead = Math.cos(pitch) * this.data.distance;
      this.target.set(
        this.head.x - Math.sin(this.yaw) * ahead,
        this.head.y + Math.sin(pitch) * this.data.distance,
        this.head.z - Math.cos(this.yaw) * ahead,
      );
      const o = this.el.object3D;
      if (first) o.position.copy(this.target);
      else o.position.lerp(this.target, alpha);
      // Lean back by the same angle so the face points straight at the eyes
      // (entity rotation order is YXZ).
      o.rotation.set(pitch, this.yaw, 0);

      // The menu sits low in front of the body — right across the path of a
      // laser from a hand at the hip to a floor arrow. So it only catches lasers
      // while the visitor is LOOKING AT it (gaze lands inside its area); while
      // they look at / aim for hotspots, lasers pass straight through.
      o.updateMatrixWorld(true);
      this.inv.copy(o.matrixWorld).invert();
      this.o.copy(this.head).applyMatrix4(this.inv);
      cam.getWorldDirection(this.d);
      this.d.add(this.head).applyMatrix4(this.inv).sub(this.o);
      let active = false;
      if (this.d.z < -1e-6 && this.o.z > 0) {
        const t = -this.o.z / this.d.z;
        const x = this.o.x + this.d.x * t;
        const y = this.o.y + this.d.y * t;
        const m = this.data.margin * (this.active ? 2 : 1); // hysteresis
        active = Math.abs(x) < this.data.regionW / 2 + m && y > this.data.regionBottom - m && y < this.data.regionTop + m;
      }
      if (active !== this.active) {
        this.active = active;
        if (active) this.el.removeAttribute('data-ray-off');
        else this.el.setAttribute('data-ray-off', '');
        this.el.emit('vr-menu-active', { active }, false);
      }
    },
  });
}

// ---- Icons (same artwork as SceneControlsBar, 24×24 viewBox) --------------------
type IconName = 'building' | 'grid' | 'map' | 'eye' | 'eye-off' | 'exit' | 'menu' | 'close';
function drawIcon(ctx: CanvasRenderingContext2D, name: IconName) {
  const stroke = (d: string) => ctx.stroke(new Path2D(d));
  switch (name) {
    case 'building':
      stroke('M3 21h18M6 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16M9 8h1M9 12h1M12 8h1M12 12h1M16 21V11h3a1 1 0 0 1 1 1v9');
      break;
    case 'grid':
      for (const [x, y] of [[3, 3], [14, 3], [3, 14], [14, 14]]) {
        roundRect(ctx, x, y, 7, 7, 1);
        ctx.stroke();
      }
      break;
    case 'map':
      stroke('M9 4 3 6.2v13.6L9 17.6l6 2.2 6-2.2V6.2L15 8.4 9 6.2Z');
      stroke('M9 4v13.6M15 8.4V22');
      break;
    case 'eye':
      stroke('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z');
      ctx.beginPath();
      ctx.arc(12, 12, 3, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'eye-off':
      stroke('M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 4.2A9.8 9.8 0 0 1 12 4c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.1M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 3-.5');
      break;
    case 'exit':
      stroke('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9');
      break;
    case 'menu':
      stroke('M4 6h16M4 12h16M4 18h16');
      break;
    case 'close':
      stroke('M18 6 6 18M6 6l12 12');
      break;
  }
}

const iconButtonTextures = new Map<string, string>();
function iconButtonTexture(icon: IconName, label: string, w: number, h: number, active: boolean) {
  const key = `${icon}|${label}|${w}|${h}|${active}`;
  const cached = iconButtonTextures.get(key);
  if (cached) return cached;
  const { canvas, ctx } = newCanvas(w, h);
  const cw = canvas.width;
  const ch = canvas.height;
  roundRect(ctx, 3, 3, cw - 6, ch - 6, 16);
  ctx.fillStyle = active ? '#2563eb' : 'rgba(255, 255, 255, 0.08)'; // active = the blue of the 2D bar
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = active ? '#60a5fa' : 'rgba(255, 255, 255, 0.18)';
  ctx.stroke();

  const iconPx = ch * 0.46;
  ctx.save();
  ctx.translate((cw - iconPx) / 2, ch * 0.1);
  ctx.scale(iconPx / 24, iconPx / 24);
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  drawIcon(ctx, icon);
  ctx.restore();

  let size = Math.round(ch * 0.15);
  ctx.font = `700 ${size}px ${FONT}`;
  while (size > 9 && ctx.measureText(label).width > cw - 12) {
    size -= 1;
    ctx.font = `700 ${size}px ${FONT}`;
  }
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cw / 2, ch * 0.8);
  const url = canvas.toDataURL('image/png');
  iconButtonTextures.set(key, url);
  return url;
}

function IconButton({ icon, label, name, x, w, h, active = false, onClick }: {
  icon: IconName; label: string; name: string; x: number; w: number; h: number; active?: boolean; onClick: () => void;
}) {
  const ref = useEntityClick<HTMLElement>(onClick);
  const src = useMemo(() => iconButtonTexture(icon, label, w, h, active), [icon, label, w, h, active]);
  return (
    <a-plane
      ref={ref}
      class="clickable"
      data-name={name}
      vr-layer="order: 3"
      position={`${x} 0 0.005`}
      width={w}
      height={h}
      src={src}
      material="shader: flat; transparent: true"
      animation__enter="property: scale; startEvents: mouseenter; to: 1.1 1.1 1.1; dur: 120; easing: easeOutQuad"
      animation__leave="property: scale; startEvents: mouseleave; to: 1 1 1; dur: 120; easing: easeOutQuad"
    />
  );
}

const pillTextures = new Map<string, string>();
function pillTexture(icon: IconName, label: string, w: number, h: number, active: boolean) {
  const key = `${icon}|${label}|${w}|${h}|${active}`;
  const cached = pillTextures.get(key);
  if (cached) return cached;
  const { canvas, ctx } = newCanvas(w, h);
  const cw = canvas.width;
  const ch = canvas.height;
  roundRect(ctx, 3, 3, cw - 6, ch - 6, (ch - 6) / 2);
  ctx.fillStyle = active ? '#2563eb' : 'rgba(22, 29, 51, 0.94)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = active ? '#60a5fa' : 'rgba(255, 255, 255, 0.35)';
  ctx.stroke();
  ctx.font = `700 ${Math.round(ch * 0.42)}px ${FONT}`;
  const iconPx = ch * 0.5;
  const gap = ch * 0.18;
  const total = iconPx + gap + ctx.measureText(label).width;
  const x0 = (cw - total) / 2;
  ctx.save();
  ctx.translate(x0, (ch - iconPx) / 2);
  ctx.scale(iconPx / 24, iconPx / 24);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  drawIcon(ctx, icon);
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x0 + iconPx + gap, ch / 2 + 1);
  const url = canvas.toDataURL('image/png');
  pillTextures.set(key, url);
  return url;
}

// The clickable area is much bigger than the pill it shows: a small target this
// low is hard to hit — with a controller held at the hip, and impossible in the
// emulator's Play mode, whose two lasers run parallel to the view ~25cm either
// side of center (they'd pass either side of a 20cm button). It's invisible, and
// only catches lasers while the visitor is looking at the menu (vr-menu-follow).
export const MENU_HIT_W = 0.62;
export const MENU_HIT_H = 0.16;
function MenuToggle({ open, active, w, h, onClick }: {
  open: boolean; active: boolean; w: number; h: number; onClick: () => void;
}) {
  const ref = useEntityClick<HTMLElement>(onClick);
  const src = useMemo(() => pillTexture(open ? 'close' : 'menu', open ? 'Tutup' : 'Menu', w, h, open), [open, w, h]);
  return (
    <a-plane
      ref={ref}
      class="clickable"
      data-name="menu-toggle"
      vr-layer="order: 3"
      width={MENU_HIT_W}
      height={MENU_HIT_H}
      material="shader: flat; transparent: true; opacity: 0"
      animation__enter="property: scale; startEvents: mouseenter; to: 1.1 1.1 1.1; dur: 120; easing: easeOutQuad"
      animation__leave="property: scale; startEvents: mouseleave; to: 1 1 1; dur: 120; easing: easeOutQuad"
    >
      <a-plane
        vr-layer="order: 4"
        position="0 0 0.002"
        width={w}
        height={h}
        src={src}
        // Dimmed while lasers pass through it (not looking down at it).
        material={`shader: flat; transparent: true; opacity: ${active ? 1 : 0.55}`}
      />
    </a-plane>
  );
}

export function VRMenuBar({
  expanded,
  onToggleMenu,
  hotspotsVisible,
  open,
  onMainLocation,
  onAllLocations,
  onFloorplan,
  onToggleHotspots,
  onExitVR,
}: {
  expanded: boolean;
  onToggleMenu: () => void;
  hotspotsVisible: boolean;
  open: 'locations' | 'floorplan' | null;
  onMainLocation: () => void;
  onAllLocations: () => void;
  onFloorplan: () => void;
  onToggleHotspots: () => void;
  onExitVR: () => void;
}) {
  const BW = 0.115;
  const BH = 0.105;
  const GAP = 0.016;
  const PAD = 0.025;
  const items = [
    { name: 'menu-main', icon: 'building' as const, label: 'Main Location', onClick: onMainLocation },
    { name: 'menu-locations', icon: 'grid' as const, label: 'All Location', onClick: onAllLocations, active: open === 'locations' },
    { name: 'menu-floorplan', icon: 'map' as const, label: 'Denah', onClick: onFloorplan, active: open === 'floorplan' },
    {
      name: 'menu-hotspots',
      icon: (hotspotsVisible ? 'eye' : 'eye-off') as IconName,
      label: hotspotsVisible ? 'Hide Hotspot' : 'Show Hotspot',
      onClick: onToggleHotspots,
    },
    { name: 'menu-exit', icon: 'exit' as const, label: 'Keluar VR', onClick: onExitVR },
  ];
  const W = items.length * BW + (items.length - 1) * GAP + PAD * 2;
  const H = BH + PAD * 2;
  const [bg] = useState(() => {
    const { canvas, ctx } = newCanvas(W, H);
    roundRect(ctx, 2, 2, canvas.width - 4, canvas.height - 4, 22);
    ctx.fillStyle = 'rgba(22, 29, 51, 0.94)'; // #161d33, the 2D bar's fill
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.stroke();
    return canvas.toDataURL('image/png');
  });
  const PILL_W = 0.24;
  const PILL_H = 0.075;
  const followRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = followRef.current;
    if (!el) return;
    const onActive = (e: Event) => setActive(!!(e as CustomEvent).detail?.active);
    el.addEventListener('vr-menu-active', onActive);
    return () => el.removeEventListener('vr-menu-active', onActive);
  }, []);
  return (
    <a-entity
      ref={followRef}
      // Its area grows to include the bar while the menu is open.
      vr-menu-follow={`regionW: ${expanded ? Math.max(W, MENU_HIT_W) : MENU_HIT_W}; regionBottom: ${-MENU_HIT_H / 2}; regionTop: ${
        expanded ? MENU_HIT_H / 2 + 0.01 + H : MENU_HIT_H / 2
      }`}
      data-ray-off=""
    >
      <MenuToggle open={expanded} active={active} w={PILL_W} h={PILL_H} onClick={onToggleMenu} />
      {expanded && (
        // Opens just above the Menu button's (invisible, larger) hit area.
        <a-entity position={`0 ${MENU_HIT_H / 2 + 0.01 + H / 2} 0`}>
          <CardPlane src={bg} width={W} height={H} blocking={false} />
          {items.map((it, i) => (
            <IconButton
              key={it.name}
              name={it.name}
              icon={it.icon}
              label={it.label}
              x={-W / 2 + PAD + BW / 2 + i * (BW + GAP)}
              w={BW}
              h={BH}
              active={!!it.active}
              onClick={it.onClick}
            />
          ))}
        </a-entity>
      )}
    </a-entity>
  );
}

// ---- Thumbnails --------------------------------------------------------------------
// Room thumbnails are drawn down to a small canvas before becoming textures: the
// API may hand back a full-size image, and every texture costs GPU memory on the
// headset for as long as the panel is open.
const thumbCache = new Map<string, Promise<string | null>>();
function loadThumb(url: string): Promise<string | null> {
  let p = thumbCache.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 384;
          canvas.height = 192;
          const ctx = canvas.getContext('2d')!;
          // cover-fit
          const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
          const w = img.naturalWidth * scale;
          const h = img.naturalHeight * scale;
          ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch {
          resolve(null); // tainted canvas (no CORS) — show the title only
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
    thumbCache.set(url, p);
  }
  return p;
}

function useThumb(url: string | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setSrc(null);
    if (url) loadThumb(url).then((s) => alive && setSrc(s));
    return () => {
      alive = false;
    };
  }, [url]);
  return src;
}

const tileTextures = new Map<string, string>();
function tileTexture(title: string, order: number, active: boolean, w: number, h: number, thumbH: number) {
  const key = `${title}|${order}|${active}|${w}|${h}`;
  const cached = tileTextures.get(key);
  if (cached) return cached;
  const { canvas, ctx } = newCanvas(w, h);
  const cw = canvas.width;
  const ch = canvas.height;
  const th = (thumbH / h) * ch;
  roundRect(ctx, 3, 3, cw - 6, ch - 6, 14);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.save();
  roundRect(ctx, 3, 3, cw - 6, ch - 6, 14);
  ctx.clip();
  ctx.fillStyle = '#0b1222'; // thumbnail placeholder
  ctx.fillRect(0, 0, cw, th);
  ctx.restore();
  ctx.lineWidth = active ? 6 : 2;
  ctx.strokeStyle = active ? '#fbbf24' : 'rgba(255, 255, 255, 0.15)';
  roundRect(ctx, 3, 3, cw - 6, ch - 6, 14);
  ctx.stroke();

  ctx.textBaseline = 'middle';
  const cy = th + (ch - th) / 2;
  ctx.font = `800 20px ${FONT}`;
  ctx.fillStyle = active ? '#fbbf24' : '#94a3b8';
  const num = String(order);
  ctx.fillText(num, 14, cy);
  const numW = ctx.measureText(num).width + 24;
  ctx.font = `700 21px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  let text = title;
  const max = cw - numW - 14;
  while (text.length > 1 && ctx.measureText(text).width > max) text = text.slice(0, -1);
  if (text !== title) text = `${text.slice(0, -1).trimEnd()}…`;
  ctx.fillText(text, numW, cy);
  const url = canvas.toDataURL('image/png');
  tileTextures.set(key, url);
  return url;
}

function RoomTile({ scene, active, x, y, w, h, onClick }: {
  scene: SceneSummary; active: boolean; x: number; y: number; w: number; h: number; onClick: () => void;
}) {
  const ref = useEntityClick<HTMLElement>(onClick);
  const thumbH = h * 0.7;
  const src = useMemo(() => tileTexture(scene.title, scene.order, active, w, h, thumbH), [scene.title, scene.order, active, w, h, thumbH]);
  const thumb = useThumb(scene.thumbnail_url);
  const inset = 0.012;
  return (
    <a-plane
      ref={ref}
      class="clickable"
      data-name={`room-${scene.id}`}
      vr-layer="order: 2"
      position={`${x} ${y} 0.01`}
      width={w}
      height={h}
      src={src}
      material="shader: flat; transparent: true"
      animation__enter="property: scale; startEvents: mouseenter; to: 1.05 1.05 1.05; dur: 120; easing: easeOutQuad"
      animation__leave="property: scale; startEvents: mouseleave; to: 1 1 1; dur: 120; easing: easeOutQuad"
    >
      {thumb && (
        <a-plane
          vr-layer="order: 3"
          position={`0 ${h / 2 - thumbH / 2 - inset / 2} 0.002`}
          width={w - inset * 2}
          height={thumbH - inset}
          src={thumb}
          material="shader: flat; transparent: true"
        />
      )}
    </a-plane>
  );
}

function usePaging<T>(items: T[], perPage: number, startIndex: number) {
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const [page, setPage] = useState(() => Math.min(pages - 1, Math.max(0, Math.floor(startIndex / perPage))));
  const current = Math.min(page, pages - 1);
  return {
    page: current,
    pages,
    slice: items.slice(current * perPage, current * perPage + perPage),
    prev: () => setPage((p) => (p - 1 + pages) % pages),
    next: () => setPage((p) => (p + 1) % pages),
  };
}

function cardWithTitle(W: number, H: number, title: string, subtitle?: string) {
  const { canvas, ctx } = newCanvas(W, H);
  drawCard(ctx, canvas.width, canvas.height);
  ctx.textBaseline = 'top';
  ctx.font = `800 34px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, 42, 40);
  if (subtitle) {
    ctx.font = `600 22px ${FONT}`;
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText(subtitle, canvas.width - 42, 48);
    ctx.textAlign = 'left';
  }
  return { canvas, ctx };
}

// ---- All Location (gallery) ----------------------------------------------------------

export function VRLocationsPanel({ scenes, currentId, onSelect, onClose }: {
  scenes: SceneSummary[]; currentId: string | null; onSelect: (id: string) => void; onClose: () => void;
}) {
  const COLS = 4;
  const ROWS = 3;
  const TW = 0.43;
  const TH = 0.3;
  const GAP = 0.04;
  const pad = 0.085;
  const HEAD = 0.13;
  const W = COLS * TW + (COLS - 1) * GAP + pad * 2;
  const gridH = ROWS * TH + (ROWS - 1) * GAP;
  const H = pad + HEAD + gridH + 0.05 + 0.12 + pad;
  const { page, pages, slice, prev, next } = usePaging(scenes, COLS * ROWS, Math.max(0, scenes.findIndex((s) => s.id === currentId)));

  const card = useMemo(() => {
    const { canvas } = cardWithTitle(W, H, 'Semua Lokasi', pages > 1 ? `Halaman ${page + 1} / ${pages}` : undefined);
    return canvas.toDataURL('image/png');
  }, [W, H, page, pages]);

  const top = H / 2;
  const btnY = -H / 2 + pad + 0.06;
  return (
    <PanelRoot>
      <CardPlane src={card} width={W} height={H} />
      {slice.map((s, i) => {
        const c = i % COLS;
        const r = Math.floor(i / COLS);
        return (
          <RoomTile
            key={s.id}
            scene={s}
            active={s.id === currentId}
            x={-W / 2 + pad + TW / 2 + c * (TW + GAP)}
            y={top - pad - HEAD - TH / 2 - r * (TH + GAP)}
            w={TW}
            h={TH}
            onClick={() => onSelect(s.id)}
          />
        );
      })}
      {pages > 1 && (
        <>
          <VRButton name="page-prev" label="‹ Sebelumnya" x={-W / 2 + pad + 0.24} y={btnY} width={0.48} onClick={prev} />
          <VRButton name="page-next" label="Berikutnya ›" x={-W / 2 + pad + 0.78} y={btnY} width={0.48} onClick={next} />
        </>
      )}
      <VRButton name="close" label="Tutup" x={W / 2 - pad - 0.2} y={btnY} width={0.4} primary onClick={onClose} />
    </PanelRoot>
  );
}

// ---- Denah (floor plan) -------------------------------------------------------------

const pinTextures = new Map<string, string>();
function pinTexture(order: number, active: boolean, size: number) {
  const key = `${order}|${active}|${size}`;
  const cached = pinTextures.get(key);
  if (cached) return cached;
  const { canvas, ctx } = newCanvas(size, size);
  const c = canvas.width / 2;
  ctx.beginPath();
  ctx.arc(c, c, c - 4, 0, Math.PI * 2);
  ctx.fillStyle = active ? '#fbbf24' : 'rgba(0, 0, 0, 0.7)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = active ? '#ffffff' : 'rgba(255, 255, 255, 0.75)';
  ctx.stroke();
  ctx.font = `800 ${Math.round(c * 0.9)}px ${FONT}`;
  ctx.fillStyle = active ? '#0a1226' : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(order), c, c + 1);
  const url = canvas.toDataURL('image/png');
  pinTextures.set(key, url);
  return url;
}

function MapPin({ scene, active, x, y, onClick }: {
  scene: SceneSummary; active: boolean; x: number; y: number; onClick: () => void;
}) {
  const ref = useEntityClick<HTMLElement>(onClick);
  const size = 0.075;
  const src = useMemo(() => pinTexture(scene.order, active, size), [scene.order, active]);
  return (
    <a-plane
      ref={ref}
      class="clickable"
      data-name={`pin-${scene.id}`}
      vr-layer="order: 3"
      position={`${x} ${y} 0.01`}
      width={size}
      height={size}
      src={src}
      material="shader: flat; transparent: true"
      animation__enter="property: scale; startEvents: mouseenter; to: 1.3 1.3 1.3; dur: 120; easing: easeOutQuad"
      animation__leave="property: scale; startEvents: mouseleave; to: 1 1 1; dur: 120; easing: easeOutQuad"
    />
  );
}

export function VRFloorplanPanel({ scenes, currentId, onSelect, onClose }: {
  scenes: SceneSummary[]; currentId: string | null; onSelect: (id: string) => void; onClose: () => void;
}) {
  const W = 2.0;
  const pad = 0.085;
  const HEAD = 0.13;
  const LIST_W = 0.66;
  const ROW_H = 0.085;
  const ROW_GAP = 0.014;
  const PER_PAGE = 8;
  const listH = PER_PAGE * ROW_H + (PER_PAGE - 1) * ROW_GAP;
  const H = pad + HEAD + listH + 0.05 + 0.12 + pad;
  const MAP_X = pad + LIST_W + 0.06; // from the left edge
  const MAP_W = W - MAP_X - pad;
  const MAP_H = listH;
  const withCoords = scenes.filter((s) => s.map_x != null && s.map_y != null);
  const { page, pages, slice, prev, next } = usePaging(scenes, PER_PAGE, Math.max(0, scenes.findIndex((s) => s.id === currentId)));

  const card = useMemo(() => {
    const { canvas, ctx } = cardWithTitle(W, H, 'Denah Museum');
    const px = (m: number) => m * 600;
    // List header
    ctx.textBaseline = 'top';
    ctx.font = `700 18px ${FONT}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText('DAFTAR LOKASI', px(pad), px(pad + HEAD - 0.045));
    if (pages > 1) {
      ctx.textAlign = 'right';
      ctx.fillText(`${page + 1} / ${pages}`, px(pad + LIST_W), px(pad + HEAD - 0.045));
      ctx.textAlign = 'left';
    }
    // Map surface: navy fill + faint grid (same look as the 2D floor plan)
    const mx = px(MAP_X);
    const my = px(pad + HEAD);
    const mw = px(MAP_W);
    const mh = px(MAP_H);
    roundRect(ctx, mx, my, mw, mh, 16);
    ctx.fillStyle = '#0a1428';
    ctx.fill();
    ctx.save();
    roundRect(ctx, mx, my, mw, mh, 16);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 1;
    for (let gx = mx; gx < mx + mw; gx += 30) {
      ctx.beginPath();
      ctx.moveTo(gx, my);
      ctx.lineTo(gx, my + mh);
      ctx.stroke();
    }
    for (let gy = my; gy < my + mh; gy += 30) {
      ctx.beginPath();
      ctx.moveTo(mx, gy);
      ctx.lineTo(mx + mw, gy);
      ctx.stroke();
    }
    ctx.restore();
    roundRect(ctx, mx, my, mw, mh, 16);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // "Lantai 1" tag
    ctx.font = `600 18px ${FONT}`;
    roundRect(ctx, mx + 16, my + 16, ctx.measureText('Lantai 1').width + 24, 34, 8);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textBaseline = 'middle';
    ctx.fillText('Lantai 1', mx + 28, my + 33);
    ctx.textAlign = 'center';
    if (withCoords.length === 0) {
      ctx.font = `400 24px ${FONT}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillText('Peta denah interaktif menyusul.', mx + mw / 2, my + mh / 2 - 16);
      ctx.font = `400 19px ${FONT}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillText('Sementara ini, pilih lokasi dari daftar di samping.', mx + mw / 2, my + mh / 2 + 18);
    } else {
      // Legend: amber dot = you are here, ringed dot = other rooms
      ctx.font = `500 19px ${FONT}`;
      ctx.textAlign = 'left';
      const ly = my + mh - 28;
      const a = 'Lokasi Anda';
      const b = 'Titik Lokasi';
      const total = 22 + ctx.measureText(a).width + 36 + 22 + ctx.measureText(b).width;
      let lx = mx + (mw - total) / 2;
      ctx.beginPath();
      ctx.arc(lx + 8, ly, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText(a, lx + 22, ly);
      lx += 22 + ctx.measureText(a).width + 36;
      ctx.beginPath();
      ctx.arc(lx + 8, ly, 7, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.stroke();
      ctx.fillText(b, lx + 22, ly);
    }
    ctx.textAlign = 'left';
    return canvas.toDataURL('image/png');
    // withCoords.length is all the map drawing depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pages, withCoords.length]);

  const left = -W / 2;
  const top = H / 2;
  const btnY = -H / 2 + pad + 0.06;
  return (
    <PanelRoot>
      <CardPlane src={card} width={W} height={H} />
      {slice.map((s, i) => (
        <VRButton
          key={s.id}
          name={`room-${s.id}`}
          label={`${s.order}.  ${s.title}`}
          x={left + pad + LIST_W / 2}
          y={top - pad - HEAD - ROW_H / 2 - i * (ROW_H + ROW_GAP)}
          width={LIST_W}
          height={ROW_H}
          active={s.id === currentId}
          onClick={() => onSelect(s.id)}
        />
      ))}
      {withCoords.map((s) => (
        <MapPin
          key={s.id}
          scene={s}
          active={s.id === currentId}
          x={left + MAP_X + (MAP_W * (s.map_x as number)) / 100}
          y={top - pad - HEAD - (MAP_H * (s.map_y as number)) / 100}
          onClick={() => onSelect(s.id)}
        />
      ))}
      {pages > 1 && (
        <>
          <VRButton name="page-prev" label="‹" x={left + pad + 0.06} y={btnY} width={0.12} onClick={prev} />
          <VRButton name="page-next" label="›" x={left + pad + 0.2} y={btnY} width={0.12} onClick={next} />
        </>
      )}
      <VRButton name="close" label="Tutup" x={W / 2 - pad - 0.2} y={btnY} width={0.4} primary onClick={onClose} />
    </PanelRoot>
  );
}
