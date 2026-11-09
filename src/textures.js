// All textures are generated procedurally on canvases – the game ships without image files.
import * as THREE from 'three';

export const FONT = '"Lilita One", "Arial Black", system-ui, sans-serif';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tex(c, repeat = true, aniso = 4) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function speckle(g, S, r, n, colors, minR, maxR, alpha) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * (0.4 + r() * 0.6);
    g.fillStyle = colors[(r() * colors.length) | 0];
    const x = r() * S, y = r() * S, rad = minR + r() * (maxR - minR);
    // draw wrapped so the texture tiles seamlessly
    for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) {
      if (x + ox < -rad || x + ox > S + rad || y + oy < -rad || y + oy > S + rad) continue;
      g.beginPath(); g.arc(x + ox, y + oy, rad, 0, 6.283); g.fill();
    }
  }
  g.globalAlpha = 1;
}

// ---- track surfaces -----------------------------------------------------------------
export function trackTexture(theme) {
  const S = 512;
  const c = canvas(S, S), g = c.getContext('2d');
  const r = rand(theme.track.length * 977 + 5);
  const A = theme.trackA, B = theme.trackB, L = theme.trackLine;
  g.fillStyle = A; g.fillRect(0, 0, S, S);
  const kind = theme.track;
  if (kind === 'pavers' || kind === 'slabs') {
    const n = kind === 'pavers' ? 4 : 2;
    const cs = S / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const off = kind === 'pavers' && j % 2 ? cs / 2 : 0;
      for (const wrap of [0, -S]) {
        const x = i * cs + off + wrap, y = j * cs;
        const shade = r();
        g.fillStyle = shade > 0.5 ? A : B;
        g.globalAlpha = 0.35 + shade * 0.45;
        roundRect(g, x + 5, y + 5, cs - 10, cs - 10, 14); g.fill();
        g.globalAlpha = 0.5;
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x + 12, y + 9); g.lineTo(x + cs - 14, y + 9); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.22)';
        g.beginPath(); g.moveTo(x + 12, y + cs - 7); g.lineTo(x + cs - 14, y + cs - 7); g.stroke();
      }
    }
    g.globalAlpha = 1;
    speckle(g, S, r, 500, ['#000000', '#ffffff', B], 0.6, 2.2, 0.12);
  } else if (kind === 'ice') {
    const gr = g.createLinearGradient(0, 0, S, S);
    gr.addColorStop(0, A); gr.addColorStop(0.5, B); gr.addColorStop(1, A);
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    speckle(g, S, r, 60, ['#ffffff'], 10, 46, 0.1);
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.6;
    for (let i = 0; i < 26; i++) {
      let x = r() * S, y = r() * S;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 90; y += (r() - 0.5) * 90; g.lineTo(x, y); }
      g.globalAlpha = 0.25 + r() * 0.4; g.stroke();
    }
    g.globalAlpha = 1;
    speckle(g, S, r, 300, ['#ffffff'], 0.5, 1.6, 0.5);
  } else if (kind === 'basalt') {
    speckle(g, S, r, 220, [B, '#000000', A], 8, 40, 0.3);
    // glowing cracks
    for (let pass = 0; pass < 2; pass++) {
      const rr = rand(99);
      g.strokeStyle = pass ? '#ffd27a' : L; g.lineWidth = pass ? 1.6 : 6; g.globalAlpha = pass ? 0.9 : 0.4;
      g.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        let x = rr() * S, y = rr() * S;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (rr() - 0.5) * 120; y += (rr() - 0.5) * 120; g.lineTo(x, y); }
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    speckle(g, S, r, 500, ['#000000', '#6a5a62'], 0.6, 2, 0.3);
  } else if (kind === 'grid') {
    speckle(g, S, r, 80, [B, '#262a55'], 20, 70, 0.3);
    const n = 4, cs = S / n;
    for (let pass = 0; pass < 2; pass++) {
      g.strokeStyle = L; g.lineWidth = pass ? 2 : 10; g.globalAlpha = pass ? 0.95 : 0.16;
      for (let i = 0; i <= n; i++) {
        g.beginPath(); g.moveTo(i * cs, 0); g.lineTo(i * cs, S); g.stroke();
        g.beginPath(); g.moveTo(0, i * cs); g.lineTo(S, i * cs); g.stroke();
      }
    }
    g.globalAlpha = 0.5; g.fillStyle = '#ff3bd4';
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (r() < 0.3) g.fillRect(i * cs + cs / 2 - 5, j * cs + cs / 2 - 5, 10, 10);
    g.globalAlpha = 1;
  } else {
    // crystal
    const n = 4, cs = S / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * cs, y = j * cs;
      const pts = [[x, y], [x + cs, y], [x + cs, y + cs], [x, y + cs]];
      const cx = x + cs / 2, cy = y + cs / 2;
      for (let k = 0; k < 4; k++) {
        const p = pts[k], q = pts[(k + 1) % 4];
        g.fillStyle = k % 2 ? A : B; g.globalAlpha = 0.5 + r() * 0.5;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.closePath(); g.fill();
      }
      g.globalAlpha = 0.6; g.strokeStyle = L; g.lineWidth = 1.5;
      g.strokeRect(x + 1, y + 1, cs - 2, cs - 2);
    }
    g.globalAlpha = 1;
    speckle(g, S, r, 160, ['#ffffff', L], 0.6, 2.2, 0.6);
  }
  return tex(c, true, 8);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

