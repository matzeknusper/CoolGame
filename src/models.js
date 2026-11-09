// Procedural low-poly models. Everything is built from primitives and merged into single
// vertex-coloured geometries so each model is one draw call (or one instanced draw call).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

// mask: 0 = plain colour, 1 = multiplied with the tint (team colour), 2 = emissive/unlit
export function part(geo, color, mask = 0, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  if (typeof scale === 'number') scale = [scale, scale, scale];
  _e.set(rot[0], rot[1], rot[2]);
  _q.setFromEuler(_e);
  _m.compose(_p.set(pos[0], pos[1], pos[2]), _q, _s.set(scale[0], scale[1], scale[2]));
  geo.applyMatrix4(_m);
  const n = geo.attributes.position.count;
  _c.set(color);
  const col = new Float32Array(n * 3), msk = new Float32Array(n);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; msk[i] = mask; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('mask', new THREE.BufferAttribute(msk, 1));
  return geo;
}

export function merge(parts) {
  const mixed = parts.some((p) => !p.index);
  const list = mixed ? parts.map((p) => (p.index ? p.toNonIndexed() : p)) : parts;
  const g = mergeGeometries(list, false);
  parts.forEach((p) => p.dispose());
  g.computeBoundingSphere();
  return g;
}

const sph = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg);

// ---- the player's creature: a "Wusel" (faces -z) ---------------------------------------
export function wuselGeo(detail = 1) {
  const bw = detail > 0 ? 12 : 8, bh = detail > 0 ? 8 : 6;
  const p = [
    part(sph(0.34, bw, bh), 0xffffff, 1, [0, 0.33, 0], [0, 0, 0], [1, 0.94, 1]),
    part(sph(0.11, 7, 5), 0xffffff, 0, [-0.125, 0.43, -0.245]),
    part(sph(0.11, 7, 5), 0xffffff, 0, [0.125, 0.43, -0.245]),
    part(sph(0.058, 6, 4), 0x1b1035, 0, [-0.12, 0.44, -0.33]),
    part(sph(0.058, 6, 4), 0x1b1035, 0, [0.12, 0.44, -0.33]),
    part(cone(0.03, 0.2, 4), 0xdddddd, 1, [0, 0.72, 0.02]),
    part(sph(0.065, 6, 4), 0xfff27a, 2, [0, 0.84, 0.02]),
  ];
  if (detail > 0) {
    p.push(part(sph(0.1, 6, 4), 0x9a9a9a, 1, [-0.15, 0.05, -0.02], [0, 0, 0], [1, 0.55, 1.3]));
    p.push(part(sph(0.1, 6, 4), 0x9a9a9a, 1, [0.15, 0.05, -0.02], [0, 0, 0], [1, 0.55, 1.3]));
  }
  return merge(p);
}

export function megaGeo() {
  const g = wuselGeo(1);
  const crown = [];
  crown.push(part(cyl(0.2, 0.22, 0.09, 8), 0xffc93a, 0, [0, 0.69, 0]));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    crown.push(part(cone(0.055, 0.14, 4), 0xffc93a, 0, [Math.cos(a) * 0.17, 0.79, Math.sin(a) * 0.17]));
  }
  crown.push(part(sph(0.05, 6, 4), 0xff4f8a, 2, [0, 0.72, -0.2]));
  return merge([g, ...crown]);
}

// ---- enemies: "Grummels" (face +z) ----------------------------------------------------
function grummelBase(detail = 1) {
  const bw = detail > 0 ? 11 : 8, bh = detail > 0 ? 8 : 6;
  return [
    part(sph(0.34, bw, bh), 0xffffff, 1, [0, 0.34, 0], [0, 0, 0], [1, 1, 0.95]),
    part(sph(0.1, 7, 5), 0xfff3d6, 0, [-0.13, 0.42, 0.25]),
    part(sph(0.1, 7, 5), 0xfff3d6, 0, [0.13, 0.42, 0.25]),
    part(sph(0.05, 6, 4), 0x2a0612, 0, [-0.125, 0.415, 0.335]),
    part(sph(0.05, 6, 4), 0x2a0612, 0, [0.125, 0.415, 0.335]),
    // angry brows
    part(box(0.2, 0.06, 0.08), 0x1b0a2a, 0, [-0.13, 0.53, 0.27], [0.2, 0, -0.45]),
    part(box(0.2, 0.06, 0.08), 0x1b0a2a, 0, [0.13, 0.53, 0.27], [0.2, 0, 0.45]),
  ];
}

