// Game bootstrap, main loop and screen flow.
import { HW, EV, EK, STATE, UPGRADES, upgradeCost, BT } from './config.js';
import { makeLevel, makeHordeLevel, levelInfo, hordeInfo } from './levels.js';
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
if (DEBUG && params.get('up')) {
  // debug: ?up=rate,multi,mega,shield,coins (not persisted unless something else saves)
  const u = params.get('up').split(',').map(Number);
  save.up = { rate: u[0] | 0, multi: u[1] | 0, mega: u[2] | 0, shield: u[3] | 0, coins: u[4] | 0 };
}
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
let gameMode = 'campaign'; // 'campaign' (storm fortresses) | 'horde' (defeat the waves)
let hintOn = false;
let lastVib = 0;
let slowT = 0; // seconds of slow motion left (finishers)

function screenFlash(white) {
  flashEl.classList.toggle('white', !!white);
  flashEl.classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => flashEl.classList.remove('on')));
}

function setFrenzy(on) {
  document.body.classList.toggle('frenzy', on);
  if (renderer) renderer.setFrenzy(on);
}

const input = { down: false, id: -1, startX: 0, lastX: 0, startLx: 0, target: 0, keyL: false, keyR: false, keyFire: false };

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
  setFrenzy(false);
  gameMode = save.mode === 'horde' ? 'horde' : 'campaign';
  levelN = gameMode === 'horde' ? save.hbest : save.best;
  level = gameMode === 'horde' ? makeHordeLevel(levelN) : makeLevel(levelN);
  sim = new Sim(level, { rate: 8, multi: 6, mega: 4, shield: 15 }, (Math.random() * 1000) | 0);
  bot = new Bot(sim, 0.7, (Math.random() * 1000) | 0);
  renderer.buildLevel(level, sim);
  renderer.snapCamera();
  ui.showHud(false);
  ui.introCard(null);
  ui.show('home');
  musicFor(level, 'menu');
}

function startLevel(n, gm = gameMode) {
  levelN = n;
  gameMode = gm === 'horde' ? 'horde' : 'campaign';
  if (save.mode !== gameMode) { save.mode = gameMode; storeSave(save); }
  level = gameMode === 'horde' ? makeHordeLevel(n) : makeLevel(n);
  sim = new Sim(level, save.up, (Math.random() * 100000) | 0);
  bot = AUTOBOT ? new Bot(sim, 0.85, 3) : null;
  renderer.buildLevel(level, sim);
  mode = 'play';
  slowT = 0;
  setFrenzy(false);
  endShown = false;
  endDelay = 0;
  input.down = false;
  input.target = 0;
  ui.hide();
  ui.showHud(true, level);
  ui.updateHud(sim, 0);
  hintOn = n <= 2 && gameMode === 'campaign' && !save.set.auto;
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
  const horde = gameMode === 'horde';
  const starMap = horde ? save.hstars : save.stars;
  const first = !starMap[levelN];
  const reward = levelReward(level.eq || levelN, sim.coins, stars, won, first);
  const bonus = reward - sim.coins;
  save.coins += reward;
  if (won) {
    starMap[levelN] = Math.max(starMap[levelN] || 0, stars);
    if (horde) save.hbest = Math.max(save.hbest, levelN + 1);
    else save.best = Math.max(save.best, levelN + 1);
    save.stat.wins++;
  }
  save.stat.kills += sim.kills;
  storeSave(save);
  mode = 'result';
  ui.showHud(false);
  ui.introCard(null);
  const info = horde ? hordeInfo(levelN) : levelInfo(levelN);
  ui.show('result', {
    won, stars, n: levelN, horde, boss: info.boss, world: t('worlds')[info.world], collected: sim.coins, bonus: Math.max(0, bonus), total: reward,
    tip: t('tips')[(Math.random() * t('tips').length) | 0], skin: '#' + skinColor().toString(16).padStart(6, '0'),
  });
  if (won) for (let i = 0; i < stars; i++) setTimeout(() => audio.play('star', i), 420 + i * 280);
}

