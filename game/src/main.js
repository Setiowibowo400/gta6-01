// SOLMAR HEAT — boot and the one loop. The game moves between four screens:
// title, play, paused and game over. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// ?seed=N fixes the city. ?shot=start|play|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity, isBlocked } from './world.js';
import {
  ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE,
  ACTION_TAXI, ACTION_WEAPON1, ACTION_WEAPON2, createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createPlayer, currentWeapon, damagePlayer, enterCar, exitCar, healPlayer, addArmor, switchWeapon, updateOnFoot } from './player.js';
import { createCar, nearestCar, spawnParkedCars, topUpTraffic, updateCarPhysics } from './vehicles.js';
import { createPedestrian, scarePedestrians, spawnPedestrians, updatePedestrians, updateTraffic } from './traffic.js';
import { addWanted, commitCrime, updatePolice, updateWanted } from './police.js';
import { createBullet, firePlayerWeapon, spawnPickups, updateBullets, updateEnemies, updatePickups } from './combat.js';
import { MISSION_DEFS, maybeStartNextMission, startMission, startTaxiFare, updateMissions, updateTaxi } from './missions.js';
import { createAudio } from './audio.js';
import { loadSave, saveGame } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

/** Build a fresh game state for a seed: the city, the player, cars and people. */
export function createGame(seedValue) {
  const random = createRandom(seedValue);
  const city = createCity(random);
  const player = createPlayer(640, 500);
  const state = {
    seed: seedValue, random, city, player,
    cars: [], peds: [], cops: [], bullets: [], enemies: [], pickups: [], sparks: [],
    events: [], cash: 150, wanted: 0, lastCrime: -100, heatTimer: 0, spawnTimer: 0,
    mission: null, missionIndex: 0, missionsDone: 0, taxi: null,
    time: 0, message: '', messageTimer: 0, kills: 0, shotsFired: 0,
    busted: false, storyComplete: false, nextMissionReady: false,
    autoInput: null, autoAim: null, hasSave: false,
  };
  state.cars = spawnParkedCars(city, random, 18);
  // The mission cars: a Sunrise by the marina for job 1, a black Marlin at the hotel for job 5.
  const jobCar = createCar(640, 320, Math.PI / 2, 'sedan', random);
  jobCar.color = '#f1c40f';
  jobCar.name = 'Sunrise';
  state.cars.push(jobCar);
  const marlin = createCar(2240, 640, 0, 'sedan', random);
  marlin.color = '#1c2733';
  marlin.name = 'Marlin';
  state.cars.push(marlin);
  state.peds = spawnPedestrians(city, random, 26);
  spawnPickups(state);
  return state;
}

/** One fixed simulation step, driven either by live input or by the shot autopilot. */
function stepGame(state, dt, input, audio) {
  const player = state.player;
  if (player.dead) return;
  state.time += dt;
  if (state.messageTimer > 0) state.messageTimer -= dt;

  // --- Input: live keys, or the autopilot's scripted input for screenshots. ---
  const auto = state.autoInput;
  let moveX = 0;
  let moveY = 0;
  let throttle = 0;
  let steer = 0;
  let handbrake = false;
  let firing = false;
  if (auto) {
    moveX = auto.moveX || 0;
    moveY = auto.moveY || 0;
    throttle = auto.throttle || 0;
    steer = auto.steer || 0;
    handbrake = !!auto.handbrake;
  } else if (input) {
    moveX = input.moveX;
    moveY = input.moveY;
    throttle = input.throttle;
    steer = input.steer;
    handbrake = input.handbrake;
    firing = input.firing;
  }

  // --- Aim: the mouse in world coordinates (or the autopilot's aim point). ---
  if (state.autoAim) {
    player.angle = Math.atan2(state.autoAim.y - player.y, state.autoAim.x - player.x);
  } else if (input && window.__rendererCamera) {
    const cam = window.__rendererCamera;
    const wx = cam.x + (input.mouseX - cam.ox) / cam.scale;
    const wy = cam.y + (input.mouseY - cam.oy) / cam.scale;
    player.aimX = wx;
    player.aimY = wy;
    if (!player.inCar) player.angle = Math.atan2(wy - player.y, wx - player.x);
    else player.angle = Math.atan2(wy - player.inCar.y, wx - player.inCar.x);
  }

  // --- Movement: on foot or behind the wheel. ---
  if (player.inCar) {
    const car = player.inCar;
    updateCarPhysics(car, state.city, throttle, steer, handbrake, dt);
    player.x = car.x;
    player.y = car.y;
    if (car.wrecked) {
      exitCar(player, car);
      state.message = 'Your car is wrecked. Find another one.';
      state.messageTimer = 4;
    }
    // Pedestrians scatter from a speeding car.
    for (const p of state.peds) {
      if (Math.hypot(p.x - player.x, p.y - player.y) < 90 && Math.abs(car.speed) > 120) {
        p.fleeing = 1.5;
        p.angle = Math.atan2(p.y - player.y, p.x - player.x);
      }
    }
  } else {
    updateOnFoot(player, state.city, { moveX, moveY, sprint: input ? input.sprint : false, aimX: player.aimX ?? player.x, aimY: player.aimY ?? player.y }, dt);
  }

  // --- Shooting. ---
  if (firing && !player.inCar) {
    if (firePlayerWeapon(state)) {
      scarePedestrians(state.peds, player.x, player.y, 320);
      if (audio) audio.gunshot();
    }
  } else if (firing && player.inCar) {
    if (firePlayerWeapon(state) && audio) audio.gunshot();
  }

  // --- The living city, the police, combat, missions, taxi. ---
  updateTraffic(state, dt);
  updatePedestrians(state, dt);
  topUpTraffic(state, state.random);
  updateWanted(state, dt);
  updatePolice(state, dt);
  updateEnemies(state, dt);
  updateBullets(state, dt);
  updatePickups(state, dt);
  const missionResult = updateMissions(state, dt);
  if (missionResult === 'complete' && audio) {
    audio.missionDone();
    saveGame(state);
  }
  updateTaxi(state, dt);
  for (const s of state.sparks) s.t -= dt;
  state.sparks = state.sparks.filter((s) => s.t > 0);

  // --- Events the systems queued (hits, pickups, arrests). ---
  for (const event of state.events) {
    if (event.type === 'playerHit') {
      if (damagePlayer(player, event.amount)) state.busted = false;
    } else if (event.type === 'pickup') {
      if (event.kind === 'health') healPlayer(player, 45);
      else if (event.kind === 'armor') addArmor(player, 50);
      else if (event.kind === 'ammo') player.ammo.smg += 60;
      else if (event.kind === 'cash') state.cash += 50;
      if (audio) audio.pickup();
    } else if (event.type === 'copShot') {
      const cop = event.from;
      const aim = Math.atan2(player.y - cop.y, player.x - cop.x) + (Math.random() - 0.5) * 0.25;
      state.bullets.push(createBullet(cop.x, cop.y, aim, 700, 8, 'enemy'));
      if (audio) audio.enemyShot();
    } else if (event.type === 'busted') {
      state.busted = true;
      player.dead = true;
    }
  }
  state.events.length = 0;

  // --- The next job starts itself once the last one is done. ---
  if (!state.mission && !state.storyComplete && state.missionIndex < MISSION_DEFS.length && state.missionsDone > 0) {
    startMission(state, state.missionIndex);
  }
}

