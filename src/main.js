// Game bootstrap, main loop and screen flow.
import { HW, EV, EK, STATE, UPGRADES, upgradeCost, BT } from './config.js';
import { makeLevel, levelInfo } from './levels.js';
import { Sim, Bot } from './sim.js';
import { Renderer } from './render.js';
import { AudioSys } from './audio.js';
import { UI } from './ui.js';
import { loadSave, storeSave, resetSave, totalStars } from './save.js';
import { setLang, lang, t } from './i18n.js';
import { levelReward } from './economy.js';
import { THEMES, SKINS } from './themes.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const AUTOBOT = params.has('bot');
const NOADAPT = params.has('noadapt');

let save = loadSave();
setLang(save.set.lang);

const canvas = document.getElementById('c');
const flashEl = document.getElementById('flash');
const audio = new AudioSys();
audio.sfxOn = save.set.sfx;
audio.musicOn = save.set.music;

function pickQuality() {
  const q = params.get('q') || save.set.quality;
  if (q && q !== 'auto') return q;
  const mobile = matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (mobile) return cores >= 8 && mem >= 6 ? 'high' : cores <= 4 || mem <= 2 ? 'low' : 'medium';
  return 'high';
}

let renderer, ui, sim, bot, level;
let mode = 'boot'; // menu | play | paused | result
let endShown = false;
let endDelay = 0;
let coinsBefore = 0;
let levelN = 1;
let hintOn = false;
let lastVib = 0;

const input = { down: false, id: -1, startX: 0, startLx: 0, target: 0, keyL: false, keyR: false, keyFire: false };

function skinColor() {
  return (SKINS.find((s) => s.id === save.skin) || SKINS[0]).color;
}

function vib(pattern) {
  if (!save.set.vib || !navigator.vibrate) return;
  const now = performance.now();
  if (now - lastVib < 60) return;
  lastVib = now;
  try { navigator.vibrate(pattern); } catch (e) { /* not allowed */ }
}

function musicFor(lv, m) {
  const cfg = THEMES[lv.worldId].music;
  audio.playMusic(cfg, m);
}

// ---- flow --------------------------------------------------------------------------------
function startMenu() {
  mode = 'menu';
  levelN = save.best;
  level = makeLevel(levelN);
  sim = new Sim(level, { rate: 8, multi: 6, mega: 4, shield: 15 }, (Math.random() * 1000) | 0);
  bot = new Bot(sim, 0.7, (Math.random() * 1000) | 0);
  renderer.buildLevel(level, sim);
  renderer.snapCamera();
  ui.showHud(false);
  ui.introCard(null);
  ui.show('home');
  musicFor(level, 'menu');
}

function startLevel(n) {
  levelN = n;
  level = makeLevel(n);
  sim = new Sim(level, save.up, (Math.random() * 100000) | 0);
  bot = AUTOBOT ? new Bot(sim, 0.85, 3) : null;
  renderer.buildLevel(level, sim);
  mode = 'play';
  endShown = false;
  endDelay = 0;
  input.down = false;
  input.target = 0;
  ui.hide();
  ui.showHud(true, level);
  ui.updateHud(sim, 0);
  hintOn = n <= 2 && !save.set.auto;
  ui.hint(hintOn, t('hintDrag'));
  if (level.intro && !save.seen[level.intro]) {
    ui.introCard(level.intro);
    save.seen[level.intro] = 1;
    storeSave(save);
  } else ui.introCard(null);
  musicFor(level, level.stages[0].boss ? 'boss' : 'game');
  if (level.boss && level.stages.length === 1) ui.banner(`${t('bosses')[level.world]} ${t('bossIn')}`, 'bad');
}

function finish() {
  const won = sim.state === STATE.WON;
  const stars = sim.stars();
  const first = !save.stars[levelN];
  const reward = levelReward(levelN, sim.coins, stars, won, first);
  const bonus = reward - sim.coins;
  save.coins += reward;
  if (won) {
    save.stars[levelN] = Math.max(save.stars[levelN] || 0, stars);
    save.best = Math.max(save.best, levelN + 1);
    save.stat.wins++;
  }
  save.stat.kills += sim.kills;
  storeSave(save);
  mode = 'result';
  ui.showHud(false);
  ui.introCard(null);
  const info = levelInfo(levelN);
  ui.show('result', {
    won, stars, n: levelN, boss: info.boss, world: t('worlds')[info.world], collected: sim.coins, bonus: Math.max(0, bonus), total: reward,
    tip: t('tips')[(Math.random() * t('tips').length) | 0], skin: '#' + skinColor().toString(16).padStart(6, '0'),
  });
  if (won) for (let i = 0; i < stars; i++) setTimeout(() => audio.play('star', i), 420 + i * 280);
}

