'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { GUIDE_AUDIO_BASE, guideSteps, type GuideArt, type GuideMode } from '@/lib/vrGuide';
import { drawGuideArt } from './guideArt';
import {
  CanvasPlane,
  FONT,
  PX_PER_M,
  PanelRoot,
  VRButton,
  drawBlocks,
  drawCard,
  layoutBlocks,
  usingHands,
  type TextBlock,
} from './VRPanels';

// The VR guide (tutorial): a step-by-step panel — animated illustration on the
// left, text on the right, narrated by a recorded voice-over per step. It has a
// track for controllers and one for hand tracking (following whichever is in
// use, switchable). Content lives in lib/vrGuide.ts.

// ---- Animated illustration -------------------------------------------------------
// Redrawn on the XR frame loop (A-Frame tick): the window's requestAnimationFrame
// is paused while an immersive session runs on the Quest.
export function registerVrGuideArt() {
  const AFRAME = (window as unknown as { AFRAME?: any }).AFRAME;
  if (!AFRAME || AFRAME.components['vr-guide-art']) return;
  const THREE = AFRAME.THREE;
  AFRAME.registerComponent('vr-guide-art', {
    schema: {
      art: { default: 'welcome' },
      px: { default: 512 },
      fps: { default: 24 }, // plenty for these loops; each frame is a texture upload
    },
    init(this: any) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.data.px;
      this.canvas.height = this.data.px;
      this.ctx = this.canvas.getContext('2d');
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.t0 = performance.now();
      this.last = -Infinity;
      this.attach = () => {
        const mesh = this.el.getObject3D('mesh');
        if (!mesh?.material || mesh.material.map === this.texture) return;
        mesh.material.map = this.texture;
        mesh.material.needsUpdate = true;
      };
      this.el.addEventListener('loaded', this.attach);
      this.el.addEventListener('object3dset', this.attach);
      this.attach();
    },
    update(this: any, old: any) {
      if (old && old.art !== this.data.art) {
        this.t0 = performance.now(); // each step's animation starts from the top
        this.last = -Infinity;
      }
    },
    remove(this: any) {
      this.el.removeEventListener('loaded', this.attach);
      this.el.removeEventListener('object3dset', this.attach);
      this.texture.dispose();
    },
    tick(this: any) {
      const now = performance.now();
      if (now - this.last < 1000 / this.data.fps) return;
      this.last = now;
      this.attach();
      drawGuideArt(this.ctx, this.canvas.width, this.canvas.height, this.data.art as GuideArt, (now - this.t0) / 1000);
      this.texture.needsUpdate = true;
    },
  });
}

// ---- Voice-over --------------------------------------------------------------------
// The narration comes *from the panel*: it plays through a Web Audio HRTF panner
// placed at the panel and heard from the headset's pose (spatial audio), so it
// stays put in the room as the visitor turns — turning away makes it come from
// behind, drawing them back to the panel. Distance barely changes the volume
// (panels sit 0.6–1.8 m away; clarity matters more than realism).
//
// Both the <audio> elements and the AudioContext are unlocked by the "Mode VR"
// click (a user gesture), so later steps can play without the autoplay block.
// If Web Audio isn't available or isn't running, a plain <audio> is used
// instead (non-spatial). A missing file just stays silent.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

let plainEl: HTMLAudioElement | null = null;
let spatial: { ctx: AudioContext; el: HTMLAudioElement; panner: PannerNode } | null = null;

function createSpatialVoice() {
  const Ctx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const el = new Audio();
  el.preload = 'auto';
  const panner = ctx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 2; // full volume within 2 m …
  panner.rolloffFactor = 0.5; // … and only gently quieter beyond
  // A voice is a point source: fold the (stereo) recording to mono before
  // placing it, so it doesn't keep a fixed left/right of its own.
  panner.channelCount = 1;
  panner.channelCountMode = 'explicit';
  ctx.createMediaElementSource(el).connect(panner).connect(ctx.destination);
  return { ctx, el, panner };
}

