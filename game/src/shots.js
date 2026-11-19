// The screenshot scenes behind ?shot=start|play|chase|mission. Each one builds
// the real game from a fixed seed and then plays it forward with a scripted
// driver (an autopilot that drives along the roads toward a marker, shoots
// when enemies are near), so the frame is what real play looks like and the
// same seed always gives the same frame. The renderer paints it twice and
// main.js sets window.__shotReady for the screenshot tool.
import { createCar, spawnParkedCars } from './vehicles.js';
import { spawnEnemySquad } from './combat.js';
import { addWanted, spawnCopCar, spawnFootCop } from './police.js';
import { startMission, startTaxiFare } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** Drive the player's car toward a point: throttle and steering for the autopilot. */
function autopilotDrive(state, tx, ty) {
  const car = state.player.inCar;
  if (!car) return;
  const dx = tx - car.x;
  const dy = ty - car.y;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const dist = Math.hypot(dx, dy);
  state.autoInput = {
    throttle: dist > 60 ? 1 : 0,
    steer: Math.max(-1, Math.min(1, diff * 2)),
    handbrake: false,
  };
}

/** Walk the player toward a point on foot. */
function autopilotWalk(state, tx, ty) {
  const p = state.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 30) { state.autoInput = { moveX: 0, moveY: 0 }; return; }
  state.autoInput = { moveX: dx / dist, moveY: dy / dist };
}

/**
 * Set `game` (the object main.js builds) to the named scene and return the
 * screen to draw over it. Names: start, play, chase, mission; anything else is start.
 */
export function stageShot(name, game) {
  const state = game.state;
  if (name === 'play') {
    // Driving through Downtown with traffic around: the open world in motion.
    state.player.x = 1600;
    state.player.y = 640;
    const car = createCar(1600, 640, 0, 'sedan', state.random);
    car.driver = 'player';
    state.cars.push(car);
    state.player.inCar = car;
    state.player.x = car.x;
    state.player.y = car.y;
    for (let i = 0; i < 90; i += 1) {
      autopilotDrive(state, 2560, 640);
      game.stepGame(1 / 60, true);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    // Three stars, police cars closing in, the player speeding away in a stolen car.
    state.player.x = 1280;
    state.player.y = 960;
    const car = createCar(1280, 960, Math.PI, 'sedan', state.random);
    car.color = '#c0392b';
    car.driver = 'player';
    state.cars.push(car);
    state.player.inCar = car;
    state.player.x = car.x;
    state.player.y = car.y;
    addWanted(state, 3);
    // The pursuit starts behind the player, closing in — not on top of them.
    const cop1 = spawnCopCar(state);
    cop1.x = state.player.x + 520;
    cop1.y = 960;
    cop1.angle = Math.PI;
    const cop2 = spawnCopCar(state);
    cop2.x = state.player.x + 700;
    cop2.y = 928;
    cop2.angle = Math.PI;
    const foot = spawnFootCop(state);
    foot.x = state.player.x + 420;
    foot.y = 1020;
    state.cash = 1240;
    state.hideMarker = true;
    for (let i = 0; i < 100; i += 1) {
      autopilotDrive(state, 320, 960);
      game.stepGame(1 / 60, true);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Mission 4, the dockside shootout: enemies ahead, objective and marker live.
    // The player walks east along the dock road toward the marker, stopping
    // short of it so the player, the enemies and the marker all read at once.
    state.player.x = 2048;
    state.player.y = 1920;
    startMission(state, 3);
    state.mission.dialogueShown = true;
    spawnEnemySquad(state, 2240, 1920, 5, 'Vipers');
    state.cash = 860;
    state.player.ammo.smg = 90;
    state.player.weapon = 'smg';
    for (let i = 0; i < 80; i += 1) {
      autopilotWalk(state, 2160, 1920);
      state.autoAim = { x: 2240, y: 1920 };
      game.stepGame(1 / 60, true);
    }
    return { screen: SCREEN_PLAY };
  }
  // start: the title screen over the living city, player standing by the marina.
  state.player.x = 420;
  state.player.y = 500;
  spawnParkedCars(state.city, state.random, 6);
  for (let i = 0; i < 30; i += 1) game.stepGame(1 / 60, true);
  return { screen: SCREEN_TITLE };
}
