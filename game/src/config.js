// SOLMAR HEAT — tuning numbers, colours and names in one place.
// A top-down open-world crime game set in the fictional coastal city of Solmar.
// The viewport is a fixed 1280x720 logical area; the renderer scales it to the
// window. The world itself is much bigger (see WORLD) and the camera follows the player.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** The city is 3200 x 2400 world units; roads sit on a 320-unit grid. */
export const WORLD = { width: 3200, height: 2400, roadStep: 320, roadWidth: 72 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 230,
  sprintSpeed: 330,
  health: 100,
  armor: 50,
  maxHealth: 100,
  maxArmor: 100,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 520,
  maxReverse: 180,
  steer: 2.6,
  grip: 3.2,
  driftGrip: 1.4,
};

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, cooldown: 0.28, bulletSpeed: 900, spread: 0.03, ammo: Infinity, auto: false },
  smg: { name: 'SMG', damage: 20, cooldown: 0.09, bulletSpeed: 1000, spread: 0.09, ammo: 120, auto: true },
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 12,
  copCarInterval: [9, 7, 5, 3.5, 2.5],
  maxCops: [0, 2, 3, 4, 6, 8],
};

export const DISTRICTS = [
  { name: 'Marina Beach', x: 0, y: 0, w: 420, h: 2400 },
  { name: 'Old Town', x: 420, y: 0, w: 1100, h: 800 },
  { name: 'Downtown Solmar', x: 1520, y: 0, w: 1680, h: 1100 },
  { name: 'Palm Park', x: 700, y: 380, w: 480, h: 240 },
  { name: 'Harbor South', x: 420, y: 1300, w: 2780, h: 1100 },
];

/** The beach strip (sand then sea) on the west edge, and the canal across the south. */
export const BEACH = { sandTo: 200, seaTo: 80 };
export const CANAL = { y0: 1150, y1: 1250, bridgeX0: 1564, bridgeX1: 1696 };

export const PALETTE = {
  backdrop: '#0d1520',
  grass: '#4a7c3a',
  parkGrass: '#5d9b47',
  sand: '#e8d29a',
  sea: '#2f7fb8',
  canal: '#2a6d9e',
  road: '#33373d',
  roadLine: '#d8c95a',
  sidewalk: '#8d8578',
  buildingRoof: '#6b5a4e',
  buildingRoof2: '#7a6a58',
  buildingRoof3: '#5d6b7a',
  buildingTall: '#4a5a70',
  text: '#f2ede2',
  muted: '#b8b2a4',
  gold: '#f2c94c',
  red: '#e5534b',
  blue: '#4fc3f7',
  panel: '#1c2430',
  panelEdge: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save (cash, mission progress, position) is kept between visits. */
export const SAVE_KEY = 'solmar-heat.save.v1';

export const GAME_NAME = 'SOLMAR HEAT';
export const HERO_NAME = 'Dario Cruz';
export const FIXER_NAME = 'Mara Solis';