export function gruntGeo(detail = 1) {
  const p = grummelBase(detail);
  p.push(part(cone(0.075, 0.26, 5), 0xfff0cf, 0, [-0.2, 0.68, 0], [0, 0, 0.5]));
  p.push(part(cone(0.075, 0.26, 5), 0xfff0cf, 0, [0.2, 0.68, 0], [0, 0, -0.5]));
  if (detail > 0) {
    p.push(part(cone(0.04, 0.09, 4), 0xffffff, 0, [-0.06, 0.24, 0.3], [Math.PI, 0, 0]));
    p.push(part(cone(0.04, 0.09, 4), 0xffffff, 0, [0.06, 0.24, 0.3], [Math.PI, 0, 0]));
  }
  return merge(p);
}

export function runnerGeo() {
  const p = grummelBase(1);
  // mohawk fin + swept back spikes
  for (let i = 0; i < 4; i++) p.push(part(cone(0.07, 0.3 - i * 0.04, 4), 0xfff27a, 2, [0, 0.72 - i * 0.07, -0.02 - i * 0.12], [-0.5 - i * 0.25, 0, 0]));
  const g = merge(p);
  g.scale(0.82, 1.12, 0.9);
  return g;
}

export function panzerGeo() {
  const p = grummelBase(1);
  // steel helmet + front plate
  p.push(part(new THREE.SphereGeometry(0.37, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), 0x9aa3b8, 0, [0, 0.4, -0.02]));
  p.push(part(cyl(0.39, 0.39, 0.06, 10), 0x6a7288, 0, [0, 0.42, -0.02]));
  p.push(part(cone(0.07, 0.2, 5), 0xd8dde8, 0, [0, 0.84, -0.02]));
  p.push(part(box(0.5, 0.26, 0.08), 0x7d869c, 0, [0, 0.16, 0.31], [-0.25, 0, 0]));
  const g = merge(p);
  g.scale(1.25, 1.2, 1.25);
  return g;
}

export function bomberGeo() {
  const p = grummelBase(1);
  p.push(part(cyl(0.035, 0.035, 0.2, 5), 0x3a2a1a, 0, [0, 0.76, 0], [0.3, 0, 0.2]));
  p.push(part(sph(0.08, 6, 4), 0xffe45c, 2, [0.03, 0.88, 0.03]));
  p.push(part(cyl(0.35, 0.35, 0.07, 10), 0x2a2026, 0, [0, 0.33, 0], [0, 0, 0.5]));
  const g = merge(p);
  g.scale(1.15, 1.1, 1.15);
  return g;
}

export function bruteGeo(boss = false) {
  const p = grummelBase(1);
  p.push(part(cone(0.1, 0.42, 6), 0xfff0cf, 0, [-0.27, 0.7, 0.02], [0.1, 0, 0.75]));
  p.push(part(cone(0.1, 0.42, 6), 0xfff0cf, 0, [0.27, 0.7, 0.02], [0.1, 0, -0.75]));
  // jaw with teeth
  p.push(part(box(0.36, 0.08, 0.1), 0x1b0a2a, 0, [0, 0.2, 0.3]));
  for (let i = 0; i < 4; i++) p.push(part(cone(0.04, 0.1, 4), 0xffffff, 0, [-0.12 + i * 0.08, 0.27, 0.32]));
  // back spikes
  for (let i = 0; i < 3; i++) p.push(part(cone(0.07, 0.2, 5), 0x2a0f4a, 0, [0, 0.62 - i * 0.14, -0.2 - i * 0.07], [-0.9 - i * 0.3, 0, 0]));
  // arms
  p.push(part(sph(0.12, 6, 5), 0xcfcfcf, 1, [-0.38, 0.3, 0.08], [0, 0, 0], [1, 1.3, 1]));
  p.push(part(sph(0.12, 6, 5), 0xcfcfcf, 1, [0.38, 0.3, 0.08], [0, 0, 0], [1, 1.3, 1]));
  if (boss) {
    p.push(part(cyl(0.22, 0.25, 0.1, 10), 0xffc93a, 0, [0, 0.7, 0]));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      p.push(part(cone(0.055, 0.16, 4), 0xffc93a, 0, [Math.cos(a) * 0.2, 0.82, Math.sin(a) * 0.2]));
    }
    p.push(part(sph(0.06, 6, 4), 0xff3b6a, 2, [0, 0.74, 0.24]));
  }
  return merge(p);
}

