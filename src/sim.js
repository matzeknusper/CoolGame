// Pure game simulation – no rendering, no DOM. Runs identically in the browser and in Node
// (tools/balance.mjs uses it with a bot to verify that every level is winnable).
import { makeRng } from './rng.js';
import {
  HW, UNIT_SPEED, UNIT_R, PCAP, PSOFT, ECAP, EK, ENEMY, OP, BT, PT, EV, STATE, playerStats,
} from './config.js';
import { laneValue } from './levels.js';

const CELL = 1.0;
const GX = 12; // grid columns (x from -6..6)
const GZMAX = 140;
const EVMAX = 600;

export class Sim {
  constructor(level, upgrades, seed = 1) {
    this.level = level;
    this.stats = playerStats(upgrades);
    this.rng = makeRng(seed * 9973 + level.n * 31);

    // player units (struct of arrays)
    this.pn = 0;
    this.px = new Float32Array(PCAP);
    this.pz = new Float32Array(PCAP);
    this.php = new Float32Array(PCAP);
    this.pkind = new Uint8Array(PCAP); // 0 normal, 1 mega
    this.pg = new Int16Array(PCAP); // index of next gate to cross
    this.pph = new Float32Array(PCAP); // animation phase
    this.pfall = new Float32Array(PCAP); // >0: falling into a hole
    this.pborn = new Float32Array(PCAP); // spawn time (for pop-in animation)

    // enemies
    this.en = 0;
    this.ex = new Float32Array(ECAP);
    this.ez = new Float32Array(ECAP);
    this.ehp = new Float32Array(ECAP);
    this.emax = new Float32Array(ECAP);
    this.ekind = new Uint8Array(ECAP);
    this.eph = new Float32Array(ECAP);
    this.efall = new Float32Array(ECAP);
    this.ehit = new Float32Array(ECAP); // hit flash timer
    this.eborn = new Float32Array(ECAP);
    this.eoff = new Float32Array(ECAP); // personal lane offset so the horde comes as a wide front

    // grids
    this.ehead = new Int16Array(GX * GZMAX);
    this.enext = new Int16Array(ECAP);
    this.phead = new Int16Array(GX * GZMAX);
    this.pnext = new Int16Array(PCAP);
    this.big = new Int16Array(64);
    this.bigN = 0;

    // events
    this.ev = new Float32Array(EVMAX * 4);
    this.evn = 0;

    // level objects (mutable copies)
    this.gates = level.gates.map((g) => ({ ...g, cx: g.x, dead: false, flash: 0, count: 0 }));
    this.blockers = level.blockers.map((b) => ({ ...b, max: b.hp, dead: false, flash: 0 }));
    this.spinners = level.spinners.map((s) => ({ ...s, ang: s.ph }));
    this.saws = level.saws.map((s) => ({ ...s, cx: s.x }));
    this.holes = level.holes;
    this.pickups = level.pickups.map((p) => ({ ...p, dead: false }));
    this.turrets = level.turrets.map((t) => ({ ...t, t: t.ph + 2 }));
    this.shells = []; // {x,z,t,dur}
    this.forts = level.stages.map((s) => ({ z: s.zFort, hp: s.hp, max: s.hp, dead: false, flash: 0, boss: s.boss }));

    this.stage = 0;
    this.state = STATE.PLAY;
    this.time = 0;
    this.stageTime = 0;
    this.endTimer = 0;

    this.lx = 0; // launcher
    this.lz = level.stages[0].z0;
    this.targetX = 0;
    this.firing = false;
    this.cool = 0.2;
    this.megaCharge = 0;
    this.megaReady = false;
    this.rapidT = 0;
    this.freezeT = 0;
    this.shieldMax = this.stats.shield;
    this.shield = this.shieldMax;
    this.shieldFlash = 0;
    this.advFrom = 0;
    this.advT = 0;

    this.spawnAcc = 0;
    this.burstT = 3.5;
    this.divCount = 0;

    this.boss = -1; // enemy index is unstable, so the boss is tracked by flag
    this.bossAlive = false;
    this.bossHp = 0;
    this.bossMax = 0;
    this.bossX = 0;
    this.bossZ = 0;
    this.bossStompT = 0;
    this.bossWarn = 0;

    this.kills = 0;
    this.coins = 0;
    this.coinAcc = 0;
    this.shots = 0;
    this.peak = 0;

    this._setupStage();
  }

  emit(type, x, z, v) {
    if (this.evn >= EVMAX) return;
    const o = this.evn * 4;
    this.ev[o] = type; this.ev[o + 1] = x; this.ev[o + 2] = z; this.ev[o + 3] = v;
    this.evn++;
  }

  setInput(x, firing) {
    this.targetX = Math.max(-HW + 0.7, Math.min(HW - 0.7, x));
    this.firing = firing;
  }

  gateIndexForZ(z) {
    const g = this.gates;
    let i = 0;
    while (i < g.length && g[i].z >= z) i++;
    return i;
  }

  _setupStage() {
    const st = this.level.stages[this.stage];
    this.stageTime = 0;
    this.spawnAcc = 0;
    this.burstT = 7;
    this.burstN = 0;
    this.specT = st.spawn.specials.map((s) => s.first);
    if (st.boss) {
      const hp = st.hp;
      const i = this.spawnEnemy(EK.BOSS, 0, st.zFort + 2.5, hp);
      this.bossAlive = i >= 0;
      this.bossHp = this.bossMax = hp;
      this.bossStompT = 5;
    }
  }

