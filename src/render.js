// three.js renderer: builds the level scene and mirrors the simulation state every frame.
import * as THREE from 'three';
import { HW, PCAP, ECAP, EK, ENEMY, OP, BT, EV, STATE } from './config.js';
import { THEMES, ENEMY_COLORS } from './themes.js';
import * as M from './models.js';
import * as T from './textures.js';
import { Particles, Rings, FloatTexts } from './fx.js';

const TOY_VERT = /* glsl */ `
attribute float mask;
uniform vec3 uTint;
varying vec3 vCol;
varying vec3 vN;
varying vec3 vW;
varying float vEm;
void main() {
  vec3 tint = uTint;
  #ifdef USE_INSTANCING_COLOR
    tint *= instanceColor;
  #endif
  float m1 = step(0.5, mask) * (1.0 - step(1.5, mask));
  vCol = color * mix(vec3(1.0), tint, m1);
  vEm = step(1.5, mask);
  #ifdef USE_INSTANCING
    mat4 mm = modelMatrix * instanceMatrix;
  #else
    mat4 mm = modelMatrix;
  #endif
  vec4 wp = mm * vec4(position, 1.0);
  vN = normalize(mat3(mm) * normal);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const TOY_FRAG = /* glsl */ `
uniform vec3 uLight;
uniform vec3 uLightCol;
uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFlash;
varying vec3 vCol;
varying vec3 vN;
varying vec3 vW;
varying float vEm;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float ndl = dot(n, uLight);
  float diff = smoothstep(-0.3, 0.8, ndl);
  vec3 amb = mix(uAmbGround, uAmbSky, n.y * 0.5 + 0.5);
  vec3 lit = vCol * (amb * 0.62 + uLightCol * diff * 0.72);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  lit += rim * 0.28 * mix(uAmbSky, vCol, 0.4);
  vec3 h = normalize(uLight + v);
  lit += pow(max(dot(n, h), 0.0), 48.0) * 0.5 * uLightCol;
  vec3 col = mix(lit, vCol * 1.35 + 0.08, vEm);
  col = mix(col, vec3(1.0), uFlash);
  float d = length(cameraPosition - vW);
  float fog = smoothstep(uFogNear, uFogFar, d);
  col = mix(col, uFogColor, fog * (1.0 - vEm * 0.5));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAG = /* glsl */ `
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot; uniform vec3 uSun; uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(uMid, uTop, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(uMid, uBot, clamp(-h * 3.5, 0.0, 1.0));
  col = mix(col, uBot, exp(-abs(h) * 9.0) * 0.75);
  float s = max(dot(d, uSunDir), 0.0);
  col += uSun * (pow(s, 220.0) * 1.2 + pow(s, 9.0) * 0.28);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const FILM_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vW;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FILM_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uTime; uniform float uFlash; uniform float uAlpha;
varying vec2 vUv;
void main() {
  float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
  float wave = 0.5 + 0.5 * sin(vUv.y * 16.0 - uTime * 3.5 + sin(vUv.x * 8.0 + uTime * 1.3) * 1.6);
  float a = 0.36 + 0.14 * wave + 0.28 * pow(1.0 - vUv.y, 3.0) + 0.3 * pow(vUv.y, 7.0) + (1.0 - edge) * 0.4;
  vec3 col = uColor * (0.85 + 0.45 * wave) + vec3(uFlash * 0.8);
  gl_FragColor = vec4(col, clamp(a + uFlash * 0.35, 0.0, 0.95) * uAlpha);
  #include <colorspace_fragment>
}`;

const GATE_COL = { [OP.MUL]: 0x16d4c4, [OP.ADD]: 0xffb81f, [OP.SUB]: 0xff2f55, [OP.DIV]: 0xff6a1f };
const GATE_SIGN = { [OP.MUL]: '×', [OP.ADD]: '+', [OP.SUB]: '−', [OP.DIV]: '÷' };
const PICK_NAMES = ['rapid', 'freeze', 'bomb', 'mega', 'heart'];
const PICK_COL = [0xffb81f, 0x5fd0ff, 0xff5a3a, 0xffd23a, 0xff4f8a];

const QUALITY = {
  low: { dpr: 1, aa: false, shadows: false, particles: 0.5, decor: 0.5 },
  medium: { dpr: 1.5, aa: false, shadows: true, particles: 0.8, decor: 0.8 },
  high: { dpr: 2, aa: true, shadows: true, particles: 1, decor: 1 },
};

const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _v = new THREE.Vector3();

export class Renderer {
  constructor(canvas, quality = 'medium') {
    this.canvas = canvas;
    this.qualityName = quality;
    this.q = QUALITY[quality] || QUALITY.medium;
    const r = (this.r = new THREE.WebGLRenderer({ canvas, antialias: this.q.aa, powerPreference: 'high-performance', alpha: false, stencil: false }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    this.dprCap = this.q.dpr;
    this.dprScale = 1;
    this.frameAvg = 16;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(58, 1, 0.5, 600);
    this.camPos = new THREE.Vector3(0, 12, 12);
    this.camLook = new THREE.Vector3(0, 0, -8);
    this.shake = 0;
    this.time = 0;
    this.intro = 0;

    this.U = {
      uLight: { value: new THREE.Vector3(0.4, 0.8, 0.4).normalize() },
      uLightCol: { value: new THREE.Color(1, 1, 1) },
      uAmbSky: { value: new THREE.Color(0.8, 0.9, 1) },
      uAmbGround: { value: new THREE.Color(0.5, 0.6, 0.4) },
      uFogColor: { value: new THREE.Color(0.8, 0.9, 1) },
      uFogNear: { value: 50 },
      uFogFar: { value: 160 },
    };
    this.toy = this.toyMat();

    // lights for the textured (Lambert) track
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.55);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    this.scene.add(this.hemi, this.sun);

    // sky
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: true,
      uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSun: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() } },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    this.dot = T.softDot();
    this.pNorm = new Particles(Math.round(1400 * this.q.particles), false, this.dot);
    this.pAdd = new Particles(Math.round(900 * this.q.particles), true, this.dot);
    this.scene.add(this.pNorm.points, this.pAdd.points);
    this.rings = new Rings(this.scene);
    this.texts = new FloatTexts(this.scene);

