// DOM user interface: menus, level select, shop, HUD and result screens.
import { t } from './i18n.js';
import { UPGRADES, upgradeCost, playerStats } from './config.js';
import { CAMPAIGN_LEVELS, LEVELS_PER_WORLD, WORLD_COUNT, levelInfo, HORDE_LEVELS, HORDE_PER_WORLD, hordeInfo } from './levels.js';
import { SKINS, THEMES } from './themes.js';
import { WORLD_IDS } from './levels.js';
import { totalStars } from './save.js';

const I = {
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ffc928" stroke="#b97a00" stroke-width="2"/><circle cx="12" cy="12" r="6" fill="none" stroke="#fff2b0" stroke-width="2"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 1.8l3.1 6.6 7.1.9-5.2 5 1.3 7.1L12 17.9l-6.3 3.5 1.3-7.1-5.2-5 7.1-.9z" fill="currentColor" stroke="rgba(0,0,0,.35)" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 001.5.9l12-7.5a1 1 0 000-1.8l-12-7.5A1 1 0 007 4.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1.5" fill="currentColor"/><rect x="14" y="4" width="5" height="16" rx="1.5" fill="currentColor"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M3 11.5L12 3l9 8.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" fill="currentColor"/></svg>',
  retry: '<svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 107.7 10.2" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M20.5 3.5v6h-6z" fill="currentColor"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><g fill="currentColor">' + [0, 45, 90, 135].map((a) => `<rect x="10" y="1.5" width="4" height="21" rx="1.2" transform="rotate(${a} 12 12)"/>`).join('') + '<circle cx="12" cy="12" r="7"/></g><circle cx="12" cy="12" r="3" fill="#2a1f52"/></svg>',
  cart: '<svg viewBox="0 0 24 24"><path d="M12 2l2.200 5.300L20 8l-4.300 3.700L17 17.500 12 14.300 7 17.500l1.300-5.800L4 8l5.800-.7z" fill="currentColor"/><rect x="5" y="19" width="14" height="3" rx="1.500" fill="currentColor"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7.500" height="7.500" rx="2" fill="currentColor"/><rect x="13.500" y="3" width="7.500" height="7.500" rx="2" fill="currentColor"/><rect x="3" y="13.500" width="7.500" height="7.500" rx="2" fill="currentColor"/><rect x="13.500" y="13.500" width="7.500" height="7.500" rx="2" fill="currentColor"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="4.500" y="10.500" width="15" height="11" rx="2.500" fill="currentColor"/><path d="M8 10.500V7.500a4 4 0 018 0v3" fill="none" stroke="currentColor" stroke-width="2.600"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="3.500" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21C3 14.500 1.500 9.500 4.200 6.300 6.500 3.600 10.200 4.300 12 7c1.800-2.700 5.500-3.400 7.800-.7C22.500 9.500 21 14.500 12 21z" fill="currentColor"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path d="M3 18.500V7l4.500 4L12 4.500 16.500 11 21 7v11.500z" fill="currentColor" stroke="rgba(0,0,0,.3)" stroke-width="1" stroke-linejoin="round"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13.500 2L4.500 13.500h5.500L8.500 22l10-12.500h-6z" fill="currentColor"/></svg>',
  double: '<svg viewBox="0 0 24 24"><circle cx="8.500" cy="13" r="5.500" fill="currentColor"/><circle cx="16.500" cy="10" r="4.500" fill="currentColor" opacity=".7"/></svg>',
  skull: '<svg viewBox="0 0 24 24"><path d="M12 2.500c-5 0-8.500 3.500-8.500 8 0 2.800 1.300 4.800 3 6v3a1 1 0 001 1h9a1 1 0 001-1v-3c1.700-1.200 3-3.200 3-6 0-4.500-3.500-8-8.500-8z" fill="currentColor"/><circle cx="8.700" cy="11" r="2.200" fill="#1b1035"/><circle cx="15.300" cy="11" r="2.200" fill="#1b1035"/></svg>',
};
const UP_ICON = { rate: 'bolt', multi: 'double', mega: 'crown', shield: 'heart', coins: 'coin' };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const $ = (s, el = document) => el.querySelector(s);
const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const fmt = (n) => (n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : String(Math.round(n)));

