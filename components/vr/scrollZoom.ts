// A-Frame 'scroll-zoom' component: zoom the camera FOV in/out with the mouse wheel,
// with per-frame smoothing so it's smooth (not a jump per notch).
// Disabled in VR mode (the headset owns the camera). `cancel()` is called during a
// room transition so it doesn't fight the transition over FOV control.
export function registerScrollZoom() {
  const AFRAME =
    typeof window !== 'undefined' ? (window as unknown as { AFRAME?: any }).AFRAME : undefined;
  if (!AFRAME || AFRAME.components['scroll-zoom']) return;

  AFRAME.registerComponent('scroll-zoom', {
    schema: {
      min: { default: 40 }, // narrowest FOV (max zoom in)
      max: { default: 100 }, // widest FOV (max zoom out)
      step: { default: 0.05 }, // FOV degrees per deltaY unit (≈5°/notch)
      smooth: { default: 90 }, // smoothing time-constant (ms)
    },

    init(this: any) {
      this.target = null;
      this.active = false;

      this.onWheel = (e: WheelEvent) => {
        const sceneEl = this.el.sceneEl;
        if (sceneEl.is('vr-mode') || sceneEl.is('ar-mode')) return;
        e.preventDefault();
        const cur =
          this.active && this.target != null
            ? this.target
            : (this.el.getAttribute('camera')?.fov ?? 80);
        this.target = Math.max(this.data.min, Math.min(this.data.max, cur + e.deltaY * this.data.step));
        this.active = true;
      };

      this.attach = () => {
        this.canvas = sceneEl.canvas;
        if (this.canvas) this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
      };
      const sceneEl = this.el.sceneEl;
      if (sceneEl.canvas) this.attach();
      else sceneEl.addEventListener('render-target-loaded', this.attach, { once: true });
    },

    /** Stop any zoom activity (called by the room transition). */
    cancel(this: any) {
      this.active = false;
      this.target = null;
    },

    remove(this: any) {
      this.el.sceneEl.removeEventListener('render-target-loaded', this.attach);
      this.canvas?.removeEventListener('wheel', this.onWheel);
    },

    tick(this: any, _t: number, dt: number) {
      if (!this.active || this.target == null || !dt) return;
      const cur = this.el.getAttribute('camera')?.fov;
      if (typeof cur !== 'number') return;
      const alpha = 1 - Math.exp(-dt / this.data.smooth);
      const next = cur + (this.target - cur) * alpha;
      this.el.setAttribute('camera', 'fov', next);
      if (Math.abs(this.target - cur) < 0.05) this.active = false;
    },
  });
}
