// Animated illustrations for the VR guide — vector drawings (hands, Quest Touch
// controllers, lasers, hotspots, the Menu button) drawn on a canvas every frame.
// No image/video assets: nothing to download in the headset, same visual style
// as the tour, and easy to tweak.
//
// Every scene is drawn in a 100×100 coordinate space (the canvas is scaled to
// fit) and loops; `t` is the time in seconds.

import type { GuideArt } from '@/lib/vrGuide';

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

const C = {
  bg: '#0b1222',
  grid: 'rgba(255,255,255,0.045)',
  amber: '#fbbf24',
  amberSoft: 'rgba(251,191,36,0.35)',
  white: '#f8fafc',
  muted: '#94a3b8',
  dim: '#64748b',
  navy: '#161d33',
  skin: '#e8eefc',
  skinEdge: '#7c8aa5',
  body: '#eef2f7',
  bodyEdge: '#5b6678',
  face: '#1e293b',
  blue: '#2563eb',
};
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// ---- timing helpers ------------------------------------------------------------
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
/** 0→1 over [a, b] (eased). */
const ramp = (p: number, a: number, b: number) => smooth((p - a) / (b - a));
/** 0→1→0 over [a, b]. */
const bump = (p: number, a: number, b: number) => {
  const x = clamp01((p - a) / (b - a));
  return Math.sin(x * Math.PI);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpPt = (a: Pt, b: Pt, k: number): Pt => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function label(ctx: Ctx, text: string, x: number, y: number, size = 4.2, color: string = C.white, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

// ---- building blocks -------------------------------------------------------------

function background(ctx: Ctx) {
  rrect(ctx, 0.5, 0.5, 99, 99, 6);
  ctx.fillStyle = C.bg;
  ctx.fill();
  ctx.save();
  rrect(ctx, 0.5, 0.5, 99, 99, 6);
  ctx.clip();
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 0.3;
  for (let i = 5; i < 100; i += 5) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 100);
    ctx.moveTo(0, i);
    ctx.lineTo(100, i);
    ctx.stroke();
  }
  ctx.restore();
  rrect(ctx, 0.5, 0.5, 99, 99, 6);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

/** Perspective floor band at the bottom (for the "move" scenes). */
function floor(ctx: Ctx) {
  const g = ctx.createLinearGradient(0, 55, 0, 100);
  g.addColorStop(0, 'rgba(148,163,184,0)');
  g.addColorStop(1, 'rgba(148,163,184,0.18)');
  ctx.fillStyle = g;
  ctx.fillRect(1, 55, 98, 44);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.3;
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath();
    ctx.moveTo(50 + i * 4, 55);
    ctx.lineTo(50 + i * 16, 100);
    ctx.stroke();
  }
}

