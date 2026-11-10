// Debug helper: node tools/trace.mjs <level> [rate,multi,mega,shield,coins]
import { makeLevel, makeHordeLevel, hordeEq } from '../src/levels.js';
import { Sim, Bot } from '../src/sim.js';
import { STATE, EV } from '../src/config.js';
const n = Number(process.argv[2] || 1);
const u = (process.argv[3] || '0,0,0,0,0').split(',').map(Number);
const up = { rate: u[0], multi: u[1], mega: u[2], shield: u[3], coins: u[4] };
const HORDE = process.argv.includes('--horde');
const level = HORDE ? makeHordeLevel(n) : makeLevel(n);
console.log(JSON.stringify({ stages: level.stages, gates: level.gates.length, blockers: level.blockers.length, saws: level.saws.length, spinners: level.spinners.length, holes: level.holes.length, turrets: level.turrets.length, pickups: level.pickups.length }));
const sim = new Sim(level, up, 1);
const bot = new Bot(sim, 0.8, 5);
let t = 0, next = 0;
const names = Object.fromEntries(Object.entries(EV).map(([k, v]) => [v, k]));
const count = {};
while (sim.state < STATE.WON && t < 300) {
  bot.update(1 / 60); sim.step(1 / 60);
  for (let i = 0; i < sim.evn; i++) { const k = names[sim.ev[i * 4]]; count[k] = (count[k] || 0) + 1; if (k === 'SHIELD_HIT') console.log('  shield hit', t.toFixed(1), 'dmg', sim.ev[i * 4 + 3], 'x', sim.ev[i * 4 + 1].toFixed(1), 'lx', sim.lx.toFixed(1), 'firing', sim.firing, 'pn', sim.pn); }
  sim.evn = 0;
  t += 1 / 60;
  if (t >= next) { next += 2; console.log(t.toFixed(0).padStart(4), 'stage', sim.stage, 'units', sim.pn, 'enemies', sim.en, 'fort', sim.forts[sim.stage].hp, 'shield', sim.shield, 'lx', sim.lx.toFixed(1), 'boss', sim.bossHp | 0, HORDE ? `horde ${sim.hordeLeft | 0}/${sim.hordeTotal} wave ${sim.waveIdx}/${sim.waveCount}` : ''); }
}
console.log(sim.state === STATE.WON ? 'WON' : 'LOST', t.toFixed(1), count);
