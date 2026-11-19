// Drawing only: the city, the cars and people in it, the effects, and the menu
// screens. The camera follows the player; the world is drawn in world units and
// the HUD (hud.js) in screen units. Flat shapes with sun-soaked colours and
// soft shadows — no images, no network.
import { BEACH, CANAL, FIELD, FONT, GAME_NAME, PALETTE, WORLD } from './config.js';
import { PARK } from './world.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function drawCarShape(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Soft shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-26, -12, 52, 26);
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  ctx.beginPath();
  ctx.roundRect(-27, -13, 54, 26, 7);
  ctx.fill();
  // Cabin and windshield.
  ctx.fillStyle = 'rgba(20,30,40,0.85)';
  ctx.beginPath();
  ctx.roundRect(-8, -11, 20, 22, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,240,0.7)';
  ctx.fillRect(8, -10, 5, 20);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(25, -10, 3, 5);
  ctx.fillRect(25, 5, 3, 5);
  if (car.brakeLight) {
    ctx.fillStyle = '#ff2d2d';
    ctx.fillRect(-28, -10, 3, 5);
    ctx.fillRect(-28, 5, 3, 5);
  }
  if (car.driver === 'police') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    const flashing = Math.floor(time * 3) % 2 === 0;
    ctx.fillStyle = flashing ? '#ff2d2d' : '#2d7dff';
    ctx.beginPath();
    ctx.arc(-2, -8, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flashing ? '#2d7dff' : '#ff2d2d';
    ctx.beginPath();
    ctx.arc(-2, 8, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPersonShape(ctx, x, y, angle, color, withGun, time, walkPhase) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = walkPhase ? Math.sin(walkPhase) * 1.5 : 0;
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath();
  ctx.arc(4, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  if (withGun) {
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2 + bob * 0.2, 14, 4);
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, camX: 0, camY: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, bold) {
    ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function drawWorld(state) {
    const city = state.city;
    const camX = view.camX;
    const camY = view.camY;
    const vw = FIELD.width / view.scale;
    const vh = FIELD.height / view.scale;
    // Ground: grass everywhere, then the beach and sea on the west edge.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(camX - 40, camY - 40, vw + 80, vh + 80);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, camY - 40, BEACH.sandTo, vh + 80);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(0, camY - 40, BEACH.seaTo, vh + 80);
    // Animated wave lines on the water.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const wy = camY + ((state.time * 24 + i * 160) % (vh + 160)) - 80;
      ctx.beginPath();
      ctx.moveTo(6, wy);
      ctx.lineTo(74, wy);
      ctx.stroke();
    }
    // Canal and its bridge.
    ctx.fillStyle = PALETTE.canal;
    ctx.fillRect(camX - 40, CANAL.y0, vw + 80, CANAL.y1 - CANAL.y0);
    ctx.fillStyle = '#9a8a72';
    ctx.fillRect(CANAL.bridgeX0, CANAL.y0 - 8, CANAL.bridgeX1 - CANAL.bridgeX0, CANAL.y1 - CANAL.y0 + 16);
    // Park.
    ctx.fillStyle = PALETTE.parkGrass;
    ctx.fillRect(PARK.x, PARK.y, PARK.w, PARK.h);
    ctx.fillStyle = '#7ec8e3';
    ctx.beginPath();
    ctx.ellipse(PARK.x + PARK.w / 2, PARK.y + PARK.h / 2, 46, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    // Roads: asphalt with centre dashes, sidewalks around them.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const vx of city.vertical) ctx.fillRect(vx - city.roadW / 2 - 10, camY - 40, city.roadW + 20, vh + 80);
    for (const hy of city.horizontal) ctx.fillRect(camX - 40, hy - city.roadW / 2 - 10, vw + 80, city.roadW + 20);
    ctx.fillStyle = PALETTE.road;
    for (const vx of city.vertical) ctx.fillRect(vx - city.roadW / 2, camY - 40, city.roadW, vh + 80);
    for (const hy of city.horizontal) ctx.fillRect(camX - 40, hy - city.roadW / 2, vw + 80, city.roadW);
    ctx.strokeStyle = PALETTE.roadLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    for (const vx of city.vertical) {
      ctx.beginPath();
      ctx.moveTo(vx, camY - 40);
      ctx.lineTo(vx, camY + vh + 40);
      ctx.stroke();
    }
    for (const hy of city.horizontal) {
      ctx.beginPath();
      ctx.moveTo(camX - 40, hy);
      ctx.lineTo(camX + vw + 40, hy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Buildings with roofs, shade and windows.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 10);
      }
      ctx.fillStyle = 'rgba(30,40,60,0.55)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if ((i + j + b.windows) % 3 === 0) ctx.fillRect(b.x + 9 + i * 26, b.y + 9 + j * 26, 12, 12);
        }
      }
    }
    // Trees.
    for (const t of city.trees) {
      ctx.fillStyle = t.palm ? '#8a6b42' : '#5a4632';
      ctx.fillRect(t.x - 2, t.y - 2, 4, 8);
      ctx.fillStyle = t.palm ? '#3fae5a' : '#2f7a33';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 4, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMarker(x, y, color, time) {
    const pulse = 1 + Math.sin(time * 4) * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.lineTo(12, -22);
    ctx.lineTo(-12, -22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawEntities(state) {
    // Pickups: bobbing icons.
    for (const p of state.pickups) {
      const bob = Math.sin(p.t * 3) * 3;
      ctx.fillStyle = p.kind === 'health' ? '#ff5a5a' : p.kind === 'armor' ? '#4fc3f7' : p.kind === 'ammo' ? '#f2c94c' : '#4fc46a';
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.kind === 'health' ? '+' : p.kind === 'armor' ? 'A' : p.kind === 'ammo' ? '»' : '$', p.x, p.y + bob + 1);
    }
    // Pedestrians.
    for (const p of state.peds) {
      drawPersonShape(ctx, p.x, p.y, p.angle, p.color, false, state.time, p.walkPhase);
    }
    // Cars (parked, traffic, police, the player's).
    for (const car of state.cars) drawCarShape(ctx, car, state.time);
    // Enemies and foot cops.
    for (const e of state.enemies) {
      drawPersonShape(ctx, e.x, e.y, e.angle, e.color, true, state.time, 0);
      ctx.fillStyle = '#222';
      ctx.fillRect(e.x - 14, e.y - 24, 28, 5);
      ctx.fillStyle = '#ff5a4e';
      ctx.fillRect(e.x - 14, e.y - 24, 28 * Math.max(0, e.health / 80), 5);
    }
    for (const cop of state.cops) {
      drawPersonShape(ctx, cop.x, cop.y, cop.angle, '#1c2733', true, state.time, 0);
      ctx.fillStyle = '#2d7dff';
      ctx.beginPath();
      ctx.arc(cop.x, cop.y - 10, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // The player on foot (hidden while driving — the car is the player then).
    const player = state.player;
    if (!player.inCar && !player.dead) {
      const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
      if (!blink) drawPersonShape(ctx, player.x, player.y, player.angle, '#f2c94c', true, state.time, player.moving ? state.time * 10 : 0);
    }
    // Bullets as bright tracers.
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 3;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Impact sparks.
    for (const s of state.sparks) {
      ctx.fillStyle = `rgba(255, 220, 120, ${Math.max(0, s.t / 0.15)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mission and taxi markers, drawn above everything.
    const obj = state.mission && state.mission.def.objectives[state.mission.step];
    if (obj && obj.x !== undefined) drawMarker(obj.x, obj.y, '#f2c94c', state.time);
    if (state.taxi) {
      const t = state.taxi.stage === 'pickup' ? state.taxi.pickup : state.taxi.dest;
      drawMarker(t.x, t.y, '#4fc46a', state.time);
    }
    if (!state.mission && state.missionIndex < 6 && !state.hideMarker) {
      drawMarker(960, 960, '#f2c94c', state.time);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = 640;
    const h = 150 + lines.length * 30;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;
    ctx.fillStyle = 'rgba(16, 22, 32, 0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent || PALETTE.panelEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    text(title, FIELD.width / 2, y + 64, 44, PALETTE.text, 'center', true);
    lines.forEach((line, i) => text(line, FIELD.width / 2, y + 108 + i * 30, 19, PALETTE.muted, 'center'));
    text(prompt, FIELD.width / 2, y + h - 34, 20, PALETTE.gold, 'center', true);
  }

  function drawDialogue(state) {
    const m = state.mission;
    if (!m || m.dialogueShown || !m.dialogue.length) return;
    const w = 860;
    const h = 130 + m.dialogue.length * 28;
    const x = (FIELD.width - w) / 2;
    const y = FIELD.height - h - 200;
    ctx.fillStyle = 'rgba(16, 22, 32, 0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    text(m.def.title, x + 24, y + 36, 20, PALETTE.gold, 'left', true);
    m.dialogue.forEach((line, i) => text(line, x + 24, y + 70 + i * 28, 17, PALETTE.text, 'left'));
    text('Press Enter or click to start the job', x + 24, y + h - 30, 15, PALETTE.muted, 'left');
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, 300, FIELD.width / 2, FIELD.height / 2, 800);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,10,20,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  /** Paint one frame: the world from the camera, then the HUD or a menu screen. */
  function draw(state, screen) {
    const player = state.player;
    view.camX = Math.max(0, Math.min(WORLD.width - FIELD.width / view.scale, player.x - FIELD.width / view.scale / 2));
    view.camY = Math.max(0, Math.min(WORLD.height - FIELD.height / view.scale, player.y - FIELD.height / view.scale / 2));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x - view.camX * view.scale, view.y - view.camY * view.scale);
    drawWorld(state);
    drawEntities(state);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawVignette();
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(10, 14, 22, 0.55)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      text(GAME_NAME, FIELD.width / 2, 140, 84, '#f2c94c', 'center', true);
      text('A sun-soaked open-world crime story in the city of Solmar', FIELD.width / 2, 182, 22, PALETTE.text, 'center');
      drawPanel('Dario Cruz is back in Solmar', [
        'Six jobs for fixer Mara Solis. Steal cars, outrun the cops,',
        'clear the docks, and take the plaza — then the city is yours.',
        'WASD drive & walk · Mouse aim · Click / Space shoot · E enter car',
        'T taxi fares · 1/2 weapons · P pause · M mute',
        state.hasSave ? 'A saved game is waiting: press C to continue it.' : '',
      ].filter(Boolean), 'Press Space or click to start');
      return;
    }
    drawHud(ctx, state);
    drawDialogue(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', [
        `Cash $${state.cash.toLocaleString('en-US')} · Jobs done ${state.missionsDone || 0} of 6`,
        'Your progress saves automatically when a job ends.',
        'M mute · C continue a saved game · N new game',
      ], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      const busted = state.busted;
      drawPanel(busted ? 'BUSTED' : 'WASTED', [
        busted ? 'The Solmar police finally caught up with Dario.' : 'Dario went down in the streets of Solmar.',
        `Cash $${state.cash.toLocaleString('en-US')} · Jobs done ${state.missionsDone || 0} of 6 · Kills ${state.kills || 0}`,
        'The city keeps your cash. The story keeps your place.',
      ], 'Press Space or click to try again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    /** The camera's top-left corner in world units, for mouse-to-world aiming. */
    get camera() { return { x: view.camX, y: view.camY, scale: view.scale, ox: view.x, oy: view.y }; },
  };
}
