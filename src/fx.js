// Lightweight effects: GPU point particles, shock rings and floating text sprites.
import * as THREE from 'three';
import { softDot, ringTexture, DynLabel } from './textures.js';

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying vec3 vCol;
varying float vA;
void main() {
  vCol = aColor;
  vA = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec3 vCol;
varying float vA;
void main() {
  float a = texture2D(uMap, gl_PointCoord).a * vA;
  if (a < 0.02) discard;
  gl_FragColor = vec4(vCol, a);
  #include <colorspace_fragment>
}`;

const _col = new THREE.Color();

export class Particles {
  constructor(max, additive, map) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uMap: { value: map }, uScale: { value: 600 } },
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 12 : 11;
    g.setDrawRange(0, 0);
  }

  spawn(x, y, z, vx, vy, vz, color, size, life, grav = 9, drag = 1.5) {
    let i = this.n;
    if (i >= this.max) {
      // overwrite a random old particle rather than dropping the new one
      i = (Math.random() * this.max) | 0;
    } else this.n++;
    const o = i * 3;
    this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z;
    this.vel[o] = vx; this.vel[o + 1] = vy; this.vel[o + 2] = vz;
    _col.set(color);
    this.col[o] = _col.r; this.col[o + 1] = _col.g; this.col[o + 2] = _col.b;
    this.size0[i] = size; this.size[i] = size; this.alpha[i] = 1;
    this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav; this.drag[i] = drag;
  }

  burst(x, y, z, n, color, speed, size, life, up = 1, grav = 9) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, e = Math.random();
      const s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, z, Math.cos(a) * s * (1 - e * 0.5), (0.3 + e) * s * up, Math.sin(a) * s * (1 - e * 0.5),
        color, size * (0.6 + Math.random() * 0.7), life * (0.6 + Math.random() * 0.6), grav);
    }
  }

  update(dt) {
    const { pos, vel, life, maxLife, alpha, size, size0, grav, drag } = this;
    for (let i = this.n - 1; i >= 0; i--) {
      life[i] -= dt;
      if (life[i] <= 0) {
        const l = --this.n;
        if (i !== l) {
          const o = i * 3, p = l * 3;
          pos[o] = pos[p]; pos[o + 1] = pos[p + 1]; pos[o + 2] = pos[p + 2];
          vel[o] = vel[p]; vel[o + 1] = vel[p + 1]; vel[o + 2] = vel[p + 2];
          this.col[o] = this.col[p]; this.col[o + 1] = this.col[p + 1]; this.col[o + 2] = this.col[p + 2];
          life[i] = life[l]; maxLife[i] = maxLife[l]; size0[i] = size0[l]; grav[i] = grav[l]; drag[i] = drag[l];
          size[i] = size[l]; alpha[i] = alpha[l];
        }
        continue;
      }
      const o = i * 3;
      const d = Math.max(0, 1 - drag[i] * dt);
      vel[o] *= d; vel[o + 2] *= d;
      vel[o + 1] = vel[o + 1] * d - grav[i] * dt;
      pos[o] += vel[o] * dt; pos[o + 1] += vel[o + 1] * dt; pos[o + 2] += vel[o + 2] * dt;
      if (pos[o + 1] < 0.05 && grav[i] > 0 && vel[o + 1] < 0) { pos[o + 1] = 0.05; vel[o + 1] *= -0.35; }
      const k = life[i] / maxLife[i];
      alpha[i] = k < 0.4 ? k / 0.4 : 1;
      size[i] = size0[i] * (0.5 + 0.5 * k);
    }
    const g = this.points.geometry;
    g.setDrawRange(0, this.n);
    if (this.n > 0) {
      const a = g.attributes;
      for (const key of ['position', 'aColor', 'aSize', 'aAlpha']) {
        a[key].clearUpdateRanges?.();
        a[key].addUpdateRange?.(0, this.n * a[key].itemSize);
        a[key].needsUpdate = true;
      }
    }
  }
}

export class Rings {
  constructor(scene, count = 14) {
    this.items = [];
    const tex = ringTexture();
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      m.visible = false; m.renderOrder = 9;
      scene.add(m);
      this.items.push({ m, t: 0, dur: 0, r0: 0, r1: 0, hold: false });
    }
  }
  // grows from r0 to r1; "telegraph" rings stay bright until the end
  add(x, z, r0, r1, dur, color, telegraph = false, y = 0.06) {
    let it = this.items.find((i) => !i.m.visible) || this.items[0];
    it.m.visible = true; it.m.position.set(x, y, z);
    it.m.material.color.set(color);
    it.t = 0; it.dur = dur; it.r0 = r0; it.r1 = r1; it.hold = telegraph;
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.m.visible) continue;
      it.t += dt;
      const k = it.t / it.dur;
      if (k >= 1) { it.m.visible = false; continue; }
      const e = it.hold ? k : 1 - (1 - k) * (1 - k);
      const r = it.r0 + (it.r1 - it.r0) * e;
      it.m.scale.set(r * 2, 1, r * 2);
      it.m.material.opacity = it.hold ? 0.5 + 0.5 * Math.sin(it.t * 22) * 0.5 + k * 0.3 : 1 - k;
    }
  }
  clear() { for (const it of this.items) it.m.visible = false; }
}

export class FloatTexts {
  constructor(scene, count = 14) {
    this.items = [];
    for (let i = 0; i < count; i++) {
      const label = new DynLabel('#ffffff', '#1b1035');
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: label.tex, transparent: true, depthWrite: false, depthTest: false, fog: false }));
      s.visible = false; s.renderOrder = 20;
      scene.add(s);
      this.items.push({ s, label, t: 0, dur: 1 });
    }
    this.next = 0;
  }
  add(x, y, z, text, fill = '#ffffff', scale = 1.6, dur = 1.1) {
    const it = this.items[this.next];
    this.next = (this.next + 1) % this.items.length;
    it.label.fill = fill;
    it.label.text = null;
    it.label.set(text);
    it.s.visible = true;
    it.s.position.set(x, y, z);
    it.base = scale; it.t = 0; it.dur = dur;
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.s.visible) continue;
      it.t += dt;
      const k = it.t / it.dur;
      if (k >= 1) { it.s.visible = false; continue; }
      it.s.position.y += dt * 1.6;
      const pop = k < 0.15 ? 0.5 + (k / 0.15) * 0.7 : 1.2 - Math.min(0.2, (k - 0.15) * 0.8);
      it.s.scale.set(it.base * 2 * pop, it.base * pop, 1);
      it.s.material.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
    }
  }
  clear() { for (const it of this.items) it.s.visible = false; }
}

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _ax = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();

// Defeated enemies are flung through the air as tumbling bodies (one instanced draw call).
export class Corpses {
  constructor(scene, geo, mat, cap = 300) {
    this.cap = cap;
    this.n = 0;
    this.d = new Float32Array(cap * 12); // x y z vx vy vz ax az angle spin life scale
    const m = (this.mesh = new THREE.InstancedMesh(geo, mat, cap));
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    scene.add(m);
  }
  spawn(x, y, z, vx, vy, vz, r, g, b, scale = 1) {
    if (this.n >= this.cap) return;
    const i = this.n++, o = i * 12, d = this.d;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = vx; d[o + 4] = vy; d[o + 5] = vz;
    const a = Math.random() * 6.283;
    d[o + 6] = Math.cos(a); d[o + 7] = Math.sin(a); d[o + 8] = 0; d[o + 9] = (8 + Math.random() * 12) * (Math.random() < 0.5 ? -1 : 1);
    d[o + 10] = 0.75 + Math.random() * 0.35; d[o + 11] = scale;
    const c = this.mesh.instanceColor.array;
    c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b;
  }
  update(dt) {
    const d = this.d, c = this.mesh.instanceColor.array, arr = this.mesh.instanceMatrix.array;
    for (let i = this.n - 1; i >= 0; i--) {
      const o = i * 12;
      d[o + 10] -= dt;
      if (d[o + 10] <= 0) {
        const l = --this.n;
        if (i !== l) {
          for (let k = 0; k < 12; k++) d[o + k] = d[l * 12 + k];
          c[i * 3] = c[l * 3]; c[i * 3 + 1] = c[l * 3 + 1]; c[i * 3 + 2] = c[l * 3 + 2];
        } else continue;
      }
      d[o + 4] -= 26 * dt;
      d[o] += d[o + 3] * dt; d[o + 1] += d[o + 4] * dt; d[o + 2] += d[o + 5] * dt;
      d[o + 8] += d[o + 9] * dt;
    }
    for (let i = 0; i < this.n; i++) {
      const o = i * 12;
      const life = d[o + 10];
      const s = d[o + 11] * (life < 0.25 ? life / 0.25 : 1);
      _q.setFromAxisAngle(_ax.set(d[o + 6], 0, d[o + 7]), d[o + 8]);
      _m4.compose(_pos.set(d[o], Math.max(0.1, d[o + 1]), d[o + 2]), _q, _scl.set(s, s, s));
      _m4.toArray(arr, i * 16);
    }
    this.mesh.count = this.n;
    if (this.n) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; }
  }
  clear() { this.n = 0; this.mesh.count = 0; }
}

// Big soft light bursts for explosions.
export class Flashes {
  constructor(scene, map, count = 8) {
    this.items = [];
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      s.visible = false; s.renderOrder = 13;
      scene.add(s);
      this.items.push({ s, t: 0, dur: 0, size: 1 });
    }
  }
  add(x, y, z, size, color, dur = 0.28) {
    const it = this.items.find((i) => !i.s.visible) || this.items[0];
    it.s.visible = true; it.s.position.set(x, y, z);
    it.s.material.color.set(color);
    it.t = 0; it.dur = dur; it.size = size;
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.s.visible) continue;
      it.t += dt;
      const k = it.t / it.dur;
      if (k >= 1) { it.s.visible = false; continue; }
      const sc = it.size * (0.6 + k * 0.9);
      it.s.scale.set(sc, sc, 1);
      it.s.material.opacity = (1 - k) * (1 - k);
    }
  }
  clear() { for (const it of this.items) it.s.visible = false; }
}

export { softDot };