// ---- launcher (faces -z) ---------------------------------------------------------------
export function launcherBodyGeo() {
  const p = [
    part(sph(1, 14, 10), 0xffffff, 1, [0, 0.62, 0.1], [0, 0, 0], [1.05, 0.42, 1.3]),
    part(box(1.5, 0.16, 2.0), 0x2a2440, 0, [0, 0.36, 0.1]),
    part(cyl(0.62, 0.72, 0.3, 14), 0xf3efe6, 0, [0, 0.98, 0.25]),
    // bumper
    part(box(1.9, 0.22, 0.26), 0xf3efe6, 0, [0, 0.42, -1.12]),
    part(sph(0.1, 6, 4), 0xfff27a, 2, [-0.7, 0.44, -1.26]),
    part(sph(0.1, 6, 4), 0xfff27a, 2, [0.7, 0.44, -1.26]),
    // exhausts
    part(cyl(0.13, 0.16, 0.5, 8), 0x8a8fa8, 0, [-0.55, 0.62, 1.32], [1.3, 0, 0]),
    part(cyl(0.13, 0.16, 0.5, 8), 0x8a8fa8, 0, [0.55, 0.62, 1.32], [1.3, 0, 0]),
    // antenna with flag
    part(cyl(0.025, 0.025, 1.0, 5), 0xdddddd, 0, [0.72, 1.2, 0.9]),
    part(box(0.36, 0.22, 0.03), 0xffffff, 1, [0.9, 1.56, 0.9]),
  ];
  // chunky wheels
  for (const [x, z] of [[-0.98, -0.62], [0.98, -0.62], [-0.98, 0.82], [0.98, 0.82]]) {
    p.push(part(cyl(0.36, 0.36, 0.3, 12), 0x24202e, 0, [x, 0.36, z], [0, 0, Math.PI / 2]));
    p.push(part(cyl(0.17, 0.17, 0.32, 8), 0xffc93a, 0, [x, 0.36, z], [0, 0, Math.PI / 2]));
  }
  return merge(p);
}

export function launcherBarrelGeo() {
  // origin is the pivot; barrel points to -z, tilted up slightly by the mesh rotation
  const p = [
    part(cyl(0.34, 0.44, 1.5, 14), 0xf3efe6, 0, [0, 0, -0.6], [Math.PI / 2, 0, 0]),
    part(cyl(0.5, 0.5, 0.16, 14), 0xffffff, 1, [0, 0, -1.32], [Math.PI / 2, 0, 0]),
    part(cyl(0.47, 0.47, 0.12, 14), 0xffffff, 1, [0, 0, -0.5], [Math.PI / 2, 0, 0]),
    part(cyl(0.36, 0.36, 0.06, 14), 0x1b1035, 0, [0, 0, -1.4], [Math.PI / 2, 0, 0]),
    part(sph(0.5, 10, 8), 0xf3efe6, 0, [0, 0, 0.1]),
  ];
  return merge(p);
}