  spawnUnit(x, z, hp, kind, pg) {
    if (this.pn >= PCAP) return -1;
    const i = this.pn++;
    this.px[i] = x; this.pz[i] = z; this.php[i] = hp; this.pkind[i] = kind; this.pg[i] = pg;
    this.pph[i] = this.rng() * 6.28; this.pfall[i] = 0; this.pborn[i] = this.time;
    return i;
  }

  spawnEnemy(kind, x, z, hp) {
    if (this.en >= ECAP) return -1;
    const i = this.en++;
    this.ex[i] = x; this.ez[i] = z; this.ehp[i] = hp; this.emax[i] = hp; this.ekind[i] = kind;
    this.eph[i] = this.rng() * 6.28; this.efall[i] = 0; this.ehit[i] = 0; this.eborn[i] = this.time;
    this.eoff[i] = (this.rng() - 0.5) * 2 * (HW - 0.9);
    return i;
  }

  fire() {
    const s = this.stats;
    const pg = this.gateIndexForZ(this.lz - 1.2);
    this.shots++;
    if (this.megaReady) {
      this.megaReady = false;
      this.megaCharge = 0;
      this.spawnUnit(this.lx, this.lz - 1.4, s.megaHp, 1, pg);
      this.emit(EV.MEGA, this.lx, this.lz - 1.4, s.megaHp);
      return;
    }
    const jitter = (this.rng() - 0.5) * 0.5;
    this.spawnUnit(this.lx + jitter, this.lz - 1.2, 1, 0, pg);
    if (this.rng() < s.multiChance) this.spawnUnit(this.lx - jitter * 1.5, this.lz - 0.9, 1, 0, pg);
    this.emit(EV.SHOT, this.lx, this.lz - 1.2, 0);
    this.megaCharge += 1 / s.megaShots;
    if (this.megaCharge >= 1) {
      this.megaCharge = 1;
      this.megaReady = true;
      this.emit(EV.MEGA_READY, this.lx, this.lz, 0);
    }
  }

  addCoins(v, x, z) {
    this.coinAcc += v * this.stats.coinMul;
    const whole = Math.floor(this.coinAcc);
    if (whole > 0) {
      this.coinAcc -= whole;
      this.coins += whole;
      this.emit(EV.COIN, x, z, whole);
    }
  }

  // ---- main step ---------------------------------------------------------------------
  step(dt) {
    if (this.state === STATE.WON || this.state === STATE.LOST) {
      this.endTimer += dt;
      // let the scene play out a little after the end
      if (this.endTimer > 3) return;
    }
    this.time += dt;
    this.stageTime += dt;
    const playing = this.state === STATE.PLAY;
    const st = this.level.stages[this.stage];
    const fort = this.forts[this.stage];

    if (this.rapidT > 0) this.rapidT -= dt;
    if (this.freezeT > 0) this.freezeT -= dt;
    if (this.shieldFlash > 0) this.shieldFlash -= dt;

    // launcher
    if (this.state === STATE.ADVANCE) {
      this.advT += dt;
      const dur = 2.4;
      const k = Math.min(1, this.advT / dur);
      const e = k * k * (3 - 2 * k);
      this.lz = this.advFrom + (st.z0 - this.advFrom) * e;
      this.lx += (0 - this.lx) * Math.min(1, dt * 3);
      if (k >= 1) {
        this.state = STATE.PLAY;
        this.advFrom = this.lz;
        this._setupStage();
        this.emit(EV.STAGE, this.lx, this.lz, this.stage);
      }
    } else if (this.state !== STATE.LOST) {
      const dx = this.targetX - this.lx;
      const maxMove = 26 * dt;
      this.lx += Math.max(-maxMove, Math.min(maxMove, dx));
    }

    if (playing && this.firing) {
      this.cool -= dt;
      const rate = this.stats.fireRate * (this.rapidT > 0 ? 2 : 1);
      let guard = 0;
      while (this.cool <= 0 && guard++ < 6) {
        this.fire();
        this.cool += 1 / rate;
      }
    } else if (this.cool < 0) this.cool = 0;

    // moving level objects
    for (const g of this.gates) {
      if (g.amp) g.cx = g.x + Math.sin(this.time * g.spd + g.ph) * g.amp;
      if (g.flash > 0) g.flash -= dt;
    }
    for (const s of this.spinners) s.ang += s.spd * dt;
    for (const s of this.saws) s.cx = s.x + Math.sin(this.time * s.spd + s.ph) * s.amp;
    for (const b of this.blockers) if (b.flash > 0) b.flash -= dt;
    for (const f of this.forts) if (f.flash > 0) f.flash -= dt;

    if (playing) this._spawner(dt, st);
    this._turrets(dt);
    this._players(dt, fort, st);
    this._enemies(dt);
    this._combat();
    this._separate();
    this._sweep();

    if (this.pn > this.peak) this.peak = this.pn;

    if (playing && this.shield <= 0) {
      this.state = STATE.LOST;
      this.endTimer = 0;
      this.emit(EV.LOSE, this.lx, this.lz, 0);
    }
  }

