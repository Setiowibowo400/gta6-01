// Combat: bullets, enemy gang members, and pickups (health, armour, ammo, cash).
// Firing, hitting, dying and dropping are all here; the renderer only draws them.
import { WEAPONS } from './config.js';
import { isBlocked } from './world.js';
import { currentWeapon } from './player.js';
import { commitCrime } from './police.js';

export function createBullet(x, y, angle, speed, damage, from) {
  return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, from, life: 1.2 };
}

/** Fire the player's current weapon toward the aim angle. Returns true if a shot went off. */
export function firePlayerWeapon(state) {
  const player = state.player;
  if (player.cooldown > 0 || player.dead) return false;
  const weapon = currentWeapon(player);
  if (player.weapon === 'smg' && player.ammo.smg <= 0) {
    player.weapon = 'pistol';
    return false;
  }
  const fromX = player.inCar ? player.inCar.x : player.x;
  const fromY = player.inCar ? player.inCar.y : player.y;
  const spread = (Math.random() - 0.5) * weapon.spread * 2;
  const angle = player.angle + spread;
  state.bullets.push(createBullet(
    fromX + Math.cos(angle) * 24, fromY + Math.sin(angle) * 24,
    angle, weapon.bulletSpeed, weapon.damage, 'player',
  ));
  player.cooldown = weapon.cooldown;
  if (player.weapon === 'smg') player.ammo.smg -= 1;
  commitCrime(state, 'shoot');
  state.shotsFired = (state.shotsFired || 0) + 1;
  return true;
}

/** An enemy gang member: chases the player, shoots when close enough. */
export function spawnEnemy(state, x, y, gang) {
  const enemy = {
    x, y, angle: 0, speed: 150 + Math.random() * 40,
    health: 80, radius: 13, gang: gang || 'Sharks',
    shootCooldown: 0.6 + Math.random(), color: gang === 'Vipers' ? '#27ae60' : '#c0392b',
    dead: false,
  };
  state.enemies.push(enemy);
  return enemy;
}

export function spawnEnemySquad(state, x, y, count, gang) {
  for (let i = 0; i < count; i += 1) {
    spawnEnemy(state, x + (Math.random() - 0.5) * 160, y + (Math.random() - 0.5) * 160, gang);
  }
}

export function updateEnemies(state, dt) {
  const player = state.player;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    e.angle = Math.atan2(dy, dx);
    if (dist > 260) {
      e.x += (dx / dist) * e.speed * dt;
      e.y += (dy / dist) * e.speed * dt;
    } else if (dist < 120) {
      e.x -= (dx / dist) * e.speed * 0.5 * dt;
      e.y -= (dy / dist) * e.speed * 0.5 * dt;
    }
    e.shootCooldown -= dt;
    if (dist < 460 && e.shootCooldown <= 0) {
      e.shootCooldown = 0.8 + Math.random() * 0.9;
      const aim = e.angle + (Math.random() - 0.5) * 0.22;
      state.bullets.push(createBullet(e.x + Math.cos(aim) * 20, e.y + Math.sin(aim) * 20, aim, 700, 9, 'enemy'));
    }
  }
  state.enemies = state.enemies.filter((e) => !e.dead);
}

export function updateBullets(state, dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (isBlocked(state.city, b.x, b.y, 2)) { b.life = 0; state.sparks.push({ x: b.x, y: b.y, t: 0.15 }); continue; }
    const targets = b.from === 'player'
      ? [...state.enemies.filter((e) => !e.dead), ...state.cops]
      : [state.player];
    for (const t of targets) {
      const tr = t.radius || 13;
      if (Math.hypot(t.x - b.x, t.y - b.y) < tr + 3) {
        b.life = 0;
        if (t === state.player) {
          state.events.push({ type: 'playerHit', amount: b.damage });
        } else if (t.cop) {
          t.health -= b.damage;
          if (t.health <= 0) {
            t.dead = true;
            commitCrime(state, 'killCop');
            state.cash += 20;
            dropPickup(state, t.x, t.y);
          }
        } else {
          t.health -= b.damage;
          if (t.health <= 0) {
            t.dead = true;
            commitCrime(state, 'kill');
            state.cash += 50;
            state.kills = (state.kills || 0) + 1;
            dropPickup(state, t.x, t.y);
            if (state.mission) state.mission.kills = (state.mission.kills || 0) + 1;
          }
        }
        break;
      }
    }
    // Bullets can also hit the player's car or a traffic car and damage it.
    if (b.life > 0 && b.from === 'enemy') {
      for (const car of state.cars) {
        if (Math.abs(car.x - b.x) < 28 && Math.abs(car.y - b.y) < 16) {
          car.health -= b.damage;
          if (car.health <= 0) car.wrecked = true;
          b.life = 0;
          break;
        }
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  state.cops = state.cops.filter((c) => !c.dead);
}

export function createPickup(x, y, kind) {
  return { x, y, kind, t: 0 };
}

export function dropPickup(state, x, y) {
  const roll = Math.random();
  const kind = roll < 0.4 ? 'health' : roll < 0.7 ? 'ammo' : roll < 0.85 ? 'armor' : 'cash';
  state.pickups.push(createPickup(x, y, kind));
}

export function spawnPickups(state) {
  const spots = [
    [960, 960, 'health'], [2240, 640, 'armor'], [640, 1760, 'ammo'],
    [2560, 1760, 'health'], [1600, 320, 'cash'], [320, 1920, 'ammo'],
  ];
  for (const [x, y, kind] of spots) state.pickups.push(createPickup(x, y, kind));
}

export function updatePickups(state, dt) {
  const player = state.player;
  for (const p of state.pickups) p.t += dt;
  state.pickups = state.pickups.filter((p) => {
    if (Math.hypot(p.x - player.x, p.y - player.y) < 34) {
      state.events.push({ type: 'pickup', kind: p.kind });
      return false;
    }
    return true;
  });
}
