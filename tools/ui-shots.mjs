// Walks through the menus and saves screenshots: node tools/ui-shots.mjs <outDir>
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('vibrate')) logs.push(m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
const url = 'file://' + new URL('../dist/standalone.html', import.meta.url).pathname;
await page.addInitScript(() => {
  if (!localStorage.getItem('wuselwars.save.v1')) {
    const stars = {}; for (let i = 1; i <= 23; i++) stars[i] = 1 + (i * 7) % 3;
    localStorage.setItem('wuselwars.save.v1', JSON.stringify({ v: 1, coins: 1840, best: 24, stars, up: { rate: 5, multi: 3, mega: 2, shield: 4, coins: 1 }, skin: 'mint', seen: {}, set: { sfx: true, music: true, vib: true, quality: 'low', lang: 'de', auto: false }, stat: { wins: 23, kills: 0 } }));
  }
});
await page.goto(url + '?debug&nosw&noadapt');
await page.waitForTimeout(2500);
const shot = (n) => page.screenshot({ path: `${out}/ui-${n}.png` });
await shot('home');
await page.tap('[data-act=levels]'); await page.waitForTimeout(500); await shot('levels');
await page.tap('[data-act=world][data-arg="4"]'); await page.waitForTimeout(400); await shot('levels-locked');
await page.tap('[data-act=home]'); await page.waitForTimeout(400);
await page.tap('[data-act=shop]'); await page.waitForTimeout(500); await shot('shop');
await page.tap('[data-act=buy][data-arg=rate]'); await page.waitForTimeout(300);
await page.tap('[data-act=tab][data-arg=skin]'); await page.waitForTimeout(400); await shot('skins');
await page.tap('[data-act=home]'); await page.waitForTimeout(400);
await page.tap('[data-act=settings]'); await page.waitForTimeout(500); await shot('settings');
await page.tap('[data-act=home]'); await page.waitForTimeout(400);
// play a level by hand for a moment, pause, then let it be won
await page.tap('[data-act=levels]'); await page.waitForTimeout(300);
await page.tap('[data-act=world][data-arg="0"]'); await page.waitForTimeout(300);
await page.tap('[data-act=level][data-arg="2"]'); await page.waitForTimeout(2500);
await page.mouse.move(200, 600); await page.mouse.down(); await page.mouse.move(120, 600, { steps: 5 }); await page.waitForTimeout(3000);
await shot('play');
await page.mouse.up();
await page.tap('[data-act=pause]'); await page.waitForTimeout(500); await shot('pause');
await page.tap('[data-act=resume]'); await page.waitForTimeout(300);
await page.evaluate(() => { const s = window.__game.sim; s.forts[s.stage].hp = 3; s.spawnUnit(0, s.forts[s.stage].z + 4, 5, 0, 99); });
await page.waitForTimeout(7000); await shot('win');
await page.tap('[data-act=restart]'); await page.waitForTimeout(1500);
await page.evaluate(() => { window.__game.sim.shield = 0; });
await page.waitForTimeout(6000); await shot('lose');
console.log(logs.length ? logs.join('\n') : 'no errors');
await browser.close();