export function primeGuideAudio() {
  try {
    plainEl ??= new Audio();
    plainEl.src = SILENT_WAV;
    plainEl.play().catch(() => {});
    spatial ??= createSpatialVoice();
    if (spatial) {
      spatial.ctx.resume().catch(() => {});
      spatial.el.src = SILENT_WAV;
      spatial.el.play().catch(() => {});
    }
  } catch {
    /* best-effort */
  }
}

/** The element to play through: spatial when its AudioContext is running (an
 *  element routed into a suspended context would be silent). */
function voiceEl(): HTMLAudioElement {
  if (spatial?.ctx.state === 'running') return spatial.el;
  plainEl ??= new Audio();
  return plainEl;
}

function playGuideAudio(file: string) {
  try {
    stopGuideAudio();
    const el = voiceEl();
    el.src = GUIDE_AUDIO_BASE + file;
    el.currentTime = 0;
    el.play().catch(() => {});
  } catch {
    /* best-effort */
  }
}
export function stopGuideAudio() {
  plainEl?.pause();
  spatial?.el.pause();
}

/** Puts the voice at this entity (the panel) and the listener at the headset,
 *  every frame. */
export function registerVrGuideVoice() {
  const AFRAME = (window as unknown as { AFRAME?: any }).AFRAME;
  if (!AFRAME || AFRAME.components['vr-guide-voice']) return;
  const THREE = AFRAME.THREE;
  const pos = new THREE.Vector3();
  const head = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const fwd = new THREE.Vector3();
  const up = new THREE.Vector3();
  // Short glide between frame updates: no zipper noise as the head moves.
  const set = (param: AudioParam, value: number, t: number) => param.setTargetAtTime(value, t, 0.02);
  AFRAME.registerComponent('vr-guide-voice', {
    tick(this: any) {
      const cam = this.el.sceneEl?.camera;
      if (spatial?.ctx.state !== 'running' || !cam) return;
      const { ctx, panner } = spatial;
      const t = ctx.currentTime;
      this.el.object3D.getWorldPosition(pos);
      cam.getWorldPosition(head);
      cam.getWorldQuaternion(quat);
      fwd.set(0, 0, -1).applyQuaternion(quat);
      up.set(0, 1, 0).applyQuaternion(quat);
      const l = ctx.listener as AudioListener & { positionX?: AudioParam };
      if (panner.positionX && l.positionX) {
        set(panner.positionX, pos.x, t);
        set(panner.positionY, pos.y, t);
        set(panner.positionZ, pos.z, t);
        set(l.positionX, head.x, t);
        set(l.positionY, head.y, t);
        set(l.positionZ, head.z, t);
        set(l.forwardX, fwd.x, t);
        set(l.forwardY, fwd.y, t);
        set(l.forwardZ, fwd.z, t);
        set(l.upX, up.x, t);
        set(l.upY, up.y, t);
        set(l.upZ, up.z, t);
      } else {
        // Older Web Audio: the deprecated setters.
        (panner as any).setPosition(pos.x, pos.y, pos.z);
        (l as any).setPosition(head.x, head.y, head.z);
        (l as any).setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
      }
    },
  });
}

// ---- Panel ---------------------------------------------------------------------------