const handlers = {
  click: () => { audio.unlock(); audio.play('click'); },
  play: (n) => startLevel(n),
  home: () => startMenu(),
  pause: () => { if (mode === 'play') { mode = 'paused'; ui.show('pause'); } },
  resume: () => { if (mode === 'paused') { mode = 'play'; ui.hide(); } },
  restart: () => startLevel(levelN),
  next: () => startLevel(Math.max(levelN + 1, 1)),
  buy: (id) => {
    const def = UPGRADES.find((u) => u.id === id);
    const lvl = save.up[id];
    const cost = upgradeCost(def, lvl);
    if (lvl >= def.max || save.coins < cost) { audio.play('deny'); return; }
    save.coins -= cost;
    save.up[id]++;
    storeSave(save);
    audio.play('buy');
    vib(20);
    ui.show('shop');
  },
  skin: (id) => {
    const sk = SKINS.find((s) => s.id === id);
    if (!sk || totalStars(save) < sk.stars) return;
    save.skin = id;
    storeSave(save);
    renderer.setSkin(sk.color);
    ui.show('shop');
  },
  toggle: (k) => {
    save.set[k] = !save.set[k];
    storeSave(save);
    if (k === 'sfx') audio.setSfx(save.set.sfx);
    if (k === 'music') audio.setMusic(save.set.music);
    if (k === 'vib' && save.set.vib) vib(30);
    ui.show(mode === 'paused' ? 'pause' : 'settings', { lang });
  },
  quality: (q) => {
    save.set.quality = q;
    storeSave(save);
    location.reload();
  },
  lang: (l) => {
    save.set.lang = l;
    storeSave(save);
    setLang(l);
    ui.build();
    ui.show('settings', { lang });
  },
  reset: () => {
    save = resetSave();
    ui.save = save;
    setLang(save.set.lang);
    renderer.setSkin(skinColor());
    startMenu();
  },
};

// ---- input --------------------------------------------------------------------------------
function bindInput() {
  const sens = () => (HW * 2 * 1.45) / Math.min(window.innerWidth, window.innerHeight * 0.7);
  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock();
    if (mode !== 'play') return;
    input.down = true; input.id = e.pointerId;
    input.startX = e.clientX; input.startLx = sim.lx;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (hintOn) { hintOn = false; ui.hint(false); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!input.down || e.pointerId !== input.id) return;
    input.target = input.startLx + (e.clientX - input.startX) * sens();
    // re-anchor at the track edges so reversing direction responds immediately
    const lim = HW - 0.7;
    if (input.target > lim) { input.startX += (input.target - lim) / sens(); input.target = lim; }
    if (input.target < -lim) { input.startX += (input.target + lim) / sens(); input.target = -lim; }
  });
  const up = (e) => { if (e.pointerId === input.id) input.down = false; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    audio.unlock();
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.keyL = true;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') input.keyR = true;
    else if (e.code === 'Space') { input.keyFire = true; if (hintOn) { hintOn = false; ui.hint(false); } e.preventDefault(); }
    else if (e.code === 'Escape' || e.code === 'KeyP') { if (mode === 'play') handlers.pause(); else if (mode === 'paused') handlers.resume(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.keyL = false;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') input.keyR = false;
    else if (e.code === 'Space') input.keyFire = false;
  });
  window.addEventListener('resize', () => renderer.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => renderer.resize(), 200));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (mode === 'play') handlers.pause(); audio.suspend(); } else audio.resume();
  });
  // Android hardware back button (called from the native wrapper)
  window.onAndroidBack = () => {
    if (mode === 'play') { handlers.pause(); return true; }
    if (mode === 'paused') { handlers.resume(); return true; }
    if (ui.screen && ui.screen !== 'home') { startMenu(); return true; }
    return false;
  };
}

// ---- events -> effects ---------------------------------------------------------------------
function processEvents(silent) {
  const ev = sim.ev;
  for (let i = 0; i < sim.evn; i++) {
    const o = i * 4, type = ev[o], x = ev[o + 1], z = ev[o + 2], v = ev[o + 3];
    renderer.fx(type, x, z, v, sim);
    if (silent) continue;
    switch (type) {
      case EV.SHOT: audio.play('shot'); break;
      case EV.MEGA: audio.play('mega'); vib(25); break;
      case EV.POP_P: audio.play('pop'); break;
      case EV.POP_E: audio.play(v >= EK.BRUTE ? 'bigPop' : 'popE'); break;
      case EV.GATE: audio.play('gate'); break;
      case EV.FORT_HIT: audio.play('fortHit'); break;
      case EV.FORT_DOWN: audio.play('fortDown'); vib([40, 40, 90]); ui.banner(t('stageClear'), 'good'); break;
      case EV.SHIELD_HIT:
        audio.play('shield'); vib(35);
        flashEl.classList.add('on');
        requestAnimationFrame(() => requestAnimationFrame(() => flashEl.classList.remove('on')));
        break;
      case EV.BLOCK_HIT: audio.play('blockHit'); break;
      case EV.BLOCK_DOWN: audio.play(sim.blockers[v | 0]?.type === BT.TNT ? 'explo' : 'gateDone'); break;
      case EV.PICKUP: audio.play('pickup'); ui.banner(t('pick')[v | 0], 'good'); vib(20); break;
      case EV.FALL: audio.play('fall'); break;
      case EV.SHELL_FIRE: audio.play('shell'); break;
      case EV.SHELL_LAND: case EV.EXPLO: audio.play('explo'); break;
      case EV.GATE_DONE: audio.play('gateDone'); break;
      case EV.BOSS_WARN: audio.play('warn'); break;
      case EV.BOSS_STOMP: audio.play('stomp'); vib(60); break;
      case EV.COIN: audio.play('coin'); break;
      case EV.STAGE:
        audio.play('stage');
        if (level.stages[sim.stage].boss) { ui.banner(`${t('bosses')[level.world]} ${t('bossIn')}`, 'bad'); musicFor(level, 'boss'); }
        break;
      case EV.WIN: audio.play('win'); vib([30, 50, 30, 50, 120]); break;
      case EV.LOSE: audio.play('lose'); audio.play('explo'); vib([120, 60, 200]); break;
      case EV.BOSS_DOWN: audio.play('fortDown'); vib([60, 40, 140]); break;
      case EV.CAGE_FREE: audio.play('cage'); break;
      case EV.FREEZE: audio.play('freeze'); break;
      case EV.SAW_KILL: audio.play('saw'); break;
      case EV.MEGA_READY: audio.play('megaReady'); break;
    }
  }
  sim.evn = 0;
}

