// The city of Solmar: a procedural, seeded grid city. Roads on a 320-unit grid,
// blocks filled with varied buildings, a beach and sea on the west edge, a park,
// a canal crossed by one bridge, and named districts. Deterministic from a seed:
// the same seed always builds the same city. No drawing here — only data and
// collision queries the simulation and the renderer both use.
import { BEACH, CANAL, WORLD } from './config.js';

export const PARK = { x: 700, y: 380, w: 480, h: 240 };

const ROOF_COLORS = ['#6b5a4e', '#7a6a58', '#5d6b7a', '#8a6f52', '#4a5a70', '#715f63'];

/** Vertical road centre-lines, and horizontal ones. */
export function roadLines() {
  const vertical = [];
  const horizontal = [];
  for (let x = WORLD.roadStep; x < WORLD.width; x += WORLD.roadStep) vertical.push(x);
  for (let y = WORLD.roadStep; y < WORLD.height; y += WORLD.roadStep) horizontal.push(y);
  return { vertical, horizontal };
}

export function createCity(random) {
  const { vertical, horizontal } = roadLines();
  const buildings = [];
  const trees = [];
  const roadW = WORLD.roadWidth;
  const half = roadW / 2;

  // One building (or a small row) per block, skipping the park block and the canal band.
  for (let col = 0; col < vertical.length; col += 1) {
    for (let row = 0; row < horizontal.length; row += 1) {
      const x0 = vertical[col] + half + 14;
      const y0 = horizontal[row] + half + 14;
      const x1 = (col + 1 < vertical.length ? vertical[col + 1] : WORLD.width) - half - 14;
      const y1 = (row + 1 < horizontal.length ? horizontal[row + 1] : WORLD.height) - half - 14;
      if (x1 - x0 < 60 || y1 - y0 < 60) continue;
      // The park block: trees, paths and a pond instead of buildings.
      if (x0 >= PARK.x - 20 && y0 >= PARK.y - 20 && x1 <= PARK.x + PARK.w + 20 && y1 <= PARK.y + PARK.h + 20) {
        for (let t = 0; t < 26; t += 1) {
          trees.push({ x: PARK.x + 30 + random() * (PARK.w - 60), y: PARK.y + 30 + random() * (PARK.h - 60), r: 10 + random() * 8 });
        }
        continue;
      }
      // The canal band: no buildings where the water runs.
      if (y0 < CANAL.y1 && y1 > CANAL.y0) continue;
      const downtown = x0 > 1500 && y0 < 1100;
      const count = 1 + Math.floor(random() * (downtown ? 2 : 3));
      for (let b = 0; b < count; b += 1) {
        const bw = 60 + random() * Math.max(20, (x1 - x0) / count - 70);
        const bh = 60 + random() * Math.max(20, (y1 - y0) - 70);
        const bx = x0 + (b * (x1 - x0)) / count + random() * 10;
        const by = y0 + random() * Math.max(0, (y1 - y0) - bh - 10);
        if (bx + bw > x1 || by + bh > y1) continue;
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          tall: downtown && random() < 0.6,
          color: ROOF_COLORS[Math.floor(random() * ROOF_COLORS.length)],
          windows: Math.floor(random() * 3),
        });
      }
    }
  }
  // Palm trees along the beach promenade and a few in the park's corners.
  for (let y = 120; y < WORLD.height; y += 130) {
    trees.push({ x: 215 + random() * 30, y, r: 9 + random() * 5, palm: true });
  }
  return { vertical, horizontal, buildings, trees, roadW };
}

/** True when the point is on a road (within the asphalt, not the sidewalk). */
export function isOnRoad(city, x, y) {
  const half = city.roadW / 2;
  for (const vx of city.vertical) if (Math.abs(x - vx) <= half) return true;
  for (const hy of city.horizontal) if (Math.abs(y - hy) <= half) return true;
  return false;
}

/** True when the point is in the sea or the canal (off the bridge). */
export function isWater(x, y) {
  if (x < BEACH.seaTo) return true;
  if (y > CANAL.y0 && y < CANAL.y1 && !(x > CANAL.bridgeX0 && x < CANAL.bridgeX1)) return true;
  return false;
}

/** True when a circle at (x, y) with radius r is blocked: building, water, or off the map. */
export function isBlocked(city, x, y, r) {
  if (x < r + 4 || y < r + 4 || x > WORLD.width - r - 4 || y > WORLD.height - r - 4) return true;
  if (isWater(x, y)) return true;
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

/** Slide a circle along obstacles: try full move, then x-only, then y-only. */
export function moveWithCollision(city, pos, dx, dy, r) {
  if (!isBlocked(city, pos.x + dx, pos.y + dy, r)) { pos.x += dx; pos.y += dy; return; }
  if (!isBlocked(city, pos.x + dx, pos.y, r)) { pos.x += dx; return; }
  if (!isBlocked(city, pos.x, pos.y + dy, r)) { pos.y += dy; }
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(city, random) {
  if (random() < 0.5) {
    const vx = city.vertical[Math.floor(random() * city.vertical.length)];
    return { x: vx + (random() < 0.5 ? -18 : 18), y: 100 + random() * (WORLD.height - 200) };
  }
  const hy = city.horizontal[Math.floor(random() * city.horizontal.length)];
  return { x: 260 + random() * (WORLD.width - 520), y: hy + (random() < 0.5 ? -18 : 18) };
}

/** A random point on a sidewalk (just off a road), for pedestrians and pickups. */
export function randomSidewalkPoint(city, random) {
  const p = randomRoadPoint(city, random);
  p.x += (random() < 0.5 ? -1 : 1) * (city.roadW / 2 + 12 + random() * 10);
  return p;
}

/** The district name at a point, for the HUD location line. */
export function districtAt(x, y) {
  if (x < 420) return 'Marina Beach';
  if (x >= 700 && x <= 1180 && y >= 380 && y <= 620) return 'Palm Park';
  if (y >= CANAL.y1) return 'Harbor South';
  if (x > 1500 && y < 1100) return 'Downtown Solmar';
  return 'Old Town';
}