export function VRGuidePanel({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<GuideMode>(() => (usingHands() ? 'hand' : 'controller'));
  const [manualMode, setManualMode] = useState(false);
  const [index, setIndex] = useState(0);
  const steps = useMemo(() => guideSteps(mode), [mode]);
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  // Follow the input actually in use (controllers put down → hand track), until
  // the visitor picks a track themselves.
  useEffect(() => {
    if (manualMode) return;
    const id = window.setInterval(() => setMode(usingHands() ? 'hand' : 'controller'), 1000);
    return () => window.clearInterval(id);
  }, [manualMode]);

  // Narrate each step as it appears.
  useEffect(() => {
    playGuideAudio(step.audio);
  }, [step.audio]);
  useEffect(() => () => stopGuideAudio(), []);

  // ---- Layout (meters, panel-local) ----
  const W = 2.0;
  const H = 1.16;
  const pad = 0.07;
  const ART = 0.84;
  const colX = pad + ART + 0.06; // right column, from the left edge
  const colW = W - colX - pad;
  const btnY = -H / 2 + pad + 0.06;
  const replayW = 0.32;
  const replayH = 0.075;
  const replayY = btnY + 0.06 + 0.04 + replayH / 2; // just above the nav row, under the text

  const version = `${mode}|${step.id}|${index}/${steps.length}`;
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const px = (m: number) => m * PX_PER_M;
    drawCard(ctx, w, h);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = `800 19px ${FONT}`;
    ctx.fillStyle = '#fbbf24';
    const modeName = mode === 'hand' ? 'MODE TANGAN' : 'MODE CONTROLLER';
    ctx.fillText(`PANDUAN VR · ${modeName} · LANGKAH ${index + 1} DARI ${steps.length}`, px(colX), px(pad + 0.01));
    const blocks: TextBlock[] = [
      { text: step.title, size: 38, weight: 800, color: '#ffffff', lineHeight: 48, maxLines: 2, gapAfter: 14 },
      { text: step.text, size: 27, color: '#e2e8f0', lineHeight: 39 },
    ];
    // text runs from under the header down to just above the "Ulangi suara" button
    const laid = layoutBlocks(ctx, blocks, px(colW), px(H / 2 - pad - 0.08 - (replayY + replayH / 2 + 0.04)));
    drawBlocks(ctx, laid, px(colX), px(pad + 0.08));
    // progress dots under the illustration
    const dotsY = px(pad + ART + 0.035);
    const gap = 26;
    const x0 = px(pad + ART / 2) - ((steps.length - 1) * gap) / 2;
    for (let i = 0; i < steps.length; i++) {
      ctx.beginPath();
      ctx.arc(x0 + i * gap, dotsY, i === index ? 8 : 5.5, 0, Math.PI * 2);
      ctx.fillStyle = i === index ? '#fbbf24' : i < index ? 'rgba(251,191,36,0.45)' : 'rgba(255,255,255,0.22)';
      ctx.fill();
    }
  };

  const toggleMode = () => {
    setManualMode(true);
    setMode((m) => (m === 'hand' ? 'controller' : 'hand'));
  };

  return (
    <PanelRoot placement={{ distance: 1.8, drop: 0.12 }}>
      <CanvasPlane width={W} height={H} version={version} draw={draw} />
      {/* the voice-over is heard from here — the middle of the panel */}
      <a-entity vr-guide-voice="" />
      {/* animated illustration */}
      <a-plane
        vr-guide-art={`art: ${step.art}`}
        vr-layer="order: 1"
        position={`${-W / 2 + pad + ART / 2} ${H / 2 - pad - ART / 2} 0.005`}
        width={ART}
        height={ART}
        material="shader: flat; transparent: true"
      />
      <VRButton
        name="guide-replay"
        label="Ulangi suara"
        x={-W / 2 + colX + replayW / 2}
        y={replayY}
        width={replayW}
        height={replayH}
        onClick={() => playGuideAudio(step.audio)}
      />
      <VRButton
        name="guide-mode"
        label={mode === 'hand' ? 'Ganti ke Controller' : 'Ganti ke Mode Tangan'}
        x={-W / 2 + pad + 0.27}
        y={btnY}
        width={0.54}
        onClick={toggleMode}
      />
      <VRButton name="guide-skip" label="Lewati" x={-W / 2 + pad + 0.54 + 0.04 + 0.14} y={btnY} width={0.28} onClick={onClose} />
      {index > 0 && (
        <VRButton
          name="guide-prev"
          label="‹ Sebelumnya"
          x={W / 2 - pad - 0.4 - 0.04 - 0.2}
          y={btnY}
          width={0.4}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        />
      )}
      <VRButton
        name="guide-next"
        label={last ? 'Selesai' : 'Berikutnya ›'}
        x={W / 2 - pad - 0.2}
        y={btnY}
        width={0.4}
        primary
        onClick={() => (last ? onClose() : setIndex((i) => i + 1))}
      />
    </PanelRoot>
  );
}