// ---- far ground ---------------------------------------------------------------------
export function groundTexture(theme) {
  const S = 512;
  const c = canvas(S, S), g = c.getContext('2d');
  const r = rand(theme.ground.length * 131 + 9);
  g.fillStyle = theme.groundA; g.fillRect(0, 0, S, S);
  const kind = theme.ground;
  if (kind === 'water') {
    speckle(g, S, r, 90, [theme.groundB], 14, 60, 0.25);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = r() * S, y = r() * S, w = 14 + r() * 40;
      g.globalAlpha = 0.2 + r() * 0.5;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 6, x + w, y); g.stroke();
    }
  } else if (kind === 'sand' || kind === 'snow') {
    speckle(g, S, r, 120, [theme.groundB], 20, 80, 0.3);
    g.strokeStyle = kind === 'sand' ? 'rgba(160,100,40,0.25)' : 'rgba(120,150,200,0.25)'; g.lineWidth = 5;
    for (let i = 0; i < 16; i++) {
      const y = (i / 16) * S;
      g.beginPath();
      for (let x = 0; x <= S; x += 16) g.lineTo(x, y + Math.sin((x / S) * 6.283 * 2 + i) * 9);
      g.stroke();
    }
  } else if (kind === 'lava') {
    g.fillStyle = '#2a0f0c'; g.fillRect(0, 0, S, S);
    for (let pass = 0; pass < 2; pass++) {
      const rr = rand(7);
      g.strokeStyle = pass ? theme.groundB : theme.groundA; g.lineWidth = pass ? 5 : 22; g.lineCap = 'round'; g.globalAlpha = pass ? 1 : 0.8;
      for (let i = 0; i < 14; i++) {
        let x = rr() * S, y = rr() * S;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 7; k++) { x += (rr() - 0.5) * 170; y += (rr() - 0.5) * 170; g.lineTo(x, y); }
        g.stroke();
      }
    }
  } else if (kind === 'city') {
    const n = 8, cs = S / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      g.fillStyle = r() < 0.5 ? '#141634' : '#1d1746'; g.fillRect(i * cs + 4, j * cs + 4, cs - 8, cs - 8);
      for (let k = 0; k < 6; k++) if (r() < 0.6) {
        g.fillStyle = ['#37f2ff', '#ff3bd4', '#ffe66a'][(r() * 3) | 0]; g.globalAlpha = 0.5 + r() * 0.5;
        g.fillRect(i * cs + 8 + r() * (cs - 20), j * cs + 8 + r() * (cs - 20), 4, 4);
      }
      g.globalAlpha = 1;
    }
  } else {
    // nebula
    for (let i = 0; i < 40; i++) {
      const x = r() * S, y = r() * S, rad = 40 + r() * 120;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, ['rgba(160,70,220,0.35)', 'rgba(255,90,180,0.25)', 'rgba(70,90,240,0.3)'][(r() * 3) | 0]);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) g.fillRect(x - rad + ox, y - rad + oy, rad * 2, rad * 2);
    }
    speckle(g, S, r, 260, ['#ffffff', '#ffe9a0', '#a0d8ff'], 0.5, 1.8, 0.9);
  }
  g.globalAlpha = 1;
  return tex(c, true, 2);
}