  _stageCleared(x, z) {
    // all remaining enemies of this stage pop
    for (let i = 0; i < this.en; i++) {
      if (this.ehp[i] > 0) {
        this.ehp[i] = 0;
        this.emit(EV.POP_E, this.ex[i], this.ez[i], this.ekind[i]);
        this.kills++;
      }
    }
    this.shells.length = 0;
    this.addCoins(15 + this.level.n * 2.2, x, z);
    if (this.stage < this.level.stages.length - 1) {
      this.advFrom = this.lz;
      this.advT = 0;
      this.stage++;
      this.state = STATE.ADVANCE;
    } else {
      this.state = STATE.WON;
      this.endTimer = 0;
      this.emit(EV.WIN, x, z, 0);
    }
  }

  _spawner(dt, st) {
    const sp = st.spawn;
    const warm = Math.min(1, 0.35 + this.stageTime / 12);
    const ramp = (1 + sp.ramp * (Math.min(this.stageTime, 30) / 20)) * warm;
    this.spawnAcc += sp.rate * ramp * dt;
    this.burstT -= dt;
    if (this.burstT <= 0) {
      this.burstT = sp.burstEvery;
      this.burstN++;
      this.spawnAcc += sp.burstHp * ramp * Math.min(1, 0.3 + this.burstN * 0.2);
    }
    let sx = 0, sz = st.zFort + 1.6, spread = 2.6;
    if (st.boss) {
      if (!this.bossAlive) return;
      sx = this.bossX; sz = this.bossZ + 2.2; spread = 2.2;
    }
    const clampX = (x) => Math.max(-HW + 0.6, Math.min(HW - 0.6, x));
    // special squads
    const specs = sp.specials;
    for (let k = 0; k < specs.length; k++) {
      this.specT[k] -= dt;
      if (this.specT[k] <= 0) {
        const s = specs[k];
        this.specT[k] = s.every / Math.min(1.6, ramp);
        const cx = sx + (this.rng() - 0.5) * 2 * spread;
        for (let c = 0; c < s.count; c++) {
          const hp = s.kind === EK.BRUTE ? sp.bruteHp : ENEMY[s.kind].hp;
          this.spawnEnemy(s.kind, clampX(cx + (this.rng() - 0.5) * 2.4), sz + this.rng() * 1.6, hp);
        }
      }
    }
    // grunts
    let guard = 0;
    while (this.spawnAcc >= 1 && this.en < ECAP - 8 && guard++ < 10) {
      this.spawnAcc -= 1;
      this.spawnEnemy(EK.GRUNT, clampX(sx + (this.rng() - 0.5) * 2 * spread), sz + this.rng() * 0.8, 1);
    }
    if (this.spawnAcc > 120) this.spawnAcc = 120;
  }