// ---- enemy fort (front faces +z) -------------------------------------------------------
export function fortGeo(theme) {
  const A = theme.fortA, B = theme.fortB, R = theme.fortRoof;
  const p = [
    part(box(9.8, 2.5, 1.5), A, 0, [0, 1.25, 0]),
    part(box(9.8, 0.3, 1.8), B, 0, [0, 2.5, 0]),
    part(box(3.4, 2.1, 0.3), 0x120818, 0, [0, 1.05, 0.68]),
    part(box(3.9, 0.35, 0.5), B, 0, [0, 2.2, 0.7]),
    part(box(3.2, 1.6, 1.3), A, 0, [0, 3.3, -0.1]),
    part(cone(2.5, 1.5, 4), R, 0, [0, 4.85, -0.1], [0, Math.PI / 4, 0]),
    part(box(0.5, 0.6, 0.1), 0xffd86a, 2, [-0.7, 3.4, 0.56]),
    part(box(0.5, 0.6, 0.1), 0xffd86a, 2, [0.7, 3.4, 0.56]),
  ];
  for (let i = 0; i < 7; i++) p.push(part(box(0.7, 0.5, 0.4), A, 0, [-4.2 + i * 1.4, 2.9, 0.65]));
  for (let i = 0; i < 6; i++) p.push(part(box(0.12, 2.0, 0.1), 0x8a3ff0, 2, [-1.25 + i * 0.5, 1.0, 0.86]));
  for (const x of [-4.1, 4.1]) {
    p.push(part(cyl(1.0, 1.15, 4.2, 10), B, 0, [x, 2.1, 0.2]));
    p.push(part(cyl(1.2, 1.2, 0.35, 10), A, 0, [x, 4.2, 0.2]));
    p.push(part(cone(1.25, 1.7, 10), R, 0, [x, 5.2, 0.2]));
    p.push(part(box(0.3, 0.5, 0.1), 0xffd86a, 2, [x, 2.9, 1.25]));
    p.push(part(cyl(0.04, 0.04, 1.0, 4), 0xdddddd, 0, [x, 6.4, 0.2]));
    p.push(part(box(0.6, 0.36, 0.04), 0x8a3ff0, 2, [x + 0.32, 6.7, 0.2]));
  }
  return merge(p);
}

export function ruinGeo(theme) {
  const p = [];
  let seed = 3;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 16; i++) {
    const s = 0.4 + r() * 0.9;
    p.push(part(box(s * 1.4, s * 0.7, s), i % 2 ? theme.fortA : theme.fortB, 0, [-4.2 + r() * 8.4, s * 0.3, (r() - 0.5) * 1.6], [r() * 0.5, r() * 3, r() * 0.5]));
  }
  return merge(p);
}

export function bossGateGeo(theme) {
  const p = [part(new THREE.TorusGeometry(3.4, 0.45, 8, 20), theme.fortB, 0, [0, 3.0, 0])];
  p.push(part(new THREE.TorusGeometry(3.4, 0.16, 6, 20), 0xc04cff, 2, [0, 3.0, 0.3]));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.push(part(cone(0.3, 1.1, 5), theme.fortRoof, 0, [Math.cos(a) * 3.9, 3 + Math.sin(a) * 3.9, 0], [0, 0, a - Math.PI / 2]));
  }
  p.push(part(box(9.6, 0.5, 2.4), theme.fortA, 0, [0, 0.0, 0]));
  return merge(p);
}

// ---- obstacles -------------------------------------------------------------------------
export function crateGeo() {
  return new THREE.BoxGeometry(1.5, 1.5, 1.5);
}

export function cageGeo() {
  const p = [part(cyl(1.0, 1.0, 0.16, 10), 0x6a7288, 0, [0, 0.08, 0]), part(cyl(1.0, 1.0, 0.16, 10), 0x6a7288, 0, [0, 1.75, 0]),
    part(cone(1.0, 0.5, 10), 0x8a93aa, 0, [0, 2.08, 0]), part(sph(0.12, 6, 4), 0xffc93a, 0, [0, 2.38, 0])];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    p.push(part(cyl(0.05, 0.05, 1.7, 5), 0xc9cfdd, 0, [Math.cos(a) * 0.9, 0.9, Math.sin(a) * 0.9]));
  }
  return merge(p);
}

export function mineGeo() {
  const p = [part(sph(0.8, 12, 9), 0x2a2030, 0, [0, 0.85, 0]), part(sph(0.3, 8, 6), 0xff4a2a, 2, [0, 0.85, 0.62]),
    part(cyl(0.9, 0.9, 0.14, 12), 0xffcf2e, 0, [0, 0.85, 0])];
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, -1], [0.7, 0.7, 0], [-0.7, 0.7, 0], [0, 0.7, -0.7], [0.7, 0, -0.7], [-0.7, 0, -0.7], [0.6, 0.6, 0.5], [-0.6, 0.6, 0.5]];
  for (const d of dirs) {
    const v = new THREE.Vector3(d[0], d[1], d[2]).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    const e = new THREE.Euler().setFromQuaternion(q);
    p.push(part(cone(0.14, 0.4, 5), 0x8a93aa, 0, [v.x * 0.9, 0.85 + v.y * 0.9, v.z * 0.9], [e.x, e.y, e.z]));
  }
  return merge(p);
}

