// Headless balance check: a bot plays every campaign level.
//   node tools/balance.mjs            -> economy run (bot buys upgrades with earned coins)
//   node tools/balance.mjs --quick    -> CI-style check, exits non-zero if a level is unwinnable
//   node tools/balance.mjs --base     -> every level with zero upgrades (how hard is it un-upgraded?)
//   node tools/balance.mjs --horde    -> the same for the horde mode (its own upgrades, earned in it)
import { makeLevel, makeHordeLevel, hordeEq, CAMPAIGN_LEVELS, HORDE_LEVELS } from '../src/levels.js';
import { Sim, Bot } from '../src/sim.js';
import { STATE, UPGRADES, upgradeCost } from '../src/config.js';
import { levelReward } from '../src/economy.js';

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const base = args.includes('--base');
const horde = args.includes('--horde');
const upto = Number((args.find((a) => a.startsWith('--to=')) || '').slice(5)) || (horde ? HORDE_LEVELS : CAMPAIGN_LEVELS);
const skill = Number((args.find((a) => a.startsWith('--skill=')) || '').slice(8)) || 0.8;

export function play(n, upgrades, seed = 1, sk = skill) {
  const level = horde ? makeHordeLevel(n) : makeLevel(n);
  const sim = new Sim(level, upgrades, seed);
  const bot = new Bot(sim, sk, seed * 13 + n);
  const dt = 1 / 60;
  let t = 0;
  while (sim.state !== STATE.WON && sim.state !== STATE.LOST && t < 400) {
    bot.update(dt);
    sim.step(dt);
    sim.evn = 0;
    t += dt;
  }
  return { level, sim, time: t, won: sim.state === STATE.WON, stars: sim.stars() };
}

const up = { rate: 0, multi: 0, mega: 0, shield: 0, coins: 0 };
let wallet = 0;
let fails = 0, hardFails = 0;
const order = ['rate', 'multi', 'shield', 'mega', 'rate', 'coins', 'multi'];
let oi = 0;
const t0 = Date.now();
console.log(' lvl st  M     fortHP  result  time  stars shield  peak  coins  wallet  upgrades');
for (let n = 1; n <= upto; n++) {
  let tries = 0, r;
  for (;;) {
    r = play(n, base ? {} : up, 1 + tries);
    tries++;
    const rew = levelReward(horde ? hordeEq(n) : n, r.sim.coins, r.stars, r.won, true);
    if (!base) wallet += rew;
    if (!base) {
      // buy greedily in a fixed priority rotation
      for (let guard = 0; guard < 40; guard++) {
        const id = order[oi % order.length];
        const def = UPGRADES.find((u) => u.id === id);
        if (up[id] >= def.max) { oi++; continue; }
        const cost = upgradeCost(def, up[id]);
        if (cost > wallet) break;
        wallet -= cost; up[id]++; oi++;
      }
    }
    if (r.won || tries >= (quick ? 6 : 4) || base) break;
    fails++;
  }
  if (!r.won) hardFails++;
  const L = r.level;
  console.log(
    String(n).padStart(4), String(L.stages.length).padStart(2), L.stages.map((s) => s.M.toFixed(1)).join('/').padEnd(14),
    L.stages.map((s) => s.hp).join('/').padEnd(16), (r.won ? 'WIN ' : 'LOSS') + (tries > 1 ? `x${tries}` : '  '),
    r.time.toFixed(0).padStart(5), String(r.stars).padStart(4), `${Math.max(0, r.sim.shield)}/${r.sim.shieldMax}`.padStart(7),
    String(r.sim.peak).padStart(5), String(r.sim.coins).padStart(6), String(Math.round(wallet)).padStart(7), ' ', Object.values(up).join(','),
  );
}
console.log(`retries: ${fails}, unwinnable: ${hardFails}, ${(Date.now() - t0) / 1000}s`);
if (quick && hardFails) process.exit(1);
