// Bundles the game into a single self-contained HTML file (JS, CSS and fonts inlined).
//   node build.mjs            -> dist/ (PWA: index.html, manifest, service worker, icons)
//   node build.mjs --serve    -> build + static server on http://localhost:8080
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { extname, join } from 'node:path';

const root = new URL('.', import.meta.url).pathname;
const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });

const result = await build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true, minify: true, format: 'iife', target: ['es2019'], write: false, legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/g, '<\\/script');

const font = (file, family, weight) => {
  const b64 = readFileSync(join(root, 'node_modules/@fontsource', file)).toString('base64');
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
};
const fonts = [
  font('lilita-one/files/lilita-one-latin-400-normal.woff2', 'Lilita One', 400),
  font('nunito/files/nunito-latin-800-normal.woff2', 'Nunito', '700 900'),
].join('\n');
const css = fonts + '\n' + readFileSync(join(root, 'src/styles.css'), 'utf8');

const tpl = readFileSync(join(root, 'src/index.html'), 'utf8');
const page = (pwa) => tpl
  .replace('<!--PWA-->', () => pwa)
  .replace('/*CSS*/', () => css)
  .replace('/*JS*/', () => js);

const pwaTags = '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">\n<link rel="apple-touch-icon" href="icons/icon-192.png">';
const html = page(pwaTags);
writeFileSync(join(dist, 'index.html'), html);
// no external references at all: used for the Android WebView and for single-file sharing
writeFileSync(join(dist, 'standalone.html'), page(''));

// PWA files
const version = createHash('sha1').update(html).digest('hex').slice(0, 10);
writeFileSync(join(dist, 'sw.js'), readFileSync(join(root, 'src/pwa/sw.js'), 'utf8').replace('__VERSION__', version));
writeFileSync(join(dist, 'manifest.webmanifest'), readFileSync(join(root, 'src/pwa/manifest.webmanifest'), 'utf8'));
if (existsSync(join(root, 'src/pwa/icons'))) cpSync(join(root, 'src/pwa/icons'), join(dist, 'icons'), { recursive: true });

// Android wrapper assets
const assets = join(root, 'android/app/src/main/assets');
if (existsSync(join(root, 'android/app/src/main'))) {
  mkdirSync(assets, { recursive: true });
  writeFileSync(join(assets, 'index.html'), page(''));
}

const kb = (n) => (n / 1024).toFixed(0) + ' kB';
console.log(`built dist/index.html ${kb(html.length)} (js ${kb(js.length)}, css+fonts ${kb(css.length)}), version ${version}`);

if (process.argv.includes('--serve')) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(dist, p);
    if (!f.startsWith(dist) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(f).pipe(res);
  }).listen(8080, () => console.log('http://localhost:8080'));
}