function runShot(name) {
  const state = createGame(seed);
  window.__solmarState = state; // Debug handle: lets a test read the staged state.
  const renderer = createRenderer(canvas);
  window.__rendererCamera = renderer.camera;
  const game = { state, stepGame: (dt, auto) => stepGame(state, dt, null, null) };
  const scene = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const renderer = createRenderer(canvas);
  window.__rendererCamera = renderer.camera;
  const audio = createAudio();
  let state = createGame(seed);
  window.__solmarState = state; // Debug handle: lets a test read the live state.
  const saved = loadSave();
  state.hasSave = !!saved;
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function applySave(data) {
    state.cash = data.cash;
    state.missionIndex = data.missionIndex;
    state.missionsDone = data.missionsDone || 0;
    state.player.x = data.x;
    state.player.y = data.y;
    state.player.health = data.health;
    state.player.armor = data.armor;
    state.player.ammo.smg = data.ammoSmg || 0;
    state.kills = data.kills || 0;
    state.message = `Welcome back — job ${Math.min(state.missionIndex + 1, 6)} of 6.`;
    state.messageTimer = 5;
  }

  function startGame(fromSave) {
    state = createGame(seed);
    window.__solmarState = state;
    state.hasSave = !!saved;
    if (fromSave && saved) applySave(saved);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    startMission(state, state.missionIndex);
    announce(`Playing. Job ${state.missionIndex + 1} of 6.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (state.busted && audio) audio.busted();
    saveGame(state);
    announce(state.busted ? 'Busted. The police caught Dario.' : 'Wasted. Dario went down.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      state.message = muted ? 'Sound off (M to turn back on).' : 'Sound on.';
      state.messageTimer = 2;
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(false);
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame(false);
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        saveGame(state);
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    // Dismiss mission dialogue first, then the action keys.
    if (state.mission && !state.mission.dialogueShown && (actions & ACTION_CONFIRM)) {
      state.mission.dialogueShown = true;
      return;
    }
    if (actions & ACTION_WEAPON1) switchWeapon(state.player, 'pistol');
    if (actions & ACTION_WEAPON2) switchWeapon(state.player, 'smg');
    if (actions & ACTION_TAXI) startTaxiFare(state);
    if (actions & ACTION_ENTER) {
      const player = state.player;
      if (player.inCar) {
        exitCar(player, player.inCar);
      } else {
        const car = nearestCar(state.cars, player.x, player.y, 70);
        if (car) {
          const wasTraffic = car.driver === 'traffic';
          enterCar(player, car);
          if (wasTraffic) commitCrime(state, 'steal');
          if (audio) audio.unlock();
        } else if (!state.mission) {
          maybeStartNextMission(state);
        }
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        stepGame(state, STEP, input, audio);
        accumulator -= STEP;
        if (state.player.dead) { endGame(); break; }
      }
      // Sound follows the game: engine, sirens, and the music loop.
      const car = state.player.inCar;
      audio.engine(car ? car.speed : 0, !!car);
      const policeNear = state.cars.some((c) => c.driver === 'police' && Math.hypot(c.x - state.player.x, c.y - state.player.y) < 700);
      audio.siren(policeNear || state.wanted > 0, state.time);
      audio.music(state.time);
    } else {
      accumulator = 0;
      audio.engine(0, false);
      audio.siren(false, 0);
    }
    renderer.draw(state, screen);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(state);
      announce('Paused.');
    }
  });
  // Continue a saved game (C) or start fresh (N) from the title screen.
  window.addEventListener('keydown', (event) => {
    if (screen !== SCREEN_TITLE) return;
    if (event.code === 'KeyC' && saved) startGame(true);
    else if (event.code === 'KeyN') startGame(false);
  });

  announce('Solmar Heat. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