// ---- sprites ------------------------------------------------------------------------
export function softDot() {
  const S = 64, c = canvas(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return tex(c, false);
}

export function shadowBlob() {
  const S = 64, c = canvas(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const t = tex(c, false);
  return t;
}

export function cloudTexture() {
  const W = 256, H = 128, c = canvas(W, H), g = c.getContext('2d');
  const r = rand(4);
  for (let i = 0; i < 16; i++) {
    const x = 50 + r() * 156, y = 62 + r() * 26, rad = 22 + r() * 30;
    const gr = g.createRadialGradient(x, y - 6, 2, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return tex(c, false);
}

export function ringTexture() {
  const S = 128, c = canvas(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.72, 'rgba(255,255,255,0.15)');
  gr.addColorStop(0.9, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return tex(c, false);
}

// Text label with thick outline, cached by content.
const labelCache = new Map();
export function labelTexture(text, fill = '#ffffff', stroke = '#1b1035') {
  const key = text + fill + stroke;
  if (labelCache.has(key)) return labelCache.get(key);
  const W = 256, H = 128, c = canvas(W, H), g = c.getContext('2d');
  drawLabel(g, W, H, text, fill, stroke);
  const t = tex(c, false);
  labelCache.set(key, t);
  return t;
}

export function drawLabel(g, W, H, text, fill = '#ffffff', stroke = '#1b1035') {
  g.clearRect(0, 0, W, H);
  let size = H * 0.78;
  g.font = `${size}px ${FONT}`;
  const w = g.measureText(text).width;
  if (w > W * 0.9) { size *= (W * 0.9) / w; g.font = `${size}px ${FONT}`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.strokeStyle = stroke; g.lineWidth = size * 0.2;
  g.strokeText(text, W / 2, H / 2 + size * 0.04);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillText(text, W / 2, H / 2 + size * 0.1);
  g.fillStyle = fill;
  g.fillText(text, W / 2, H / 2 + size * 0.04);
}

// A label whose content changes (hp counters): owns its canvas.
export class DynLabel {
  constructor(fill = '#ffffff', stroke = '#1b1035') {
    this.c = canvas(256, 128);
    this.g = this.c.getContext('2d');
    this.tex = tex(this.c, false);
    this.tex.generateMipmaps = false;
    this.tex.minFilter = THREE.LinearFilter;
    this.fill = fill; this.stroke = stroke; this.text = null;
  }
  set(text) {
    if (text === this.text) return;
    this.text = text;
    drawLabel(this.g, 256, 128, text, this.fill, this.stroke);
    this.tex.needsUpdate = true;
  }
}

// Icons for pickups, drawn as simple vector glyphs.
export function iconTexture(kind) {
  const S = 128, c = canvas(S, S), g = c.getContext('2d');
  const cols = { rapid: ['#ffe45c', '#ff8a1f'], freeze: ['#bff3ff', '#3aa8ff'], bomb: ['#ff8a5c', '#d81f4a'], mega: ['#ffe9a0', '#ffb300'], heart: ['#ffb3c8', '#ff2f6a'] }[kind];
  const gr = g.createRadialGradient(S / 2, S * 0.4, 4, S / 2, S / 2, S / 2);
  gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]);
  g.fillStyle = gr; g.beginPath(); g.arc(S / 2, S / 2, S * 0.46, 0, 6.283); g.fill();
  g.lineWidth = 7; g.strokeStyle = '#ffffff'; g.stroke();
  g.fillStyle = '#ffffff'; g.strokeStyle = '#1b1035'; g.lineWidth = 6; g.lineJoin = 'round';
  g.translate(S / 2, S / 2);
  g.beginPath();
  if (kind === 'rapid') {
    g.moveTo(8, -38); g.lineTo(-22, 6); g.lineTo(-2, 6); g.lineTo(-10, 38); g.lineTo(22, -8); g.lineTo(2, -8); g.closePath();
  } else if (kind === 'freeze') {
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; g.moveTo(0, 0); g.lineTo(Math.cos(a) * 36, Math.sin(a) * 36); }
    g.lineWidth = 9; g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.stroke();
    g.setTransform(1, 0, 0, 1, 0, 0);
    return tex(c, false);
  } else if (kind === 'bomb') {
    g.arc(-2, 6, 26, 0, 6.283); g.moveTo(14, -18); g.lineTo(26, -34);
  } else if (kind === 'mega') {
    g.moveTo(-34, 22); g.lineTo(-34, -18); g.lineTo(-16, 2); g.lineTo(0, -30); g.lineTo(16, 2); g.lineTo(34, -18); g.lineTo(34, 22); g.closePath();
  } else {
    g.moveTo(0, 32); g.bezierCurveTo(-52, -4, -24, -44, 0, -18); g.bezierCurveTo(24, -44, 52, -4, 0, 32); g.closePath();
  }
  g.stroke(); g.fill();
  g.setTransform(1, 0, 0, 1, 0, 0);
  return tex(c, false);
}

export function crateTexture() {
  const S = 128, c = canvas(S, S), g = c.getContext('2d');
  const r = rand(21);
  g.fillStyle = '#c98a3e'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? '#d99a4a' : '#bf7f36'; g.fillRect(0, i * 32, S, 30);
    g.strokeStyle = 'rgba(90,50,10,0.35)'; g.lineWidth = 1;
    for (let k = 0; k < 4; k++) { const y = i * 32 + 4 + r() * 22; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(40, y + 3, 80, y - 3, S, y); g.stroke(); }
  }
  g.strokeStyle = '#7a4a1c'; g.lineWidth = 14; g.strokeRect(7, 7, S - 14, S - 14);
  g.lineWidth = 12; g.beginPath(); g.moveTo(10, 10); g.lineTo(S - 10, S - 10); g.stroke();
  g.fillStyle = '#ffe08a';
  for (const [x, y] of [[14, 14], [S - 14, 14], [14, S - 14], [S - 14, S - 14]]) { g.beginPath(); g.arc(x, y, 4, 0, 6.283); g.fill(); }
  return tex(c, false);
}

export function hazardTexture(a = '#ffcf2e', b = '#22202a') {
  const S = 64, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, S, S);
  g.fillStyle = b;
  for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 16, 0); g.lineTo(i * 32 + 16 + 64, 64); g.lineTo(i * 32 + 64, 64); g.closePath(); g.fill(); }
  return tex(c, true);
}
