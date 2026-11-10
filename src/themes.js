// Visual themes of the six worlds.
export const THEMES = {
  meadow: {
    skyTop: 0x2f8fe6, skyMid: 0x8fd3ff, skyBot: 0xe8f7ff, sun: 0xfff3c4, sunDir: [0.35, 0.8, 0.45],
    fog: 0xcfeeff, fogNear: 55, fogFar: 170,
    track: 'pavers', trackA: '#e9e2cf', trackB: '#cfc5aa', trackLine: '#ffffff', curb: 0x4fc36b, curb2: 0xffffff, side: 0x9c8f72,
    ground: 'water', groundA: '#2aa6d8', groundB: '#5fd0ee',
    light: 0xfff6e0, ambientSky: 0xbfe6ff, ambientGround: 0x7fbf6a,
    fortA: 0x7d5ab5, fortB: 0x4a2f7a, fortRoof: 0xe0457b,
    decor: 'meadow', ambient: 'petals', ambientColor: 0xffc6e0, clouds: 0xffffff,
    music: { root: 60, scale: 'major', bpm: 112, lead: 'triangle' },
  },
  desert: {
    skyTop: 0xf08a3c, skyMid: 0xffc27a, skyBot: 0xfff0c9, sun: 0xfff1b0, sunDir: [-0.5, 0.45, 0.5],
    fog: 0xffd9a6, fogNear: 50, fogFar: 160,
    track: 'slabs', trackA: '#f0d49a', trackB: '#d9b672', trackLine: '#7a4a1c', curb: 0xd9622b, curb2: 0xffe9b8, side: 0xa87440,
    ground: 'sand', groundA: '#e2b565', groundB: '#f3d08a',
    light: 0xffe2b0, ambientSky: 0xffd9a0, ambientGround: 0xd98b4a,
    fortA: 0x8a4b2d, fortB: 0x5a2a1a, fortRoof: 0x7b2fb5,
    decor: 'desert', ambient: 'dust', ambientColor: 0xffe7b8, clouds: 0xffe6c2,
    music: { root: 57, scale: 'phrygian', bpm: 104, lead: 'sawtooth' },
  },
  frost: {
    skyTop: 0x5d7fd6, skyMid: 0xb5cdf6, skyBot: 0xf2f8ff, sun: 0xffffff, sunDir: [0.2, 0.7, 0.6],
    fog: 0xdfeaff, fogNear: 45, fogFar: 150,
    track: 'ice', trackA: '#d8ecff', trackB: '#a9cdf2', trackLine: '#ffffff', curb: 0x4f8fe0, curb2: 0xffffff, side: 0x7fa6d6,
    ground: 'snow', groundA: '#e9f3ff', groundB: '#c5dbf5',
    light: 0xf2f6ff, ambientSky: 0xd6e6ff, ambientGround: 0xa9c2e6,
    fortA: 0x4a5f9a, fortB: 0x2a3566, fortRoof: 0xc23b6a,
    decor: 'frost', ambient: 'snow', ambientColor: 0xffffff, clouds: 0xffffff,
    music: { root: 62, scale: 'dorian', bpm: 100, lead: 'sine' },
  },
  lava: {
    skyTop: 0x1a0a14, skyMid: 0x5a1420, skyBot: 0xf0602a, sun: 0xffb060, sunDir: [-0.3, 0.5, 0.4],
    fog: 0x6a1a1c, fogNear: 40, fogFar: 140,
    track: 'basalt', trackA: '#4a3d44', trackB: '#32282e', trackLine: '#ff7a2a', curb: 0xff5a1f, curb2: 0x2a2026, side: 0x241a1e,
    ground: 'lava', groundA: '#ff5a14', groundB: '#ffc23a',
    light: 0xffc8a0, ambientSky: 0xb06a6a, ambientGround: 0xff5a20,
    fortA: 0x3a2a36, fortB: 0x1e141c, fortRoof: 0xff3b2a,
    decor: 'lava', ambient: 'embers', ambientColor: 0xffa040, clouds: 0,
    music: { root: 55, scale: 'minor', bpm: 122, lead: 'square' },
  },
  neon: {
    skyTop: 0x05061c, skyMid: 0x1a1250, skyBot: 0x7a2a9a, sun: 0xff8ae0, sunDir: [0.4, 0.6, 0.5],
    fog: 0x24124e, fogNear: 45, fogFar: 150,
    track: 'grid', trackA: '#1c1f3c', trackB: '#14162c', trackLine: '#37f2ff', curb: 0x37f2ff, curb2: 0xff3bd4, side: 0x0e1024,
    ground: 'city', groundA: '#0b0c22', groundB: '#2a1a5a',
    light: 0xd8c8ff, ambientSky: 0x7a6ad6, ambientGround: 0x3a2a8a,
    fortA: 0x2a2450, fortB: 0x15122e, fortRoof: 0xff3bd4,
    enemy: 0xff3f86, // purple grunts would drown on the dark neon track
    decor: 'neon', ambient: 'sparks', ambientColor: 0x7af7ff, clouds: 0, stars: true,
    music: { root: 58, scale: 'minor', bpm: 126, lead: 'sawtooth' },
  },
  cosmos: {
    skyTop: 0x04020f, skyMid: 0x2a0f5a, skyBot: 0xc04a9a, sun: 0xffd6f6, sunDir: [-0.4, 0.65, 0.4],
    fog: 0x2a1250, fogNear: 50, fogFar: 160,
    track: 'crystal', trackA: '#5a3aa8', trackB: '#3e2584', trackLine: '#ffd86a', curb: 0xffc93a, curb2: 0xff6ad5, side: 0x2a1860,
    ground: 'nebula', groundA: '#12072e', groundB: '#5a1f8a',
    light: 0xffe6ff, ambientSky: 0x9a7af0, ambientGround: 0x5a2a9a,
    fortA: 0x3a2a7a, fortB: 0x1a1240, fortRoof: 0xffc93a,
    enemy: 0xff6a3a,
    decor: 'cosmos', ambient: 'stardust', ambientColor: 0xfff0a0, clouds: 0, stars: true,
    music: { root: 61, scale: 'lydian', bpm: 116, lead: 'triangle' },
  },
};

// player colour skins (unlocked by total stars)
export const SKINS = [
  { id: 'mint', color: 0x35e0a1, stars: 0 },
  { id: 'sun', color: 0xffc928, stars: 12 },
  { id: 'berry', color: 0xff5fa2, stars: 30 },
  { id: 'ocean', color: 0x3aa8ff, stars: 60 },
  { id: 'lime', color: 0xa6f03a, stars: 100 },
  { id: 'ghost', color: 0xf2f4ff, stars: 150 },
];

export const ENEMY_COLORS = [0x8a3ff0, 0xff4fb0, 0x4a5a9a, 0xff6a2a, 0x6a22c8, 0x52127a];
