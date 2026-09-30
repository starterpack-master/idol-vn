import * as THREE from 'three';

export const DEG = Math.PI / 180;

/** yaw: 0 = forward, +90 = right, 180 = behind. pitch: + = up */
export function dirFromYawPitch(yaw, pitch) {
  const y = yaw * DEG, p = pitch * DEG;
  return new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
}

export const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Renders the 360° panorama sphere, character sprites and hotspots.
 * Owns camera orientation (yaw/pitch), drag + gyro look, scripted turns, gaze raycast.
 */
export class Panorama {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 1200);

    const geo = new THREE.SphereGeometry(500, 64, 40);
    geo.scale(-1, 1, 1);
    this.sphereMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.sphere = new THREE.Mesh(geo, this.sphereMat);
    this.sphere.rotation.y = -Math.PI / 2; // image center (u=0.5) faces yaw 0
    this.scene.add(this.sphere);

    this.yaw = 0;
    this.pitch = 0;
    this.interactive = false;
    this.actors = new Map();   // id -> { sprite, yaw, pitch, dist, baseScale, phase }
    this.hotspots = new Map(); // id -> sprite (non-actor markers)
    this.tweens = [];
    this.shakeT = 0; this.shakePow = 0;
    this.raycaster = new THREE.Raycaster();
    this.onTap = null;         // (hitId|null) => void
    this.onFrame = null;       // (dt) => void
    this.gazeTargets = null;   // Set of ids that count for center-gaze
    this.gazeHit = null;

    this._initInput();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._last = performance.now();
    this.renderer.setAnimationLoop(() => this._loop());
  }

  _resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.baseFov = w < h ? 82 : 64; // portrait phones need a taller FOV
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  setTexture(tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    this.sphereMat.map = tex; // lifetime is managed by Assets (LRU)
    this.sphereMat.color.set(0xffffff);
    this.sphereMat.needsUpdate = true;
  }

  // ---------- camera ----------
  turnTo(yaw, pitch = this.pitch, ms = 1200) {
    const y0 = this.yaw, p0 = this.pitch;
    const dy = wrap180(yaw - y0), dp = pitch - p0;
    if (ms <= 0) { this.yaw = y0 + dy; this.pitch = pitch; return Promise.resolve(); }
    return new Promise((res) => {
      this.tweens.push({ t: 0, ms, fn: (k) => { this.yaw = y0 + dy * k; this.pitch = p0 + dp * k; }, res });
    });
  }

  zoom(fovMul = 1, ms = 600) {
    const f0 = this.camera.fov, f1 = this.baseFov * fovMul;
    return new Promise((res) => {
      this.tweens.push({ t: 0, ms, fn: (k) => { this.camera.fov = f0 + (f1 - f0) * k; this.camera.updateProjectionMatrix(); }, res });
    });
  }

  shake(pow = 1, ms = 400) { this.shakePow = pow; this.shakeT = ms; }

  // ---------- actors ----------
  addActor(id, texture, { yaw = 0, pitch = -8, dist = 3, height = 2.3, aspect = 2 / 3, opacity = 1 } = {}) {
    this.removeActor(id);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity, depthWrite: false });
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(mat);
    sprite.userData.id = id;
    sprite.scale.set(height * aspect, height, 1);
    sprite.renderOrder = 10 - dist;
    this.scene.add(sprite);
    const a = { sprite, yaw, pitch, dist, height, aspect, phase: Math.random() * 6 };
    this.actors.set(id, a);
    this._placeActor(a, 0);
    return a;
  }

  setActorTexture(id, texture) {
    const a = this.actors.get(id);
    if (!a) return;
    texture.colorSpace = THREE.SRGBColorSpace;
    a.sprite.material.map = texture;
    a.sprite.material.needsUpdate = true;
  }

  fadeActor(id, to, ms = 400) {
    const a = this.actors.get(id);
    if (!a) return Promise.resolve();
    const m = a.sprite.material, o0 = m.opacity;
    return new Promise((res) => this.tweens.push({ t: 0, ms, fn: (k) => (m.opacity = o0 + (to - o0) * k), res }));
  }

  moveActor(id, { yaw, pitch, dist }, ms = 500) {
    const a = this.actors.get(id);
    if (!a) return Promise.resolve();
    const s = { yaw: a.yaw, pitch: a.pitch, dist: a.dist };
    const e = { yaw: yaw ?? a.yaw, pitch: pitch ?? a.pitch, dist: dist ?? a.dist };
    const dy = wrap180(e.yaw - s.yaw);
    return new Promise((res) => this.tweens.push({
      t: 0, ms, res,
      fn: (k) => { a.yaw = s.yaw + dy * k; a.pitch = s.pitch + (e.pitch - s.pitch) * k; a.dist = s.dist + (e.dist - s.dist) * k; },
    }));
  }

  removeActor(id) {
    const a = this.actors.get(id);
    if (!a) return;
    this.scene.remove(a.sprite);
    a.sprite.material.dispose();
    this.actors.delete(id);
  }

  clearActors() { [...this.actors.keys()].forEach((id) => this.removeActor(id)); }

  _placeActor(a, time) {
    const bob = Math.sin(time * 0.0016 + a.phase) * 0.012;
    a.sprite.position.copy(dirFromYawPitch(a.yaw, a.pitch).multiplyScalar(a.dist));
    a.sprite.position.y += bob;
    a.sprite.scale.set(a.height * a.aspect, a.height, 1);
  }

  // ---------- hotspot markers (non-actor) ----------
  addMarker(id, texture, yaw, pitch, { dist = 6, size = 0.7, hidden = false } = {}) {
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: hidden ? 0 : 1 });
    const s = new THREE.Sprite(mat);
    s.userData.id = id;
    s.userData.pulse = !hidden;
    s.position.copy(dirFromYawPitch(yaw, pitch).multiplyScalar(dist));
    s.scale.set(size, size, 1);
    s.renderOrder = 20;
    this.scene.add(s);
    this.hotspots.set(id, s);
  }

  clearMarkers() {
    this.hotspots.forEach((s) => { this.scene.remove(s); s.material.dispose(); });
    this.hotspots.clear();
  }

  // ---------- particles ----------
  /** name: 'sparkle' | null. opts.yaw centers the effect */
  setFx(name, { yaw = this.yaw, glow } = {}) {
    if (this.fx) { this.scene.remove(this.fx); this.fx.geometry.dispose(); this.fx.material.dispose(); this.fx = null; }
    if (name !== 'sparkle') return;
    const N = 240, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const v = dirFromYawPitch(yaw + (Math.random() - 0.5) * 110, -25 + Math.random() * 65).multiplyScalar(1.5 + Math.random() * 4);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ size: 0.09, map: glow, color: 0xffd6ec, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.fx = new THREE.Points(geo, mat);
    this.fx.renderOrder = 30;
    this.scene.add(this.fx);
  }

  _updateFx(dt, now) {
    if (!this.fx) return;
    const p = this.fx.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * 0.00018;
      if (y > 2.5) y = -1.5;
      p.setY(i, y);
    }
    p.needsUpdate = true;
    this.fx.material.opacity = 0.65 + Math.sin(now * 0.004) * 0.35;
  }

  /** full cleanup between sessions (title <-> game, load) */
  reset() {
    this.tweens = [];
    this.onTap = null; this.onFrame = null; this.gazeTargets = null; this.gazeHit = null;
    this.interactive = false;
    this.clearActors(); this.clearMarkers(); this.setFx(null);
    this.camera.fov = this.baseFov; this.camera.updateProjectionMatrix();
  }

  /** small 16:9 JPEG of the current view for save slots */
  snapshot(w = 192) {
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement, h = Math.round((w * 9) / 16);
    const sh = Math.min(src.height, (src.width * 9) / 16);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(src, 0, (src.height - sh) / 2, src.width, sh, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.6);
  }

  /** screen-relative yaw offset of a point, used by the compass UI */
  relYaw(yaw) { return wrap180(yaw - this.yaw); }

  _pick(ndcX, ndcY, filter) {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const objs = [...[...this.actors.values()].map((a) => a.sprite), ...this.hotspots.values()]
      .filter((o) => !filter || filter.has(o.userData.id));
    const hits = this.raycaster.intersectObjects(objs, false);
    return hits.length ? hits[0].object.userData.id : null;
  }

  // ---------- input ----------
  _initInput() {
    const el = this.renderer.domElement;
    let down = null, moved = 0;
    el.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch };
      moved = 0;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      moved = Math.max(moved, Math.hypot(dx, dy));
      if (!this.interactive) return;
      const k = this.camera.fov / el.clientHeight;
      this.yaw = down.yaw - dx * k;
      this.pitch = Math.max(-70, Math.min(70, down.pitch + dy * k));
    });
    el.addEventListener('pointerup', (e) => {
      if (down && moved < 8 && this.onTap) {
        const r = el.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 2 - 1;
        const y = -((e.clientY - r.top) / r.height) * 2 + 1;
        this.onTap(this.interactive ? this._pick(x, y) : null);
      }
      down = null;
    });
  }

  async enableGyro() {
    if (typeof DeviceOrientationEvent === 'undefined') return false;
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try { if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') return false; } catch { return false; }
    }
    let ref = null;
    this._gyro = (e) => {
      if (e.alpha == null || !this.interactive) { ref = null; return; }
      if (!ref) ref = { a: e.alpha, b: e.beta, yaw: this.yaw, pitch: this.pitch };
      this.yaw = ref.yaw - wrap180(e.alpha - ref.a);
      this.pitch = Math.max(-70, Math.min(70, ref.pitch + (e.beta - ref.b)));
    };
    window.addEventListener('deviceorientation', this._gyro);
    return true;
  }

  disableGyro() { if (this._gyro) window.removeEventListener('deviceorientation', this._gyro); this._gyro = null; }

  // ---------- loop ----------
  _loop() {
    const now = performance.now();
    const dt = Math.min(64, now - this._last);
    this._last = now;

    for (const tw of [...this.tweens]) {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.ms);
      tw.fn(ease(k));
      if (k >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.res(); }
    }

    this.actors.forEach((a) => this._placeActor(a, now));
    this._updateFx(dt, now);
    this.hotspots.forEach((s) => {
      if (s.userData.pulse) { const k = 1 + Math.sin(now * 0.005) * 0.12; s.scale.setScalar(0.7 * k); }
    });

    // subtle idle sway so the scene never feels frozen
    let sy = Math.sin(now * 0.0004) * 0.25, sp = Math.sin(now * 0.00053) * 0.18;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      sy += (Math.random() - 0.5) * 2 * this.shakePow;
      sp += (Math.random() - 0.5) * 2 * this.shakePow;
    }
    this.camera.lookAt(dirFromYawPitch(this.yaw + sy, this.pitch + sp));

    if (this.gazeTargets) this.gazeHit = this._pick(0, 0, this.gazeTargets);
    if (this.onFrame) this.onFrame(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