  _turrets(dt) {
    const playing = this.state === STATE.PLAY;
    for (const t of this.turrets) {
      if (t.stage !== this.stage || !playing) continue;
      if (t.z > this.lz - 3) continue; // behind the launcher
      t.t -= dt;
      if (t.t <= 0) {
        t.t = t.period;
        // aim at the player's stream between launcher and turret
        const tz = Math.min(this.lz - 4, t.z + 6 + this.rng() * 6);
        const tx = Math.max(-HW + 1, Math.min(HW - 1, this.lx + (this.rng() - 0.5) * 1.6));
        this.shells.push({ x: tx, z: tz, t: 0, dur: 1.5, sx: t.side * (HW + 1.6), sz: t.z });
        this.emit(EV.SHELL_FIRE, t.side * (HW + 1.6), t.z, 0);
      }
    }
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.t += dt;
      if (s.t >= s.dur) {
        this.shells.splice(i, 1);
        this.emit(EV.SHELL_LAND, s.x, s.z, 2.0);
        this._blast(s.x, s.z, 2.0, 14, 0, true);
      }
    }
  }

  // radial damage; hurtPlayers: player units die / megas lose hp; enemyDmg: damage to enemies
  _blast(x, z, r, playerMax, enemyDmg, hurtPlayers) {
    const r2 = r * r;
    if (hurtPlayers) {
      let n = 0;
      for (let i = 0; i < this.pn && n < playerMax; i++) {
        if (this.php[i] <= 0) continue;
        const dx = this.px[i] - x, dz = this.pz[i] - z;
        if (dx * dx + dz * dz < r2) {
          if (this.pkind[i] === 1) { this.php[i] -= 8; if (this.php[i] > 0) continue; }
          this.php[i] = 0;
          this.emit(EV.POP_P, this.px[i], this.pz[i], 0);
          n++;
        }
      }
    }
    if (enemyDmg > 0) {
      for (let i = 0; i < this.en; i++) {
        if (this.ehp[i] <= 0) continue;
        const dx = this.ex[i] - x, dz = this.ez[i] - z;
        const rr = r + ENEMY[this.ekind[i]].r;
        if (dx * dx + dz * dz < rr * rr) this._hurtEnemy(i, enemyDmg);
      }
    }
  }

  _hurtEnemy(i, dmg) {
    const kind = this.ekind[i];
    this.ehp[i] -= dmg;
    this.ehit[i] = 0.12;
    if (kind === EK.BOSS) this.bossHp = Math.max(0, this.ehp[i]);
    if (this.ehp[i] <= 0) {
      this.ehp[i] = 0;
      this.kills++;
      const x = this.ex[i], z = this.ez[i];
      this.emit(EV.POP_E, x, z, kind);
      this.addCoins(0.12 + this.emax[i] * 0.05, x, z);
      if (kind === EK.BOMBER) {
        this.emit(EV.EXPLO, x, z, 1.7);
        this._blast(x, z, 1.7, 6, 0, true);
      } else if (kind === EK.BOSS) {
        this.bossAlive = false;
        this.emit(EV.BOSS_DOWN, x, z, 0);
        this.addCoins(40 + this.level.n * 3, x, z);
        this._stageCleared(x, z);
      }
    }
  }

  _killUnit(i, ev) {
    this.php[i] = 0;
    this.emit(ev, this.px[i], this.pz[i], this.pkind[i]);
  }

  _players(dt, fort, st) {
    const gates = this.gates, G = gates.length;
    const holes = this.holes, blockers = this.blockers, spinners = this.spinners, saws = this.saws, pickups = this.pickups;
    const fz = fort.z + 1.35;
    const bossStage = st.boss;
    const zEnd = this.level.zEnd;
    const px = this.px, pz = this.pz, php = this.php;
    for (let i = this.pn - 1; i >= 0; i--) {
      if (php[i] <= 0) continue;
      if (this.pfall[i] > 0) {
        this.pfall[i] += dt;
        pz[i] -= UNIT_SPEED * 0.5 * dt;
        if (this.pfall[i] > 0.9) php[i] = 0;
        continue;
      }
      const mega = this.pkind[i] === 1;
      const speed = mega ? UNIT_SPEED * 0.72 : UNIT_SPEED;
      let x = px[i], z = pz[i] - speed * dt;
      this.pph[i] += dt * (mega ? 9 : 14);

      // funnel towards the fort gate when close
      if (!bossStage && z - fz < 9) {
        const lim = 2.9;
        if (x > lim) x -= Math.min(x - lim, 5 * dt);
        else if (x < -lim) x += Math.min(-lim - x, 5 * dt);
      }
      const edge = HW - 0.32;
      if (x > edge) x = edge; else if (x < -edge) x = -edge;

      // gates
      let gi = this.pg[i];
      while (gi < G && z <= gates[gi].z) {
        const g = gates[gi];
        gi++;
        if (g.dead) continue;
        if (Math.abs(x - g.cx) > g.w) continue;
        this.pg[i] = gi;
        px[i] = x; pz[i] = z;
        this._applyGate(i, g, gi);
        if (php[i] <= 0) break;
      }
      this.pg[i] = gi;
      if (php[i] <= 0) continue;

      // holes
      let dead = false;
      for (let h = 0; h < holes.length; h++) {
        const ho = holes[h];
        if (z < ho.z1 && z > ho.z0 && x > ho.x0 && x < ho.x1) {
          this.pfall[i] = 0.001;
          this.emit(EV.FALL, x, z, 0);
          dead = true;
          break;
        }
      }
      if (dead) { px[i] = x; pz[i] = z; continue; }

      const r = mega ? 0.75 : UNIT_R;
      // blockers
      for (let b = 0; b < blockers.length; b++) {
        const bl = blockers[b];
        if (bl.dead) continue;
        const dz = z - bl.z;
        if (dz > 1.6 || dz < -1.6) continue;
        const dx = x - bl.x, rr = bl.r + r;
        if (dx * dx + dz * dz < rr * rr) {
          const d = Math.min(php[i], bl.hp);
          bl.hp -= d; php[i] -= d; bl.flash = 0.1;
          this.emit(EV.BLOCK_HIT, x, z, b);
          if (bl.hp <= 0) this._blockerDown(bl, b);
          if (php[i] <= 0) { this.emit(EV.POP_P, x, z, mega ? 1 : 0); dead = true; }
          break;
        }
      }
      if (dead) { php[i] = 0; continue; }

      // spinners
      for (let s = 0; s < spinners.length; s++) {
        const sp = spinners[s];
        const dz = z - sp.z;
        if (dz > sp.len + 1 || dz < -sp.len - 1) continue;
        const dx = x - sp.x;
        const ca = Math.cos(sp.ang), sa = Math.sin(sp.ang);
        const along = dx * ca + dz * sa, across = -dx * sa + dz * ca;
        if (Math.abs(along) < sp.len && Math.abs(across) < 0.3 + r * 0.6) {
          if (mega) { php[i] -= 40 * dt; if (php[i] > 0) continue; }
          this.emit(EV.SAW_KILL, x, z, 0);
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (let s = 0; s < saws.length; s++) {
          const sw = saws[s];
          const dz = z - sw.z;
          if (dz > 1.5 || dz < -1.5) continue;
          const dx = x - sw.cx, rr = sw.r + r * 0.7;
          if (dx * dx + dz * dz < rr * rr) {
            if (mega) { php[i] -= 40 * dt; if (php[i] > 0) continue; }
            this.emit(EV.SAW_KILL, x, z, 0);
            dead = true;
            break;
          }
        }
      }
      if (dead) { php[i] = 0; continue; }

      // pickups
      for (let p = 0; p < pickups.length; p++) {
        const pk = pickups[p];
        if (pk.dead) continue;
        const dz = z - pk.z, dx = x - pk.x;
        if (dx * dx + dz * dz < 1.0) this._collect(pk);
      }

      // fort / end of track
      if (!bossStage) {
        if (z <= fz && !fort.dead) {
          const d = Math.min(php[i], fort.hp);
          fort.hp -= d;
          fort.flash = 0.1;
          this.emit(EV.FORT_HIT, x, fz, d);
          this.emit(EV.POP_P, x, z, mega ? 1 : 0);
          php[i] = 0;
          if (fort.hp <= 0) {
            fort.dead = true;
            this.emit(EV.FORT_DOWN, 0, fort.z, this.stage);
            this._stageCleared(0, fort.z);
            return this._finishPlayers(i, dt);
          }
          continue;
        }
      } else if (z < zEnd) {
        this.pfall[i] = 0.001;
      }
      px[i] = x; pz[i] = z;
    }
  }

  // after a fort fell mid-loop, the remaining (not yet processed) units just keep moving
  _finishPlayers(from, dt) {
    for (let i = from - 1; i >= 0; i--) {
      if (this.php[i] > 0 && this.pfall[i] <= 0) this.pz[i] -= UNIT_SPEED * dt;
    }
  }

  _applyGate(i, g, gi) {
    const x = this.px[i], z = this.pz[i];
    const mega = this.pkind[i] === 1;
    const hp = this.php[i];
    g.flash = 0.18;
    g.count++;
    switch (g.op) {
      case OP.MUL: {
        if (mega) break; // the mega is a tank: multipliers do not affect it
        const extra = g.val - 1;
        this._clone(i, extra, g.w, g.cx, gi);
        this.emit(EV.GATE, x, z, extra);
        break;
      }
      case OP.ADD: {
        if (mega) {
          const d = Math.min(g.pool, 10);
          this.php[i] += d; g.pool -= d;
        } else {
          g.pool -= 1;
          this._clone(i, 1, g.w, g.cx, gi, true);
        }
        this.emit(EV.GATE, x, z, 1);
        if (g.pool <= 0) { g.dead = true; this.emit(EV.GATE_DONE, g.cx, g.z, this.gates.indexOf(g)); }
        break;
      }
      case OP.SUB: {
        const d = Math.min(g.pool, hp);
        g.pool -= d;
        this.php[i] -= d;
        if (this.php[i] <= 0) this._killUnit(i, EV.POP_P);
        if (g.pool <= 0) { g.dead = true; this.emit(EV.GATE_DONE, g.cx, g.z, this.gates.indexOf(g)); }
        break;
      }
      case OP.DIV: {
        if (mega || hp > 1) { this.php[i] = Math.ceil(hp / g.val); break; }
        this.divCount++;
        if (this.divCount % g.val !== 0) this._killUnit(i, EV.POP_P);
        break;
      }
    }
  }

  _clone(i, extra, w, cx, gi, single) {
    const hp = single ? 1 : this.php[i];
    const x = this.px[i], z = this.pz[i];
    for (let k = 0; k < extra; k++) {
      if (this.pn >= PSOFT) {
        // crowd is full: fold the power into this unit instead
        this.php[i] = Math.min(9999, this.php[i] + hp);
        continue;
      }
      let nx = x + (this.rng() - 0.5) * 1.3;
      const lo = cx - w + 0.2, hi = cx + w - 0.2;
      if (nx < lo) nx = lo; else if (nx > hi) nx = hi;
      this.spawnUnit(nx, z - this.rng() * 0.7, hp, 0, gi);
    }
  }

  _blockerDown(bl, idx) {
    bl.dead = true;
    this.emit(EV.BLOCK_DOWN, bl.x, bl.z, idx);
    if (bl.type === BT.CRATE) this.addCoins(bl.val, bl.x, bl.z);
    else if (bl.type === BT.CAGE) {
      const pg = this.gateIndexForZ(bl.z);
      let n = bl.val;
      const per = Math.max(1, Math.ceil(n / 60));
      while (n > 0) {
        const hp = Math.min(per, n);
        n -= hp;
        if (this.spawnUnit(bl.x + (this.rng() - 0.5) * 2, bl.z - this.rng() * 1.5, hp, 0, pg) < 0) break;
      }
      this.emit(EV.CAGE_FREE, bl.x, bl.z, bl.val);
    } else if (bl.type === BT.TNT) {
      this.emit(EV.EXPLO, bl.x, bl.z, 5);
      this._blast(bl.x, bl.z, 5, 0, 12, false);
    }
  }

  _collect(pk) {
    pk.dead = true;
    this.emit(EV.PICKUP, pk.x, pk.z, pk.type);
    switch (pk.type) {
      case PT.RAPID: this.rapidT = 6; break;
      case PT.FREEZE: this.freezeT = 4.5; this.emit(EV.FREEZE, pk.x, pk.z, 0); break;
      case PT.BOMB: this.emit(EV.EXPLO, pk.x, pk.z, 9); this._blast(pk.x, pk.z, 9, 0, 14, false); break;
      case PT.MEGA:
        if (!this.megaReady) { this.megaCharge = 1; this.megaReady = true; this.emit(EV.MEGA_READY, this.lx, this.lz, 0); }
        break;
      case PT.HEART: this.shield = Math.min(this.shieldMax, this.shield + 2); break;
    }
  }

  _enemies(dt) {
    const frozen = this.freezeT > 0;
    const ex = this.ex, ez = this.ez;
    const holes = this.holes, blockers = this.blockers, spinners = this.spinners, saws = this.saws;
    const lz = this.lz, lx = this.lx;
    this.bigN = 0;
    for (let i = this.en - 1; i >= 0; i--) {
      if (this.ehp[i] <= 0) continue;
      const kind = this.ekind[i];
      const def = ENEMY[kind];
      if (this.ehit[i] > 0) this.ehit[i] -= dt;
      if (kind >= EK.BRUTE && this.bigN < 64) this.big[this.bigN++] = i;
      if (this.efall[i] > 0) {
        this.efall[i] += dt;
        if (this.efall[i] > 0.9) this.ehp[i] = 0;
        continue;
      }
      if (kind === EK.BOSS) {
        this._boss(i, dt, frozen);
        continue;
      }
      if (frozen) continue;
      this.eph[i] += dt * def.speed * 3.2;
      let x = ex[i];
      const z = ez[i] + def.speed * dt;
      // steer to the launcher
      // far away the horde is a wide front, close to the launcher it converges on it
      const near = lz - z < 13;
      let tx = near ? lx + this.eoff[i] * 0.22 : lx * 0.3 + this.eoff[i];
      let lat = near ? def.lat + 1.6 : def.lat;
      if (kind === EK.RUNNER) tx += Math.sin(this.eph[i] * 0.35) * (near ? 1.0 : 2.2);
      else if (kind === EK.BRUTE) tx = lx * 0.7 + this.eoff[i] * 0.3;
      // avoid holes ahead
      for (let h = 0; h < holes.length; h++) {
        const ho = holes[h];
        if (z < ho.z0 - 5 || z > ho.z1) continue;
        if (x > ho.x0 - 0.5 && x < ho.x1 + 0.5) {
          // go to the nearest solid side
          const leftOk = ho.x0 > -HW + 0.4, rightOk = ho.x1 < HW - 0.4;
          if (leftOk && (!rightOk || x - ho.x0 < ho.x1 - x)) tx = ho.x0 - 1.2;
          else tx = ho.x1 + 1.2;
          const urgent = z > ho.z0 - 1.5 ? 6 : 3;
          x += Math.sign(tx - x) * Math.min(Math.abs(tx - x), urgent * dt);
          tx = x;
        } else if (tx > ho.x0 - 0.6 && tx < ho.x1 + 0.6) tx = x;
      }
      const dxl = tx - x;
      x += Math.sign(dxl) * Math.min(Math.abs(dxl), lat * dt);
      // walk around blockers
      for (let b = 0; b < blockers.length; b++) {
        const bl = blockers[b];
        if (bl.dead) continue;
        const dz = z - bl.z;
        if (dz > 1.8 || dz < -1.8) continue;
        const dx = x - bl.x, rr = bl.r + def.r + 0.1;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr) x += (dx >= 0 ? 1 : -1) * 4 * dt;
      }
      const edge = HW - 0.35;
      if (x > edge) x = edge; else if (x < -edge) x = -edge;

      // hazards hit enemies as well
      let dead = false;
      for (let h = 0; h < holes.length && !dead; h++) {
        const ho = holes[h];
        if (z < ho.z1 && z > ho.z0 && x > ho.x0 && x < ho.x1) { this.efall[i] = 0.001; dead = true; }
      }
      if (dead) { ex[i] = x; ez[i] = z; continue; }
      for (let s = 0; s < spinners.length && !dead; s++) {
        const sp = spinners[s];
        const dz = z - sp.z;
        if (dz > sp.len + 1 || dz < -sp.len - 1) continue;
        const dx = x - sp.x;
        const ca = Math.cos(sp.ang), sa = Math.sin(sp.ang);
        if (Math.abs(dx * ca + dz * sa) < sp.len && Math.abs(-dx * sa + dz * ca) < 0.3 + def.r * 0.6) dead = true;
      }
      for (let s = 0; s < saws.length && !dead; s++) {
        const sw = saws[s];
        const dz = z - sw.z;
        if (dz > 1.6 || dz < -1.6) continue;
        const dx = x - sw.cx, rr = sw.r + def.r * 0.7;
        if (dx * dx + dz * dz < rr * rr) dead = true;
      }
      if (dead) {
        ex[i] = x; ez[i] = z;
        if (kind === EK.BRUTE) this._hurtEnemy(i, 30 * dt);
        else this._hurtEnemy(i, 999);
        if (this.ehp[i] <= 0) continue;
      }

      // reached the launcher?
      if (z >= lz - 0.9) {
        this.ehp[i] = 0;
        if (this.state === STATE.PLAY || this.state === STATE.ADVANCE) {
          this.shield -= def.dmg;
          this.shieldFlash = 0.35;
          this.emit(EV.SHIELD_HIT, x, lz - 0.9, def.dmg);
        }
        this.emit(EV.POP_E, x, z, kind);
        continue;
      }
      ex[i] = x; ez[i] = z;
    }
  }

  _boss(i, dt, frozen) {
    const def = ENEMY[EK.BOSS];
    this.bossX = this.ex[i]; this.bossZ = this.ez[i];
    this.bossHp = this.ehp[i];
    if (this.state !== STATE.PLAY) return;
    if (frozen) return;
    this.eph[i] += dt * 2.2;
    // enraged bosses walk faster
    const rage = this.ehp[i] < this.emax[i] * 0.35 ? 1.35 : 1;
    if (this.bossWarn > 0) {
      this.bossWarn -= dt;
      if (this.bossWarn <= 0) {
        this.emit(EV.BOSS_STOMP, this.ex[i], this.ez[i], 4.2);
        this._blast(this.ex[i], this.ez[i], 4.2, 60, 0, true);
      }
      return; // stands still while winding up
    }
    this.bossStompT -= dt;
    if (this.bossStompT <= 0) {
      this.bossStompT = 6.5;
      this.bossWarn = 1.1;
      this.emit(EV.BOSS_WARN, this.ex[i], this.ez[i], 4.2);
      return;
    }
    this.ez[i] += def.speed * rage * dt;
    const dx = this.lx - this.ex[i];
    this.ex[i] += Math.sign(dx) * Math.min(Math.abs(dx), def.lat * dt);
    if (this.ez[i] >= this.lz - 2.4) {
      this.shield = 0;
      this.shieldFlash = 0.4;
      this.emit(EV.SHIELD_HIT, this.ex[i], this.lz - 1, 999);
    }
  }

  _gridBounds() {
    const fort = this.forts[this.stage];
    this.gz0 = fort.z - 8;
    const top = Math.max(this.lz, this.advFrom) + 3;
    this.gnz = Math.min(GZMAX, Math.ceil((top - this.gz0) / CELL) + 1);
  }

  _combat() {
    this._gridBounds();
    const gz0 = this.gz0, gnz = this.gnz;
    const head = this.ehead, next = this.enext;
    head.fill(-1, 0, GX * gnz);
    const ex = this.ex, ez = this.ez, ehp = this.ehp;
    for (let i = 0; i < this.en; i++) {
      if (ehp[i] <= 0 || this.ekind[i] >= EK.BRUTE || this.efall[i] > 0) continue;
      let cx = (ex[i] + 6) | 0, cz = ((ez[i] - gz0) / CELL) | 0;
      if (cx < 0) cx = 0; else if (cx >= GX) cx = GX - 1;
      if (cz < 0 || cz >= gnz) continue;
      const c = cz * GX + cx;
      next[i] = head[c];
      head[c] = i;
    }
    const px = this.px, pz = this.pz, php = this.php;
    const bigN = this.bigN, big = this.big;
    for (let i = 0; i < this.pn; i++) {
      if (php[i] <= 0 || this.pfall[i] > 0) continue;
      const x = px[i], z = pz[i];
      const mega = this.pkind[i] === 1;
      const r = mega ? 0.75 : UNIT_R + (php[i] > 1 ? 0.12 : 0);
      // big enemies (brutes, boss): brute force
      for (let b = 0; b < bigN && php[i] > 0; b++) {
        const e = big[b];
        if (ehp[e] <= 0) continue;
        const dx = x - ex[e], dz = z - ez[e];
        const rr = r + ENEMY[this.ekind[e]].r;
        if (dx * dx + dz * dz < rr * rr) {
          const d = Math.min(php[i], ehp[e]);
          php[i] -= d;
          this._hurtEnemy(e, d);
          if (this.ekind[e] === EK.BOSS) this.emit(EV.FORT_HIT, x, z, d);
        }
      }
      if (php[i] <= 0) { this.emit(EV.POP_P, x, z, mega ? 1 : 0); continue; }
      const cx = (x + 6) | 0, cz = ((z - gz0) / CELL) | 0;
      const x0 = cx > 0 ? cx - 1 : 0, x1 = cx < GX - 1 ? cx + 1 : GX - 1;
      const z0 = cz > 0 ? cz - 1 : 0, z1 = cz < gnz - 1 ? cz + 1 : gnz - 1;
      outer:
      for (let zz = z0; zz <= z1; zz++) {
        for (let xx = x0; xx <= x1; xx++) {
          let e = head[zz * GX + xx];
          while (e >= 0) {
            if (ehp[e] > 0) {
              const dx = x - ex[e], dz = z - ez[e];
              const rr = r + ENEMY[this.ekind[e]].r;
              if (dx * dx + dz * dz < rr * rr) {
                const d = Math.min(php[i], ehp[e]);
                php[i] -= d;
                this._hurtEnemy(e, d);
                if (php[i] <= 0) { this.emit(EV.POP_P, x, z, mega ? 1 : 0); break outer; }
              }
            }
            e = next[e];
          }
        }
      }
    }
  }

  // soft separation so the crowd spreads out instead of stacking
  _separate() {
    const gz0 = this.gz0, gnz = this.gnz;
    const head = this.phead, next = this.pnext;
    head.fill(-1, 0, GX * gnz);
    const px = this.px, pz = this.pz, php = this.php;
    const half = CELL * 0.5;
    for (let i = 0; i < this.pn; i++) {
      if (php[i] <= 0 || this.pfall[i] > 0) { next[i] = -2; continue; }
      let cx = ((px[i] + 6) / half) | 0, cz = ((pz[i] - gz0) / CELL) | 0;
      cx >>= 1;
      if (cx < 0) cx = 0; else if (cx >= GX) cx = GX - 1;
      if (cz < 0 || cz >= gnz) { next[i] = -2; continue; }
      const c = cz * GX + cx;
      next[i] = head[c];
      head[c] = i;
    }
    const edge = HW - 0.32;
    for (let i = 0; i < this.pn; i++) {
      if (next[i] === -2) continue;
      const x = px[i], z = pz[i];
      const cx = Math.min(GX - 1, Math.max(0, (x + 6) | 0)), cz = ((z - gz0) / CELL) | 0;
      let ax = 0, checked = 0;
      const x0 = cx > 0 ? cx - 1 : 0, x1 = cx < GX - 1 ? cx + 1 : GX - 1;
      const zA = cz > 0 ? cz - 1 : 0, zB = cz < gnz - 1 ? cz + 1 : gnz - 1;
      for (let zz = zA; zz <= zB && checked < 10; zz++) {
        for (let xx = x0; xx <= x1 && checked < 10; xx++) {
          let j = head[zz * GX + xx];
          while (j >= 0 && checked < 10) {
            if (j !== i) {
              const dx = x - px[j], dz = z - pz[j];
              const d2 = dx * dx + dz * dz;
              if (d2 < 0.3 && d2 > 1e-5) {
                const d = Math.sqrt(d2);
                ax += (dx / d) * (0.55 - d);
                checked++;
              } else if (d2 <= 1e-5) { ax += (i & 1 ? 0.05 : -0.05); checked++; }
            }
            j = next[j];
          }
        }
      }
      if (ax !== 0) {
        let nx = x + Math.max(-0.06, Math.min(0.06, ax * 0.25));
        if (nx > edge) nx = edge; else if (nx < -edge) nx = -edge;
        px[i] = nx;
      }
    }
  }

  _sweep() {
    // remove dead (swap with last)
    for (let i = this.pn - 1; i >= 0; i--) {
      if (this.php[i] <= 0) {
        const l = --this.pn;
        if (i !== l) {
          this.px[i] = this.px[l]; this.pz[i] = this.pz[l]; this.php[i] = this.php[l]; this.pkind[i] = this.pkind[l];
          this.pg[i] = this.pg[l]; this.pph[i] = this.pph[l]; this.pfall[i] = this.pfall[l]; this.pborn[i] = this.pborn[l];
        }
      }
    }
    for (let i = this.en - 1; i >= 0; i--) {
      if (this.ehp[i] <= 0) {
        const l = --this.en;
        if (i !== l) {
          this.ex[i] = this.ex[l]; this.ez[i] = this.ez[l]; this.ehp[i] = this.ehp[l]; this.emax[i] = this.emax[l];
          this.ekind[i] = this.ekind[l]; this.eph[i] = this.eph[l]; this.efall[i] = this.efall[l]; this.ehit[i] = this.ehit[l];
          this.eborn[i] = this.eborn[l]; this.eoff[i] = this.eoff[l];
        }
      }
    }
  }

  // ---- results -------------------------------------------------------------------------
  stars() {
    if (this.state !== STATE.WON) return 0;
    const frac = this.shield / this.shieldMax;
    return frac >= 0.85 ? 3 : frac >= 0.45 ? 2 : 1;
  }
}

