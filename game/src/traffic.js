// Traffic and pedestrians: the city alive around the player. Traffic cars follow
// their road lane, slow for the car ahead, and turn at intersections. Pedestrians
// stroll the sidewalks and run away from gunfire. Neither file draws anything.
import { WORLD } from './config.js';
import { isBlocked, moveWithCollision, randomSidewalkPoint } from './world.js';
import { spawnTrafficCar } from './vehicles.js';

export function createPedestrian(city, random, x, y) {
  const p = x === undefined ? randomSidewalkPoint(city, random) : { x, y };
  return {
    x: p.x, y: p.y, angle: random() * Math.PI * 2,
    speed: 40 + random() * 30, fleeing: 0, panic: 0,
    color: ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#ecf0f1'][Math.floor(random() * 6)],
    walkPhase: random() * Math.PI * 2,
  };
}

export function spawnPedestrians(city, random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) peds.push(createPedestrian(city, random));
  return peds;
}

/** A gunshot nearby sends every pedestrian within earshot running. */
export function scarePedestrians(peds, x, y, radius) {
  for (const p of peds) {
    if (Math.hypot(p.x - x, p.y - y) < radius) {
      p.fleeing = 2.5 + Math.random() * 2;
      p.angle = Math.atan2(p.y - y, p.x - x);
    }
  }
}

/** One traffic car: hold its lane, slow for traffic ahead, turn at intersections. */
export function updateTrafficCar(car, state, dt) {
  const ai = car.ai;
  if (!ai) return;
  const ahead = 70;
  let blocked = false;
  for (const other of state.cars) {
    if (other === car || other.wrecked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (forward > 0 && forward < ahead && side < 30) { blocked = true; break; }
  }
  const target = blocked ? 0 : 150;
  car.speed += Math.max(-300 * dt, Math.min(300 * dt, target - car.speed));
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (isBlocked(state.city, nx, ny, 20)) {
    // Reached a building or the map edge: turn around at the next intersection.
    car.angle += Math.PI / 2;
    car.speed *= 0.4;
    return;
  }
  car.x = nx;
  car.y = ny;
  // At an intersection, sometimes turn onto the crossing road.
  const nearV = state.city.vertical.some((vx) => Math.abs(car.x - vx) < 26);
  const nearH = state.city.horizontal.some((hy) => Math.abs(car.y - hy) < 26);
  if (nearV && nearH && Math.random() < dt * 0.5) {
    car.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
  }
  // Keep the car glued to its lane: nudge back toward the road centre.
  if (ai.axis === 'v') {
    const vx = state.city.vertical.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
    car.x += (vx + 18 * Math.sign(Math.sin(car.angle)) - car.x) * dt * 0.5;
  } else {
    const hy = state.city.horizontal.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
    car.y += (hy + 18 * Math.sign(-Math.cos(car.angle)) - car.y) * dt * 0.5;
  }
}

export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.driver === 'traffic') updateTrafficCar(car, state, dt);
  }
  // Cull traffic that drifted far from the player; the top-up in vehicles.js replaces it.
  state.cars = state.cars.filter((c) => {
    if (c.driver !== 'traffic') return true;
    const d = Math.hypot(c.x - state.player.x, c.y - state.player.y);
    return d < 1600;
  });
  // Keep the sidewalks populated near the player.
  if (state.peds.length < 24) {
    state.peds.push(createPedestrian(state.city, state.random));
  }
  state.peds = state.peds.filter((p) => Math.hypot(p.x - state.player.x, p.y - state.player.y) < 1500);
}

export function updatePedestrians(state, dt) {
  for (const p of state.peds) {
    p.walkPhase += dt * 6;
    if (p.fleeing > 0) {
      p.fleeing -= dt;
      const speed = 260;
      moveWithCollision(state.city, p, Math.cos(p.angle) * speed * dt, Math.sin(p.angle) * speed * dt, 10);
      continue;
    }
    // A lazy stroll: mostly straight, a new direction now and then.
    if (Math.random() < dt * 0.15) p.angle += (Math.random() - 0.5) * 1.6;
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    if (isBlocked(state.city, nx, ny, 10) || nx < 0 || ny < 0 || nx > WORLD.width || ny > WORLD.height) {
      p.angle += Math.PI / 2 + (Math.random() - 0.5);
    } else {
      p.x = nx;
      p.y = ny;
    }
  }
}
