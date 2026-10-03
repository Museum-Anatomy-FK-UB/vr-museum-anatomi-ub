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
// One shared <audio>: unlocked by the "Mode VR" click (a user gesture), so later
// steps can play without the browser's autoplay block. A missing file (not
// recorded yet) just stays silent.
let guideAudioEl: HTMLAudioElement | null = null;
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export function primeGuideAudio() {
  try {
    guideAudioEl ??= new Audio();
    guideAudioEl.src = SILENT_WAV;
    guideAudioEl.play().catch(() => {});
  } catch {
    /* best-effort */
  }
}
function playGuideAudio(file: string) {
  try {
    guideAudioEl ??= new Audio();
    guideAudioEl.pause();
    guideAudioEl.src = GUIDE_AUDIO_BASE + file;
    guideAudioEl.currentTime = 0;
    guideAudioEl.play().catch(() => {});
  } catch {
    /* best-effort */
  }
}
export function stopGuideAudio() {
  guideAudioEl?.pause();
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