// ---------------------------------------------------------------------------------------
// Bot: used for the attract mode behind the menu and for automated balance checks.

export class Bot {
  constructor(sim, skill = 0.8, seed = 7) {
    this.sim = sim;
    this.skill = skill;
    this.rng = makeRng(seed);
    this.t = 0;
    this.x = 0;
  }

  update(dt) {
    const s = this.sim;
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 0.25 + (1 - this.skill) * 0.5;
      this.x = this.choose();
    }
    s.setInput(this.x, s.state === STATE.PLAY);
  }

  choose() {
    const s = this.sim;
    // 1) defend: an enemy is close to the launcher
    let danger = -1, dz = 1e9;
    for (let i = 0; i < s.en; i++) {
      if (s.ehp[i] <= 0) continue;
      const d = s.lz - s.ez[i];
      if (d < 9 && d < dz) { dz = d; danger = i; }
    }
    if (danger >= 0 && this.rng() < 0.55 + this.skill * 0.45) { this.t = 0.1; return s.ex[danger]; }
    // 1b) thin out a horde that is building up in the near half before it arrives all at once
    let near = 0, pick = -1;
    for (let i = 0; i < s.en; i++) {
      if (s.ehp[i] > 0 && s.lz - s.ez[i] < 22) { near++; if (this.rng() < 1 / near) pick = i; }
    }
    if (near > 14 && this.rng() < 0.5) return s.ex[pick];
    // 2) otherwise: best lane through the remaining gates
    const view = { stages: s.level.stages, gates: [], holes: s.holes, spinners: s.spinners, saws: s.saws, blockers: s.blockers };
    for (const g of s.gates) if (!g.dead && g.z < s.lz) view.gates.push(g);
    let best = -1, bx = 0;
    for (let x = -HW + 0.8; x <= HW - 0.8; x += 0.3) {
      let v = laneValue(view, s.stage, x);
      // cages are worth opening, pickups too
      for (const b of s.blockers) if (!b.dead && b.stage === s.stage && b.type === BT.CAGE && Math.abs(b.x - x) < 0.6) v *= 2.2;
      for (const p of s.pickups) if (!p.dead && p.stage === s.stage && p.z < s.lz && Math.abs(p.x - x) < 0.5) v *= 1.5;
      v += this.rng() * (1 - this.skill) * 1.5;
      v -= Math.abs(x - s.lx) * 0.01;
      if (v > best) { best = v; bx = x; }
    }
    return bx;
  }
}
