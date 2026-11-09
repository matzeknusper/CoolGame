// Renders the app icons (PWA + Android) from a canvas drawing: node tools/make-icons.mjs
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('..', import.meta.url).pathname;

// kind: 'full' (rounded background), 'maskable' (full bleed, safe zone), 'fg' (transparent adaptive foreground), 'round'
const draw = (size, kind) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const S = size;
  const scale = kind === 'maskable' ? 0.74 : kind === 'fg' ? 0.6 : 0.94;
  if (kind !== 'fg') {
    const bg = g.createRadialGradient(S * 0.5, S * 0.32, S * 0.05, S * 0.5, S * 0.5, S * 0.8);
    bg.addColorStop(0, '#6a45d6'); bg.addColorStop(0.6, '#3a2485'); bg.addColorStop(1, '#1b1035');
    g.fillStyle = bg;
    if (kind === 'full') { const r = S * 0.22; g.beginPath(); g.roundRect(0, 0, S, S, r); g.fill(); }
    else if (kind === 'round') { g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.fill(); }
    else g.fillRect(0, 0, S, S);
    // rays
    g.save(); g.translate(S / 2, S * 0.56); g.globalAlpha = 0.09; g.fillStyle = '#fff';
    if (kind !== 'maskable') { g.beginPath(); kind === 'round' ? g.arc(0, -S * 0.06, S / 2, 0, 7) : g.roundRect(-S / 2, -S * 0.56, S, S, S * 0.22); g.clip(); }
    for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(-S * 0.1, -S); g.lineTo(S * 0.1, -S); g.fill(); }
    g.restore();
  }
  g.translate(S / 2, S / 2); g.scale(scale, scale); g.translate(-S / 2, -S / 2);
  const blob = (x, y, r, col, dark, eyes = true) => {
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, r * 0.95, r * 0.9, r * 0.22, 0, 0, 7); g.fill();
    // antenna
    g.strokeStyle = dark; g.lineWidth = r * 0.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -r * 0.8); g.lineTo(r * 0.08, -r * 1.25); g.stroke();
    g.fillStyle = '#fff27a'; g.beginPath(); g.arc(r * 0.08, -r * 1.3, r * 0.15, 0, 7); g.fill();
    const gr = g.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.05, 0, 0, r * 1.1);
    gr.addColorStop(0, '#c9ffe9'); gr.addColorStop(0.35, col); gr.addColorStop(1, dark);
    g.fillStyle = gr; g.strokeStyle = '#1b1035'; g.lineWidth = r * 0.09;
    g.beginPath(); g.ellipse(0, 0, r, r * 0.93, 0, 0, 7); g.fill(); g.stroke();
    if (eyes) for (const sx of [-1, 1]) {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(sx * r * 0.36, -r * 0.12, r * 0.29, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#1b1035'; g.beginPath(); g.arc(sx * r * 0.36 + r * 0.05, -r * 0.08, r * 0.14, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(sx * r * 0.36 + r * 0.1, -r * 0.16, r * 0.05, 0, 7); g.fill();
    }
    g.strokeStyle = '#1b1035'; g.lineWidth = r * 0.08; g.beginPath(); g.arc(0, r * 0.22, r * 0.3, 0.25, Math.PI - 0.25); g.stroke();
    g.restore();
  };
  blob(S * 0.22, S * 0.5, S * 0.14, '#35e0a1', '#12956a');
  blob(S * 0.8, S * 0.52, S * 0.13, '#35e0a1', '#12956a');
  blob(S * 0.5, S * 0.56, S * 0.3, '#35e0a1', '#0f8f63');
  // multiplier badge
  g.save(); g.translate(S * 0.74, S * 0.24); g.rotate(0.2);
  g.fillStyle = '#ffc928'; g.strokeStyle = '#1b1035'; g.lineWidth = S * 0.028; g.lineJoin = 'round';
  g.beginPath(); g.roundRect(-S * 0.17, -S * 0.11, S * 0.34, S * 0.22, S * 0.06); g.fill(); g.stroke();
  g.fillStyle = '#1b1035'; g.font = `900 ${S * 0.17}px "Arial Black", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('×3', 0, S * 0.012);
  g.restore();
  return c.toDataURL('image/png');
};

const browser = await chromium.launch();
const page = await browser.newPage();
const png = async (size, kind) => Buffer.from((await page.evaluate(`(${draw})(${size}, '${kind}')`)).split(',')[1], 'base64');
const out = (file, buf) => { mkdirSync(join(root, file, '..'), { recursive: true }); writeFileSync(join(root, file), buf); };

out('src/pwa/icons/icon-192.png', await png(192, 'full'));
out('src/pwa/icons/icon-512.png', await png(512, 'full'));
out('src/pwa/icons/icon-maskable-512.png', await png(512, 'maskable'));
const res = 'android/app/src/main/res';
for (const [d, s] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
  out(`${res}/mipmap-${d}/ic_launcher.png`, await png(s, 'full'));
  out(`${res}/mipmap-${d}/ic_launcher_round.png`, await png(s, 'round'));
  out(`${res}/mipmap-${d}/ic_launcher_foreground.png`, await png(Math.round(s * 2.25), 'fg'));
}
await browser.close();
console.log('icons written');
