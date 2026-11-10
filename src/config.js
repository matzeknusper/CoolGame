// Shared gameplay constants (used by the simulation, the level generator and the renderer).
export const HW = 4.6; // track half width
export const UNIT_SPEED = 9.5;
export const UNIT_R = 0.3;
export const PCAP = 1100; // hard cap of player units
export const PSOFT = 800; // above this, clones merge into hp instead of new units
export const ECAP = 1600; // large enough for the carpets of the horde mode

// enemy kinds
export const EK = { GRUNT: 0, RUNNER: 1, PANZER: 2, BOMBER: 3, BRUTE: 4, BOSS: 5 };
export const ENEMY = [
  { name: 'grunt', hp: 1, speed: 3.1, r: 0.33, dmg: 1, cost: 1, lat: 0.9 },
  { name: 'runner', hp: 1, speed: 6.2, r: 0.3, dmg: 1, cost: 1.6, lat: 2.4 },
  { name: 'panzer', hp: 5, speed: 2.6, r: 0.42, dmg: 2, cost: 5, lat: 0.7 },
  { name: 'bomber', hp: 2, speed: 3.6, r: 0.38, dmg: 2, cost: 4, lat: 1.2 },
  { name: 'brute', hp: 14, speed: 1.9, r: 0.8, dmg: 3, cost: 13, lat: 0.5 },
  { name: 'boss', hp: 500, speed: 0.62, r: 1.9, dmg: 999, cost: 0, lat: 0.35 },
];

// gate operations
export const OP = { MUL: 0, ADD: 1, SUB: 2, DIV: 3 };
// blocker types
export const BT = { CRATE: 0, CAGE: 1, TNT: 2 };
// pickup types
export const PT = { RAPID: 0, FREEZE: 1, BOMB: 2, MEGA: 3, HEART: 4 };

// simulation events (consumed by renderer + audio)
export const EV = {
  SHOT: 1, MEGA: 2, POP_P: 3, POP_E: 4, GATE: 5, FORT_HIT: 6, FORT_DOWN: 7, SHIELD_HIT: 8,
  BLOCK_HIT: 9, BLOCK_DOWN: 10, PICKUP: 11, FALL: 12, SHELL_FIRE: 13, SHELL_LAND: 14,
  GATE_DONE: 15, BOSS_STOMP: 16, BOSS_WARN: 17, COIN: 18, STAGE: 19, WIN: 20, LOSE: 21,
  EXPLO: 22, BOSS_DOWN: 23, CAGE_FREE: 24, FREEZE: 25, SAW_KILL: 26, MEGA_READY: 27,
  WAVE: 28, BOSS_IN: 29,
};

export const STATE = { PLAY: 0, ADVANCE: 1, WON: 2, LOST: 3 };

// ---- upgrades -------------------------------------------------------------
export const UPGRADES = [
  { id: 'rate', max: 20, base: 45, growth: 1.3 },
  { id: 'multi', max: 15, base: 70, growth: 1.34 },
  { id: 'mega', max: 15, base: 60, growth: 1.32 },
  { id: 'shield', max: 15, base: 50, growth: 1.3 },
  { id: 'coins', max: 15, base: 80, growth: 1.36 },
];

export function upgradeCost(def, lvl) {
  return Math.round((def.base * Math.pow(def.growth, lvl)) / 5) * 5;
}

// Derived player stats from upgrade levels {rate, multi, mega, shield, coins}
export function playerStats(up) {
  const u = up || {};
  const rate = u.rate | 0, multi = u.multi | 0, mega = u.mega | 0, shield = u.shield | 0, coins = u.coins | 0;
  return {
    fireRate: 4.6 + 0.42 * rate,
    multiChance: 0.06 * multi,
    megaHp: 20 + 7 * mega,
    megaShots: Math.max(16, 44 - 1.6 * mega),
    shield: 10 + 2 * shield,
    coinMul: 1 + 0.08 * coins,
  };
}
