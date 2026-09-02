// A-Frame 'little-planet-intro' component: the "Little Planet" (tiny planet)
// opening — the panorama first appears as a small curved planet seen from above,
// then unrolls into the normal first-person view (the same effect 3DVista and the
// FILKOM tour use to open a tour).
//
// WHY A SHADER: a little planet is a STEREOGRAPHIC projection, which can show far
// more than 180° at once. A normal perspective camera physically cannot — pushing
// its FOV that wide just smears the edges into a fisheye. So the intro is drawn on
// a full-screen quad whose fragment shader casts one ray per pixel and samples the
// equirectangular panorama directly, with the projection animated from
// stereographic to rectilinear.
//
// SEAMLESS HANDOFF: the ray→UV math below is derived from three.js' own
// SphereGeometry formula (see node_modules/three/src/geometries/SphereGeometry.js),
// including the sky's yaw/roll rotation and its (-1,1,1) mirror scale. So at the
// end of the animation (rectilinear, FOV 80°, level, yaw 0) the quad renders
// exactly what the real sky sphere behind it renders, and removing the quad is
// invisible.

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

varying vec2 vUv;

uniform sampler2D map;
uniform float aspect;
uniform float fov;       // radians — animated from very wide down to the normal FOV
uniform float progress;  // 0 = stereographic (planet), 1 = rectilinear (normal view)
uniform float viewPitch; // radians — starts looking straight down, ends level
uniform float viewYaw;   // radians
uniform float skyYaw;    // radians — the sky sphere's own rotation.y (initial_yaw)
uniform float skyRoll;   // radians — the sky sphere's own rotation.z (horizon_roll)

const float PI = 3.141592653589793;

// How far from a pole (as sin of the polar angle) the pole stabiliser fades out.
// 0.15 is roughly 8.6 degrees — a small disc at the planet's centre.
const float POLE_FADE = 0.15;

// Mip level used inside that disc. At 5760x2880 level 10 is about 5x2 texels, so
// the sample no longer depends on which column it lands on — which is the whole
// point: the pole must look the same no matter how the view is rotated.
const float POLE_LOD = 10.0;