export function sawGeo(r) {
  const p = [part(cyl(r * 0.82, r * 0.82, 0.1, 18), 0xd8dde8, 0), part(cyl(r * 0.3, r * 0.3, 0.2, 10), 0xff4a2a, 0)];
  const teeth = 12;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    p.push(part(cone(r * 0.2, r * 0.36, 3), 0xf4f6fb, 0, [Math.cos(a) * r * 0.9, 0, Math.sin(a) * r * 0.9], [Math.PI / 2, 0, -a + Math.PI / 2 + 0.5]));
  }
  return merge(p);
}

export function spinnerGeo(len) {
  const p = [part(box(len * 2, 0.34, 0.42), 0xffcf2e, 0, [0, 0.45, 0]), part(cyl(0.5, 0.62, 0.7, 10), 0x3a3448, 0, [0, 0.35, 0]),
    part(sph(0.3, 8, 6), 0xff4a2a, 2, [0, 0.78, 0])];
  const n = Math.floor(len * 2 / 0.7);
  for (let i = 0; i < n; i++) {
    const x = -len + 0.35 + i * ((len * 2 - 0.7) / Math.max(1, n - 1));
    if (Math.abs(x) < 0.6) continue;
    p.push(part(box(0.2, 0.36, 0.44), 0x24202e, 0, [x, 0.45, 0]));
    p.push(part(cone(0.1, 0.3, 4), 0xf4f6fb, 0, [x + 0.25, 0.45, 0.3], [Math.PI / 2, 0, 0]));
    p.push(part(cone(0.1, 0.3, 4), 0xf4f6fb, 0, [x + 0.25, 0.45, -0.3], [-Math.PI / 2, 0, 0]));
  }
  return merge(p);
}

export function turretGeo(theme) {
  const p = [part(cyl(0.9, 1.1, 1.6, 8), theme.fortB, 0, [0, 0.8, 0]), part(cyl(1.05, 1.05, 0.3, 8), theme.fortA, 0, [0, 1.7, 0]),
    part(sph(0.7, 10, 7), theme.fortRoof, 0, [0, 2.1, 0]), part(cyl(0.26, 0.32, 1.3, 8), 0x2a2030, 0, [0, 2.7, 0.3], [0.5, 0, 0]),
    part(sph(0.16, 6, 4), 0xff4a2a, 2, [0, 2.2, 0.7])];
  return merge(p);
}

export function gatePostGeo() {
  const p = [part(cyl(0.16, 0.2, 2.5, 8), 0xf3efe6, 0, [0, 1.25, 0]), part(cyl(0.3, 0.34, 0.24, 8), 0x2a2440, 0, [0, 0.12, 0]),
    part(sph(0.24, 8, 6), 0xffffff, 1, [0, 2.62, 0])];
  return merge(p);
}

// ---- scenery ---------------------------------------------------------------------------
// Returns one merged geometry with all decoration of a level (a single draw call).
export function decorGeo(kind, zEnd, seed0 = 1, density = 1) {
  let seed = seed0 * 7 + 11;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const rr = (a, b) => a + (b - a) * r();
  const parts = [];
  const add = (builder, x, y, z, s, ry = r() * 6.28) => {
    for (const g of builder(r)) {
      _e.set(0, ry, 0); _q.setFromEuler(_e);
      _m.compose(_p.set(x, y, z), _q, _s.set(s, s, s));
      g.applyMatrix4(_m);
      parts.push(g);
    }
  };
  const B = BUILDERS[kind];
  const len = Math.abs(zEnd) + 60;
  const count = Math.round((len / 5.5) * density);
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1;
    const near = r() < 0.55;
    const x = side * (near ? rr(8.5, 16) : rr(16, 46));
    const z = 14 - (i / count) * len + rr(-3, 3);
    const big = !near && r() < 0.5;
    const kindIdx = big ? 2 : r() < 0.6 ? 0 : 1;
    const s = (big ? rr(2.2, 4.2) : rr(0.9, 1.8)) * (near ? 1 : 1.3);
    const y = B.y(near, r);
    add(B.items[kindIdx], x, y, z, s);
  }
  // support pylons under the track
  for (let z = -6; z > zEnd; z -= 18) {
    for (const x of [-3.6, 3.6]) parts.push(part(cyl(0.5, 0.75, 14, 6), B.pylon, 0, [x, -8.2, z]));
    parts.push(part(box(8.6, 0.6, 1.2), B.pylon, 0, [0, -1.5, z]));
  }
  return merge(parts);
}

