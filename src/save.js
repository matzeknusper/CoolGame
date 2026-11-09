// Persistent progress (localStorage with an in-memory fallback).
const KEY = 'wuselwars.save.v1';

const DEFAULT = () => ({
  v: 1,
  coins: 0,
  best: 1, // highest unlocked level
  stars: {}, // level -> 1..3
  up: { rate: 0, multi: 0, mega: 0, shield: 0, coins: 0 },
  skin: 'mint',
  seen: {},
  set: { sfx: true, music: true, vib: true, quality: 'auto', lang: null, auto: false },
  stat: { wins: 0, kills: 0 },
});

export function loadSave() {
  const d = DEFAULT();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.v === 1) {
        Object.assign(d, s);
        d.up = { ...DEFAULT().up, ...s.up };
        d.set = { ...DEFAULT().set, ...s.set };
        d.stat = { ...DEFAULT().stat, ...s.stat };
      }
    }
  } catch (e) { /* storage unavailable: play without persistence */ }
  return d;
}

export function storeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  return DEFAULT();
}

export function totalStars(s) {
  let t = 0;
  for (const k in s.stars) t += s.stars[k];
  return t;
}
