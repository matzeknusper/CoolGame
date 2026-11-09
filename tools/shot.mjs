// Screenshot helper for visual checks: node tools/shot.mjs <out.png> [query] [waitMs] [w] [h] [dsf]
import { createRequire } from 'node:module';
// playwright is pre-installed globally in the dev container: run with NODE_PATH=$(npm root -g)
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, query = '', wait = '4000', w = '412', h = '892', dsf = '1'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dsf, hasTouch: true, isMobile: true });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto('file://' + new URL('../dist/standalone.html', import.meta.url).pathname + (query ? '?' + query : ''));
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
const fps = await page.evaluate(() => document.getElementById('fps')?.textContent || '');
console.log(fps);
if (logs.length) console.log(logs.slice(0, 12).join('\n'));
await browser.close();
