// A-Frame 'smooth-drag-look' component: smooth drag-to-look (mouse & touch),
// 3DVista-style.
//
// Built-in A-Frame (look-controls) applies the raw pointer delta 1:1 to the
// camera rotation per event — it feels stiff/choppy, and its touch formula has a
// DIFFERENT DIRECTION from the mouse (and only moves yaw, ignoring pitch). This
// component replaces the built-in mouse AND touch drag (VR headset mode is STILL
// handled by look-controls itself, untouched):
//   1) During drag: the camera "chases" the target rotation with per-frame
//      smoothing (instead of jumping exactly to the pointer) → motion feels smooth.
//   2) On release: the last movement speed is used as inertia — the camera keeps
//      "gliding" then slows down & stops (not an abrupt halt).
//   3) Consistent direction: dragging right→left moves the content to the right
//      (and vice versa), the same on mouse and touch.
export function registerSmoothDragLook() {
  const AFRAME =
    typeof window !== 'undefined' ? (window as unknown as { AFRAME?: any }).AFRAME : undefined;
  if (!AFRAME || AFRAME.components['smooth-drag-look']) return;

  const PI_2 = Math.PI / 2;
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  AFRAME.registerComponent('smooth-drag-look', {
    schema: {
      sensitivity: { default: 0.002 }, // rad per px — matches the look-controls default
      followMs: { default: 18 }, // time-constant (ms) the camera "chases" the target while dragging — smaller = snappier
      friction: { default: 0.8 }, // velocity retention per ~16.67ms during inertia — smaller = shorter glide
      minVelocity: { default: 0.00006 }, // rad/ms — below this inertia is considered done (trims the glide tail)
      velocitySmoothing: { default: 0.4 }, // EMA for the velocity estimate (seeds inertia)
      clickMaxPx: { default: 8 }, // movement <= this many px between press-release counts as a CLICK, not a drag
      hoverThrottleMs: { default: 80 }, // minimum gap between hover raycasts
    },

    init(this: any) {
      const THREE = AFRAME.THREE;
      this.dragging = false;
      this.pointerId = null;
      this.lastX = 0;
      this.lastY = 0;
      this.downX = 0;
      this.downY = 0;
      this.lastMoveTime = 0;
      this.targetYaw = 0;
      this.targetPitch = 0;
      this.velYaw = 0;
      this.velPitch = 0;
      this.hasInertia = false;
      this.canvas = null as HTMLCanvasElement | null;
      this.hoverEl = null;
      this.lastHoverTime = 0;
      this.raycaster = new THREE.Raycaster();
      this.ndc = new THREE.Vector2();

      const sceneEl = this.el.sceneEl;
      const getLook = () => this.el.components['look-controls'];

      // Raycast NDC (-1..1) to a hotspot: return the ROOT entity with class .clickable.
      // (Click & hover are handled manually here — A-Frame's built-in rayOrigin:mouse
      // cursor is incompatible with the pointer capture used for dragging.)
      this.raycastClickable = (nx: number, ny: number) => {
        const cam3 = sceneEl.camera;
        if (!cam3) return null;
        this.ndc.set(nx, ny);
        this.raycaster.setFromCamera(this.ndc, cam3);
        const roots = Array.from(sceneEl.querySelectorAll('.clickable')) as any[];
        if (roots.length === 0) return null;
        const objects = roots.map((r) => r.object3D).filter(Boolean);
        // matrixWorld can be stale right after a mutation (the renderer only updates
        // it next frame) — refresh it first so the raycast result is accurate.
        objects.forEach((o) => o.updateMatrixWorld(true));
        const hits = this.raycaster.intersectObjects(objects, true);
        const hitEl = hits[0]?.object?.el as HTMLElement | undefined;
        if (!hitEl) return null;
        let el: HTMLElement | null = hitEl;
        while (el && !(el.classList && el.classList.contains('clickable'))) el = el.parentElement;
        return el;
      };

      this.pxToNdc = (x: number, y: number) => {
        const rect = this.canvas?.getBoundingClientRect();
        if (!rect || rect.width === 0 || rect.height === 0) return null;
        return {
          nx: ((x - rect.left) / rect.width) * 2 - 1,
          ny: -(((y - rect.top) / rect.height) * 2 - 1),
        };
      };

      this.setHover = (el: HTMLElement | null) => {
        if (el === this.hoverEl) return;
        (this.hoverEl as any)?.emit?.('mouseleave');
        this.hoverEl = el;
        (el as any)?.emit?.('mouseenter');
        if (this.canvas && !this.dragging) this.canvas.style.cursor = el ? 'pointer' : 'grab';
      };

      this.onPointerDown = (e: PointerEvent) => {
        if (e.pointerType === 'pen') return; // stylus: leave the browser default
        if (e.button !== 0) return;
        if (sceneEl.is('vr-mode') || sceneEl.is('ar-mode')) return;
        const look = getLook();
        if (!look?.yawObject || !look?.pitchObject) return;
        this.dragging = true;
        this.hasInertia = false;
        this.velYaw = 0;
        this.velPitch = 0;
        this.targetYaw = look.yawObject.rotation.y;
        this.targetPitch = look.pitchObject.rotation.x;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.downX = e.clientX;
        this.downY = e.clientY;
        this.lastMoveTime = performance.now();
        this.pointerId = e.pointerId;
        try {
          this.canvas?.setPointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
        if (this.canvas) this.canvas.style.cursor = 'grabbing';
      };

      this.onPointerMove = (e: PointerEvent) => {
        // Hotspot hover (only when NOT dragging, outside VR, throttled)
        if (!this.dragging && e.pointerType === 'mouse' && !sceneEl.is('vr-mode')) {
          const now = performance.now();
          if (now - this.lastHoverTime > this.data.hoverThrottleMs) {
            this.lastHoverTime = now;
            const ndc = this.pxToNdc(e.clientX, e.clientY);
            if (ndc) this.setHover(this.raycastClickable(ndc.nx, ndc.ny));
          }
        }
        if (!this.dragging || e.pointerId !== this.pointerId) return;
        const now = performance.now();
        const dt = Math.max(1, now - this.lastMoveTime);
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.lastMoveTime = now;

        const dYaw = -dx * this.data.sensitivity;
        const dPitch = -dy * this.data.sensitivity;
        this.targetYaw += dYaw;
        this.targetPitch = clamp(this.targetPitch + dPitch, -PI_2, PI_2);

        // The velocity estimate (rad/ms) is EMA-smoothed so inertia follows the
        // recent movement trend, not just the very last mousemove sample which can jitter.
        const s = this.data.velocitySmoothing;
        this.velYaw = this.velYaw * (1 - s) + (dYaw / dt) * s;
        this.velPitch = this.velPitch * (1 - s) + (dPitch / dt) * s;
      };

      this.onPointerUp = (e: PointerEvent) => {
        if (e.pointerId !== this.pointerId) return;
        const wasDragging = this.dragging;
        this.dragging = false;
        try {
          this.canvas?.releasePointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
        if (this.canvas) this.canvas.style.cursor = 'grab';

        // Press-release with almost no movement = CLICK the hotspot at the pointer.
        const moved = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
        if (wasDragging && moved <= this.data.clickMaxPx && !sceneEl.is('vr-mode')) {
          const ndc = this.pxToNdc(e.clientX, e.clientY);
          const target = ndc ? this.raycastClickable(ndc.nx, ndc.ny) : null;
          if (target) {
            (target as any).emit?.('click');
            this.hasInertia = false;
            return;
          }
        }

        this.hasInertia =
          Math.abs(this.velYaw) * 16.67 > this.data.minVelocity ||
          Math.abs(this.velPitch) * 16.67 > this.data.minVelocity;
      };

      this.resetDrag = () => {
        this.dragging = false;
        this.hasInertia = false;
        if (this.canvas) this.canvas.style.cursor = 'grab';
      };

      this.attach = () => {
        this.canvas = sceneEl.canvas;
        if (!this.canvas) return;
        this.canvas.style.cursor = 'grab';
        // Prevent the browser from hijacking touch gestures (scroll/pull-refresh) on
        // the canvas — without this, a touchscreen drag can be canceled (pointercancel) midway.
        this.canvas.style.touchAction = 'none';
        this.canvas.addEventListener('pointerdown', this.onPointerDown);
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('pointercancel', this.onPointerUp);
        window.addEventListener('blur', this.resetDrag);
      };
      if (sceneEl.canvas) this.attach();
      else sceneEl.addEventListener('render-target-loaded', this.attach, { once: true });
    },

    remove(this: any) {
      const sceneEl = this.el.sceneEl;
      sceneEl.removeEventListener('render-target-loaded', this.attach);
      if (this.canvas) {
        this.canvas.removeEventListener('pointerdown', this.onPointerDown);
        this.canvas.style.cursor = '';
      }
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('pointercancel', this.onPointerUp);
      window.removeEventListener('blur', this.resetDrag);
    },

    tick(this: any, _time: number, dt: number) {
      if (!dt) return;
      const look = this.el.components['look-controls'];
      if (!look?.yawObject || !look?.pitchObject) return;

      if (this.dragging) {
        // Chase the target with frame-rate-independent exponential smoothing —
        // this is what smooths out unevenly-arriving mousemove deltas.
        const alpha = 1 - Math.exp(-dt / this.data.followMs);
        look.yawObject.rotation.y += (this.targetYaw - look.yawObject.rotation.y) * alpha;
        look.pitchObject.rotation.x += (this.targetPitch - look.pitchObject.rotation.x) * alpha;
        return;
      }

      if (this.hasInertia) {
        look.yawObject.rotation.y += this.velYaw * dt;
        look.pitchObject.rotation.x = clamp(
          look.pitchObject.rotation.x + this.velPitch * dt,
          -PI_2,
          PI_2,
        );
        this.targetYaw = look.yawObject.rotation.y;
        this.targetPitch = look.pitchObject.rotation.x;

        const decay = Math.pow(this.data.friction, dt / 16.67);
        this.velYaw *= decay;
        this.velPitch *= decay;
        if (
          Math.abs(this.velYaw) * 16.67 < this.data.minVelocity &&
          Math.abs(this.velPitch) * 16.67 < this.data.minVelocity
        ) {
          this.hasInertia = false;
          this.velYaw = 0;
          this.velPitch = 0;
        }
        return;
      }

      // Idle (no drag, no inertia): sync the target to the actual rotation — so if
      // another component (idle-rotate) moves the camera, the next drag starts
      // smoothly from the current position, without a "jump".
      this.targetYaw = look.yawObject.rotation.y;
      this.targetPitch = look.pitchObject.rotation.x;
    },
  });
}
