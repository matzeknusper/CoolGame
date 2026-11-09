// Deterministic level generator: 6 worlds x 10 levels (every 10th is a boss), then endless.
import { makeRng } from './rng.js';
import { HW, OP, BT, PT, EK, ENEMY, UNIT_SPEED } from './config.js';

export const LEVELS_PER_WORLD = 10;
export const WORLD_COUNT = 6;
export const CAMPAIGN_LEVELS = LEVELS_PER_WORLD * WORLD_COUNT;

export const WORLD_IDS = ['meadow', 'desert', 'frost', 'lava', 'neon', 'cosmos'];

// level number -> mechanic that is introduced there (shown as a hint card)
export const INTROS = {
  1: 'basics', 2: 'add', 3: 'move', 4: 'crate', 5: 'sub', 6: 'cage', 7: 'brute', 8: 'pickup',
  9: 'div', 10: 'boss', 11: 'saw', 12: 'runner', 14: 'tnt', 21: 'spin', 22: 'hole', 24: 'panzer',
  31: 'turret', 33: 'bomber',
};

export function levelInfo(n) {
  const wn = (n - 1) % CAMPAIGN_LEVELS;
  return {
    n,
    cycle: Math.floor((n - 1) / CAMPAIGN_LEVELS),
    world: Math.floor(wn / LEVELS_PER_WORLD),
    idx: wn % LEVELS_PER_WORLD,
    boss: wn % LEVELS_PER_WORLD === LEVELS_PER_WORLD - 1,
  };
}

// Fire power (units/s) the level is balanced around: assumes steady, moderate upgrading.
export function expectedRate(n) {
  const rate = 4.6 + 0.42 * Math.min(20, n * 0.3);
  const multi = 1 + 0.06 * Math.min(15, n * 0.2);
  return rate * multi;
}

function features(n) {
  return {
    add: n >= 2, move: n >= 3, crate: n >= 4, sub: n >= 5, cage: n >= 6, brute: n >= 7,
    pickup: n >= 8, div: n >= 9, saw: n >= 11, runner: n >= 12, tnt: n >= 14, spin: n >= 21,
    hole: n >= 22, panzer: n >= 24, turret: n >= 31, bomber: n >= 33,
  };
}

// Fraction of time a gate covers lane x (1 for static gates that contain x).
function gateCover(g, x) {
  const reach = g.w - 0.25;
  if (!g.amp) return Math.abs(x - g.x) < reach ? 1 : 0;
  const lo = g.x - g.amp, hi = g.x + g.amp;
  if (x < lo - reach || x > hi + reach) return 0;
  // sinusoidal motion spends more time at the ends; a flat estimate is good enough here
  return Math.min(1, (2 * reach) / (2 * g.amp + 2 * reach) * 1.15);
}

// Estimated crowd multiplier for a straight shot down lane x in the given stage.
export function laneValue(level, si, x) {
  const st = level.stages[si];
  let v = 1;
  for (const h of level.holes) if (h.stage === si && x > h.x0 - 0.2 && x < h.x1 + 0.2) return 0;
  for (const g of level.gates) {
    if (g.stage !== si || g.dead) continue;
    const c = gateCover(g, x);
    if (c <= 0) continue;
    if (g.op === OP.MUL) v *= 1 + (g.val - 1) * c;
    else if (g.op === OP.DIV) v *= 1 - (1 - 1 / g.val) * c;
    else if (g.op === OP.ADD) v *= 1 + 0.35 * c * Math.min(1, (g.pool ?? g.val) / 20);
    else if (g.op === OP.SUB) v *= 1 - 0.5 * c * Math.min(1, (g.pool ?? g.val) / 20);
  }
  for (const s of level.spinners) if (s.stage === si && Math.abs(x - s.x) < s.len) v *= 0.55;
  for (const s of level.saws) if (s.stage === si && Math.abs(x - s.x) < s.amp + s.r) v *= 0.75;
  for (const b of level.blockers) {
    if (b.stage !== si || b.dead) continue;
    if (Math.abs(x - b.x) < b.r + 0.2) v *= b.type === BT.CRATE ? 0.5 : 0.7;
  }
  return v * (st ? 1 : 1);
}