type CoinIcon = 'arrow' | 'info' | 'door';
/** The tour's hotspot coin (dark disc, white rim, glow); `squash` < 1 lays it on the floor. */
function coin(ctx: Ctx, x: number, y: number, r: number, icon: CoinIcon, hover = 0, ripple = 0, squash = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, squash);
  const s = 1 + 0.18 * hover;
  ctx.scale(s, s);
  if (ripple > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, r * (1.1 + ripple * 0.9), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(251,191,36,${0.8 * (1 - ripple)})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  const glow = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.6);
  glow.addColorStop(0, 'rgba(255,255,255,0.35)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createRadialGradient(0, -r * 0.1, 0, 0, 0, r);
  body.addColorStop(0, '#3a3a3a');
  body.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hover > 0.5 ? C.amber : 'rgba(255,255,255,0.92)';
  ctx.lineWidth = r * 0.14;
  ctx.stroke();
  ctx.fillStyle = C.white;
  if (icon === 'arrow') {
    const k = r * 0.06;
    ctx.beginPath();
    ctx.moveTo(0, -9 * k);
    ctx.lineTo(9 * k, 7 * k);
    ctx.lineTo(0, 2.8 * k);
    ctx.lineTo(-9 * k, 7 * k);
    ctx.closePath();
    ctx.fill();
  } else if (icon === 'info') {
    ctx.beginPath();
    ctx.arc(0, -r * 0.34, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
    rrect(ctx, -r * 0.1, -r * 0.08, r * 0.2, r * 0.52, r * 0.1);
    ctx.fill();
  } else {
    rrect(ctx, -r * 0.25, -r * 0.42, r * 0.5, r * 0.84, r * 0.08);
    ctx.fill();
  }
  ctx.restore();
}

/** A laser from `a` toward `b`, grown to `grow` (0..1); amber when it's on target. */
function laser(ctx: Ctx, a: Pt, b: Pt, grow = 1, onTarget = false) {
  const end = lerpPt(a, b, grow);
  const g = ctx.createLinearGradient(a[0], a[1], end[0], end[1]);
  const col = onTarget ? '251,191,36' : '255,255,255';
  g.addColorStop(0, `rgba(${col},0.25)`);
  g.addColorStop(1, `rgba(${col},0.95)`);
  ctx.strokeStyle = g;
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(end[0], end[1]);
  ctx.stroke();
  if (onTarget && grow >= 1) {
    ctx.fillStyle = C.amber;
    ctx.beginPath();
    ctx.arc(end[0], end[1], 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Quest Touch controller, seen from above-behind. Returns where its laser starts.
 * trigger / face / meta: 0..1 highlight (pressed) amounts.
 */
function controller(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  o: { side?: 'left' | 'right'; trigger?: number; face?: number; meta?: number; tilt?: number } = {},
): Pt {
  const side = o.side ?? 'right';
  const m = side === 'right' ? 1 : -1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(((o.tilt ?? -18) * m * Math.PI) / 180);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  // handle (behind)
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.bodyEdge;
  ctx.lineWidth = 12.6;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(2 * m, 24);
  ctx.stroke();
  ctx.strokeStyle = C.body;
  ctx.lineWidth = 11;
  ctx.stroke();
  // trigger (front, under the index finger)
  const tp = o.trigger ?? 0;
  rrect(ctx, -4, -14 + tp * 1.2, 8, 5, 2.2);
  ctx.fillStyle = tp > 0.05 ? C.amber : '#cbd5e1';
  ctx.fill();
  ctx.strokeStyle = C.bodyEdge;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  if (tp > 0.05) {
    ctx.strokeStyle = `rgba(251,191,36,${0.6 * tp})`;
    ctx.lineWidth = 1.2;
    rrect(ctx, -6, -16 + tp * 1.2, 12, 9, 3.5);
    ctx.stroke();
  }
  // head (face plate)
  ctx.beginPath();
  ctx.ellipse(0, -2, 13, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.body;
  ctx.fill();
  ctx.strokeStyle = C.bodyEdge;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -2, 10.5, 7.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.face;
  ctx.fill();
  // thumbstick
  ctx.beginPath();
  ctx.arc(-4 * m, -2, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#334155';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-4 * m, -2, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = '#475569';
  ctx.fill();
  // face buttons: upper (B / Y) and lower (A / X)
  const fp = o.face ?? 0;
  const upper = side === 'right' ? 'B' : 'Y';
  const lower = side === 'right' ? 'A' : 'X';
  const btn = (bx: number, by: number, txt: string, lit: number) => {
    ctx.beginPath();
    ctx.arc(bx, by, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = lit > 0.05 ? C.amber : '#475569';
    ctx.fill();
    if (lit > 0.05) {
      ctx.beginPath();
      ctx.arc(bx, by, 2.2 + 2.5 * lit, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(251,191,36,${0.7 * lit})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    label(ctx, txt, bx, by + 0.1, 2.4, lit > 0.05 ? C.face : C.white, 800);
  };
  btn(4.5 * m, -5, upper, fp);
  btn(5.5 * m, 1, lower, 0);
  // Meta / menu button on the handle
  const mp = o.meta ?? 0;
  ctx.beginPath();
  ctx.arc(0.6 * m, 8, 1.4, 0, Math.PI * 2);
  ctx.fillStyle = mp > 0.05 ? C.amber : '#94a3b8';
  ctx.fill();
  if (mp > 0.05) {
    ctx.beginPath();
    ctx.arc(0.6 * m, 8, 1.4 + 2.5 * mp, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(251,191,36,${0.7 * mp})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.restore();
  // laser origin: the front tip, in canvas space
  const ang = ((o.tilt ?? -18) * m * Math.PI) / 180;
  return [x + Math.sin(ang) * 14 * s, y - Math.cos(ang) * 14 * s];
}

type HandPose = 'open' | 'point' | 'pinch';
/**
 * Stylized hand, back of the hand toward the viewer, fingers up. `k` blends from
 * the open hand (0) to `pose` (1). Returns the index fingertip position.
 */
function hand(ctx: Ctx, x: number, y: number, s: number, pose: HandPose, k: number, side: 'left' | 'right' = 'right', rot = 0): Pt {
  const m = side === 'right' ? 1 : -1;
  // finger [base, open-tip, posed-tip], in hand space (palm center ~ 0,4; up = -y)
  type F = { base: Pt; open: Pt; posed: Pt; w: number };
  const thumbBase: Pt = [-8, 8];
  const fingers: Record<string, F> = {
    index: { base: [-5.5, -4], open: [-7, -22], posed: pose === 'point' ? [-6.5, -24] : [-12.5, -10], w: 4.2 },
    middle: { base: [-1.6, -5], open: [-1.5, -24], posed: pose === 'point' ? [-1.5, -6] : [-3, -15], w: 4.4 },
    ring: { base: [2.4, -4.5], open: [3.5, -22], posed: pose === 'point' ? [2.5, -5.5] : [3, -13], w: 4.1 },
    pinky: { base: [6.2, -3], open: [8.5, -17], posed: pose === 'point' ? [6, -3.5] : [8, -10], w: 3.6 },
    thumb: { base: thumbBase, open: [-17, -4], posed: pose === 'point' ? [-5, -1] : [-12.5, -9], w: 4.8 },
  };
  const toCanvas = (p: Pt): Pt => {
    const px = p[0] * m;
    const c = Math.cos(rot);
    const sn = Math.sin(rot);
    return [x + (px * c - p[1] * sn) * s, y + (px * sn + p[1] * c) * s];
  };
  const drawFinger = (f: F) => {
    const tip = lerpPt(f.open, f.posed, k);
    const b = toCanvas(f.base);
    const t = toCanvas(tip);
    // bend: control point pushed sideways a little (knuckle)
    const mid: Pt = [(b[0] + t[0]) / 2, (b[1] + t[1]) / 2];
    const dx = t[0] - b[0];
    const dy = t[1] - b[1];
    const len = Math.hypot(dx, dy) || 1;
    const bend = 1.2 * s;
    const ctrl: Pt = [mid[0] - (dy / len) * bend * m, mid[1] + (dx / len) * bend * m];
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.quadraticCurveTo(ctrl[0], ctrl[1], t[0], t[1]);
    ctx.strokeStyle = C.skinEdge;
    ctx.lineWidth = (f.w + 1.1) * s;
    ctx.stroke();
    ctx.strokeStyle = C.skin;
    ctx.lineWidth = f.w * s;
    ctx.stroke();
    return t;
  };
  // fingers behind the palm, thumb in front
  drawFinger(fingers.pinky);
  drawFinger(fingers.ring);
  drawFinger(fingers.middle);
  const indexTip = drawFinger(fingers.index);
  // palm + wrist
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(m * s, s);
  rrect(ctx, -8.5, -6.5, 17, 18, 6);
  ctx.fillStyle = C.skin;
  ctx.fill();
  ctx.strokeStyle = C.skinEdge;
  ctx.lineWidth = 1.1 / s;
  ctx.stroke();
  rrect(ctx, -5.5, 10, 11, 9, 3);
  ctx.fill();
  ctx.stroke();
  // knuckle hints
  ctx.strokeStyle = 'rgba(124,138,165,0.5)';
  ctx.lineWidth = 0.6 / s;
  ctx.beginPath();
  ctx.moveTo(-6, -3);
  ctx.quadraticCurveTo(0, -5.5, 6, -3);
  ctx.stroke();
  ctx.restore();
  drawFinger(fingers.thumb);
  return indexTip;
}

function menuPill(ctx: Ctx, x: number, y: number, s: number, lit = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  rrect(ctx, -11, -3.6, 22, 7.2, 3.6);
  ctx.fillStyle = lit > 0.5 ? C.blue : C.navy;
  ctx.fill();
  ctx.strokeStyle = lit > 0.5 ? '#60a5fa' : 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 0.6;
  ctx.lineCap = 'round';
  for (const dy of [-1.4, 0, 1.4]) {
    ctx.beginPath();
    ctx.moveTo(-7.5, dy);
    ctx.lineTo(-4.5, dy);
    ctx.stroke();
  }
  label(ctx, 'Menu', 2, 0.2, 3.4);
  ctx.restore();
}

/** The open menu bar (6 icon buttons); `hi` = index of the highlighted one. */
function menuBar(ctx: Ctx, x: number, y: number, s: number, appear: number, hi = -1) {
  if (appear <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (0.85 + 0.15 * appear), s * (0.85 + 0.15 * appear));
  ctx.globalAlpha = appear;
  rrect(ctx, -33, -6, 66, 12, 3);
  ctx.fillStyle = 'rgba(22,29,51,0.96)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.4;
  ctx.stroke();
  const names = ['Main', 'Lokasi', 'Denah', 'Hotspot', 'Panduan', 'Keluar VR'];
  names.forEach((n, i) => {
    const bx = -27.5 + i * 11;
    rrect(ctx, bx - 4.8, -4.6, 9.6, 9.2, 1.8);
    ctx.fillStyle = i === hi ? C.blue : 'rgba(255,255,255,0.08)';
    ctx.fill();
    label(ctx, n, bx, 0.3, n.length > 6 ? 1.75 : 2.2, C.white, 700);
  });
  ctx.restore();
}

/** Small info panel with a photo, text lines and a "Tutup" button. */
function miniPanel(ctx: Ctx, x: number, y: number, w: number, h: number, appear: number, btnLit = 0, btnPress = 0) {
  if (appear <= 0) return { btn: [x + w * 0.32, y + h * 0.36] as Pt };
  ctx.save();
  ctx.translate(x, y);
  const sc = 0.8 + 0.2 * appear;
  ctx.scale(sc, sc);
  ctx.globalAlpha = appear;
  rrect(ctx, -w / 2, -h / 2, w, h, 2.5);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 0.4;
  ctx.stroke();
  ctx.fillStyle = C.amber;
  ctx.fillRect(-w / 2 + 1, -h / 2 + 0.3, w - 2, 0.8);
  // photo
  rrect(ctx, -w / 2 + 3, -h / 2 + 4, w * 0.4, h * 0.55, 1.5);
  ctx.fillStyle = '#334155';
  ctx.fill();
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 4, -h / 2 + 4 + h * 0.5);
  ctx.lineTo(-w / 2 + 3 + w * 0.15, -h / 2 + 4 + h * 0.25);
  ctx.lineTo(-w / 2 + 3 + w * 0.38, -h / 2 + 4 + h * 0.5);
  ctx.closePath();
  ctx.fill();
  // text lines
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  rrect(ctx, -w / 2 + 6 + w * 0.4, -h / 2 + 4.5, w * 0.38, 2.2, 1);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 4; i++) {
    rrect(ctx, -w / 2 + 6 + w * 0.4, -h / 2 + 9 + i * 3.2, w * (i === 3 ? 0.25 : 0.42), 1.4, 0.7);
    ctx.fill();
  }
  // button
  const bw = w * 0.3;
  const bh = 5.5;
  const bx = w / 2 - bw - 3;
  const by = h / 2 - bh - 3 + btnPress * 0.6;
  rrect(ctx, bx, by, bw, bh, bh / 2);
  ctx.fillStyle = btnLit > 0.5 ? '#fcd34d' : C.amber;
  ctx.fill();
  if (btnLit > 0.05) {
    rrect(ctx, bx - 1.2, by - 1.2, bw + 2.4, bh + 2.4, bh / 2 + 1.2);
    ctx.strokeStyle = `rgba(251,191,36,${0.8 * btnLit})`;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  label(ctx, 'Tutup', bx + bw / 2, by + bh / 2 + 0.2, 2.8, C.face, 800);
  ctx.restore();
  return { btn: [x + (bx + bw / 2) * sc, y + (by + bh / 2) * sc] as Pt };
}

function metaLogo(ctx: Ctx, x: number, y: number, r: number, lit = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = lit > 0.5 ? C.amber : C.navy;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 0.4;
  ctx.stroke();
  // infinity loop
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const d = 1 + Math.sin(a) * Math.sin(a);
    const px = (r * 0.62 * Math.cos(a)) / d;
    const py = (r * 0.62 * Math.sin(a) * Math.cos(a)) / d;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = lit > 0.5 ? C.face : C.white;
  ctx.lineWidth = r * 0.16;
  ctx.stroke();
  ctx.restore();
}

function caption(ctx: Ctx, text: string, lit = false) {
  let size = 4.4;
  ctx.font = `700 ${size}px ${FONT}`;
  while (size > 3 && ctx.measureText(text).width > 86) {
    size -= 0.1;
    ctx.font = `700 ${size}px ${FONT}`;
  }
  const w = ctx.measureText(text).width + 8;
  rrect(ctx, 50 - w / 2, 88, w, 7.5, 3.75);
  ctx.fillStyle = lit ? C.amber : 'rgba(0,0,0,0.45)';
  ctx.fill();
  label(ctx, text, 50, 91.9, size, lit ? C.face : C.white);
}

// ---- scenes ----------------------------------------------------------------------

function sceneWelcome(ctx: Ctx, t: number) {
  const bob = Math.sin(t * 1.6) * 1.5;
  // headset
  ctx.save();
  ctx.translate(50, 44 + bob);
  ctx.strokeStyle = C.dim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, -2, 30, 15, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  rrect(ctx, -24, -12, 48, 24, 10);
  ctx.fillStyle = C.body;
  ctx.fill();
  ctx.strokeStyle = C.bodyEdge;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  rrect(ctx, -21, -9, 42, 18, 8);
  const visor = ctx.createLinearGradient(-21, -9, 21, 9);
  visor.addColorStop(0, '#1e293b');
  visor.addColorStop(1, '#0f172a');
  ctx.fillStyle = visor;
  ctx.fill();
  // sensors
  ctx.fillStyle = '#334155';
  for (const sx of [-14, 14]) {
    ctx.beginPath();
    ctx.arc(sx, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // sheen sweep
  const sx = ((t * 30) % 90) - 45;
  const sheen = ctx.createLinearGradient(sx - 6, 0, sx + 6, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  rrect(ctx, -21, -9, 42, 18, 8);
  ctx.fill();
  ctx.restore();
  // sparkles
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * 0.4;
    const tw = (Math.sin(t * 3 + i * 1.7) + 1) / 2;
    const px = 50 + Math.cos(a) * 36;
    const py = 44 + Math.sin(a) * 22;
    ctx.fillStyle = `rgba(251,191,36,${0.25 + 0.6 * tw})`;
    ctx.beginPath();
    ctx.moveTo(px, py - 2 - tw * 1.5);
    ctx.lineTo(px + 0.7, py - 0.7);
    ctx.lineTo(px + 2 + tw * 1.5, py);
    ctx.lineTo(px + 0.7, py + 0.7);
    ctx.lineTo(px, py + 2 + tw * 1.5);
    ctx.lineTo(px - 0.7, py + 0.7);
    ctx.lineTo(px - 2 - tw * 1.5, py);
    ctx.lineTo(px - 0.7, py - 0.7);
    ctx.closePath();
    ctx.fill();
  }
  label(ctx, 'MODE VR', 50, 76, 6, C.white, 800);
  label(ctx, 'Museum Anatomi FK UB', 50, 83, 3.8, C.muted, 600);
}

function sceneLook(ctx: Ctx, t: number) {
  // top-down: you in the middle of the 360° room, view cone sweeping left/right
  const cx = 50;
  const cy = 50;
  ctx.setLineDash([1.5, 1.5]);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, '360°', cx, cy - 38, 3.6, C.muted, 700);
  const yaw = Math.sin(t * 0.9) * 1.25; // radians
  const dir = -Math.PI / 2 + yaw;
  ctx.fillStyle = C.amberSoft;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, 33, dir - 0.5, dir + 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.amber;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, 33, dir - 0.5, dir + 0.5);
  ctx.stroke();
  // head seen from above, headset on the face side (toward the view)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(yaw);
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#475569';
  ctx.fill();
  ctx.strokeStyle = C.bodyEdge;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.strokeStyle = C.dim; // strap
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 8.4, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  rrect(ctx, -7.5, -12, 15, 6.5, 2.8); // headset
  ctx.fillStyle = C.body;
  ctx.fill();
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = C.bodyEdge;
  ctx.stroke();
  ctx.restore();
  // turning arrows
  const arrow = (sgn: number) => {
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const a0 = -Math.PI / 2 + sgn * 0.75;
    const a1 = -Math.PI / 2 + sgn * 1.35;
    ctx.arc(cx, cy, 18, Math.min(a0, a1), Math.max(a0, a1));
    ctx.stroke();
    const ex = cx + Math.cos(a1) * 18;
    const ey = cy + Math.sin(a1) * 18;
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.arc(ex, ey, 1.2, 0, Math.PI * 2);
    ctx.fill();
  };
  arrow(-1);
  arrow(1);
  caption(ctx, 'Putar kepala / badan');
}

/** Shared timeline for "aim, then click" scenes. */
function aimTimeline(t: number, period = 3.2) {
  const p = (t % period) / period;
  return { p, grow: ramp(p, 0.05, 0.3), on: p > 0.3, press: bump(p, 0.48, 0.66), ripple: clamp01((p - 0.55) / 0.35) };
}

function sceneControllerSelect(ctx: Ctx, t: number) {
  const { grow, on, press, ripple } = aimTimeline(t);
  const target: Pt = [70, 30];
  coin(ctx, target[0], target[1], 9, 'info', on ? 1 : 0, ripple > 0 && ripple < 1 ? ripple : 0);
  const tip = controller(ctx, 34, 70, 1.25, { trigger: press, tilt: 32 });
  laser(ctx, tip, target, grow, on);
  if (press > 0.2) label(ctx, 'klik!', target[0], target[1] - 15, 4, C.amber, 800);
  caption(ctx, 'Bidik + tekan TRIGGER', press > 0.2);
}

function sceneControllerMove(ctx: Ctx, t: number) {
  floor(ctx);
  const { p, grow, on, press, ripple } = aimTimeline(t);
  const target: Pt = [64, 66];
  const fade = 1 - ramp(p, 0.75, 0.95);
  ctx.globalAlpha = fade;
  coin(ctx, target[0], target[1], 9, 'arrow', on ? 1 : 0, ripple > 0 && ripple < 1 ? ripple : 0, 0.45);
  ctx.globalAlpha = 1;
  const tip = controller(ctx, 28, 62, 1.2, { trigger: press, tilt: 48 });
  if (fade > 0.05) laser(ctx, tip, target, grow, on);
  if (p > 0.72) label(ctx, '→ ruangan berikutnya', 50, 30, 4.6, C.amber, 800);
  caption(ctx, 'Bidik panah di lantai + TRIGGER', press > 0.2);
}

function sceneControllerInfo(ctx: Ctx, t: number) {
  const period = 5;
  const p = (t % period) / period;
  const target: Pt = [74, 22];
  const open = ramp(p, 0.3, 0.4) * (1 - ramp(p, 0.86, 0.94));
  // phase 1 (0–0.4): aim at the (i), click → panel opens; phase 2: aim at Tutup, click → closes
  const press1 = bump(p, 0.18, 0.28);
  const press2 = bump(p, 0.7, 0.8);
  coin(ctx, target[0], target[1], 7, 'info', p < 0.32 && p > 0.1 ? 1 : 0);
  const panel = miniPanel(ctx, 56, 52, 52, 32, open, p > 0.55 && p < 0.86 ? 1 : 0, press2);
  const tip = controller(ctx, 22, 76, 1.05, { trigger: Math.max(press1, press2), tilt: 30 });
  if (p < 0.32) laser(ctx, tip, target, ramp(p, 0.02, 0.12), p > 0.1);
  else if (p > 0.45 && p < 0.86) laser(ctx, tip, panel.btn, ramp(p, 0.45, 0.55), p > 0.55);
  caption(ctx, p < 0.45 ? 'Pilih ikon (i)' : 'Pilih "Tutup" untuk menutup', press1 > 0.2 || press2 > 0.2);
}

function sceneControllerMenu(ctx: Ctx, t: number) {
  const period = 3.6;
  const p = (t % period) / period;
  const press = bump(p, 0.15, 0.32);
  const open = ramp(p, 0.28, 0.4) * (1 - ramp(p, 0.88, 0.97));
  controller(ctx, 28, 66, 1.15, { side: 'left', face: press, tilt: -10 });
  menuPill(ctx, 26, 42 - Math.sin(t * 2) * 0.6, 1, open > 0.5 ? 1 : 0);
  controller(ctx, 72, 66, 1.15, { side: 'right', face: press, tilt: 10 });
  menuBar(ctx, 50, 20, 1.15, open);
  caption(ctx, 'Tekan B atau Y', press > 0.2);
}

function sceneControllerFinish(ctx: Ctx, t: number) {
  const period = 4;
  const p = (t % period) / period;
  menuBar(ctx, 50, 24, 1.2, 1, p < 0.5 ? 5 : -1);
  label(ctx, 'atau', 50, 44, 3.8, C.muted, 600);
  const meta = p >= 0.5 ? bump(p, 0.55, 0.9) : 0;
  controller(ctx, 50, 68, 1.25, { side: 'right', meta, tilt: 0 });
  caption(ctx, p < 0.5 ? 'Menu → Keluar VR' : 'Tombol Meta (controller kanan)', true);
}

function sceneHandSelect(ctx: Ctx, t: number) {
  const { grow, on, press, ripple } = aimTimeline(t);
  const target: Pt = [70, 28];
  coin(ctx, target[0], target[1], 9, 'info', on ? 1 : 0, ripple > 0 && ripple < 1 ? ripple : 0);
  const origin: Pt = [38, 52];
  laser(ctx, origin, target, grow, on);
  hand(ctx, 34, 70, 1.1, 'pinch', press, 'right', 0.25);
  if (press > 0.6) {
    ctx.fillStyle = `rgba(251,191,36,${press})`;
    ctx.beginPath();
    ctx.arc(26.5, 61, 2.2 * press, 0, Math.PI * 2);
    ctx.fill();
  }
  caption(ctx, 'Bidik + CUBIT (ibu jari + telunjuk)', press > 0.3);
}

function sceneHandMove(ctx: Ctx, t: number) {
  floor(ctx);
  const { p, grow, on, press, ripple } = aimTimeline(t);
  const target: Pt = [66, 68];
  const fade = 1 - ramp(p, 0.75, 0.95);
  ctx.globalAlpha = fade;
  coin(ctx, target[0], target[1], 9, 'arrow', on ? 1 : 0, ripple > 0 && ripple < 1 ? ripple : 0, 0.45);
  ctx.globalAlpha = 1;
  const origin: Pt = [34, 50];
  if (fade > 0.05) laser(ctx, origin, target, grow, on);
  hand(ctx, 28, 66, 1.05, 'pinch', press, 'right', 0.45);
  if (p > 0.72) label(ctx, '→ ruangan berikutnya', 50, 28, 4.6, C.amber, 800);
  caption(ctx, 'Arahkan ke panah + CUBIT', press > 0.3);
}

function sceneHandInfo(ctx: Ctx, t: number) {
  const period = 3.4;
  const p = (t % period) / period;
  const contact = bump(p, 0.42, 0.62);
  const lit = p > 0.3 && p < 0.7 ? 1 : 0;
  const panel = miniPanel(ctx, 50, 27, 64, 38, 1, lit, contact);
  // index fingertip travels in to the button and back out
  const approach = ramp(p, 0.1, 0.45) * (1 - ramp(p, 0.62, 0.9));
  const s = 0.9;
  const handPos = lerpPt([74, 78], [panel.btn[0] + 6.5 * s, panel.btn[1] + 24 * s], approach);
  hand(ctx, handPos[0], handPos[1], s, 'point', 1, 'right', 0);
  if (contact > 0.3) label(ctx, 'tap!', panel.btn[0] - 12, panel.btn[1] - 6, 4, C.amber, 800);
  caption(ctx, 'Sentuh tombol dengan telunjuk', contact > 0.3);
}

function sceneHandMenu(ctx: Ctx, t: number) {
  const period = 3.6;
  const p = (t % period) / period;
  const contact = bump(p, 0.35, 0.5);
  const open = ramp(p, 0.42, 0.52) * (1 - ramp(p, 0.88, 0.97));
  // left hand raised, Menu button floating above it
  hand(ctx, 27, 74, 0.95, 'open', 0, 'left', -0.1);
  const pill: Pt = [28, 47 - Math.sin(t * 2) * 0.6];
  menuPill(ctx, pill[0], pill[1], 1, contact > 0.2 || open > 0.5 ? 1 : 0);
  // right index comes in from the right to tap its right end
  const rot = -0.95;
  const s = 0.9;
  const tipOff: Pt = [(-6.5 * Math.cos(rot) + 24 * Math.sin(rot)) * s, (-6.5 * Math.sin(rot) - 24 * Math.cos(rot)) * s];
  const approach = ramp(p, 0.08, 0.38) * (1 - ramp(p, 0.5, 0.8));
  const tipAt = lerpPt([90, 62], [pill[0] + 10, pill[1]], approach);
  hand(ctx, tipAt[0] - tipOff[0], tipAt[1] - tipOff[1], s, 'point', 1, 'right', rot);
  menuBar(ctx, 52, 18, 1.1, open);
  caption(ctx, 'Sentuh Menu di atas tangan kiri', contact > 0.2);
}

function sceneHandFinish(ctx: Ctx, t: number) {
  const period = 4.4;
  const p = (t % period) / period;
  if (p < 0.45) {
    menuBar(ctx, 50, 30, 1.2, 1, 5);
    caption(ctx, 'Menu → Keluar VR', true);
    return;
  }
  // palm toward the face; a Meta icon appears; pinch it
  const q = (p - 0.45) / 0.55;
  const pinch = bump(q, 0.45, 0.85);
  hand(ctx, 50, 68, 1.2, 'pinch', pinch, 'right', 0);
  metaLogo(ctx, 40, 44, 4.5, pinch > 0.5 ? 1 : 0);
  caption(ctx, 'Telapak ke wajah → cubit ikon Meta', pinch > 0.5);
}

const SCENES: Record<GuideArt, (ctx: Ctx, t: number) => void> = {
  welcome: sceneWelcome,
  look: sceneLook,
  'controller-select': sceneControllerSelect,
  'controller-move': sceneControllerMove,
  'controller-info': sceneControllerInfo,
  'controller-menu': sceneControllerMenu,
  'controller-finish': sceneControllerFinish,
  'hand-select': sceneHandSelect,
  'hand-move': sceneHandMove,
  'hand-info': sceneHandInfo,
  'hand-menu': sceneHandMenu,
  'hand-finish': sceneHandFinish,
};

/** Draw one frame of a guide illustration onto a square canvas. */
export function drawGuideArt(ctx: Ctx, w: number, h: number, art: GuideArt, t: number) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.scale(w / 100, h / 100);
  background(ctx);
  SCENES[art](ctx, t);
  ctx.restore();
}
