// The wanted system: 1–5 stars, police cars and foot cops who spawn, chase, ram
// and arrest, and heat that decays when no cop can see the player. Crimes add
// heat; staying out of sight lets it cool.
import { WANTED } from './config.js';
import { createCar } from './vehicles.js';
import { randomRoadPoint } from './world.js';

export function addWanted(state, stars) {
  state.wanted = Math.min(WANTED.maxStars, state.wanted + stars);
  state.lastCrime = state.time;
  state.heatTimer = 0;
}

export function commitCrime(state, kind) {
  // Shooting in public, killing, and stealing a car in front of a witness all count.
  if (kind === 'shoot') addWanted(state, 1);
  else if (kind === 'kill') addWanted(state, 1);
  else if (kind === 'steal') addWanted(state, 1);
  else if (kind === 'killCop') addWanted(state, 2);
}

/** A cop car, spawning on a road near (but not on top of) the player. */
export function spawnCopCar(state) {
  const p = randomRoadPoint(state.city, state.random);
  const car = createCar(p.x, p.y, Math.atan2(state.player.y - p.y, state.player.x - p.x), 'police', state.random);
  car.color = '#1c2733';
  car.driver = 'police';
  car.speed = 260;
  state.cars.push(car);
  return car;
}

/** A foot cop, spawning a short walk from the player. */
export function spawnFootCop(state) {
  const angle = state.random() * Math.PI * 2;
  const x = state.player.x + Math.cos(angle) * 420;
  const y = state.player.y + Math.sin(angle) * 420;
  const cop = {
    x, y, angle, speed: 200, health: 60, cop: true,
    shootCooldown: 1 + state.random(), arrestTimer: 0, radius: 13,
  };
  state.cops.push(cop);
  return cop;
}

/** Keep the police presence matched to the wanted level. */
export function updateWanted(state, dt) {
  if (state.wanted === 0) return;
  const cops = state.cars.filter((c) => c.driver === 'police').length + state.cops.length;
  const want = WANTED.maxCops[state.wanted];
  state.spawnTimer -= dt;
  if (cops < want && state.spawnTimer <= 0) {
    if (state.wanted >= 2 && Math.random() < 0.4) spawnFootCop(state);
    else spawnCopCar(state);
    state.spawnTimer = WANTED.copCarInterval[state.wanted];
  }
  // Heat decay: unseen and quiet for a while, the stars start to fall.
  const anyNear = state.cars.some((c) => c.driver === 'police' && Math.hypot(c.x - state.player.x, c.y - state.player.y) < 520)
    || state.cops.some((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 420);
  if (!anyNear && state.time - state.lastCrime > WANTED.decayDelay) {
    state.heatTimer += dt;
    if (state.heatTimer > 6) {
      state.wanted = Math.max(0, state.wanted - 1);
      state.heatTimer = 0;
      state.lastCrime = state.time;
    }
  } else {
    state.heatTimer = 0;
  }
}

/** Police cars chase and ram; foot cops chase, shoot, and arrest a slow player. */
export function updatePolice(state, dt) {
  const player = state.player;
  for (const car of state.cars) {
    if (car.driver !== 'police' || car.wrecked) continue;
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    car.speed += Math.max(-500 * dt, Math.min(500 * dt, (dist > 120 ? 480 : 300) - car.speed));
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!state.city.buildings.some((b) => nx > b.x - 18 && nx < b.x + b.w + 18 && ny > b.y - 18 && ny < b.y + b.h + 18)) {
      car.x = nx;
      car.y = ny;
    } else {
      car.speed *= 0.4;
      car.angle += 0.6 * dt;
    }
    // Ramming the player's car (or the player on foot) hurts.
    if (dist < 46) {
      if (player.inCar) {
        player.inCar.speed *= 0.98;
        player.inCar.health = Math.max(0, player.inCar.health - 10 * dt);
      } else if (player.invulnerable <= 0) {
        state.events.push({ type: 'playerHit', amount: 14 });
      }
      car.speed *= 0.98;
    }
  }
  for (const cop of state.cops) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    cop.angle = Math.atan2(dy, dx);
    if (dist > 40) {
      const speed = state.wanted >= 3 ? 230 : 180;
      cop.x += (dx / dist) * speed * dt;
      cop.y += (dy / dist) * speed * dt;
      cop.arrestTimer = 0;
    } else {
      // Close and slow: the arrest clock runs.
      const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : (player.moving ? 200 : 0);
      if (playerSpeed < 60) {
        cop.arrestTimer += dt;
        if (cop.arrestTimer > 2.5) state.events.push({ type: 'busted' });
      }
    }
    // Cops open fire from two stars up.
    cop.shootCooldown -= dt;
    if (state.wanted >= 2 && dist < 420 && cop.shootCooldown <= 0) {
      cop.shootCooldown = 0.9 + Math.random() * 0.7;
      state.events.push({ type: 'copShot', from: cop, target: 'player' });
    }
  }
  // Cull police that fell far behind.
  state.cars = state.cars.filter((c) => c.driver !== 'police' || Math.hypot(c.x - player.x, c.y - player.y) < 1800);
  state.cops = state.cops.filter((c) => Math.hypot(c.x - player.x, c.y - player.y) < 1500);
}