export class UI {
  constructor(root, save, handlers) {
    this.root = root;
    this.save = save;
    this.h = handlers;
    this.screen = null;
    this.worldTab = 0;
    this.shopTab = 'up';
    this.hudCache = {};
    this.build();
  }

  build() {
    this.root.innerHTML = `
      <div id="hud" class="hidden">
        <div class="hud-top">
          <button class="icon-btn" data-act="pause" aria-label="Pause">${I.pause}</button>
          <div class="hud-title"><div id="hud-level"></div><div id="hud-stages"></div></div>
          <div class="pill coin-pill">${I.coin}<span id="hud-coins">0</span></div>
        </div>
        <div class="bar enemy-bar"><div class="bar-fill" id="hud-fort"></div><div class="bar-text" id="hud-fort-text"></div></div>
        <div id="hud-combo"><div class="combo-n"><span id="hud-combo-n"></span></div><div class="frenzy-bar"><i id="hud-frenzy"></i></div></div>
        <div id="hud-chips"></div>
        <div id="hud-hint" class="hidden"><div class="hand"></div><span></span></div>
        <div id="hud-banner"></div>
        <div class="hud-bottom">
          <div class="stat shield-stat"><span class="stat-icon">${I.heart}</span><div class="bar"><div class="bar-fill" id="hud-shield"></div><div class="bar-text" id="hud-shield-text"></div></div></div>
          <div class="crowd"><span id="hud-crowd">0</span><small>${t('crowd')}</small></div>
          <div class="stat mega-stat"><div class="bar"><div class="bar-fill" id="hud-mega"></div><div class="bar-text">MEGA</div></div><span class="stat-icon">${I.crown}</span></div>
        </div>
      </div>
      <div id="intro-card" class="hidden"></div>
      <div id="screens"></div>
      <div id="fps" class="hidden"></div>`;
    this.screens = $('#screens', this.root);
    this.hud = $('#hud', this.root);
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      this.h.click?.();
      this.act(b.dataset.act, b.dataset.arg, b);
    });
  }

  act(a, arg, b) {
    const h = this.h;
    switch (a) {
      case 'play': h.play(this.save.mode === 'horde' ? this.save.hbest : this.save.best, this.save.mode); break;
      case 'level': h.play(Number(arg), b?.dataset.mode || 'campaign'); break;
      case 'mode': h.mode(arg); break;
      case 'levels': this.worldTab = Math.min(WORLD_COUNT - 1, levelInfo(Math.min(this.save.best, CAMPAIGN_LEVELS)).world); this.show('levels'); break;
      case 'shop': this.show('shop'); break;
      case 'settings': this.show('settings'); break;
      case 'home': h.home(); break;
      case 'back': this.screen === 'pause' ? h.resume() : h.home(); break;
      case 'world': this.worldTab = Number(arg); this.show('levels'); break;
      case 'tab': this.shopTab = arg; this.show('shop'); break;
      case 'buy': h.buy(arg); break;
      case 'skin': h.skin(arg); break;
      case 'pause': h.pause(); break;
      case 'resume': h.resume(); break;
      case 'restart': h.restart(); break;
      case 'next': h.next(); break;
      case 'toggle': h.toggle(arg); break;
      case 'quality': h.quality(arg); break;
      case 'lang': h.lang(arg); break;
      case 'reset': this.show('reset'); break;
      case 'reset-yes': h.reset(); break;
    }
  }

  modeSwitch() {
    const m = this.save.mode === 'horde' ? 'horde' : 'campaign';
    const b = (id, name, sub) => `<button class="mode ${m === id ? 'on' : ''} m-${id}" data-act="mode" data-arg="${id}"><b>${t(name)}</b><small>${t(sub)}</small></button>`;
    return `<div class="mode-switch">${b('campaign', 'modeCampaign', 'modeCampaignSub')}${b('horde', 'modeHorde', 'modeHordeSub')}</div>`;
  }

  // upgrades are kept per game mode (coins are shared)
  ups() { return this.save.mode === 'horde' ? this.save.hup : this.save.up; }

  coinsPill() { return `<div class="pill coin-pill">${I.coin}<span>${fmt(this.save.coins)}</span></div>`; }
  starsPill() { return `<div class="pill star-pill"><span class="star on">${I.star}</span><span>${totalStars(this.save)}</span></div>`; }

  show(name, data) {
    this.screen = name;
    const s = this.save;
    let html = '';
    if (name === 'home') {
      const horde = s.mode === 'horde';
      const lvl = horde ? s.hbest : s.best;
      const info = horde ? hordeInfo(lvl) : levelInfo(lvl);
      const wname = t('worlds')[info.world];
      html = `<div class="screen home">
        <div class="top-row">${this.starsPill()}${this.coinsPill()}</div>
        <div class="logo"><span class="l1">${t('title1')}</span><span class="l2">${t('title2')}</span><div class="tag">${t(horde ? 'taglineHorde' : 'tagline')}</div></div>
        <div class="home-actions">
          ${this.modeSwitch()}
          <button class="btn big primary pulse" data-act="play">${I.play}<span>${t('level')} ${lvl}</span><small>${info.cycle ? t('endless') + ' · ' : ''}${wname}${info.boss ? ' · ' + t('bossLevel') : ''}</small></button>
          <div class="row">
            <button class="btn" data-act="levels">${I.grid}<span>${t('levels')}</span></button>
            <button class="btn" data-act="shop">${I.cart}<span>${t('upgrades')}</span>${this.canBuy() ? '<i class="dot"></i>' : ''}</button>
            <button class="btn square" data-act="settings" aria-label="${t('settings')}">${I.gear}</button>
          </div>
        </div></div>`;
    } else if (name === 'levels' && s.mode === 'horde') {
      let rows = '';
      for (let w = 0; w < WORLD_COUNT; w++) {
        const th = THEMES[WORLD_IDS[w]];
        let grid = '';
        for (let k = 0; k < HORDE_PER_WORLD; k++) {
          const n = w * HORDE_PER_WORLD + k + 1;
          const open = n <= s.hbest;
          const st = s.hstars[n] || 0;
          const boss = k === HORDE_PER_WORLD - 1;
          grid += `<button class="lvl ${open ? '' : 'locked'} ${boss ? 'boss' : ''} ${n === s.hbest ? 'current' : ''}" ${open ? `data-act="level" data-mode="horde" data-arg="${n}"` : 'disabled'}>
            <b>${open ? (boss ? I.skull : n) : I.lock}</b>
            <span class="stars">${[1, 2, 3].map((i) => `<i class="star ${st >= i ? 'on' : ''}">${I.star}</i>`).join('')}</span></button>`;
        }
        rows += `<div class="world-card slim" style="--a:${hex(th.skyTop)};--b:${hex(th.skyMid)};--c:${hex(th.skyBot)}"><div class="world-head"><h3>${t('worlds')[w]}</h3></div><div class="lvl-grid">${grid}</div></div>`;
      }
      const endless = s.hbest > HORDE_LEVELS ? `<button class="btn primary wide" data-act="level" data-mode="horde" data-arg="${s.hbest}">${I.play}<span>${t('endless')}: ${t('level')} ${s.hbest}</span></button>` : '';
      html = `<div class="screen panel-screen">
        <div class="top-row"><button class="icon-btn" data-act="home">${I.back}</button><h2>${t('levels')}</h2>${this.starsPill()}</div>
        ${this.modeSwitch()}
        <div class="scroll">${rows}${endless}</div></div>`;
    } else if (name === 'levels') {
      const w = this.worldTab;
      const th = THEMES[WORLD_IDS[w]];
      const unlockedWorld = (i) => i === 0 || s.best > i * LEVELS_PER_WORLD;
      let tabs = '';
      for (let i = 0; i < WORLD_COUNT; i++) {
        const c = THEMES[WORLD_IDS[i]];
        tabs += `<button class="wtab ${i === w ? 'on' : ''} ${unlockedWorld(i) ? '' : 'locked'}" data-act="world" data-arg="${i}" style="--a:${hex(c.skyTop)};--b:${hex(c.skyBot)}">${unlockedWorld(i) ? i + 1 : I.lock}</button>`;
      }
      let grid = '';
      for (let k = 0; k < LEVELS_PER_WORLD; k++) {
        const n = w * LEVELS_PER_WORLD + k + 1;
        const open = n <= s.best;
        const st = s.stars[n] || 0;
        const boss = k === LEVELS_PER_WORLD - 1;
        grid += `<button class="lvl ${open ? '' : 'locked'} ${boss ? 'boss' : ''} ${n === s.best ? 'current' : ''}" ${open ? `data-act="level" data-arg="${n}"` : 'disabled'}>
          <b>${open ? (boss ? I.skull : n) : I.lock}</b>
          <span class="stars">${[1, 2, 3].map((i) => `<i class="star ${st >= i ? 'on' : ''}">${I.star}</i>`).join('')}</span></button>`;
      }
      const wst = [...Array(LEVELS_PER_WORLD)].reduce((a, _, k) => a + (s.stars[w * LEVELS_PER_WORLD + k + 1] || 0), 0);
      const endless = s.best > CAMPAIGN_LEVELS ? `<button class="btn primary wide" data-act="level" data-arg="${s.best}">${I.play}<span>${t('endless')}: ${t('level')} ${s.best}</span></button>` : '';
      html = `<div class="screen panel-screen">
        <div class="top-row"><button class="icon-btn" data-act="home">${I.back}</button><h2>${t('levels')}</h2>${this.starsPill()}</div>
        ${this.modeSwitch()}
        <div class="wtabs">${tabs}</div>
        <div class="world-card" style="--a:${hex(th.skyTop)};--b:${hex(th.skyMid)};--c:${hex(th.skyBot)}">
          <div class="world-head"><div><small>${t('world')} ${w + 1}</small><h3>${t('worlds')[w]}</h3></div><div class="pill star-pill"><span class="star on">${I.star}</span><span>${wst}/${LEVELS_PER_WORLD * 3}</span></div></div>
          ${unlockedWorld(w) ? `<div class="lvl-grid">${grid}</div>` : `<div class="world-locked">${I.lock}<p>${t('locked')}</p></div>`}
        </div>${endless}</div>`;
    } else if (name === 'shop') {
      let body = '';
      if (this.shopTab === 'up') {
        const ups = this.ups();
        const cur = playerStats(ups);
        for (const def of UPGRADES) {
          const lvl = ups[def.id];
          const maxed = lvl >= def.max;
          const cost = upgradeCost(def, lvl);
          const nxt = playerStats({ ...ups, [def.id]: lvl + 1 });
          const val = {
            rate: [cur.fireRate.toFixed(1) + '/s', nxt.fireRate.toFixed(1) + '/s'],
            multi: [Math.round(cur.multiChance * 100) + '%', Math.round(nxt.multiChance * 100) + '%'],
            mega: [cur.megaHp + ' HP', nxt.megaHp + ' HP'],
            shield: [cur.shield, nxt.shield],
            coins: ['+' + Math.round((cur.coinMul - 1) * 100) + '%', '+' + Math.round((nxt.coinMul - 1) * 100) + '%'],
          }[def.id];
          body += `<div class="up-card up-${def.id}">
            <div class="up-icon">${I[UP_ICON[def.id]]}</div>
            <div class="up-info"><h4>${t('up.' + def.id)[0]} <small>${t('lvl')} ${lvl}</small></h4><p>${t('up.' + def.id)[1]}</p>
              <div class="up-val">${val[0]}${maxed ? '' : ` <span>→ ${val[1]}</span>`}</div>
              <div class="pips">${[...Array(def.max)].map((_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
            <button class="btn buy ${maxed ? 'maxed' : s.coins >= cost ? 'primary' : 'poor'}" data-act="buy" data-arg="${def.id}" ${maxed ? 'disabled' : ''}>${maxed ? t('max') : I.coin + '<span>' + fmt(cost) + '</span>'}</button>
          </div>`;
        }
      } else {
        const ts = totalStars(s);
        body = '<div class="skin-grid">';
        for (const sk of SKINS) {
          const open = ts >= sk.stars;
          const on = s.skin === sk.id;
          body += `<button class="skin ${on ? 'on' : ''} ${open ? '' : 'locked'}" ${open ? `data-act="skin" data-arg="${sk.id}"` : 'disabled'}>
            <span class="blob" style="--c:${hex(sk.color)}"><i></i><i></i></span><b>${t('skin.' + sk.id)}</b>
            <small>${on ? t('selected') : open ? t('select') : `<span class="star on">${I.star}</span> ${sk.stars}`}</small></button>`;
        }
        body += '</div>';
      }
      html = `<div class="screen panel-screen">
        <div class="top-row"><button class="icon-btn" data-act="home">${I.back}</button><h2>${t('upgrades')}</h2>${this.coinsPill()}</div>
        <div class="tabs"><button class="tab ${this.shopTab === 'up' ? 'on' : ''}" data-act="tab" data-arg="up">${t('upgrades')}</button><button class="tab ${this.shopTab === 'skin' ? 'on' : ''}" data-act="tab" data-arg="skin">${t('skins')}</button></div>
        ${this.shopTab === 'up' ? this.modeSwitch() + `<p class="hint-line">${t('upSeparate')}</p>` : ''}
        <div class="scroll">${body}</div></div>`;
    } else if (name === 'settings' || name === 'pause') {
      const st = s.set;
      const tog = (k) => `<button class="toggle ${st[k] ? 'on' : ''}" data-act="toggle" data-arg="${k}"><span>${t(k)}</span><i></i></button>`;
      const seg = (act, cur, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-act="${act}" data-arg="${v}">${l}</button>`).join('')}</div>`;
      const common = `${tog('sfx')}${tog('music')}${tog('vib')}${tog('auto')}`;
      if (name === 'pause') {
        html = `<div class="screen overlay"><div class="card">
          <h2>${t('pause')}</h2>
          <button class="btn primary wide" data-act="resume">${I.play}<span>${t('resume')}</span></button>
          <div class="row"><button class="btn" data-act="restart">${I.retry}<span>${t('restart')}</span></button><button class="btn" data-act="home">${I.home}<span>${t('home')}</span></button></div>
          <div class="set-list">${common}</div></div></div>`;
      } else {
        html = `<div class="screen panel-screen">
          <div class="top-row"><button class="icon-btn" data-act="home">${I.back}</button><h2>${t('settings')}</h2><span></span></div>
          <div class="scroll"><div class="set-list">${common}
            <div class="set-row"><span>${t('quality')}</span>${seg('quality', st.quality, [['auto', t('q.auto')], ['low', t('q.low')], ['medium', t('q.medium')], ['high', t('q.high')]])}</div>
            <div class="set-row"><span>${t('lang')}</span>${seg('lang', data?.lang, [['de', 'Deutsch'], ['en', 'English']])}</div>
            <button class="btn danger wide" data-act="reset">${t('reset')}</button>
            <p class="credits">Wusel Wars v1.0 · three.js · Fonts: Lilita One, Nunito (OFL)</p>
          </div></div></div>`;
      }
    } else if (name === 'reset') {
      html = `<div class="screen overlay"><div class="card"><h2>${t('resetAsk')}</h2>
        <div class="row"><button class="btn danger" data-act="reset-yes">${t('yes')}</button><button class="btn primary" data-act="settings">${t('no')}</button></div></div></div>`;
    } else if (name === 'result') {
      const d = data;
      const stars = [1, 2, 3].map((i) => `<i class="star big ${d.stars >= i ? 'on pop' : ''}" style="animation-delay:${0.25 + i * 0.28}s">${I.star}</i>`).join('');
      html = `<div class="screen overlay result ${d.won ? 'won' : 'lost'}"><div class="card">
        <small class="res-level">${d.horde ? t('modeHorde') + ' · ' : ''}${t('level')} ${d.n} · ${d.world}</small>
        <h2>${d.won ? (d.horde ? t('hordeWin') : d.boss ? t('bossWin') : t('win')) : t('lose')}</h2>
        ${d.won ? `<div class="res-stars">${stars}</div>` : `<div class="res-sad"><span class="blob sad" style="--c:${d.skin}"><i></i><i></i></span></div>`}
        <div class="res-rows">
          <div><span>${t('collected')}</span><b>${I.coin}${d.collected}</b></div>
          ${d.won ? `<div><span>${t('bonus')}</span><b>${I.coin}${d.bonus}</b></div>` : ''}
          <div class="total"><span>${t('total')}</span><b>${I.coin}<span id="res-total">0</span></b></div>
        </div>
        ${d.won ? '' : `<p class="tip">${d.tip}</p>`}
        ${d.won ? `<button class="btn primary wide pulse" data-act="next">${I.play}<span>${t('next')}</span></button>` : `<button class="btn primary wide pulse" data-act="restart">${I.retry}<span>${t('retry')}</span></button>`}
        <div class="row">
          ${d.won ? `<button class="btn" data-act="restart">${I.retry}<span>${t('retry')}</span></button>` : ''}
          <button class="btn" data-act="shop">${I.cart}<span>${t('upgrades')}</span>${this.canBuy() ? '<i class="dot"></i>' : ''}</button>
          <button class="btn square" data-act="home" aria-label="${t('home')}">${I.home}</button>
        </div></div></div>`;
    }
    this.screens.innerHTML = html;
    if (name === 'result') this.countUp($('#res-total', this.screens), data.total);
  }

  hide() { this.screen = null; this.screens.innerHTML = ''; }

  canBuy() {
    const ups = this.ups();
    return UPGRADES.some((d) => ups[d.id] < d.max && upgradeCost(d, ups[d.id]) <= this.save.coins);
  }

  countUp(node, to) {
    const t0 = performance.now(), dur = 900;
    const tick = (now) => {
      if (!node.isConnected) return;
      const k = Math.min(1, (now - t0) / dur);
      node.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    setTimeout(() => requestAnimationFrame(tick), 500);
  }

  // ---- HUD -------------------------------------------------------------------------------
  showHud(on, level) {
    this.hud.classList.toggle('hidden', !on);
    this.hudCache = {};
    if (on && level) {
      const horde = level.mode === 'horde';
      const info = horde ? hordeInfo(level.n) : levelInfo(level.n);
      $('#hud-level').textContent = `${horde ? t('modeHorde') : t('level')} ${level.n}`;
      // campaign: one dot per stage, horde: one dot per wave
      $('#hud-stages').innerHTML = horde
        ? level.stages[0].horde.waves.map(() => '<i></i>').join('') + (level.stages[0].horde.bossHp ? '<i class="boss"></i>' : '')
        : level.stages.map((s) => `<i class="${s.boss ? 'boss' : ''}"></i>`).join('');
      this.hud.classList.toggle('horde', horde);
      $('#hud-banner').className = '';
      $('#hud-banner').textContent = '';
      this.bossName = t('bosses')[info.world];
    }
  }

  set(id, val, fn) {
    if (this.hudCache[id] === val) return;
    this.hudCache[id] = val;
    fn($('#' + id), val);
  }

  updateHud(sim, coins) {
    const st = sim.level.stages[sim.stage];
    const fort = sim.forts[sim.stage];
    const boss = st.boss;
    const horde = !!st.horde;
    const hp = horde ? sim.hordeLeft : boss ? sim.bossHp : fort.hp, max = horde ? sim.hordeTotal : boss ? sim.bossMax : fort.max;
    this.set('hud-fort', Math.round((Math.max(0, hp) / Math.max(1, max)) * 200), (n, v) => { n.style.transform = `scaleX(${v / 200})`; });
    this.set('hud-fort-text', (horde ? t('horde') + ' · ' : boss ? this.bossName + ' · ' : '') + Math.ceil(Math.max(0, hp)), (n, v) => { n.textContent = v; });
    this.set('hud-shield', Math.round((Math.max(0, sim.shield) / sim.shieldMax) * 100), (n, v) => { n.style.transform = `scaleX(${v / 100})`; n.parentNode.classList.toggle('low', v < 35); });
    this.set('hud-shield-text', Math.max(0, sim.shield), (n, v) => { n.textContent = v; });
    this.set('hud-mega', Math.round(sim.megaCharge * 50), (n, v) => { n.style.transform = `scaleX(${v / 50})`; n.parentNode.parentNode.classList.toggle('ready', v >= 50); });
    this.set('hud-crowd', sim.pn, (n, v) => { n.textContent = v; });
    this.set('hud-coins', coins, (n, v) => { n.textContent = fmt(v); });
    this.set('hud-stages', horde ? sim.waveIdx - 1 + (sim.hw && sim.hw.boss ? 1 : 0) : sim.stage, (n, v) => { [...n.children].forEach((c, i) => { c.classList.toggle('done', i < v); c.classList.toggle('cur', i === v); }); });
    // combo counter and frenzy gauge
    const cb = sim.combo >= 8 ? sim.combo : 0;
    this.set('hud-combo-n', cb, (n, v) => {
      n.textContent = v ? '×' + v : '';
      n.parentNode.style.setProperty('--s', String(1 + Math.min(0.9, v / 250)));
      if (v) { n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); }
    });
    const fz = sim.frenzyT > 0 ? 100 + Math.ceil((sim.frenzyT / 5.5) * 20) : Math.round(sim.frenzy * 40);
    this.set('hud-frenzy', fz, (n, v) => {
      const on = v >= 100;
      n.style.transform = `scaleX(${on ? (v - 100) / 20 : v / 40})`;
      n.parentNode.parentNode.classList.toggle('on', on);
    });
    const chips = (sim.rapidT > 0 ? 'r' + Math.ceil(sim.rapidT) : '') + (sim.freezeT > 0 ? 'f' + Math.ceil(sim.freezeT) : '');
    this.set('hud-chips', chips, (n) => {
      n.innerHTML = (sim.rapidT > 0 ? `<span class="chip rapid">${I.bolt}${Math.ceil(sim.rapidT)}s</span>` : '') + (sim.freezeT > 0 ? `<span class="chip freeze">❄ ${Math.ceil(sim.freezeT)}s</span>` : '');
    });
  }

  banner(text, cls = '') {
    const n = $('#hud-banner');
    n.textContent = text;
    n.className = '';
    void n.offsetWidth; // restart the animation
    n.className = 'show ' + cls;
  }

  hint(on, text) {
    const n = $('#hud-hint');
    n.classList.toggle('hidden', !on);
    if (on) $('span', n).textContent = text;
  }

  introCard(key) {
    const n = $('#intro-card');
    if (!key) { n.classList.add('hidden'); return; }
    const [title, body] = t('intro.' + key);
    n.innerHTML = `<b>${title}</b><p>${body}</p>`;
    n.classList.remove('hidden');
    n.classList.remove('anim');
    void n.offsetWidth;
    n.classList.add('anim');
    clearTimeout(this.introTimer);
    this.introTimer = setTimeout(() => n.classList.add('hidden'), 5200);
  }

  fps(text) {
    const n = $('#fps');
    n.classList.remove('hidden');
    n.textContent = text;
  }
}