void main() {
  // Screen position, y in [-1,1] and x widened by the aspect ratio.
  vec2 s = vec2((vUv.x * 2.0 - 1.0) * aspect, vUv.y * 2.0 - 1.0);
  float r = length(s);
  float psi = atan(s.y, s.x);

  // Angle from the view axis. Rectilinear flattens out at 180°; stereographic
  // keeps going, which is what wraps the world into a "planet".
  //
  // tan(fov/2) is only meaningful for fov < 180° — beyond that it goes negative
  // and the rectilinear ray flips backwards, sampling the opposite side of the
  // panorama and producing a mirrored ghost image. The progress uniform is
  // scheduled (see the component below) to stay at 0 until fov is back inside
  // the valid range, and max() keeps the term harmless even at the boundary.
  float thetaRect = max(0.0, atan(r * tan(fov * 0.5)));
  float thetaStereo = 2.0 * atan(r * tan(fov * 0.25));
  float theta = mix(thetaStereo, thetaRect, progress);

  // Ray in view space (camera looks down -Z).
  vec3 dir = vec3(sin(theta) * cos(psi), sin(theta) * sin(psi), -cos(theta));

  // Apply the virtual camera orientation: pitch about X, then yaw about Y.
  float cp = cos(viewPitch), sp = sin(viewPitch);
  dir = vec3(dir.x, dir.y * cp - dir.z * sp, dir.y * sp + dir.z * cp);
  float cy = cos(viewYaw), sy = sin(viewYaw);
  dir = vec3(dir.x * cy + dir.z * sy, dir.y, -dir.x * sy + dir.z * cy);

  // World space -> sky-sphere local space. The sphere uses rotation (0, yaw, roll)
  // with three.js' default XYZ order, i.e. R = Ry(yaw) * Rz(roll), so the inverse
  // is Ry(-yaw) followed by Rz(-roll).
  float ciy = cos(-skyYaw), siy = sin(-skyYaw);
  dir = vec3(dir.x * ciy + dir.z * siy, dir.y, -dir.x * siy + dir.z * ciy);
  float cir = cos(-skyRoll), sir = sin(-skyRoll);
  dir = vec3(dir.x * cir - dir.y * sir, dir.x * sir + dir.y * cir, dir.z);

  // Undo the sphere's (-1, 1, 1) mirror scale.
  dir.x = -dir.x;

  // Direction -> equirect UV, inverting three.js SphereGeometry:
  //   x = -cos(phi) * sin(th), y = cos(th), z = sin(phi) * sin(th), uv = (u, 1 - v)
  float th = acos(clamp(dir.y, -1.0, 1.0));
  float phi = atan(dir.z, -dir.x);
  vec2 texUv = vec2(phi / (2.0 * PI), 1.0 - th / PI);

  // ---- Mip selection, computed analytically instead of left to the GPU ------
  // The GPU normally picks a mip level from how far texUv jumps between
  // neighbouring pixels. That guess breaks this shader in two places:
  //   * atan()'s branch cut, where u flips +0.5 <-> -0.5 in one pixel step. The
  //     colour is still right (wrapS is Repeat, both sides hit the same texel)
  //     but the apparent jump makes the GPU drop to its coarsest mip — a blurred
  //     vertical band straight down the image.
  //   * the pole at the planet's centre, where every meridian converges so u
  //     spins wildly; as the intro animates, the chosen mip pops between levels
  //     from frame to frame, which reads as a twitching centre.
  // The dir vector itself is smooth everywhere (the psi branch cut cancels out,
  // since only its sin/cos are used, and at screen centre it converges to a single
  // point), so differentiating IT and converting analytically gives a gradient
  // that never jumps. Feeding that to gradient sampling fixes both artifacts.
  vec3 dirDx = dFdx(dir);
  vec3 dirDy = dFdy(dir);

  // x^2 + z^2, i.e. sin^2(th) — goes to 0 at the poles, hence the floor.
  float horiz = max(1.0 - dir.y * dir.y, 1e-6);
  float sinTh = sqrt(horiz);

  // d(phi) = (z*d(x) - x*d(z)) / (x^2 + z^2);  d(v) = d(y) / (PI * sin(th))
  vec2 texUvDx = vec2(
    (dir.z * dirDx.x - dir.x * dirDx.z) / (horiz * 2.0 * PI),
    dirDx.y / (PI * sinTh)
  );
  vec2 texUvDy = vec2(
    (dir.z * dirDy.x - dir.x * dirDy.z) / (horiz * 2.0 * PI),
    dirDy.y / (PI * sinTh)
  );

  // three.js compiles ShaderMaterial as GLSL 3.0 and aliases this to textureGrad.
  vec4 color = texture2DGradEXT(map, texUv, texUvDx, texUvDy);

  // ---- Pole stabiliser ------------------------------------------------------
  // At a pole the panorama's entire bottom (or top) row collapses onto ONE
  // physical point, so the column a pixel lands on carries no real information —
  // yet it sweeps around as the intro turns, and that is what makes the centre
  // twitch. The value that is actually correct there is the average across those
  // columns, which is the same from every angle. Anisotropic filtering
  // deliberately avoids that kind of averaging (it trades it for sharpness), so
  // it cannot deliver it — hence sampling an explicitly coarse mip here instead,
  // faded in only over the small disc right at the pole.
  vec4 poleColor = texture2DLodEXT(map, texUv, POLE_LOD);
  gl_FragColor = mix(color, poleColor, 1.0 - smoothstep(0.0, POLE_FADE, sinTh));

  // The panorama texture is tagged sRGB, so sampling it yields LINEAR values.
  // Built-in materials (like the sky sphere's) convert back to the renderer's
  // output color space automatically; a ShaderMaterial does not, so without this
  // the intro renders noticeably darker than the scene it hands off to.
  #include <colorspace_fragment>
}
`;

/** Widest stereographic FOV (deg) — how tightly the world curls into a planet. */
const START_FOV_DEG = 270;

/**
 * FOV (deg) at which the projection starts blending from stereographic toward
 * rectilinear. Must stay safely under 180°, where rectilinear is undefined —
 * blending it in while the FOV is still ultra-wide is what produced the mirrored
 * "double image".
 *
 * Kept well below that limit but as early as is safe, so the morph is spread
 * across a long stretch instead of being crammed into the final moments.
 */
const BLEND_START_FOV_DEG = 170;

export function registerLittlePlanetIntro() {
  const AFRAME =
    typeof window !== 'undefined' ? (window as unknown as { AFRAME?: any }).AFRAME : undefined;
  if (!AFRAME || AFRAME.components['little-planet-intro']) return;

  const THREE = AFRAME.THREE;
  const DEG2RAD = Math.PI / 180;
  // Quintic smootherstep: slow at both ends, quick through the middle, and —
  // unlike the easeInOutCubic used before — its ACCELERATION is continuous too.
  // Cubic ease-in-out reverses acceleration abruptly at the halfway point (it
  // measured as a spike ~2.4x the norm at exactly t=0.5), which lands on screen
  // as a small jolt mid-animation. This curve has zero velocity AND zero
  // acceleration at both ends, so nothing snaps anywhere along the way.
  const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

  /**
   * Transition from 0 to 1 that is smooth in EVERY derivative, not just the
   * first few. Used for the projection blend, which has to be pinned at exactly
   * 0 for the first stretch of the intro (rectilinear is undefined while the FOV
   * is still ultra-wide). Any schedule that simply clamps leaves a join where
   * the motion changes abruptly; even a quintic only pushes that join up to the
   * third derivative, which still measured as a residual spike mid-animation.
   * This one leaves nothing to spike: it departs from 0 and settles at 1 with
   * every derivative vanishing, and still returns exactly 0 and exactly 1 at the
   * ends so the final frame matches the sky sphere it hands off to.
   */
  const smoothTransition = (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const a = Math.exp(-1 / x);
    const b = Math.exp(-1 / (1 - x));
    return a / (a + b);
  };

  AFRAME.registerComponent('little-planet-intro', {
    schema: {},

    init(this: any) {
      this.uniforms = {
        map: { value: null },
        aspect: { value: 1 },
        fov: { value: START_FOV_DEG * DEG2RAD },
        progress: { value: 0 },
        viewPitch: { value: -Math.PI / 2 },
        viewYaw: { value: 0 },
        skyYaw: { value: 0 },
        skyRoll: { value: 0 },
      };

      const material = new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        depthTest: false,
        depthWrite: false,
        // MUST be transparent even though the shader outputs alpha 1: three.js
        // draws the whole opaque queue BEFORE the transparent one, and the sky
        // spheres are transparent. An opaque quad would therefore always be
        // painted over by the sky no matter how high its renderOrder is — the
        // intro would silently never appear.
        transparent: true,
      });

      this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      // Above every other layer (hotspots sit at 10/11, the sky at 0/1) so the
      // intro fully covers the live scene while it plays.
      this.mesh.renderOrder = 999;
      this.mesh.visible = false;
      this.mesh.frustumCulled = false;
      this.el.setObject3D('mesh', this.mesh);

      this.playing = false;
      this.endTimer = null;
    },

    remove(this: any) {
      if (this.endTimer) clearTimeout(this.endTimer);
      this.el.removeObject3D('mesh');
      this.mesh?.geometry?.dispose();
      this.mesh?.material?.dispose();
    },

    /** Stretch the quad to exactly fill the real camera's frustum at 1 unit away. */
    fitToCamera(this: any) {
      const cam = this.el.sceneEl?.camera;
      if (!cam) return;
      const height = 2 * Math.tan((cam.fov * DEG2RAD) / 2);
      this.mesh.scale.set(height * cam.aspect, height, 1);
      this.uniforms.aspect.value = cam.aspect;
    },

    /**
     * Run the intro. `texture` is the panorama already loaded by sky-crossfade,
     * and skyYaw/skyRoll are that sphere's rotation, so the final frame lines up
     * pixel-for-pixel with the scene revealed underneath.
     *
     * NOT named play(): that is an A-Frame component lifecycle method, which the
     * engine calls with no arguments — overriding it breaks the entity.
     */
    runIntro(
      this: any,
      { texture, skyYaw = 0, skyRoll = 0, duration = 2600 }: {
        texture: any;
        skyYaw?: number;
        skyRoll?: number;
        duration?: number;
      },
    ) {
      if (!texture) return Promise.resolve();

      // Hardware wrapping across the ±180° seam, instead of a fract() jump that
      // would show as a hard line down the middle of the planet.
      texture.wrapS = THREE.RepeatWrapping;

      // Anisotropic filtering, which was sitting at 1 (i.e. off). It exists for
      // exactly the situation the little planet creates: near the pole a pixel's
      // texture footprint is extremely lopsided — very wide horizontally, thin
      // vertically. With it off, the mip level has to be picked from the WIDE
      // axis, so the pole is over-blurred and pumps between levels as the view
      // turns. With it on, the hardware takes several samples along the wide axis
      // and picks the level from the thin one: steadier and sharper. It stays on
      // the shared texture afterwards, which benefits the normal view too.
      const maxAnisotropy = this.el.sceneEl?.renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
      if (maxAnisotropy > texture.anisotropy) texture.anisotropy = maxAnisotropy;

      texture.needsUpdate = true;

      this.uniforms.map.value = texture;
      this.uniforms.skyYaw.value = skyYaw;
      this.uniforms.skyRoll.value = skyRoll;
      this.uniforms.progress.value = 0;
      this.uniforms.viewPitch.value = -Math.PI / 2;
      this.uniforms.viewYaw.value = 0;
      this.uniforms.fov.value = START_FOV_DEG * DEG2RAD;

      this.fitToCamera();
      this.mesh.visible = true;

      this.startTime = performance.now();
      this.duration = duration;
      this.playing = true;

      return new Promise<void>((resolve) => {
        this.finish = () => {
          if (!this.playing && !this.mesh.visible) return;
          this.playing = false;
          this.mesh.visible = false;
          this.uniforms.map.value = null; // don't pin the texture alive
          if (this.endTimer) clearTimeout(this.endTimer);
          this.endTimer = null;
          resolve();
        };
        // Safety net: if rAF is paused (backgrounded tab) tick() never runs, and
        // without this the intro quad would stay up forever, hiding the tour.
        this.endTimer = setTimeout(this.finish, duration + 250);
      });
    },

    tick(this: any) {
      if (!this.playing) return;

      const t = Math.min(1, (performance.now() - this.startTime) / this.duration);
      const e = ease(t);

      const targetFov = this.el.sceneEl?.camera?.fov ?? 80;
      const fovDeg = START_FOV_DEG + (targetFov - START_FOV_DEG) * e;

      // Drive the stereographic→rectilinear blend off the FOV rather than raw
      // time, so it can only begin once the FOV is inside rectilinear's valid
      // range, and still reaches exactly 1 at the end (fovDeg === targetFov) —
      // which is what makes the final frame identical to the sky sphere behind it.
      // The morph must be pinned at 0 while the FOV is still ultra-wide, but the
      // moment it starts moving is exactly where the twitch was measured (an
      // acceleration spike ~42x the norm at mid-animation with a plain clamp,
      // still ~6x with a quintic). smoothTransition leaves no join at all.
      const blend = smoothTransition(
        (BLEND_START_FOV_DEG - fovDeg) / (BLEND_START_FOV_DEG - targetFov),
      );

      this.uniforms.fov.value = fovDeg * DEG2RAD;
      this.uniforms.viewPitch.value = (-Math.PI / 2) * (1 - e);
      this.uniforms.progress.value = blend;
      this.fitToCamera();

      if (t >= 1) this.finish?.();
    },
  });
}
