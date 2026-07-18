// A-Frame 'idle-rotate' component: the camera slowly auto-rotates when idle (a
// museum-kiosk attract mode). It stops when the user interacts (drag/scroll/keyboard),
// and is disabled in VR mode. The speed eases in so it starts smoothly, not abruptly.
//
// Idle detection: mouse hover (without clicking) does NOT stop it — only a real
// drag/interaction resets the timer, so the tour keeps rotating when left alone.
export function registerIdleRotate() {
  const AFRAME =
    typeof window !== 'undefined' ? (window as unknown as { AFRAME?: any }).AFRAME : undefined;
  if (!AFRAME || AFRAME.components['idle-rotate']) return;

  AFRAME.registerComponent('idle-rotate', {
    schema: {
      speed: { default: 0.09 }, // radians per second (full speed)
      delay: { default: 4000 }, // ms of idle before it starts
      ramp: { default: 1200 }, // ms ease-in from rest to full speed
      enabled: { default: true }, // disabled e.g. during Pick coordinate mode
    },

    init(this: any) {
      this.lastActive = performance.now();
      this.inVR = false;
      this.pointerDown = false;
      this.rotating = false;
      this.rotateStart = 0;

      // Reset the idle timer + stop rotating.
      this.bump = () => {
        this.lastActive = performance.now();
        this.rotating = false;
      };
      this.onDown = () => {
        this.pointerDown = true;
        this.bump();
      };
      this.onUp = () => {
        this.pointerDown = false;
        this.bump();
      };
      // Mouse movement only resets while dragging (a button is held down).
      this.onMove = () => {
        if (this.pointerDown) this.bump();
      };

      window.addEventListener('mousedown', this.onDown, { passive: true });
      window.addEventListener('touchstart', this.onDown, { passive: true });
      window.addEventListener('mouseup', this.onUp, { passive: true });
      window.addEventListener('touchend', this.onUp, { passive: true });
      window.addEventListener('touchcancel', this.onUp, { passive: true });
      window.addEventListener('mousemove', this.onMove, { passive: true });
      window.addEventListener('touchmove', this.onMove, { passive: true });
      window.addEventListener('wheel', this.bump, { passive: true });
      window.addEventListener('keydown', this.bump);

      const scene = this.el.sceneEl;
      this.onEnterVR = () => {
        this.inVR = true;
      };
      this.onExitVR = () => {
        this.inVR = false;
        this.bump();
      };
      scene.addEventListener('enter-vr', this.onEnterVR);
      scene.addEventListener('exit-vr', this.onExitVR);
    },

    remove(this: any) {
      window.removeEventListener('mousedown', this.onDown);
      window.removeEventListener('touchstart', this.onDown);
      window.removeEventListener('mouseup', this.onUp);
      window.removeEventListener('touchend', this.onUp);
      window.removeEventListener('touchcancel', this.onUp);
      window.removeEventListener('mousemove', this.onMove);
      window.removeEventListener('touchmove', this.onMove);
      window.removeEventListener('wheel', this.bump);
      window.removeEventListener('keydown', this.bump);
      const scene = this.el.sceneEl;
      scene.removeEventListener('enter-vr', this.onEnterVR);
      scene.removeEventListener('exit-vr', this.onExitVR);
    },

    tick(this: any, _time: number, dt: number) {
      if (!this.data.enabled || this.inVR || !dt) return;
      const now = performance.now();
      if (now - this.lastActive < this.data.delay) return;

      const lookControls = this.el.components['look-controls'];
      if (!lookControls || !lookControls.yawObject || !lookControls.pitchObject) return;

      if (!this.rotating) {
        this.rotating = true;
        this.rotateStart = now;
      }

      // 1) Recenter the view to the horizon first: ease pitch → 0 (if looking down/up).
      const pitch = lookControls.pitchObject.rotation.x;
      const k = 1 - Math.exp(-dt / 250); // exponential, ~0.7s to center
      lookControls.pitchObject.rotation.x = pitch + (0 - pitch) * k;

      // 2) Rotate yaw with ease-in, BUT only reach full speed once near level
      //    (so it "returns to center then rotates", not rotating while tilted).
      const levelThreshold = (12 * Math.PI) / 180; // 12°
      const level = Math.max(0, 1 - Math.abs(lookControls.pitchObject.rotation.x) / levelThreshold);
      const r = Math.min(1, (now - this.rotateStart) / this.data.ramp);
      const easedRamp = r * r * (3 - 2 * r);
      lookControls.yawObject.rotation.y -= (this.data.speed * easedRamp * level * dt) / 1000;
    },
  });
}
