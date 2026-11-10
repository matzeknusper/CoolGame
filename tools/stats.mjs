// Win-rate statistics per level with "expected" upgrades: node tools/stats.mjs [seeds] [skill] [upgradeFactor]
import { makeLevel, makeHordeLevel, hordeEq, CAMPAIGN_LEVELS, HORDE_LEVELS } from '../src/levels.js';
import { Sim, Bot } from '../src/sim.js';
import { STATE } from '../src/config.js';
const seeds = Number(process.argv[2] || 5), skill = Number(process.argv[3] || 0.8), uf = Number(process.argv[4] || 1);
const HORDE = process.argv.includes('--horde');
const COUNT = HORDE ? HORDE_LEVELS : CAMPAIGN_LEVELS;
let tw = 0, tt = 0, ts = 0, rows = [];
for (let lv = 1; lv <= COUNT; lv++) {
  const n = HORDE ? hordeEq(lv) : lv;
  const up = { rate: Math.min(20, Math.floor(n * 0.3 * uf)), multi: Math.min(15, Math.floor(n * 0.24 * uf)), mega: Math.min(15, Math.floor(n * 0.15 * uf)), shield: Math.min(15, Math.floor(n * 0.15 * uf)), coins: 0 };
  let w = 0, t = 0, s = 0, pk = 0;
  for (let k = 0; k < seeds; k++) {
    const sim = new Sim(HORDE ? makeHordeLevel(lv) : makeLevel(n), up, k + 1);
    const bot = new Bot(sim, skill, k * 17 + n);
    let time = 0;
    while (sim.state < STATE.WON && time < 400) { bot.update(1 / 60); sim.step(1 / 60); sim.evn = 0; time += 1 / 60; }
    if (sim.state === STATE.WON) { w++; s += sim.stars(); }
    t += time; pk = Math.max(pk, sim.peak);
  }
  tw += w; tt += t; ts += s;
  rows.push(`${String(lv).padStart(3)} win ${w}/${seeds} t=${(t / seeds).toFixed(0).padStart(3)}s stars=${(s / Math.max(1, w)).toFixed(1)} peak=${pk}`);
}
const bad = rows.filter((r) => !r.includes(`win ${seeds}/${seeds}`));
console.log(bad.join('\n'));
console.log(`TOTAL win ${(100 * tw / (seeds * COUNT)).toFixed(0)}%  avg time ${(tt / (seeds * COUNT)).toFixed(0)}s  avg stars ${(ts / Math.max(1, tw)).toFixed(2)}`);
if (process.argv.includes('--all')) console.log(rows.join('\n'));
// --min=NN: fail (for CI) when the bot's win rate drops below NN percent
const min = Number((process.argv.find((a) => a.startsWith('--min=')) || '').slice(6));
if (min && (100 * tw) / (seeds * COUNT) < min) { console.error(`win rate below ${min}%`); process.exit(1); }