export function bestLane(level, si) {
  let best = 0, bx = 0;
  for (let x = -HW + 0.6; x <= HW - 0.6; x += 0.2) {
    const v = laneValue(level, si, x) - Math.abs(x) * 0.002;
    if (v > best) { best = v; bx = x; }
  }
  return { x: bx, v: best };
}

export function makeLevel(n) {
  const info = levelInfo(n);
  const rng = makeRng(n * 7919 + 13);
  const f = features(n);
  const { world, idx, boss, cycle } = info;
  const hard = n + cycle * 20; // difficulty scalar
  const rateExp = expectedRate(n);

  const L = {
    n, world, idx, boss, cycle,
    worldId: WORLD_IDS[world],
    intro: cycle === 0 ? INTROS[n] || null : null,
    stages: [], gates: [], blockers: [], spinners: [], saws: [], holes: [], pickups: [], turrets: [],
    zEnd: 0,
  };

  let stageCount = 1 + (idx >= 3 ? 1 : 0) + (idx >= 8 || (world >= 4 && idx >= 6) ? 1 : 0);
  if (world === 0 && idx < 4) stageCount = 1;
  if (boss) stageCount = 2;

  const mulMax = Math.min(36, 4 + n * 0.42);
  let z0 = 0;

  for (let si = 0; si < stageCount; si++) {
    const bossStage = boss && si === stageCount - 1;
    const rows = bossStage ? 3 : n === 1 ? 2 : rng.int(3, Math.min(6, 3 + Math.floor(world / 2) + (idx > 4 ? 1 : 0)));
    let z = z0 - 9;
    let budget = bossStage ? Math.max(4, mulMax * 0.6) : mulMax;
    let gateRows = 0;
    let lastFiller = null;

    const pickMul = (bonus = 0) => {
      const opts = [];
      if (budget >= 2) opts.push([2, 5]);
      if (budget >= 3) opts.push([3, 3]);
      if (budget >= 4 && n > 12) opts.push([4, 1.3]);
      if (budget >= 5 && n > 25) opts.push([5, 0.8]);
      if (!opts.length) return 0;
      let m = rng.weighted(opts);
      if (bonus && budget >= m + 1 && m < 5) m += 1;
      return m;
    };
    const addPool = () => Math.round((rateExp * rng.range(1.6, 3.2)) / 5) * 5 + 5;
    const subPool = () => Math.max(5, Math.round((rateExp * rng.range(0.9, 2.2)) / 5) * 5);
    const gate = (x, w, op, val, extra) => {
      const g = { stage: si, z, x, w, op, val, pool: op === OP.ADD || op === OP.SUB ? val : 0, amp: 0, spd: 0, ph: 0, ...extra };
      L.gates.push(g);
      return g;
    };
    const badGate = (x, w) => {
      const opts = [];
      if (f.sub) opts.push(['sub', 3]);
      if (f.div) opts.push(['div', 2]);
      if (!opts.length) return null;
      return rng.weighted(opts) === 'sub' ? gate(x, w, OP.SUB, subPool()) : gate(x, w, OP.DIV, rng.chance(0.75) ? 2 : 3);
    };
    const altGate = (x, w, m) => {
      // the "other" choice next to a good gate
      const opts = [['mul', m > 2 ? 3 : 1]];
      if (f.add) opts.push(['add', 3]);
      if (f.sub || f.div) opts.push(['bad', 1.6 + world * 0.25]);
      const k = rng.weighted(opts);
      if (k === 'mul') return gate(x, w, OP.MUL, Math.max(2, m - 1));
      if (k === 'add') return gate(x, w, OP.ADD, addPool());
      return badGate(x, w);
    };

    const P = {
      wide() {
        const m = pickMul() || 2;
        gate(0, 2.5, OP.MUL, m);
        budget /= m;
      },
      pair() {
        const m = pickMul();
        if (!m) return P.pool();
        const side = rng.chance(0.5) ? -1 : 1;
        gate(side * 2.3, 2.05, OP.MUL, m);
        altGate(-side * 2.3, 2.05, m);
        budget /= m;
      },
      mover() {
        const m = pickMul(1);
        if (!m) return P.pool();
        const w = rng.range(1.45, 1.85);
        const g = gate(0, w, OP.MUL, m);
        g.amp = HW - w - 0.15;
        g.spd = rng.range(0.7, 1.1) + Math.min(0.8, hard * 0.012);
        g.ph = rng.range(0, 6.28);
        budget /= 1 + (m - 1) * 0.6;
      },
      triple() {
        const m = pickMul(1);
        if (!m) return P.pool();
        const xs = [-3.07, 0, 3.07];
        const order = [0, 1, 2].sort(() => rng() - 0.5);
        gate(xs[order[0]], 1.38, OP.MUL, m);
        if (!badGate(xs[order[1]], 1.38)) gate(xs[order[1]], 1.38, OP.MUL, 2);
        if (f.add) gate(xs[order[2]], 1.38, OP.ADD, addPool());
        budget /= m;
      },
      guard() {
        const m = pickMul(1);
        if (!m || !f.sub) return P.pair();
        const side = rng.chance(0.5) ? -1 : 1;
        gate(side * 2.3, 1.9, OP.MUL, m);
        z += 2.6;
        gate(side * 2.3, 1.9, OP.SUB, subPool());
        z -= 2.6;
        if (rng.chance(0.7)) {
          if (f.add && rng.chance(0.6)) gate(-side * 2.3, 1.9, OP.ADD, addPool());
          else gate(-side * 2.3, 1.9, OP.MUL, 2);
        }
        budget /= m;
      },
      pool() {
        // no multiplier budget left: bonus pools only
        if (!f.add) return P.blockers();
        const side = rng.chance(0.5) ? -1 : 1;
        gate(side * 2.3, 2.05, OP.ADD, addPool());
        if (rng.chance(0.6)) badGate(-side * 2.3, 2.05);
      },
      blockers() {
        const slots = [-3, 0, 3].sort(() => rng() - 0.5);
        const count = rng.int(1, f.cage ? 3 : 2);
        for (let i = 0; i < count; i++) {
          const opts = [[BT.CRATE, 3]];
          if (f.cage) opts.push([BT.CAGE, 3]);
          if (f.tnt) opts.push([BT.TNT, 2]);
          const type = rng.weighted(opts);
          const flow = rateExp * Math.max(1, (mulMax / Math.max(1, budget)) * 0.5);
          let hp, val;
          if (type === BT.CRATE) { hp = Math.round(flow * rng.range(0.8, 1.6)); val = 8 + Math.round(n * 0.9 + rng.range(0, 6)); }
          else if (type === BT.CAGE) { hp = Math.round(flow * rng.range(0.4, 0.8)); val = Math.round(hp * rng.range(1.6, 2.4)) + 4; }
          else { hp = Math.round(Math.max(3, flow * 0.3)); val = 0; }
          L.blockers.push({ stage: si, z, x: slots[i], r: 0.95, type, hp: Math.max(3, hp), val });
        }
      },
      saw() {
        L.saws.push({ stage: si, z, x: 0, amp: 3.3, r: 0.75, spd: rng.range(1.1, 1.6) + Math.min(0.9, hard * 0.012), ph: rng.range(0, 6.28) });
      },
      spin() {
        const x = rng.pick([-1.6, 0, 1.6]);
        L.spinners.push({ stage: si, z, x, len: rng.range(2.3, 3.0), spd: (rng.chance(0.5) ? 1 : -1) * (rng.range(1.2, 1.8) + Math.min(0.8, hard * 0.008)), ph: rng.range(0, 3.14) });
      },
      hole() {
        const kind = rng.int(0, 2);
        const len = rng.range(2.6, 4.2);
        if (kind === 0) L.holes.push({ stage: si, z0: z - len / 2, z1: z + len / 2, x0: -HW - 1, x1: -0.7 });
        else if (kind === 1) L.holes.push({ stage: si, z0: z - len / 2, z1: z + len / 2, x0: 0.7, x1: HW + 1 });
        else L.holes.push({ stage: si, z0: z - len / 2, z1: z + len / 2, x0: -1.7, x1: 1.7 });
      },
      pickup() {
        const opts = [[PT.RAPID, 3], [PT.FREEZE, 2.4], [PT.BOMB, 2.4], [PT.MEGA, 2], [PT.HEART, 1.6]];
        L.pickups.push({ stage: si, z, x: rng.range(-3.2, 3.2), type: rng.weighted(opts) });
      },
      turret() {
        L.turrets.push({ stage: si, z, side: rng.chance(0.5) ? -1 : 1, period: Math.max(2.6, 5 - hard * 0.02), ph: rng.range(0, 2) });
      },
    };

    const gatePatterns = () => {
      const o = [['pair', 5]];
      if (n <= 3) o.push(['wide', 3]);
      if (f.move) o.push(['mover', 3 + world * 0.4]);
      if (n >= 5) o.push(['triple', 2.2]);
      if (f.sub) o.push(['guard', 2]);
      return o;
    };
    const fillerPatterns = () => {
      const o = [];
      if (f.crate) o.push(['blockers', 3]);
      if (f.pickup) o.push(['pickup', 2.2]);
      if (f.saw) o.push(['saw', 2.2]);
      if (f.spin) o.push(['spin', 2.2]);
      if (f.hole) o.push(['hole', 2]);
      if (f.turret) o.push(['turret', 1.8]);
      return o.filter((e) => e[0] !== lastFiller);
    };
    const introFiller = { crate: 'blockers', cage: 'blockers', tnt: 'blockers', pickup: 'pickup', saw: 'saw', spin: 'spin', hole: 'hole', turret: 'turret' };
    const introGate = { add: 'pair', move: 'mover', sub: 'guard', div: 'pair' };

    for (let r = 0; r < rows; r++) {
      let fill = fillerPatterns();
      const wantGate = r === 0 || gateRows < 2 && r >= rows - 2 || !fill.length || rng.chance(0.6);
      let pat;
      if (si === 0 && r === 0 && n === 1) pat = 'wide';
      else if (si === 0 && r === 0 && L.intro && introGate[L.intro]) pat = introGate[L.intro];
      else if (si === 0 && r === 1 && L.intro && introFiller[L.intro]) pat = introFiller[L.intro];
      else if (wantGate) pat = rng.weighted(gatePatterns());
      else pat = rng.weighted(fill);

      const isGate = ['wide', 'pair', 'mover', 'triple', 'guard', 'pool'].includes(pat);
      if (isGate) gateRows++;
      else lastFiller = pat;
      const before = { g: L.gates.length, b: L.blockers.length };
      P[pat]();
      // intro levels must really show the new thing
      if (si === 0 && L.intro && r <= 1) forceIntro(L, L.intro, before, rng, rateExp);
      z -= isGate ? rng.range(8.5, 10.5) : rng.range(6.5, 8);
      // sprinkle an extra pickup now and then
      if (f.pickup && isGate && rng.chance(0.16)) { z += 4; P.pickup(); z -= 4; }
    }

    const zFort = z - 5;
    const stage = { z0, zFort, boss: bossStage, hp: 0, spawn: null, M: 1 };
    L.stages.push(stage);
    z0 = zFort - 7;
  }
  L.zEnd = L.stages[L.stages.length - 1].zFort - 3;
  L.gates.sort((a, b) => b.z - a.z);

  // ---- balance: fort hp + enemy pressure from the estimated crowd flow -----------------
  for (let si = 0; si < L.stages.length; si++) {
    const st = L.stages[si];
    // every stage needs a satisfying multiplier lane
    let M = Math.max(1, bestLane(L, si).v);
    for (let guard = 0; guard < 8 && M < 3.2; guard++) {
      const mine = L.gates.filter((g) => g.stage === si);
      let g = mine.find((q) => q.op === OP.MUL && !q.amp && q.val < 5) || mine.find((q) => q.op === OP.MUL && q.val < 5);
      if (g) g.val++;
      else if (mine.length) { g = mine[0]; g.op = OP.MUL; g.val = 3; g.pool = 0; }
      else break;
      M = Math.max(1, bestLane(L, si).v);
    }
    st.M = M;
    const flow = rateExp * (1 + (M - 1) * 0.8);
    const secs = ((n === 1 ? 9 : 17 + Math.min(26, n * 0.6)) * (st.boss ? 1.6 : 1) * (1 + cycle * 0.25)) / Math.sqrt(L.stages.length);
    st.hp = Math.max(20, Math.round((flow * 0.7 * secs) / 10) * 10);

    // special squads arrive on their own timers; grunts fill the rest
    const pool = [];
    if (f.runner) pool.push({ kind: EK.RUNNER, every: rng.range(7, 9.5), count: Math.min(5, 2 + Math.floor(hard / 18)), first: rng.range(5, 8) });
    if (f.panzer) pool.push({ kind: EK.PANZER, every: rng.range(8, 11), count: Math.min(4, 2 + Math.floor(hard / 25)), first: rng.range(6, 10) });
    if (f.bomber) pool.push({ kind: EK.BOMBER, every: rng.range(9, 12), count: Math.min(4, 1 + Math.floor(hard / 22)), first: rng.range(8, 12) });
    if (f.brute) pool.push({ kind: EK.BRUTE, every: rng.range(11, 15) - Math.min(3, hard * 0.04), count: Math.min(2, 1 + Math.floor(hard / 35)), first: rng.range(7, 11) });
    pool.sort(() => rng() - 0.5);
    let specials = pool.slice(0, Math.min(pool.length, 1 + Math.floor(world / 3) + (rng.chance(0.4) ? 1 : 0)));
    const introKind = { brute: EK.BRUTE, runner: EK.RUNNER, panzer: EK.PANZER, bomber: EK.BOMBER }[L.intro];
    if (introKind !== undefined && si === 0) {
      specials = specials.filter((s) => s.kind !== introKind);
      specials.unshift({ ...pool.find((s) => s.kind === introKind), first: 3 });
    }
    // Pressure is tied to the raw fire rate: an un-multiplied stream can just about hold the
    // line, multipliers are what wins the level.
    const pr = (0.44 + Math.min(0.46, hard * 0.01)) * (st.boss ? 0.6 : 1) * (n === 1 ? 0.7 : 1);
    st.spawn = {
      rate: rateExp * pr,
      burstEvery: Math.max(5.5, 9 - hard * 0.04),
      burstHp: rateExp * pr * (2.2 + Math.min(2.8, hard * 0.045)),
      ramp: 0.2 + Math.min(0.25, hard * 0.004),
      bruteHp: Math.round(8 + hard * 0.25 + rateExp * 0.5),
      specials,
    };
  }
  return L;
}

