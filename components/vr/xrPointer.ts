// A-Frame 'xr-pointer' component: ALL hotspot interaction inside an immersive
// WebXR session (Meta Quest, other headsets, Cardboard-style phones).
//
// Why not A-Frame's laser-controls/cursor: those pick a button mapping per
// controller model (triggerdown for Touch controllers, nothing for tracked
// hands), and the gaze cursor ALSO listens to the session's select events — so
// with both present one trigger pull could click two different things (what the
// laser points at AND what the head looks at). Everything here instead goes
// through the WebXR standard itself:
//   - Pointing: every 'tracked-pointer' input source (Quest Touch controllers
//     AND tracked hands) gets a laser along its targetRaySpace, with hover.
//   - Clicking: the session's 'select' event (trigger on a controller, pinch on
//     a hand, the button on a Cardboard viewer), raycast along that SAME input's
//     targetRaySpace — so what the laser shows is exactly what gets clicked.
//   - Gaze: only when there is no tracked pointer (e.g. Cardboard), a reticle in
//     the view center activates a hotspot after dwelling on it (fuse).
// A click is re-emitted as a plain 'click' on the .clickable root entity, which
// is what HotspotLayer (and the in-VR panels) already listen for.
export function registerXrPointer() {
  const AFRAME =
    typeof window !== 'undefined' ? (window as unknown as { AFRAME?: any }).AFRAME : undefined;
  if (!AFRAME || AFRAME.components['xr-pointer']) return;

  const THREE = AFRAME.THREE;
  // Above hotspots (10/11) and the in-VR panels (30+): the laser must never be
  // hidden behind what it points at.
  const LASER_RENDER_ORDER = 60;
  const LASER_IDLE = 0xffffff;
  const LASER_HOVER = 0xfbbf24;

  // Closest .clickable ROOT hit by a ray, skipping anything hidden.
  function isShown(obj: any) {
    for (let o = obj; o; o = o.parent) if (o.visible === false) return false;
    return true;
  }
  function clickableRoot(obj: any): HTMLElement | null {
    let o = obj;
    while (o && !o.el) o = o.parent;
    let el: HTMLElement | null = o?.el ?? null;
    while (el && !(el.classList && el.classList.contains('clickable'))) el = el.parentElement;
    return el;
  }

  function makeLaser() {
    const group = new THREE.Group();
    // Unit-length beam along -Z, scaled to the hit distance every frame.
    const beamGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 1, 8, 1, true);
    beamGeo.rotateX(-Math.PI / 2);
    beamGeo.translate(0, 0, -0.5);
    const mat = () =>
      new THREE.MeshBasicMaterial({
        color: LASER_IDLE,
        transparent: true,
        opacity: 0.75,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
    const beam = new THREE.Mesh(beamGeo, mat());
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), mat());
    dot.material.opacity = 0.95;
    beam.renderOrder = LASER_RENDER_ORDER;
    dot.renderOrder = LASER_RENDER_ORDER + 1;
    beam.frustumCulled = false;
    dot.frustumCulled = false;
    group.add(beam, dot);
    group.visible = false;
    return { group, beam, dot };
  }

  function disposeLaser(sceneEl: any, laser: any) {
    sceneEl.object3D.remove(laser.group);
    laser.group.traverse((o: any) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  }

  const FORWARD = new THREE.Vector3(0, 0, -1);

  AFRAME.registerComponent('xr-pointer', {
    schema: {
      objects: { default: '.clickable' },
      far: { default: 30 }, // hotspots sit at radius 6; panels ~2m
      idleLength: { default: 4 }, // laser length when pointing at nothing
      dwellMs: { default: 1000 }, // gaze (no controllers) dwell-to-click time
      reticle: { type: 'selector' }, // gaze reticle entity (child of the camera)
    },

    init(this: any) {
      this.session = null;
      this.lasers = new Map(); // XRInputSource -> laser visuals + hover state
      this.hovered = new Set<HTMLElement>();
      this.raycaster = new THREE.Raycaster();
      this.origin = new THREE.Vector3();
      this.direction = new THREE.Vector3();
      this.tmpQuat = new THREE.Quaternion();
      this.roots = [] as HTMLElement[];
      this.rootsAt = 0;
      this.gazeEl = null;
      this.gazeSince = 0;
      this.gazeFired = false;

      this.onEnterVR = () => {
        const session = this.el.sceneEl.xrSession;
        if (!session) return; // not a real immersive session
        this.session = session;
        session.addEventListener('select', this.onSelect);
      };
      this.onExitVR = () => {
        this.session?.removeEventListener('select', this.onSelect);
        this.session = null;
        this.lasers.forEach((l: any) => disposeLaser(this.el.sceneEl, l));
        this.lasers.clear();
        this.setHovered(new Set());
        this.setReticle(false);
        this.gazeEl = null;
      };
      this.onSelect = (evt: any) => {
        const source = evt.inputSource;
        // 'screen' is handheld AR tapping — not a mode this tour runs in.
        if (!source || source.targetRayMode === 'screen') return;
        const refSpace = this.el.sceneEl.renderer.xr.getReferenceSpace();
        const pose = refSpace && evt.frame?.getPose(source.targetRaySpace, refSpace);
        if (!pose) return;
        this.poseToRay(pose);
        const hit = this.cast(true);
        if (!hit) return;
        // A Cardboard button press on what the gaze is already dwelling on must
        // not be followed by the dwell firing a second click.
        if (hit.el === this.gazeEl) this.gazeFired = true;
        this.pulse(source, 0.6, 40);
        (hit.el as any).emit?.('click');
      };

      const sceneEl = this.el.sceneEl;
      sceneEl.addEventListener('enter-vr', this.onEnterVR);
      sceneEl.addEventListener('exit-vr', this.onExitVR);
      if (sceneEl.xrSession) this.onEnterVR();
    },

    remove(this: any) {
      const sceneEl = this.el.sceneEl;
      sceneEl.removeEventListener('enter-vr', this.onEnterVR);
      sceneEl.removeEventListener('exit-vr', this.onExitVR);
      this.onExitVR();
    },

    /** XR pose (reference space) -> world-space ray, the same way A-Frame's cursor does it. */
    poseToRay(this: any, pose: any) {
      const { position: p, orientation: q } = pose.transform;
      this.origin.set(p.x, p.y, p.z);
      this.direction.set(0, 0, -1).applyQuaternion(this.tmpQuat.set(q.x, q.y, q.z, q.w));
      const parent = this.el.sceneEl.camera?.el?.object3D?.parent;
      if (parent) {
        parent.localToWorld(this.origin);
        this.direction.transformDirection(parent.matrixWorld);
      }
    },

    /** Raycast the current origin/direction against the .clickable roots. */
    cast(this: any, fresh = false) {
      const now = performance.now();
      if (fresh || now - this.rootsAt > 300) {
        this.roots = Array.from(this.el.sceneEl.querySelectorAll(this.data.objects));
        this.rootsAt = now;
      }
      const objects = this.roots.map((r: any) => r.object3D).filter(Boolean);
      if (!objects.length) return null;
      this.raycaster.set(this.origin, this.direction);
      this.raycaster.far = this.data.far;
      const hits = this.raycaster.intersectObjects(objects, true);
      for (const h of hits) {
        if (!isShown(h.object)) continue;
        const el = clickableRoot(h.object);
        if (el) return { el, distance: h.distance };
      }
      return null;
    },

    pulse(this: any, source: any, intensity: number, ms: number) {
      try {
        source.gamepad?.hapticActuators?.[0]?.pulse?.(intensity, ms);
      } catch {
        /* haptics are best-effort */
      }
    },

    setReticle(this: any, on: boolean, progress = 0) {
      const r = this.data.reticle?.object3D;
      if (!r) return;
      r.visible = on;
      // Shrinks while dwelling — the visitor sees the fuse "counting down".
      const s = 1 - 0.45 * progress;
      r.scale.set(s, s, s);
    },

    // mouseenter/mouseleave drive the existing hover (scale-up) animations.
    setHovered(this: any, next: Set<HTMLElement>) {
      this.hovered.forEach((el: any) => {
        if (!next.has(el)) el.emit?.('mouseleave');
      });
      next.forEach((el: any) => {
        if (!this.hovered.has(el)) el.emit?.('mouseenter');
      });
      this.hovered = next;
    },

    tick(this: any) {
      if (!this.session) return;
      const sceneEl = this.el.sceneEl;
      const frame = sceneEl.frame;
      const refSpace = sceneEl.renderer.xr.getReferenceSpace();
      if (!frame || !refSpace) return;

      const hovered = new Set<HTMLElement>();
      const seen = new Set();
      let pointers = 0;

      for (const source of this.session.inputSources) {
        if (source.targetRayMode !== 'tracked-pointer') continue;
        pointers++;
        seen.add(source);
        let laser = this.lasers.get(source);
        if (!laser) {
          laser = { ...makeLaser(), hoverEl: null };
          sceneEl.object3D.add(laser.group);
          this.lasers.set(source, laser);
        }
        const pose = frame.getPose(source.targetRaySpace, refSpace);
        if (!pose) {
          laser.group.visible = false;
          continue;
        }
        this.poseToRay(pose);
        const hit = this.cast();
        const length = hit ? hit.distance : this.data.idleLength;

        laser.group.position.copy(this.origin);
        laser.group.quaternion.setFromUnitVectors(FORWARD, this.direction);
        laser.beam.scale.set(1, 1, length);
        laser.dot.position.set(0, 0, -length);
        laser.dot.visible = !!hit;
        const color = hit ? LASER_HOVER : LASER_IDLE;
        laser.beam.material.color.setHex(color);
        laser.dot.material.color.setHex(color);
        laser.group.visible = true;

        if (hit) hovered.add(hit.el);
        // A light tick when the laser moves onto something new.
        if (hit && hit.el !== laser.hoverEl) this.pulse(source, 0.25, 15);
        laser.hoverEl = hit?.el ?? null;
      }

      // Drop lasers of input sources that went away (e.g. controllers put down
      // and the headset switched to hand tracking — hands get their own lasers).
      this.lasers.forEach((l: any, source: any) => {
        if (seen.has(source)) return;
        disposeLaser(sceneEl, l);
        this.lasers.delete(source);
      });

      // Gaze fallback — only with no tracked pointer, otherwise just looking at a
      // hotspot for a second while aiming a controller elsewhere would click it.
      if (pointers === 0 && sceneEl.camera) {
        const cam = sceneEl.camera;
        cam.getWorldPosition(this.origin);
        cam.getWorldDirection(this.direction);
        const hit = this.cast();
        const now = performance.now();
        if (hit?.el !== this.gazeEl) {
          this.gazeEl = hit?.el ?? null;
          this.gazeSince = now;
          this.gazeFired = false;
        }
        let progress = 0;
        if (this.gazeEl && !this.gazeFired) {
          progress = Math.min(1, (now - this.gazeSince) / this.data.dwellMs);
          if (progress >= 1) {
            this.gazeFired = true; // once per look — must look away to fire again
            progress = 0;
            (this.gazeEl as any).emit?.('click');
          }
        }
        if (this.gazeEl) hovered.add(this.gazeEl);
        this.setReticle(true, progress);
      } else {
        this.gazeEl = null;
        this.setReticle(false);
      }

      this.setHovered(hovered);
    },
  });
}