// ---- main loop -----------------------------------------------------------------------------
let last = 0, fpsT = 0, fpsN = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const raw = Math.min(100, ts - last);
  last = ts;
  const dt = Math.min(0.05, raw / 1000);
  if (mode === 'boot') return;
  if (!NOADAPT) renderer.adapt(raw);

  if (mode === 'menu') {
    bot.update(dt);
    sim.step(dt);
    processEvents(true);
    if (sim.state === STATE.WON || sim.state === STATE.LOST) {
      if (sim.endTimer > 2.5) {
        sim = new Sim(level, { rate: 8, multi: 6, mega: 4, shield: 15 }, (Math.random() * 1000) | 0);
        bot = new Bot(sim, 0.7, (Math.random() * 1000) | 0);
        renderer.buildLevel(level, sim);
        renderer.snapCamera();
      }
    }
    renderer.update(sim, dt, true);
  } else if (mode === 'play') {
    if (bot) bot.update(dt);
    else {
      if (input.keyL) input.target -= 14 * dt;
      if (input.keyR) input.target += 14 * dt;
      input.target = Math.max(-HW + 0.7, Math.min(HW - 0.7, input.target));
      sim.setInput(input.target, input.down || input.keyFire || save.set.auto);
    }
    // split long frames so fast units cannot tunnel through thin things
    const steps = dt > 0.024 ? 2 : 1;
    for (let i = 0; i < steps; i++) sim.step(dt / steps);
    processEvents(false);
    renderer.update(sim, dt, false);
    ui.updateHud(sim, sim.coins);
    if ((sim.state === STATE.WON || sim.state === STATE.LOST) && !endShown) {
      endDelay += dt;
      if (endDelay > (sim.state === STATE.WON ? 1.9 : 1.5)) { endShown = true; finish(); }
    }
  } else if (mode === 'result') {
    // keep the scene alive behind the result card
    sim.step(dt);
    processEvents(true);
    renderer.update(sim, dt, false);
  } else if (mode === 'paused') {
    renderer.update(sim, 0, false);
  }
  renderer.render();

  if (DEBUG) {
    fpsT += raw; fpsN++;
    if (fpsT > 500) {
      const info = renderer.r.info.render;
      ui.fps(`${Math.round((fpsN * 1000) / fpsT)} fps · ${info.calls} calls · ${(info.triangles / 1000) | 0}k tris · u${sim.pn} e${sim.en} · dpr ${renderer.r.getPixelRatio().toFixed(2)} · ${renderer.qualityName}`);
      fpsT = 0; fpsN = 0;
    }
  }
}

async function boot() {
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.race([
        Promise.all([document.fonts.load('40px "Lilita One"'), document.fonts.load('800 16px "Nunito"')]),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    }
  } catch (e) { /* fall back to system fonts */ }
  renderer = new Renderer(canvas, pickQuality());
  renderer.setSkin(skinColor());
  ui = new UI(document.getElementById('ui'), save, handlers);
  bindInput();
  const startAt = Number(params.get('level'));
  if (startAt > 0) startLevel(startAt);
  else startMenu();
  document.getElementById('boot').classList.add('done');
  setTimeout(() => document.getElementById('boot').remove(), 700);
  requestAnimationFrame((ts) => { last = ts; requestAnimationFrame(frame); });
  if (DEBUG) window.__game = { get sim() { return sim; }, get renderer() { return renderer; }, save, startLevel, startMenu, handlers, ui };
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !params.has('nosw')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot().catch((e) => {
  console.error(e);
  const b = document.getElementById('boot');
  if (b) b.innerHTML = '<div style="padding:24px;text-align:center;font:700 16px system-ui">WebGL konnte nicht gestartet werden.<br><small>' + String(e && e.message || e) + '</small></div>';
});
