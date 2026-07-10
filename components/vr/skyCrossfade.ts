// Komponen A-Frame 'sky-crossfade': dua lapis sphere (menggantikan <a-sky> tunggal)
// yang saling di-blend opacity-nya saat pindah scene — panorama LAMA dissolve
// langsung ke panorama BARU, TANPA melewati hitam. Geometri/orientasi mengikuti
// persis default <a-sky> A-Frame (radius 500, shader flat/MeshBasicMaterial,
// side back, scale -1 1 1 utk mirror tekstur) supaya hasil visual identik.
export function registerSkyCrossfade() {
  const AFRAME =
    typeof window !== 'undefined' ? (window as unknown as { AFRAME?: any }).AFRAME : undefined;
  if (!AFRAME || AFRAME.components['sky-crossfade']) return;

  AFRAME.registerComponent('sky-crossfade', {
    schema: {
      radius: { default: 500 },
      // Jarak dorong bola panorama LAMA ke arah pandang saat blend — efek "maju"
      // tanpa menyentuh FOV kamera (panorama BARU diam total, tidak ikut zoom).
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

      this.matA = makeMaterial();
      this.matB = makeMaterial();
      this.meshA = new THREE.Mesh(geometry, this.matA);
      this.meshB = new THREE.Mesh(geometry, this.matB);
      this.meshA.scale.set(-1, 1, 1);
      this.meshB.scale.set(-1, 1, 1);
      this.meshA.renderOrder = 0;
      this.meshB.renderOrder = 1; // digambar setelah A, urutan blend konsisten

      this.el.setObject3D('sky-crossfade-a', this.meshA);
      this.el.setObject3D('sky-crossfade-b', this.meshB);

      this.loader = new THREE.TextureLoader();
      this.loader.crossOrigin = 'anonymous';

      this.activeIsA = true; // mesh yg lagi tampil penuh (opacity 1)
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
    },

    /** Tampilkan panorama pertama kali — instan (belum ada "lama" utk di-blend). */
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

    /** Blend dari panorama saat ini ke panorama baru — dissolve langsung, tanpa hitam. */
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
            outgoing.material.opacity = 1; // pastikan baseline penuh sebelum di-fade-out

            this.currentSrc = url;
            this._fadeIncoming = incoming;
            this._fadeOutgoing = outgoing;
            this._fadeStart = performance.now();
            this._fadeDuration = duration;

            // Efek "maju": tarik bola panorama LAMA ke belakang kamera sehingga
            // permukaan di depan mendekat (membesar). Arah diambil dari pandangan
            // kamera SAAT INI. Panorama baru tetap di origin — tidak bergerak.
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

      // Dorong panorama lama ke arah pandang (ease-in: mulai halus lalu melaju —
      // terasa seperti melangkah maju). Panorama baru tidak disentuh sama sekali.
      if (this._pushVec) {
        const eased = t * t;
        this._fadeOutgoing.position.copy(this._pushVec).multiplyScalar(eased);
      }

      if (t >= 1) {
        this.fading = false;
        this._fadeOutgoing.material.opacity = 0;
        this._fadeOutgoing.position.set(0, 0, 0); // reset (sudah tak terlihat)
        this._pushVec = null;
        this._onFadeDone?.();
        this._onFadeDone = null;
      }
    },
  });
}