// Make sure an intro level actually contains the mechanic it announces.
function forceIntro(L, intro, before, rng, rateExp) {
  const newGates = L.gates.slice(before.g);
  const newBlocks = L.blockers.slice(before.b);
  if (intro === 'add' && newGates.length && !L.gates.some((g) => g.op === OP.ADD)) {
    const g = newGates[newGates.length - 1];
    g.op = OP.ADD; g.val = g.pool = 20;
  }
  if (intro === 'div' && newGates.length && !L.gates.some((g) => g.op === OP.DIV)) {
    const g = newGates[newGates.length - 1];
    if (g.op !== OP.MUL || newGates.length > 1) { g.op = OP.DIV; g.val = 2; g.pool = 0; }
  }
  if (newBlocks.length) {
    const want = intro === 'crate' ? BT.CRATE : intro === 'cage' ? BT.CAGE : intro === 'tnt' ? BT.TNT : -1;
    if (want >= 0 && !L.blockers.some((b) => b.type === want)) {
      const b = newBlocks[0];
      b.type = want;
      if (want === BT.CAGE) { b.hp = Math.round(rateExp * 0.8); b.val = b.hp * 2 + 4; }
      if (want === BT.TNT) { b.hp = 4; b.val = 0; }
      if (want === BT.CRATE) { b.hp = Math.round(rateExp * 1.2); b.val = 15; }
    }
  }
}

export { ENEMY, UNIT_SPEED };
