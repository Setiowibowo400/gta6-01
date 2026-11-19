// Cars: creation, arcade driving physics (acceleration, braking, steering with
// speed, drift on handbrake), and spawning parked and traffic cars. A car is
// just data — the renderer draws it, traffic.js steers the ones nobody drives.
import { CAR, WORLD } from './config.js';
import { isBlocked, randomRoadPoint } from './world.js';

const CAR_COLORS = ['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#2c3e50', '#e67e22', '#8e44ad', '#16a085', '#7f8c8d', '#d35400'];
const CAR_NAMES = ['Comet', 'Sunrise', 'Palmera', 'Dune', 'Marlin', 'Cortez', 'Breeze', 'Torero'];

let nextCarId = 1;

export function createCar(x, y, angle, kind, random) {
  const color = CAR_COLORS[Math.floor(random() * CAR_COLORS.length)];
  const name = CAR_NAMES[Math.floor(random() * CAR_NAMES.length)];
  return {
    id: nextCarId, x, y, angle, speed: 0,
    color, name, kind: kind || 'sedan',
    driver: null, // 'player' | 'traffic' | 'police' | null (parked)
    health: 100, wrecked: false, brakeLight: false,
    ai: null, // traffic brain, set by traffic.js
  };
}

/** Parked cars along the roads, waiting to be stolen. */
export function spawnParkedCars(city, random, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(city, random);
    const onVertical = Math.abs(p.x - Math.round(p.x / 320) * 320) < 40;
    const angle = onVertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
    // Park on the roadside, just off the driving lane.
    const px = onVertical ? p.x + (random() < 0.5 ? -30 : 30) : p.x;
    const py = onVertical ? p.y : p.y + (random() < 0.5 ? -30 : 30);
    if (isBlocked(city, px, py, 20)) continue;
    cars.push(createCar(px, py, angle, 'sedan', random));
  }
  return cars;
}

/** One traffic car on a road, already moving in its lane. */
export function spawnTrafficCar(city, random, near) {
  let p = randomRoadPoint(city, random);
  if (near) {
    for (let tries = 0; tries < 12; tries += 1) {
      const q = randomRoadPoint(city, random);
      const d = Math.hypot(q.x - near.x, q.y - near.y);
      if (d > 350 && d < 900) { p = q; break; }
    }
  }
  const vertical = Math.abs(p.x - Math.round(p.x / 320) * 320) < 40;
  const angle = vertical ? (p.y % 2 < 1 ? Math.PI / 2 : -Math.PI / 2) : (p.x % 2 < 1 ? 0 : Math.PI);
  const car = createCar(p.x, p.y, angle, 'sedan', random);
  car.driver = 'traffic';
  car.speed = 120 + random() * 70;
  car.ai = { axis: vertical ? 'v' : 'h', dir: Math.sign(Math.cos(angle)) || 1, wait: 0 };
  return car;
}

/**
 * Drive a car for one step. throttle -1..1 (reverse..forward), steer -1..1,
 * handbrake true to drift. Returns nothing; the car moves and turns in place.
 */
export function updateCarPhysics(car, city, throttle, steer, handbrake, dt) {
  if (car.wrecked) { car.speed *= (1 - 3 * dt); return; }
  const accel = throttle > 0 ? CAR.accel : CAR.reverseAccel;
  car.speed += throttle * accel * dt;
  // Rolling drag and braking when no throttle.
  car.speed -= car.speed * 0.55 * dt;
  if (throttle === 0) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 260 * dt);
  const max = car.speed >= 0 ? CAR.maxSpeed : CAR.maxReverse;
  car.speed = Math.max(-max, Math.min(max, car.speed));
  const grip = handbrake ? CAR.driftGrip : CAR.grip;
  const turn = steer * CAR.steer * Math.min(1, Math.abs(car.speed) / 160) * Math.sign(car.speed || 1);
  car.angle += turn * grip * dt * 0.55;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!isBlocked(city, nx, ny, 20)) {
    car.x = nx;
    car.y = ny;
  } else {
    // A bump: lose speed and stop dead against the wall.
    car.speed *= -0.25;
  }
  car.brakeLight = throttle < 0 || handbrake;
}

/** The nearest car to a point within maxDist, or null. */
export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** Keep the car count near the target by spawning traffic near the player. */
export function topUpTraffic(state, random) {
  const traffic = state.cars.filter((c) => c.driver === 'traffic');
  if (traffic.length >= 14) return;
  const car = spawnTrafficCar(state.city, random, { x: state.player.x, y: state.player.y });
  state.cars.push(car);
}