const handlers = {
  click: () => { audio.unlock(); audio.play('click'); },
  play: (n, gm) => startLevel(n, gm),
  mode: (m) => {
    save.mode = m === 'horde' ? 'horde' : 'campaign';
    storeSave(save);
    // on the home screen the scene behind the menu shows the chosen mode
    if (ui.screen === 'home') startMenu();
    else ui.show('levels');
  },
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
    input.startX = input.lastX = e.clientX; input.startLx = sim.lx;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (hintOn) { hintOn = false; ui.hint(false); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!input.down || e.pointerId !== input.id) return;
    input.lastX = e.clientX;
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
      case EV.POP_E: audio.play(v >= EK.BRUTE ? 'bigPop' : 'popE', sim.combo); break;
      case EV.GATE: audio.play('gate'); break;
      case EV.FORT_HIT: audio.play('fortHit'); break;
      case EV.FORT_DOWN: audio.play('fortDown'); vib([40, 40, 90]); ui.banner(t('stageClear'), 'good'); slowT = 0.8; screenFlash(true); break;
      case EV.SHIELD_HIT:
        audio.play('shield'); vib(35);
        screenFlash(false);
        break;
      case EV.BLOCK_HIT: audio.play('blockHit'); break;
      case EV.BLOCK_DOWN: audio.play(sim.blockers[v | 0]?.type === BT.TNT ? 'explo' : 'gateDone'); break;
      case EV.PICKUP: audio.play('pickup'); ui.banner(t('pick')[v | 0], 'good'); vib(20); break;
      case EV.FALL: audio.play('fall'); break;
      case EV.SHELL_FIRE: audio.play('shell'); break;
      case EV.SHELL_LAND: case EV.EXPLO: audio.play('explo'); if (v >= 4.5) { screenFlash(true); vib(30); } break;
      case EV.GATE_DONE: audio.play('gateDone'); break;
      case EV.BOSS_WARN: audio.play('warn'); break;
      case EV.BOSS_STOMP: audio.play('stomp'); vib(60); break;
      case EV.COIN: audio.play('coin'); break;
      case EV.STAGE:
        audio.play('stage');
        if (level.stages[sim.stage].boss) { ui.banner(`${t('bosses')[level.world]} ${t('bossIn')}`, 'bad'); musicFor(level, 'boss'); }
        break;
      case EV.WIN: audio.play('win'); vib([30, 50, 30, 50, 120]); slowT = Math.max(slowT, 0.7); setFrenzy(false); break;
      case EV.FRENZY: audio.play('frenzy'); ui.banner(t('frenzy'), 'gold'); setFrenzy(true); vib([20, 30, 60]); break;
      case EV.FRENZY_END: audio.play('frenzyEnd'); setFrenzy(false); break;
      case EV.MILESTONE: audio.play('milestone', (v | 0) * 2); ui.banner(t('miles')[v | 0] || t('miles')[0], 'gold'); break;
      case EV.LOSE: audio.play('lose'); audio.play('explo'); vib([120, 60, 200]); slowT = 0.6; setFrenzy(false); break;
      case EV.BOSS_DOWN: audio.play('fortDown'); vib([60, 40, 140]); slowT = 1.0; screenFlash(true); break;
      case EV.CAGE_FREE: audio.play('cage'); break;
      case EV.FREEZE: audio.play('freeze'); break;
      case EV.SAW_KILL: audio.play('saw'); break;
      case EV.MEGA_READY: audio.play('megaReady'); break;
      case EV.WAVE: {
        const count = sim.waveCount, idx = (v | 0) + 1;
        ui.banner(idx === count && count > 1 ? t('lastWave') : `${t('wave')} ${idx}/${count}`, 'bad');
        audio.play('warn');
        break;
      }
      case EV.BOSS_IN:
        ui.banner(`${t('hordeBoss')} ${t('bossIn')}`, 'bad');
        audio.play('warn');
        musicFor(level, 'boss');
        break;
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
  let dt = Math.min(0.05, raw / 1000);
  // finishers play in slow motion
  if (slowT > 0) { slowT -= dt; if (mode === 'play') dt *= 0.3; }
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
      if (sim.state === STATE.ADVANCE) {
        // the launcher drives itself to the next stage: re-anchor the drag to where it is
        input.target = sim.lx; input.startLx = sim.lx; input.startX = input.lastX;
      }
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
  const hordeAt = Number(params.get('horde'));
  if (hordeAt > 0) startLevel(hordeAt, 'horde');
  else if (startAt > 0) startLevel(startAt, 'campaign');
  else startMenu();
  document.getElementById('boot').classList.add('done');
  setTimeout(() => document.getElementById('boot').remove(), 700);
  requestAnimationFrame((ts) => { last = ts; requestAnimationFrame(frame); });
  if (DEBUG) window.__game = { get sim() { return sim; }, get renderer() { return renderer; }, save, startLevel, startMenu, handlers, ui };
  // only the PWA build (which links a manifest) ships a service worker
  try {
    if ('serviceWorker' in navigator && location.protocol === 'https:' && document.querySelector('link[rel=manifest]') && !params.has('nosw')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  } catch (e) { /* sandboxed frame */ }
}

boot().catch((e) => {
  console.error(e);
  const b = document.getElementById('boot');
  if (b) b.innerHTML = '<div style="padding:24px;text-align:center;font:700 16px system-ui">WebGL konnte nicht gestartet werden.<br><small>' + String(e && e.message || e) + '</small></div>';
});