    this._creatures();
    this.levelGroup = null;
    this.level = null;
    this.skinColor = new THREE.Color(0x35e0a1);
    this.fxBudget = 0;
    this.resize();
  }

  toyMat(tint = 0xffffff) {
    return new THREE.ShaderMaterial({
      vertexShader: TOY_VERT, fragmentShader: TOY_FRAG, vertexColors: true,
      uniforms: { ...this.U, uTint: { value: new THREE.Color(tint) }, uFlash: { value: 0 } },
    });
  }

  _inst(geo, cap, mat, withColor) {
    const m = new THREE.InstancedMesh(geo, mat, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    if (withColor) {
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    // identity scale so untouched instances are valid matrices
    const a = m.instanceMatrix.array;
    for (let i = 0; i < cap; i++) { a[i * 16] = a[i * 16 + 5] = a[i * 16 + 10] = a[i * 16 + 15] = 1; }
    this.scene.add(m);
    return m;
  }

  _creatures() {
    const detail = this.qualityName === 'low' ? 0 : 1;
    this.playerMat = this.toyMat(0x35e0a1);
    this.playerMesh = this._inst(M.wuselGeo(detail), PCAP, this.playerMat, false);
    this.megaMesh = this._inst(M.megaGeo(), 40, this.playerMat, false);
    this.enemyMat = this.toyMat(0xffffff);
    this.enemyMeshes = [
      this._inst(M.gruntGeo(detail), ECAP, this.enemyMat, true),
      this._inst(M.runnerGeo(), 96, this.enemyMat, true),
      this._inst(M.panzerGeo(), 96, this.enemyMat, true),
      this._inst(M.bomberGeo(), 64, this.enemyMat, true),
      this._inst(M.bruteGeo(false), 64, this.enemyMat, true),
      this._inst(M.bruteGeo(true), 4, this.enemyMat, true),
    ];
    this.enemyCol = ENEMY_COLORS.map((h) => new THREE.Color(h));
    if (this.q.shadows) {
      const g = new THREE.PlaneGeometry(1, 1);
      g.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ map: T.shadowBlob(), transparent: true, depthWrite: false, fog: false, opacity: 0.8 });
      this.shadowMesh = this._inst(g, PCAP + ECAP, mat, false);
      this.shadowMesh.renderOrder = 2;
    }
  }

  setSkin(color) {
    this.skinColor.set(color);
    this.playerMat.uniforms.uTint.value.set(color);
    if (this.launcherMat) this.launcherMat.uniforms.uTint.value.set(color);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.w = w; this.h = h;
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap) * this.dprScale;
    this.r.setPixelRatio(dpr);
    this.r.setSize(w, h, false);
    this.cam.aspect = w / h;
    // portrait screens need the camera further back so the whole track width stays visible
    const a = w / h;
    this.cam.fov = a < 1 ? 60 : 46;
    this.camBack = a < 0.75 ? Math.min(1.75, 0.62 / a + 0.25) : 1;
    this.cam.updateProjectionMatrix();
    this.pNorm.mat.uniforms.uScale.value = h * dpr * 0.9;
    this.pAdd.mat.uniforms.uScale.value = h * dpr * 0.9;
  }

  // Adaptive resolution: keeps the frame rate up on weak GPUs.
  adapt(frameMs) {
    this.frameAvg += (frameMs - this.frameAvg) * 0.05;
    this.adaptT = (this.adaptT || 0) + frameMs;
    if (this.adaptT < 1500) return;
    this.adaptT = 0;
    if (this.frameAvg > 21 && this.dprScale > 0.55) { this.dprScale = Math.max(0.55, this.dprScale - 0.12); this.resize(); }
    else if (this.frameAvg < 14.5 && this.dprScale < 1) { this.dprScale = Math.min(1, this.dprScale + 0.06); this.resize(); }
  }

  // ---- level construction --------------------------------------------------------------
  disposeLevel() {
    if (!this.levelGroup) return;
    this.scene.remove(this.levelGroup);
    this.levelGroup.traverse((o) => {
      if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose();
      if (o.material && o.userData.ownMat) { if (o.material.map && o.userData.ownMap) o.material.map.dispose(); o.material.dispose(); }
    });
    for (const d of this.dyn || []) d.tex.dispose();
    this.levelGroup = null;
    this.rings.clear(); this.texts.clear();
    this.pNorm.n = 0; this.pAdd.n = 0;
  }

  buildLevel(level, sim) {
    this.disposeLevel();
    this.level = level;
    const th = (this.theme = THEMES[level.worldId]);
    const G = (this.levelGroup = new THREE.Group());
    this.scene.add(G);
    this.dyn = [];

    // atmosphere
    const U = this.U;
    U.uLight.value.set(...th.sunDir).normalize();
    U.uLightCol.value.set(th.light);
    U.uAmbSky.value.set(th.ambientSky);
    U.uAmbGround.value.set(th.ambientGround);
    U.uFogColor.value.set(th.fog);
    U.uFogNear.value = th.fogNear; U.uFogFar.value = th.fogFar;
    this.scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
    this.hemi.color.set(th.ambientSky); this.hemi.groundColor.set(th.ambientGround);
    this.sun.color.set(th.light); this.sun.position.set(...th.sunDir);
    const su = this.skyMat.uniforms;
    su.uTop.value.set(th.skyTop); su.uMid.value.set(th.skyMid); su.uBot.value.set(th.skyBot); su.uSun.value.set(th.sun);
    su.uSunDir.value.set(th.sunDir[0], th.sunDir[1] * 0.6, -Math.abs(th.sunDir[2]) - 0.6).normalize();
    this.r.setClearColor(th.fog);

    this._buildTrack(level, th, G);
    this._buildScenery(level, th, G);
    this._buildObjects(level, sim, th, G);
    this._buildLauncher(G);
    this.setSkin(this.skinColor);
    this.intro = 1.8;
    this.shake = 0;
    this.confettiT = 0;
  }

  _own(mesh, ownMap) { mesh.userData.ownMat = true; mesh.userData.ownMap = !!ownMap; return mesh; }

  _buildTrack(level, th, G) {
    const W = HW + 0.45;
    const zTop = 6, zBot = level.zEnd - 3;
    const cuts = new Set([zTop, zBot]);
    for (const h of level.holes) { cuts.add(h.z0); cuts.add(h.z1); }
    const zs = [...cuts].sort((a, b) => b - a);
    const pos = [], nor = [], uv = [], spos = [], snor = [];
    const curbParts = [];
    const quad = (arr, narr, a, b, c, d, n) => {
      arr.push(...a, ...b, ...c, ...a, ...c, ...d);
      for (let i = 0; i < 6; i++) narr.push(...n);
    };
    for (let i = 0; i < zs.length - 1; i++) {
      const za = zs[i], zb = zs[i + 1], mid = (za + zb) / 2;
      let spans = [[-W, W]];
      for (const h of level.holes) {
        if (mid > h.z0 && mid < h.z1) {
          const next = [];
          for (const [a, b] of spans) {
            if (h.x1 <= a || h.x0 >= b) { next.push([a, b]); continue; }
            if (h.x0 > a) next.push([a, h.x0]);
            if (h.x1 < b) next.push([h.x1, b]);
          }
          spans = next;
        }
      }
      for (const [x0, x1] of spans) {
        quad(pos, nor, [x0, 0, zb], [x0, 0, za], [x1, 0, za], [x1, 0, zb], [0, 1, 0]);
        const u0 = (x0 + W) / W, u1 = (x1 + W) / W, va = -za / W, vb = -zb / W;
        uv.push(u0, vb, u0, va, u1, va, u0, vb, u1, va, u1, vb);
        const D = -1.3;
        quad(spos, snor, [x0, 0, za], [x0, 0, zb], [x0, D, zb], [x0, D, za], [-1, 0, 0]);
        quad(spos, snor, [x1, 0, zb], [x1, 0, za], [x1, D, za], [x1, D, zb], [1, 0, 0]);
        quad(spos, snor, [x0, 0, za], [x0, D, za], [x1, D, za], [x1, 0, za], [0, 0, 1]);
        quad(spos, snor, [x1, 0, zb], [x1, D, zb], [x0, D, zb], [x0, 0, zb], [0, 0, -1]);
        quad(spos, snor, [x0, D, za], [x0, D, zb], [x1, D, zb], [x1, D, za], [0, -1, 0]);
        // striped curbs on the outer edges
        const seg = 1.5;
        for (const [edge, ok] of [[-W, x0 <= -W + 0.01], [W, x1 >= W - 0.01]]) {
          if (!ok) continue;
          const n = Math.max(1, Math.round((za - zb) / seg));
          const l = (za - zb) / n;
          for (let k = 0; k < n; k++) {
            const zc = za - (k + 0.5) * l;
            const stripe = Math.floor(-zc / seg) % 2 === 0;
            curbParts.push(M.part(new THREE.BoxGeometry(0.34, 0.3, l), stripe ? th.curb : th.curb2, th.track === 'grid' || th.track === 'basalt' ? (stripe ? 2 : 0) : 0, [edge - Math.sign(edge) * 0.17, 0.15, zc]));
          }
        }
      }
    }
    // warning frames around holes
    for (const h of level.holes) {
      const x0 = Math.max(h.x0, -W), x1 = Math.min(h.x1, W);
      const cx = (x0 + x1) / 2, cz = (h.z0 + h.z1) / 2;
      curbParts.push(M.part(new THREE.BoxGeometry(x1 - x0, 0.05, 0.16), 0xff3b3b, 2, [cx, 0.03, h.z1 + 0.08]));
      curbParts.push(M.part(new THREE.BoxGeometry(x1 - x0, 0.05, 0.16), 0xff3b3b, 2, [cx, 0.03, h.z0 - 0.08]));
      if (h.x0 > -W) curbParts.push(M.part(new THREE.BoxGeometry(0.16, 0.05, h.z1 - h.z0), 0xff3b3b, 2, [h.x0 - 0.08, 0.03, cz]));
      if (h.x1 < W) curbParts.push(M.part(new THREE.BoxGeometry(0.16, 0.05, h.z1 - h.z0), 0xff3b3b, 2, [h.x1 + 0.08, 0.03, cz]));
    }
    const top = new THREE.BufferGeometry();
    top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    top.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    top.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const map = T.trackTexture(th);
    map.anisotropy = Math.min(8, this.r.capabilities.getMaxAnisotropy());
    const emissive = th.track === 'grid' || th.track === 'basalt' || th.track === 'crystal';
    const topMat = new THREE.MeshLambertMaterial({ map, emissive: emissive ? 0xffffff : 0x000000, emissiveMap: emissive ? map : null, emissiveIntensity: emissive ? 0.45 : 0 });
    G.add(this._own(new THREE.Mesh(top, topMat), true));
    const side = new THREE.BufferGeometry();
    side.setAttribute('position', new THREE.Float32BufferAttribute(spos, 3));
    side.setAttribute('normal', new THREE.Float32BufferAttribute(snor, 3));
    G.add(this._own(new THREE.Mesh(side, new THREE.MeshLambertMaterial({ color: th.side }))));
    if (curbParts.length) G.add(new THREE.Mesh(M.merge(curbParts), this.toy));
  }

  _buildScenery(level, th, G) {
    G.add(new THREE.Mesh(M.decorGeo(th.decor, level.zEnd, level.n, this.q.decor), this.toy));
    // far ground
    const gt = T.groundTexture(th);
    gt.repeat.set(26, 26);
    const emissive = th.ground === 'lava' || th.ground === 'city' || th.ground === 'nebula';
    const gm = new THREE.MeshBasicMaterial({ map: gt, color: emissive ? 0xffffff : 0xf2f2f2 });
    const ground = this._own(new THREE.Mesh(new THREE.PlaneGeometry(900, 900), gm), true);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -13, level.zEnd / 2);
    G.add(ground);
    this.groundTex = gt;
    this.groundFlow = th.ground === 'water' || th.ground === 'lava' ? 0.012 : th.ground === 'nebula' ? 0.004 : 0;

    // clouds
    if (th.clouds) {
      const ct = T.cloudTexture();
      const n = Math.round(14 * this.q.decor);
      for (let i = 0; i < n; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, color: th.clouds, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
        const side = i % 2 ? 1 : -1;
        s.position.set(side * (18 + ((i * 37) % 50)), 2 + ((i * 13) % 22), 10 + level.zEnd * ((i * 0.37) % 1) - 30);
        const sc = 16 + ((i * 7) % 16);
        s.scale.set(sc * 2, sc, 1);
        s.userData.ownMat = true;
        s.userData.sharedGeo = true;
        s.renderOrder = -5;
        G.add(s);
        if (i === 0) s.userData.ownMap = true;
      }
    }
    // stars
    if (th.stars) {
      const n = 500, p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, e = Math.random() * 1.2 + 0.05;
        p[i * 3] = Math.cos(a) * Math.cos(e) * 280; p[i * 3 + 1] = Math.sin(e) * 280; p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 280;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const pts = this._own(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9, depthWrite: false })));
      pts.frustumCulled = false;
      this.stars = pts;
      G.add(pts);
    } else this.stars = null;

    // ambient motes (snow, embers, petals ...) – animated on the CPU, few points
    const n = Math.round(140 * this.q.particles);
    const p = new Float32Array(n * 3);
    this.ambSeed = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) this.ambSeed[i] = Math.random();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3).setUsage(THREE.DynamicDrawUsage));
    const add = th.ambient === 'embers' || th.ambient === 'sparks' || th.ambient === 'stardust';
    const pm = new THREE.PointsMaterial({ map: this.dot, color: th.ambientColor, size: th.ambient === 'snow' ? 0.3 : 0.24, transparent: true, opacity: 0.85, depthWrite: false, fog: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.ambient = this._own(new THREE.Points(g, pm));
    this.ambient.frustumCulled = false;
    this.ambientKind = th.ambient;
    G.add(this.ambient);
  }

  _label(text, w, h, fill) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: T.labelTexture(text, fill), transparent: true, depthWrite: false, fog: false }));
    m.userData.ownMat = true;
    m.renderOrder = 8;
    return m;
  }

  _dynSprite(scale, fill = '#ffffff') {
    const d = new T.DynLabel(fill);
    this.dyn.push(d);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: d.tex, transparent: true, depthWrite: false, depthTest: false, fog: false }));
    s.scale.set(scale * 2, scale, 1);
    s.userData.ownMat = true; s.userData.sharedGeo = true;
    s.renderOrder = 15;
    s.userData.label = d;
    return s;
  }

  _buildObjects(level, sim, th, G) {
    // gates
    this.gateObjs = sim.gates.map((g) => {
      const grp = new THREE.Group();
      const col = GATE_COL[g.op];
      const film = new THREE.Mesh(new THREE.PlaneGeometry(g.w * 2, 2.5), new THREE.ShaderMaterial({
        vertexShader: FILM_VERT, fragmentShader: FILM_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color(col) }, uTime: { value: 0 }, uFlash: { value: 0 }, uAlpha: { value: 1 } },
      }));
      film.position.y = 1.3; film.renderOrder = 6; film.userData.ownMat = true;
      grp.add(film);
      const postMat = this.toyMat(col);
      const postGeo = this.postGeo || (this.postGeo = M.gatePostGeo());
      for (const sx of [-1, 1]) {
        const p = new THREE.Mesh(postGeo, postMat);
        p.position.x = sx * g.w; p.userData.sharedGeo = true; p.userData.ownMat = sx === 1;
        grp.add(p);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(g.w * 2, 0.14, 0.14), new THREE.MeshBasicMaterial({ color: col, fog: false }));
      bar.position.y = 2.58; bar.userData.ownMat = true;
      grp.add(bar);
      const lw = Math.min(g.w * 1.9, 3.3);
      let label, dyn = null;
      if (g.op === OP.ADD || g.op === OP.SUB) {
        dyn = new T.DynLabel('#ffffff');
        this.dyn.push(dyn);
        label = new THREE.Mesh(new THREE.PlaneGeometry(lw, lw / 2), new THREE.MeshBasicMaterial({ map: dyn.tex, transparent: true, depthWrite: false, fog: false }));
        label.userData.ownMat = true; label.renderOrder = 8;
        dyn.set(GATE_SIGN[g.op] + g.pool);
      } else label = this._label(GATE_SIGN[g.op] + g.val, lw, lw / 2, '#ffffff');
      label.position.set(0, 1.38, 0.06);
      grp.add(label);
      grp.position.set(g.cx, 0, g.z);
      G.add(grp);
      return { grp, film, label, dyn, g, shown: -1, gone: 0 };
    });

    // forts
    this.fortObjs = sim.forts.map((f, i) => {
      const st = level.stages[i];
      const grp = new THREE.Group();
      grp.position.set(0, 0, f.z);
      let mesh, ruin = null, label = null;
      if (st.boss) {
        mesh = new THREE.Mesh(M.bossGateGeo(th), this.toy);
        mesh.position.z = -1.5;
      } else {
        mesh = new THREE.Mesh(M.fortGeo(th), this.toyMat());
        mesh.userData.ownMat = true;
        ruin = new THREE.Mesh(M.ruinGeo(th), this.toy);
        ruin.visible = false;
        grp.add(ruin);
        label = this._dynSprite(2.6);
        label.position.set(0, 7.6, 0.6);
        label.userData.label.set(String(f.hp));
        grp.add(label);
      }
      grp.add(mesh);
      G.add(grp);
      return { grp, mesh, ruin, label, f, shown: -1, shakeT: 0, boss: st.boss };
    });

    // blockers
    const crateMat = new THREE.MeshLambertMaterial({ map: T.crateTexture() });
    this.blockObjs = sim.blockers.map((b) => {
      const grp = new THREE.Group();
      grp.position.set(b.x, 0, b.z);
      let mesh;
      if (b.type === BT.CRATE) {
        mesh = new THREE.Mesh(M.crateGeo(), crateMat);
        mesh.position.y = 0.76; mesh.rotation.y = (b.x * 7 + b.z) % 0.6 - 0.3;
      } else if (b.type === BT.CAGE) {
        mesh = new THREE.Mesh(M.cageGeo(), this.toy);
        const inside = new THREE.Mesh(this.playerMesh.geometry, this.playerMat);
        inside.userData.sharedGeo = true; inside.scale.setScalar(1.5); inside.position.y = 0.15; inside.rotation.y = Math.PI;
        grp.add(inside);
        grp.userData.inside = inside;
      } else mesh = new THREE.Mesh(M.mineGeo(), this.toy);
      grp.add(mesh);
      const label = this._dynSprite(1.3, b.type === BT.CAGE ? '#8dffcf' : b.type === BT.TNT ? '#ffb39a' : '#ffe9a0');
      label.position.y = b.type === BT.CAGE ? 3.2 : 2.5;
      grp.add(label);
      G.add(grp);
      return { grp, mesh, label, b, shown: -1, wob: 0 };
    });
    crateMat.userData = {};
    this._crateMat = crateMat;

    // spinners, saws
    this.spinObjs = sim.spinners.map((s) => {
      const m = new THREE.Mesh(M.spinnerGeo(s.len), this.toy);
      m.position.set(s.x, 0, s.z);
      G.add(m);
      return { m, s };
    });
    this.sawObjs = sim.saws.map((s) => {
      const m = new THREE.Mesh(M.sawGeo(s.r), this.toy);
      m.position.set(s.cx, 0.22, s.z);
      G.add(m);
      const slit = new THREE.Mesh(new THREE.BoxGeometry(s.amp * 2 + s.r * 2, 0.03, 0.18), new THREE.MeshBasicMaterial({ color: 0x1b1420 }));
      slit.position.set(s.x, 0.02, s.z); slit.userData.ownMat = true;
      G.add(slit);
      return { m, s };
    });

    // pickups
    this.pickObjs = sim.pickups.map((p) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._icon(p.type), transparent: true, depthWrite: false, fog: false }));
      s.scale.set(1.5, 1.5, 1);
      s.position.set(p.x, 1.3, p.z);
      s.userData.ownMat = true; s.userData.sharedGeo = true;
      s.renderOrder = 9;
      G.add(s);
      return { s, p };
    });

    // turrets + shells
    const turretGeo = level.turrets.length ? M.turretGeo(th) : null;
    this.turretObjs = sim.turrets.map((t) => {
      const m = new THREE.Mesh(turretGeo, this.toy);
      m.position.set(t.side * (HW + 1.6), -0.6, t.z);
      m.rotation.y = t.side > 0 ? -Math.PI / 2 - 0.5 : Math.PI / 2 + 0.5;
      m.userData.sharedGeo = true;
      G.add(m);
      return { m, t };
    });
    if (turretGeo) this.levelGroup.userData.turretGeo = turretGeo;
    this.shellPool = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), new THREE.MeshBasicMaterial({ color: 0x24202e }));
      m.visible = false; m.userData.ownMat = true;
      G.add(m);
      this.shellPool.push(m);
    }

    // shield line in front of the launcher
    const line = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 + 0.4, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    line.rotation.x = -Math.PI / 2; line.userData.ownMat = true; line.renderOrder = 3;
    G.add(line);
    this.shieldLine = line;
  }

  _icon(type) {
    this.icons = this.icons || {};
    return this.icons[type] || (this.icons[type] = T.iconTexture(PICK_NAMES[type]));
  }

  _buildLauncher(G) {
    this.launcherMat = this.toyMat(this.skinColor.getHex());
    const grp = new THREE.Group();
    this.bodyGeo = this.bodyGeo || M.launcherBodyGeo();
    this.barrelGeo = this.barrelGeo || M.launcherBarrelGeo();
    const body = new THREE.Mesh(this.bodyGeo, this.launcherMat);
    body.userData.sharedGeo = true; body.userData.ownMat = true;
    const barrel = new THREE.Mesh(this.barrelGeo, this.launcherMat);
    barrel.userData.sharedGeo = true;
    barrel.position.set(0, 1.28, 0.25);
    barrel.rotation.x = 0.2;
    grp.add(body, barrel);
    G.add(grp);
    this.launcher = { grp, body, barrel, recoil: 0, tilt: 0, lastX: 0 };
  }

  // ---- per-frame sync ---------------------------------------------------------------------
  update(sim, dt, menu = false) {
    this.time += dt;
    this.fxBudget = 46;
    const t = this.time;
    this._syncUnits(sim, t);
    this._syncObjects(sim, dt, t);
    this._camera(sim, dt, menu);
    this._ambient(dt);
    this.pNorm.update(dt); this.pAdd.update(dt);
    this.rings.update(dt); this.texts.update(dt);
    if (this.groundFlow) { this.groundTex.offset.x += this.groundFlow * dt; this.groundTex.offset.y += this.groundFlow * 0.6 * dt; }
    if (sim.state === STATE.WON) {
      this.confettiT -= dt;
      if (this.confettiT <= 0) {
        this.confettiT = 0.05;
        const cols = [0xffc93a, 0xff4f8a, 0x35e0a1, 0x5fd0ff, 0xffffff];
        for (let i = 0; i < 4; i++) {
          this.pNorm.spawn(sim.lx + (Math.random() - 0.5) * 16, 10 + Math.random() * 4, sim.lz - 4 - Math.random() * 14, (Math.random() - 0.5) * 2, -1, (Math.random() - 0.5) * 2, cols[(Math.random() * 5) | 0], 0.5, 2.6, 2.2, 0.6);
        }
      }
    }
  }

  _syncUnits(sim, t) {
    const sh = this.shadowMesh ? this.shadowMesh.instanceMatrix.array : null;
    let sc = 0;
    const pm = this.playerMesh.instanceMatrix.array, mm = this.megaMesh.instanceMatrix.array;
    let pc = 0, mc = 0;
    const megaBase = sim.stats.megaHp;
    for (let i = 0; i < sim.pn; i++) {
      const hp = sim.php[i];
      if (hp <= 0) continue;
      const mega = sim.pkind[i] === 1;
      const age = sim.time - sim.pborn[i];
      const pop = age < 0.14 ? 0.3 + (age / 0.14) * 0.9 : age < 0.26 ? 1.2 - ((age - 0.14) / 0.12) * 0.2 : 1;
      const ph = sim.pph[i];
      const s1 = Math.sin(ph);
      let y = Math.abs(s1) * (mega ? 0.3 : 0.17);
      const sq = Math.sin(ph * 2) * 0.09;
      let base = mega ? 2.0 + Math.min(0.9, (hp / megaBase) * 0.5) : hp > 1 ? 1.15 + Math.min(1.1, Math.log2(hp) * 0.2) : 1;
      base *= pop;
      const fall = sim.pfall[i];
      if (fall > 0) { y -= fall * fall * 16; base *= Math.max(0.25, 1 - fall * 0.8); }
      const arr = mega ? mm : pm;
      if (mega && mc >= 40) continue;
      const o = (mega ? mc++ : pc++) * 16;
      const sx = base * (1 - sq * 0.6), sy = base * (1 + sq);
      arr[o] = sx; arr[o + 1] = 0; arr[o + 2] = 0; arr[o + 3] = 0;
      arr[o + 4] = 0; arr[o + 5] = sy; arr[o + 6] = 0; arr[o + 7] = 0;
      arr[o + 8] = 0; arr[o + 9] = 0; arr[o + 10] = sx; arr[o + 11] = 0;
      arr[o + 12] = sim.px[i]; arr[o + 13] = y; arr[o + 14] = sim.pz[i]; arr[o + 15] = 1;
      if (sh && fall <= 0) {
        const s = base * 0.95 * (1 - y * 0.8);
        const q = sc++ * 16;
        sh[q] = s; sh[q + 5] = 1; sh[q + 10] = s; sh[q + 12] = sim.px[i]; sh[q + 13] = 0.03; sh[q + 14] = sim.pz[i] + 0.05; sh[q + 15] = 1;
      }
    }
    this.playerMesh.count = pc; this.megaMesh.count = mc;
    this.playerMesh.instanceMatrix.needsUpdate = true;
    this.megaMesh.instanceMatrix.needsUpdate = true;

    const counts = [0, 0, 0, 0, 0, 0];
    const frozen = sim.freezeT > 0;
    const ice = _c2.set(0x9fdcff);
    for (let i = 0; i < sim.en; i++) {
      if (sim.ehp[i] <= 0) continue;
      const kind = sim.ekind[i];
      const mesh = this.enemyMeshes[kind];
      const cap = mesh.instanceMatrix.count;
      if (counts[kind] >= cap) continue;
      const idx = counts[kind]++;
      const arr = mesh.instanceMatrix.array, col = mesh.instanceColor.array;
      const age = sim.time - sim.eborn[i];
      const pop = age < 0.25 ? 0.2 + (age / 0.25) * 0.8 : 1;
      const ph = sim.eph[i];
      let y = Math.abs(Math.sin(ph)) * 0.14;
      const sq = Math.sin(ph * 2) * 0.08;
      let base = kind === EK.BRUTE ? 2.3 : kind === EK.BOSS ? 5.4 : 1;
      if (kind === EK.BOMBER) base *= 1 + Math.sin(t * 9 + i) * 0.07;
      if (kind === EK.BOSS) {
        y = Math.abs(Math.sin(ph)) * 0.35;
        if (sim.bossWarn > 0) { y = (1.1 - sim.bossWarn) * 2.2; base *= 1.06; }
      }
      base *= pop;
      const fall = sim.efall[i];
      if (fall > 0) { y -= fall * fall * 16; base *= Math.max(0.25, 1 - fall * 0.8); }
      const sx = base * (1 - sq * 0.6), sy = base * (1 + sq);
      const o = idx * 16;
      arr[o] = sx; arr[o + 1] = 0; arr[o + 2] = 0; arr[o + 3] = 0;
      arr[o + 4] = 0; arr[o + 5] = sy; arr[o + 6] = 0; arr[o + 7] = 0;
      arr[o + 8] = 0; arr[o + 9] = 0; arr[o + 10] = sx; arr[o + 11] = 0;
      arr[o + 12] = sim.ex[i]; arr[o + 13] = y; arr[o + 14] = sim.ez[i]; arr[o + 15] = 1;
      const c = this.enemyCol[kind];
      const vary = 0.86 + ((sim.eoff[i] * 3.7) % 1 + 1) % 1 * 0.28;
      let r = c.r * vary, g = c.g * vary, b = c.b * vary;
      if (frozen) { r = r * 0.35 + ice.r * 0.65; g = g * 0.35 + ice.g * 0.65; b = b * 0.35 + ice.b * 0.65; }
      if (sim.ehit[i] > 0) { r = r * 0.3 + 1.6; g = g * 0.3 + 1.6; b = b * 0.3 + 1.6; }
      if (kind === EK.BOSS && sim.bossWarn > 0) { r += 0.8; }
      col[idx * 3] = r; col[idx * 3 + 1] = g; col[idx * 3 + 2] = b;
      if (sh && fall <= 0 && sc < PCAP + ECAP) {
        const s = base * 0.95;
        const q = sc++ * 16;
        sh[q] = s; sh[q + 5] = 1; sh[q + 10] = s; sh[q + 12] = sim.ex[i]; sh[q + 13] = 0.03; sh[q + 14] = sim.ez[i] - 0.05; sh[q + 15] = 1;
      }
    }
    for (let k = 0; k < 6; k++) {
      const m = this.enemyMeshes[k];
      m.count = counts[k];
      if (counts[k]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    }
    if (this.shadowMesh) { this.shadowMesh.count = sc; this.shadowMesh.instanceMatrix.needsUpdate = true; }
  }

  _syncObjects(sim, dt, t) {
    for (const o of this.gateObjs) {
      const g = o.g;
      if (g.dead) {
        if (o.gone < 1) {
          o.gone = Math.min(1, o.gone + dt * 4);
          o.grp.scale.setScalar(1 - o.gone * 0.6);
          o.film.material.uniforms.uAlpha.value = 1 - o.gone;
          if (o.gone >= 1) o.grp.visible = false;
        }
        continue;
      }
      // later stages stay hidden until they are reached (keeps the view readable)
      o.grp.visible = g.stage <= sim.stage;
      if (!o.grp.visible) continue;
      o.grp.position.x = g.cx;
      const u = o.film.material.uniforms;
      u.uTime.value = t + g.z;
      u.uFlash.value = Math.max(0, g.flash * 4);
      const pulse = 1 + Math.max(0, g.flash) * 0.5;
      o.label.scale.setScalar(pulse);
      if (o.dyn && o.shown !== g.pool) { o.shown = g.pool; o.dyn.set(GATE_SIGN[g.op] + Math.ceil(g.pool)); }
    }
    for (const o of this.fortObjs) {
      const f = o.f;
      if (o.boss) continue;
      if (f.dead) {
        if (o.mesh.visible) { o.mesh.visible = false; o.ruin.visible = true; o.label.visible = false; }
        continue;
      }
      const hp = Math.ceil(f.hp);
      o.label.visible = sim.forts[sim.stage] === f;
      if (o.shown !== hp) { o.shown = hp; o.label.userData.label.set(String(hp)); }
      const fl = Math.max(0, f.flash);
      o.mesh.material.uniforms.uFlash.value = fl * 3;
      o.mesh.scale.set(1 + fl * 0.25, 1 - fl * 0.3, 1);
      o.label.scale.set(5.2 * (1 + fl), 2.6 * (1 + fl), 1);
    }
    for (const o of this.blockObjs) {
      const b = o.b;
      if (b.dead) { o.grp.visible = false; continue; }
      o.label.visible = b.stage <= sim.stage;
      const hp = Math.ceil(b.hp);
      if (o.shown !== hp) { o.shown = hp; o.label.userData.label.set(String(hp)); }
      const fl = Math.max(0, b.flash);
      o.mesh.scale.set(1 + fl * 0.8, 1 - fl * 1.0, 1 + fl * 0.8);
      if (o.grp.userData.inside) o.grp.userData.inside.position.y = 0.15 + Math.abs(Math.sin(t * 5 + b.x)) * 0.25;
    }
    for (const o of this.spinObjs) o.m.rotation.y = -o.s.ang;
    for (const o of this.sawObjs) { o.m.position.x = o.s.cx; o.m.rotation.y = t * 14; }
    for (const o of this.pickObjs) {
      if (o.p.dead) { o.s.visible = false; continue; }
      o.s.position.y = 1.35 + Math.sin(t * 3 + o.p.x) * 0.2;
      const s = 1.5 + Math.sin(t * 5 + o.p.z) * 0.1;
      o.s.scale.set(s, s, 1);
    }
    // shells
    for (let i = 0; i < this.shellPool.length; i++) {
      const m = this.shellPool[i], s = sim.shells[i];
      if (!s) { m.visible = false; continue; }
      const k = s.t / s.dur;
      m.visible = true;
      m.position.set(s.sx + (s.x - s.sx) * k, 2.4 + Math.sin(k * Math.PI) * 7 - k * 2.2, s.sz + (s.z - s.sz) * k);
    }
    // launcher
    const L = this.launcher;
    const lost = sim.state === STATE.LOST;
    L.grp.visible = !(lost && sim.endTimer > 0.15);
    L.grp.position.set(sim.lx, 0, sim.lz);
    const vx = (sim.lx - L.lastX) / Math.max(dt, 1e-3);
    L.lastX = sim.lx;
    L.tilt += (Math.max(-0.25, Math.min(0.25, -vx * 0.02)) - L.tilt) * Math.min(1, dt * 10);
    L.body.rotation.z = L.tilt;
    L.recoil = Math.max(0, L.recoil - dt * 7);
    L.barrel.position.z = 0.25 + L.recoil * 0.3;
    const ready = sim.megaReady ? 1 : 0;
    L.barrel.scale.setScalar(1 + L.recoil * 0.12 + ready * (0.12 + Math.sin(t * 12) * 0.05));
    L.grp.position.y = sim.state === STATE.ADVANCE ? Math.abs(Math.sin(t * 16)) * 0.06 : 0;
    this.launcherMat.uniforms.uFlash.value = Math.max(0, sim.shieldFlash) * 1.6;
    if (ready && Math.random() < 0.5) this.pAdd.spawn(sim.lx + (Math.random() - 0.5), 1.4, sim.lz - 1.2, 0, 1.5, 0, 0xffd23a, 0.3, 0.5, -1, 0);
    // shield line
    const sl = this.shieldLine;
    sl.position.set(0, 0.04, sim.lz - 0.9);
    const frac = Math.max(0, sim.shield / sim.shieldMax);
    if (sim.shieldFlash > 0) sl.material.color.setRGB(1, 0.15, 0.15);
    else sl.material.color.copy(_c.setRGB(1, 0.25, 0.25).lerp(this.skinColor, frac));
    sl.material.opacity = 0.35 + 0.25 * Math.sin(t * 4) + (sim.shieldFlash > 0 ? 0.4 : 0);
  }

  _camera(sim, dt, menu) {
    const k = this.camBack;
    const lz = sim.lz, lx = sim.lx;
    let px = lx * 0.45, py = 9.6 * k, pz = lz + 9.2 * k;
    let tx = lx * 0.3, ty = 0.6, tz = lz - 9.5;
    if (menu) {
      // slow cinematic sway behind the menu
      px = Math.sin(this.time * 0.25) * 5; py = 8.5 * k; pz = lz + 10 * k;
      tx = Math.sin(this.time * 0.25 + 1) * 1.5; tz = lz - 12;
    }
    if (this.intro > 0 && !menu) {
      this.intro -= dt;
      const e = Math.max(0, this.intro / 1.8);
      const ee = e * e * (3 - 2 * e);
      const fz = this.level.stages[0].zFort;
      px += (0 - px) * ee; py += (7 - py) * ee; pz += (fz + 20 - pz) * ee;
      tz += (fz - tz) * ee; ty += (2 - ty) * ee;
    }
    const f = this.intro > 0 || this.snap ? 1 : Math.min(1, dt * 7);
    this.snap = false;
    this.camPos.x += (px - this.camPos.x) * f; this.camPos.y += (py - this.camPos.y) * f; this.camPos.z += (pz - this.camPos.z) * f;
    this.camLook.x += (tx - this.camLook.x) * f; this.camLook.y += (ty - this.camLook.y) * f; this.camLook.z += (tz - this.camLook.z) * f;
    this.cam.position.copy(this.camPos);
    if (this.shake > 0.001) {
      this.cam.position.x += (Math.random() - 0.5) * this.shake;
      this.cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.max(0, 1 - dt * 7);
    }
    this.cam.lookAt(this.camLook);
    this.sky.position.copy(this.cam.position);
    if (this.stars) this.stars.position.copy(this.cam.position);
  }

  snapCamera() { this.intro = 0; this.snap = true; }

  _ambient(dt) {
    const a = this.ambient;
    if (!a) return;
    const p = a.geometry.attributes.position.array, s = this.ambSeed;
    const n = p.length / 3;
    const cx = this.camLook.x, cz = this.camLook.z - 6;
    const t = this.time;
    const kind = this.ambientKind;
    const fallSpeed = kind === 'snow' ? 1.6 : kind === 'petals' ? 0.9 : kind === 'dust' ? 0.2 : -0.9;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      const yy = (((s[o + 1] * 14 - t * fallSpeed * (0.6 + s[o] * 0.8)) % 14) + 14) % 14;
      p[o] = cx + (s[o] - 0.5) * 34 + Math.sin(t * (0.5 + s[o + 2]) + i) * 0.8;
      p[o + 1] = yy - 1;
      p[o + 2] = cz + (s[o + 2] - 0.5) * 50;
    }
    a.geometry.attributes.position.needsUpdate = true;
  }

  // ---- event driven effects -----------------------------------------------------------------
  fx(type, x, z, v, sim) {
    const P = this.pNorm, A = this.pAdd;
    const skin = this.skinColor.getHex();
    switch (type) {
      case EV.SHOT:
        this.launcher.recoil = 1;
        if (this.fxBudget-- > 0) A.spawn(x, 1.5, z - 0.4, (Math.random() - 0.5) * 2, 1.5, -3, 0xffffff, 0.5, 0.22, 0, 3);
        break;
      case EV.MEGA:
        this.launcher.recoil = 1.6; this.shake = Math.max(this.shake, 0.35);
        A.burst(x, 1.4, z - 0.5, 16, 0xffd23a, 6, 0.7, 0.5, 0.6, 2);
        this.rings.add(x, z, 0.4, 3, 0.45, 0xffd23a);
        break;
      case EV.POP_P:
        if (this.fxBudget > 0) { this.fxBudget -= 3; P.burst(x, 0.4, z, v ? 14 : 3, skin, v ? 6 : 3.4, v ? 0.6 : 0.36, 0.5); }
        break;
      case EV.POP_E: {
        const big = v >= EK.BRUTE;
        if (big || this.fxBudget > 0) {
          this.fxBudget -= 3;
          P.burst(x, 0.4, z, big ? 26 : 3, ENEMY_COLORS[v], big ? 8 : 3.6, big ? 0.8 : 0.38, big ? 0.9 : 0.5);
          if (big) { this.shake = Math.max(this.shake, v === EK.BOSS ? 1.2 : 0.3); this.rings.add(x, z, 0.5, v === EK.BOSS ? 9 : 3, 0.5, 0xc98aff); }
        }
        break;
      }
      case EV.GATE:
        if (this.fxBudget-- > 0) A.spawn(x + (Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 1.4, z, (Math.random() - 0.5) * 2, 2.5, -2, 0xffffff, 0.34, 0.35, -2, 1);
        break;
      case EV.FORT_HIT:
        if (this.fxBudget-- > 0) P.spawn(x, 0.8 + Math.random(), z + 0.3, (Math.random() - 0.5) * 4, 3 + Math.random() * 3, 2 + Math.random() * 3, this.theme.fortA, 0.42, 0.6);
        break;
      case EV.FORT_DOWN: {
        this.shake = 1.4;
        const th = this.theme;
        for (let i = 0; i < 12; i++) {
          const ex = (Math.random() - 0.5) * 9;
          P.burst(ex, 1 + Math.random() * 3, z, 10, i % 2 ? th.fortA : th.fortB, 11, 1.0, 1.4, 1.2);
          A.burst(ex, 1 + Math.random() * 3, z, 8, i % 2 ? 0xffb13a : 0xfff1a0, 9, 1.3, 0.7, 1, 3);
        }
        this.rings.add(0, z, 1, 14, 0.8, 0xffe9a0);
        this.rings.add(0, z, 0.5, 9, 0.55, 0xffffff);
        break;
      }
      case EV.SHIELD_HIT:
        this.shake = Math.max(this.shake, 0.45);
        A.burst(x, 0.5, z, 8, 0xff4040, 5, 0.6, 0.45, 0.8, 4);
        this.rings.add(x, z, 0.3, 2.4, 0.4, 0xff4040);
        break;
      case EV.BLOCK_HIT: {
        const o = this.blockObjs[v | 0];
        if (o && this.fxBudget-- > 0) P.spawn(x, 0.9, z + 0.4, (Math.random() - 0.5) * 3, 3, 2, o.b.type === BT.CRATE ? 0xd99a4a : 0xc9cfdd, 0.3, 0.5);
        break;
      }
      case EV.BLOCK_DOWN: {
        const o = this.blockObjs[v | 0];
        if (!o) break;
        const col = o.b.type === BT.CRATE ? 0xd99a4a : o.b.type === BT.CAGE ? 0xc9cfdd : 0x3a3040;
        P.burst(x, 1, z, 22, col, 8, 0.8, 1.0);
        A.burst(x, 1, z, 10, 0xfff1a0, 6, 0.6, 0.5, 1, 3);
        if (o.b.type === BT.CRATE) this.texts.add(x, 2.4, z, '+' + Math.round(o.b.val * sim.stats.coinMul), '#ffe45c', 1.5);
        break;
      }
      case EV.CAGE_FREE:
        this.texts.add(x, 3, z, '+' + (v | 0), '#8dffcf', 1.9, 1.3);
        A.burst(x, 1, z, 18, skin, 8, 0.7, 0.8, 1.2, 4);
        this.rings.add(x, z, 0.4, 4, 0.5, skin);
        break;
      case EV.EXPLO:
      case EV.SHELL_LAND: {
        const r = v;
        this.shake = Math.max(this.shake, Math.min(1.2, 0.25 + r * 0.1));
        A.burst(x, 0.6, z, Math.round(14 + r * 4), 0xff8a2a, 5 + r * 1.6, 1.0 + r * 0.12, 0.6, 1, 3);
        A.burst(x, 0.6, z, 10, 0xfff1a0, 4 + r, 1.3, 0.35, 1, 0);
        P.burst(x, 0.6, z, 12, 0x4a4048, 4 + r, 1.0, 1.0, 1.4, 4);
        this.rings.add(x, z, 0.4, r, 0.45, 0xffc36a);
        break;
      }
      case EV.SHELL_FIRE:
        A.burst(x, 2.6, z, 8, 0xffc36a, 4, 0.7, 0.4, 1, 0);
        break;
      case EV.PICKUP:
        this.rings.add(x, z, 0.3, 3.5, 0.5, PICK_COL[v | 0]);
        A.burst(x, 1.3, z, 16, PICK_COL[v | 0], 6, 0.6, 0.7, 1, 3);
        break;
      case EV.FREEZE:
        this.rings.add(sim.lx, sim.lz - 14, 2, 30, 0.9, 0x9fdcff);
        break;
      case EV.GATE_DONE: {
        const o = this.gateObjs[v | 0];
        if (o) A.burst(x, 1.3, z, 22, GATE_COL[o.g.op], 6, 0.6, 0.6, 1, 4);
        break;
      }
      case EV.BOSS_WARN:
        this.rings.add(x, z, 0.5, v, 1.1, 0xff3040, true);
        break;
      case EV.BOSS_STOMP:
        this.shake = 1.0;
        this.rings.add(x, z, 1, v + 1.5, 0.5, 0xffffff);
        P.burst(x, 0.3, z, 30, 0x6a5a62, 10, 0.9, 0.9, 0.7);
        break;
      case EV.BOSS_DOWN:
        this.shake = 1.6;
        for (let i = 0; i < 8; i++) A.burst(x + (Math.random() - 0.5) * 4, 1 + Math.random() * 5, z, 12, i % 2 ? 0xc04cff : 0xffd23a, 10, 1.2, 0.9, 1, 3);
        this.rings.add(x, z, 1, 16, 0.9, 0xc98aff);
        break;
      case EV.COIN:
        if (this.fxBudget-- > 0) A.spawn(x, 0.8, z, (Math.random() - 0.5) * 1.5, 5, 0, 0xffd23a, 0.44, 0.6, 9, 0.5);
        break;
      case EV.SAW_KILL:
      case EV.FALL:
        if (type === EV.SAW_KILL && this.fxBudget-- > 0) { P.burst(x, 0.4, z, 3, skin, 5, 0.34, 0.5); A.spawn(x, 0.5, z, (Math.random() - 0.5) * 6, 4, 2, 0xfff1a0, 0.3, 0.3, 9); }
        break;
      case EV.LOSE:
        this.shake = 1.6;
        A.burst(x, 1, z, 40, 0xff8a2a, 10, 1.4, 0.9, 1, 3);
        P.burst(x, 1, z, 30, skin, 9, 0.9, 1.3, 1.3);
        P.burst(x, 1, z, 20, 0x3a3448, 8, 1.0, 1.4, 1.3);
        this.rings.add(x, z, 0.5, 10, 0.7, 0xff8a2a);
        break;
      case EV.WIN:
        this.confettiT = 0;
        break;
    }
  }

  render() {
    this.r.render(this.scene, this.cam);
  }
}
