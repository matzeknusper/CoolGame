// Win-rate statistics per level with "expected" upgrades: node tools/stats.mjs [seeds] [skill] [upgradeFactor]
import { makeLevel, CAMPAIGN_LEVELS } from '../src/levels.js';
import { Sim, Bot } from '../src/sim.js';
import { STATE } from '../src/config.js';
const seeds = Number(process.argv[2] || 5), skill = Number(process.argv[3] || 0.8), uf = Number(process.argv[4] || 1);
let tw = 0, tt = 0, ts = 0, rows = [];
for (let n = 1; n <= CAMPAIGN_LEVELS; n++) {
  const up = { rate: Math.min(20, Math.floor(n * 0.3 * uf)), multi: Math.min(15, Math.floor(n * 0.24 * uf)), mega: Math.min(15, Math.floor(n * 0.15 * uf)), shield: Math.min(15, Math.floor(n * 0.15 * uf)), coins: 0 };
  let w = 0, t = 0, s = 0, pk = 0;
  for (let k = 0; k < seeds; k++) {
    const sim = new Sim(makeLevel(n), up, k + 1);
    const bot = new Bot(sim, skill, k * 17 + n);
    let time = 0;
    while (sim.state < STATE.WON && time < 400) { bot.update(1 / 60); sim.step(1 / 60); sim.evn = 0; time += 1 / 60; }
    if (sim.state === STATE.WON) { w++; s += sim.stars(); }
    t += time; pk = Math.max(pk, sim.peak);
  }
  tw += w; tt += t; ts += s;
  rows.push(`${String(n).padStart(3)} win ${w}/${seeds} t=${(t / seeds).toFixed(0).padStart(3)}s stars=${(s / Math.max(1, w)).toFixed(1)} peak=${pk}`);
}
const bad = rows.filter((r) => !r.includes(`win ${seeds}/${seeds}`));
console.log(bad.join('\n'));
console.log(`TOTAL win ${(100 * tw / (seeds * CAMPAIGN_LEVELS)).toFixed(0)}%  avg time ${(tt / (seeds * CAMPAIGN_LEVELS)).toFixed(0)}s  avg stars ${(ts / Math.max(1, tw)).toFixed(2)}`);
if (process.argv.includes('--all')) console.log(rows.join('\n'));
