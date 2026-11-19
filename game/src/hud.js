// The HUD: health and armour bars, cash, wanted stars, weapon and ammo, the
// mission objective, the clock and the district name — plus the live minimap,
// a small canvas view of the whole city with player, police, mission and taxi
// blips. Drawing only; the numbers come from the game state.
import { FIELD, FONT, PALETTE } from './config.js';
import { currentObjective } from './missions.js';
import { districtAt } from './world.js';

const MINI = { w: 220, h: 165, x: 0, y: 0 }; // x/y set per frame (bottom-right)

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
}

function text(ctx, value, x, y, size, color, align, bold) {
  ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(value, x, y);
}

/** The clock: game time starts at 17:40 and advances one game hour per 4 real minutes. */
export function gameClock(state) {
  const total = 17 * 60 + 40 + Math.floor(state.time / 4);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function drawHud(ctx, state) {
  const player = state.player;
  // Top-left: health, armour, cash.
  ctx.fillStyle = 'rgba(12, 18, 26, 0.55)';
  ctx.fillRect(14, 12, 250, 86);
  text(ctx, 'DARIO CRUZ', 24, 18, 13, PALETTE.muted, 'left', true);
  text(ctx, 'HP', 24, 40, 13, PALETTE.text, 'left', true);
  bar(ctx, 74, 40, 132, 12, player.health / 100, '#4fc46a', '#222');
  text(ctx, 'ARMOR', 24, 58, 13, PALETTE.text, 'left', true);
  bar(ctx, 74, 58, 132, 12, player.armor / 100, '#4fc3f7', '#222');
  text(ctx, `$${state.cash.toLocaleString('en-US')}`, 24, 76, 18, PALETTE.gold, 'left', true);
  // Top-right: wanted stars and the clock.
  const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
  text(ctx, stars, FIELD.width - 24, 14, 30, state.wanted > 0 ? '#ff5a4e' : '#5a6b7a', 'right', true);
  text(ctx, `${gameClock(state)}  ${districtAt(player.x, player.y)}`, FIELD.width - 24, 50, 15, PALETTE.text, 'right');
  // Top-centre: the current objective.
  const obj = currentObjective(state);
  const line = state.taxi
    ? (state.taxi.stage === 'pickup' ? 'TAXI: pick up the passenger' : 'TAXI: drive to the destination')
    : obj ? obj.label
    : state.wanted > 0 ? 'WANTED — lose the cops: stay out of sight until the heat dies down'
    : (state.missionIndex >= 6 ? 'Free roam — press T in a car for taxi fares' : 'Press E near the yellow marker to start the next job');
  ctx.fillStyle = 'rgba(12, 18, 26, 0.55)';
  const w = ctx.measureText(line).width + 28;
  ctx.fillRect((FIELD.width - w) / 2, 12, w, 30);
  text(ctx, line, FIELD.width / 2, 19, 16, PALETTE.gold, 'center', true);
  // Bottom-left: weapon, ammo, and the timed objective's clock.
  const weapon = player.weapon === 'pistol' ? 'PISTOL ∞' : `SMG ${player.ammo.smg}`;
  text(ctx, weapon, 24, FIELD.height - 58, 18, PALETTE.text, 'left', true);
  text(ctx, '1 Pistol   2 SMG   E Enter car   T Taxi   P Pause   M Mute', 24, FIELD.height - 32, 13, PALETTE.muted, 'left');
  if (obj && obj.timer !== undefined) {
    text(ctx, `⏱ ${Math.ceil(obj.timer)}s`, FIELD.width / 2, 48, 22, '#ff8a5a', 'center', true);
  }
  // A short-lived message line above the minimap.
  if (state.message && state.messageTimer > 0) {
    text(ctx, state.message, FIELD.width / 2, FIELD.height - 210, 17, PALETTE.text, 'center', true);
  }
  drawMinimap(ctx, state);
}

/** The minimap: the whole city shrunk, with roads, water, and blips. */
export function drawMinimap(ctx, state) {
  const city = state.city;
  const w = MINI.w;
  const h = MINI.h;
  const x0 = FIELD.width - w - 16;
  const y0 = FIELD.height - h - 16;
  const sx = w / 3200;
  const sy = h / 2400;
  ctx.fillStyle = 'rgba(12, 18, 26, 0.75)';
  ctx.fillRect(x0 - 4, y0 - 4, w + 8, h + 8);
  ctx.fillStyle = '#3d5a3a';
  ctx.fillRect(x0, y0, w, h);
  // Sea and canal.
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(x0, y0, 80 * sx, h);
  ctx.fillRect(x0, y0 + 1150 * sy, w, 100 * sy);
  // Roads.
  ctx.strokeStyle = '#555a60';
  ctx.lineWidth = 3;
  for (const vx of city.vertical) {
    ctx.beginPath();
    ctx.moveTo(x0 + vx * sx, y0);
    ctx.lineTo(x0 + vx * sx, y0 + h);
    ctx.stroke();
  }
  for (const hy of city.horizontal) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + hy * sy);
    ctx.lineTo(x0 + w, y0 + hy * sy);
    ctx.stroke();
  }
  function blip(x, y, color, r) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + x * sx, y0 + y * sy, r || 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const obj = currentObjective(state);
  if (obj) blip(obj.x, obj.y, '#f2c94c', 6);
  if (state.taxi) {
    const t = state.taxi.stage === 'pickup' ? state.taxi.pickup : state.taxi.dest;
    blip(t.x, t.y, '#4fc46a', 5);
  }
  for (const car of state.cars) {
    if (car.driver === 'police') blip(car.x, car.y, '#ff5a4e', 4);
    else if (car.driver === 'traffic') blip(car.x, car.y, '#9aa5b1', 2.5);
  }
  for (const cop of state.cops) blip(cop.x, cop.y, '#ff5a4e', 3);
  // The player: a white dot with a black ring, always on top.
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x0 + state.player.x * sx, y0 + state.player.y * sy, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.stroke();
}