const island = (top, side) => (r) => [
  part(cyl(2.2, 1.9, 0.5, 7), top, 0, [0, 0, 0]),
  part(cone(1.9, 2.6, 7), side, 0, [0, -1.55, 0], [Math.PI, 0, 0]),
];
const tree = (trunk, leaf, leaf2) => (r) => [
  ...island(0x6fcf5a, 0x8a6a48)(r),
  part(cyl(0.16, 0.22, 1.2, 5), trunk, 0, [0.3, 0.8, 0.2]),
  part(sph(0.85, 7, 5), leaf, 0, [0.3, 1.9, 0.2]),
  part(sph(0.6, 6, 5), leaf2, 0, [-0.5, 1.0, -0.5]),
  part(sph(0.14, 5, 4), 0xff6fae, 0, [-0.9, 0.36, 0.7]),
  part(sph(0.14, 5, 4), 0xffe45c, 0, [0.9, 0.36, -0.9]),
];
const pine = (snow) => (r) => [
  ...island(snow ? 0xf2f8ff : 0x5fbf62, snow ? 0x8fa6c8 : 0x8a6a48)(r),
  part(cyl(0.14, 0.2, 0.7, 5), 0x6a4a2a, 0, [0, 0.55, 0]),
  part(cone(0.95, 1.3, 7), snow ? 0x3f8f7a : 0x2f9a4a, 0, [0, 1.45, 0]),
  part(cone(0.72, 1.1, 7), snow ? 0x4fa88c : 0x3bb35a, 0, [0, 2.2, 0]),
  part(cone(0.45, 0.8, 7), snow ? 0xffffff : 0x55c96e, 0, [0, 2.9, 0]),
];
const rock = (a, b) => (r) => [
  part(new THREE.IcosahedronGeometry(1.2, 0), a, 0, [0, 0, 0], [r() * 3, r() * 3, 0], [1.3, 0.9, 1]),
  part(new THREE.IcosahedronGeometry(0.7, 0), b, 0, [0.9, 0.5, 0.4], [r() * 3, r() * 3, 0]),
];
const mesa = (a, b, c) => (r) => [
  part(cyl(2.2, 2.7, 2.2, 7), a, 0, [0, 0, 0]),
  part(cyl(1.6, 2.0, 1.4, 7), b, 0, [0.3, 1.8, 0]),
  part(cyl(0.9, 1.3, 1.0, 6), c, 0, [0.5, 3.0, 0.2]),
];
const cactus = (r) => [
  ...island(0xf3d08a, 0xb9834a)(r),
  part(cyl(0.28, 0.3, 1.8, 7), 0x3fae5a, 0, [0, 1.15, 0]),
  part(sph(0.28, 6, 4), 0x3fae5a, 0, [0, 2.05, 0]),
  part(cyl(0.16, 0.16, 0.7, 6), 0x4fc36b, 0, [0.48, 1.2, 0], [0, 0, -1.2]),
  part(cyl(0.16, 0.16, 0.7, 6), 0x4fc36b, 0, [0.75, 1.6, 0]),
  part(cyl(0.16, 0.16, 0.5, 6), 0x4fc36b, 0, [-0.42, 0.9, 0], [0, 0, 1.2]),
  part(sph(0.1, 5, 4), 0xff6fae, 0, [0, 2.36, 0]),
];
const pyramid = (r) => [
  part(cone(3, 3.4, 4), 0xe9c27a, 0, [0, 1.2, 0], [0, Math.PI / 4, 0]),
  part(cone(0.7, 0.8, 4), 0xffe9a0, 2, [0, 2.6, 0], [0, Math.PI / 4, 0]),
];
const crystal = (a, b, glow) => (r) => [
  part(new THREE.OctahedronGeometry(1, 0), a, glow ? 2 : 0, [0, 1.0, 0], [0, r() * 3, 0.15], [0.6, 1.9, 0.6]),
  part(new THREE.OctahedronGeometry(0.7, 0), b, 0, [0.8, 0.5, 0.2], [0.4, r() * 3, -0.4], [0.55, 1.5, 0.55]),
  part(new THREE.OctahedronGeometry(0.5, 0), a, 0, [-0.7, 0.3, -0.3], [-0.3, r() * 3, 0.5], [0.55, 1.4, 0.55]),
  part(new THREE.IcosahedronGeometry(1.1, 0), b, 0, [0, -0.5, 0], [0, 0, 0], [1.3, 0.5, 1.3]),
];
const spire = (a, glow) => (r) => [
  part(cone(1.3, 5, 6), a, 0, [0, 1.5, 0], [0.06, 0, 0.05]),
  part(cone(0.8, 3, 5), a, 0, [1.1, 0.6, 0.4], [0.2, 0, -0.3]),
  part(new THREE.OctahedronGeometry(0.4, 0), glow, 2, [0.2, 4.2, 0]),
];
const volcano = (r) => [
  part(cyl(1.1, 3.6, 3.6, 8), 0x3a2a30, 0, [0, 0.8, 0]),
  part(cyl(1.0, 1.0, 0.2, 8), 0xff7a1a, 2, [0, 2.62, 0]),
  part(cone(0.5, 2.4, 5), 0xffc23a, 2, [0, 3.6, 0]),
];
const tower = (a, glow, glow2) => (r) => {
  const h = 4 + r() * 6;
  const p = [part(box(1.8, h, 1.8), a, 0, [0, h / 2 - 3, 0]), part(box(1.9, 0.14, 1.9), glow, 2, [0, h - 3, 0])];
  const rows = Math.floor(h / 0.9);
  for (let i = 0; i < rows; i++) if (r() < 0.7) p.push(part(box(1.84, 0.16, 1.84), r() < 0.5 ? glow : glow2, 2, [0, -2.6 + i * 0.9, 0]));
  p.push(part(cyl(0.04, 0.04, 1.4, 4), 0xdddddd, 0, [0.5, h - 2.3, 0.5]));
  return p;
};
const planet = (a, ring) => (r) => [
  part(sph(1.6, 12, 9), a, 0, [0, 1, 0]),
  part(new THREE.TorusGeometry(2.5, 0.16, 5, 22), ring, 2, [0, 1, 0], [1.3, 0.3, 0]),
  part(sph(0.4, 7, 5), ring, 0, [2.9, 2.0, 0.6]),
];

