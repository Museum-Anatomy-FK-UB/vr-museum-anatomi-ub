// A-Frame 'sky-crossfade' component: two sphere layers (replacing a single <a-sky>)
// whose opacities blend when switching scenes — the OLD panorama dissolves straight
// into the NEW one, WITHOUT passing through black. Geometry/orientation exactly
// match A-Frame's default <a-sky> (radius 500, flat shader/MeshBasicMaterial,
// back side, scale -1 1 1 to mirror the texture) so the visual result is identical.
export function registerSkyCrossfade() {
  const AFRAME =
    typeof window !== 'undefined' ? (window as unknown as { AFRAME?: any }).AFRAME : undefined;
  if (!AFRAME || AFRAME.components['sky-crossfade']) return;

  AFRAME.registerComponent('sky-crossfade', {
    schema: {
      radius: { default: 500 },
      // Distance to push the OLD panorama sphere toward the view during the blend —
      // a "forward" effect without touching the camera FOV (the NEW panorama stays
      // completely still, no zoom).
      push: { default: 170 },
    },

    init(this: any) {
      const THREE = AFRAME.THREE;
      const geometry = new THREE.SphereGeometry(this.data.radius, 64, 32);
      const makeMaterial = () =>
        new THREE.MeshBasicMaterial({
          side: THREE.BackSide,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          toneMapped: false,
        });

      this.geometry = geometry;
      this.matA = makeMaterial();
      this.matB = makeMaterial();
      this.meshA = new THREE.Mesh(geometry, this.matA);
      this.meshB = new THREE.Mesh(geometry, this.matB);
      this.meshA.scale.set(-1, 1, 1);
      this.meshB.scale.set(-1, 1, 1);
      this.meshA.renderOrder = 0;
      this.meshB.renderOrder = 1; // drawn after A, for a consistent blend order

      this.el.setObject3D('sky-crossfade-a', this.meshA);
      this.el.setObject3D('sky-crossfade-b', this.meshB);

      this.loader = new THREE.TextureLoader();
      this.loader.crossOrigin = 'anonymous';

      this.activeIsA = true; // the mesh currently shown fully (opacity 1)
      this.currentSrc = null;
      this.fading = false;
    },

    remove(this: any) {
      this.el.removeObject3D('sky-crossfade-a');
      this.el.removeObject3D('sky-crossfade-b');
      this.matA.map?.dispose();
      this.matB.map?.dispose();
      this.matA.dispose();
      this.matB.dispose();
      this.geometry?.dispose(); // both meshes share one geometry — dispose once
    },

    /** Show the panorama for the first time — instant (there's no "old" one to blend yet). */
    setInitial(this: any, url: string, rotationYDeg: number) {
      const THREE = AFRAME.THREE;
      const active = this.activeIsA ? this.meshA : this.meshB;
      return new Promise<void>((resolve) => {
        this.loader.load(
          url,
          (tex: any) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            active.material.map?.dispose();
            active.material.map = tex;
            active.material.opacity = 1;
            active.material.needsUpdate = true;
            active.rotation.y = THREE.MathUtils.degToRad(rotationYDeg || 0);
            this.currentSrc = url;
            resolve();
          },
          undefined,
          () => resolve(),
        );
      });
    },

    /** Blend from the current panorama to a new one — direct dissolve, no black. */
    crossfadeTo(this: any, url: string, rotationYDeg: number, duration = 700) {
      const THREE = AFRAME.THREE;
      if (url === this.currentSrc) return Promise.resolve();
      return new Promise<void>((resolve) => {
        this.loader.load(
          url,
          (tex: any) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            const incoming = this.activeIsA ? this.meshB : this.meshA;
            const outgoing = this.activeIsA ? this.meshA : this.meshB;

            incoming.material.map?.dispose();
            incoming.material.map = tex;
            incoming.material.needsUpdate = true;
            incoming.material.opacity = 0;
            incoming.rotation.y = THREE.MathUtils.degToRad(rotationYDeg || 0);
            outgoing.material.opacity = 1; // ensure full baseline before fading out

            this.currentSrc = url;
            this._fadeIncoming = incoming;
            this._fadeOutgoing = outgoing;
            this._fadeStart = performance.now();
            this._fadeDuration = duration;

            // "Forward" effect: pull the OLD panorama sphere behind the camera so
            // the surface in front approaches (grows). The direction is taken from
            // the CURRENT camera view. The new panorama stays at the origin — it doesn't move.
            const cam3 = this.el.sceneEl?.camera;
            if (cam3) {
              const dir = new THREE.Vector3();
              cam3.getWorldDirection(dir);
              this._pushVec = dir.multiplyScalar(-this.data.push);
            } else {
              this._pushVec = null;
            }

            this.fading = true;
            this._onFadeDone = () => {
              this.activeIsA = !this.activeIsA;
              resolve();
            };
          },
          undefined,
          () => resolve(),
        );
      });
    },

    tick(this: any) {
      if (!this.fading) return;
      const t = Math.min(1, (performance.now() - this._fadeStart) / this._fadeDuration);
      this._fadeIncoming.material.opacity = t;
      this._fadeOutgoing.material.opacity = 1 - t;

      // Push the old panorama toward the view (ease-in: starts gently then speeds
      // up — feels like stepping forward). The new panorama is not touched at all.
      if (this._pushVec) {
        const eased = t * t;
        this._fadeOutgoing.position.copy(this._pushVec).multiplyScalar(eased);
      }

      if (t >= 1) {
        this.fading = false;
        this._fadeOutgoing.material.opacity = 0;
        this._fadeOutgoing.position.set(0, 0, 0); // reset (already invisible)
        this._pushVec = null;
        this._onFadeDone?.();
        this._onFadeDone = null;
      }
    },
  });
}