const BUILDERS = {
  meadow: { pylon: 0xb9ad90, y: (near, r) => (near ? -3.5 + r() * 2 : -7 + r() * 5), items: [tree(0x8a5a2a, 0x4fc36b, 0x7fe07a), pine(false), mesa(0x7fbf6a, 0x6fcf5a, 0x9be08a)] },
  desert: { pylon: 0xa87440, y: (near, r) => (near ? -3.5 + r() * 2 : -7 + r() * 4), items: [cactus, rock(0xd9a05a, 0xe9c27a), pyramid] },
  frost: { pylon: 0x8fa6c8, y: (near, r) => (near ? -3.5 + r() * 2 : -7 + r() * 5), items: [pine(true), crystal(0xbfe9ff, 0x8fc4f2, false), mesa(0xc5dbf5, 0xe9f3ff, 0xffffff)] },
  lava: { pylon: 0x2a1e24, y: (near, r) => (near ? -4 + r() * 2 : -8 + r() * 3), items: [spire(0x3a2a30, 0xff7a1a), rock(0x3a2a30, 0x5a3a3a), volcano] },
  neon: { pylon: 0x1a1c3a, y: (near, r) => (near ? -5 + r() * 2 : -8 + r() * 3), items: [tower(0x161836, 0x37f2ff, 0xff3bd4), tower(0x1d1746, 0xff3bd4, 0xffe66a), tower(0x12142e, 0x37f2ff, 0xffe66a)] },
  cosmos: { pylon: 0x2a1860, y: (near, r) => (near ? -3.5 + r() * 3 : -8 + r() * 10), items: [crystal(0xff8ae0, 0x7a4ad6, true), rock(0x5a3aa8, 0x7a5ad0), planet(0xff9a5a, 0xffe9a0)] },
};
