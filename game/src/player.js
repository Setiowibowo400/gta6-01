// The player on foot: movement, aiming, health and armour, weapons, and getting
// into and out of cars. Driving itself lives in vehicles.js; this file only
// decides when the player is on foot and what the feet do.
import { PLAYER, WEAPONS } from './config.js';
import { moveWithCollision } from './world.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, radius: PLAYER.radius,
    health: PLAYER.health, armor: PLAYER.armor,
    weapon: 'pistol', ammo: { pistol: Infinity, smg: 120 },
    cooldown: 0, invulnerable: 0, inCar: null, dead: false,
    sprinting: false, moving: false,
  };
}

/** Aim the player at a world point (the mouse), and move with WASD/arrows. */
export function updateOnFoot(player, city, input, dt) {
  const mx = input.moveX;
  const my = input.moveY;
  const moving = mx !== 0 || my !== 0;
  player.moving = moving;
  const speed = input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  if (moving) {
    const len = Math.hypot(mx, my) || 1;
    moveWithCollision(city, player, (mx / len) * speed * dt, (my / len) * speed * dt, player.radius);
  }
  player.angle = Math.atan2(input.aimY - player.y, input.aimX - player.x);
  if (player.cooldown > 0) player.cooldown -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;
}

/** Damage the player, armour absorbing first; returns true when the hit killed them. */
export function damagePlayer(player, amount) {
  if (player.invulnerable > 0 || player.dead) return false;
  let rest = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, rest);
    player.armor -= absorbed;
    rest -= absorbed;
  }
  player.health -= rest;
  player.invulnerable = 0.25;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    return true;
  }
  return false;
}

export function healPlayer(player, amount) {
  player.health = Math.min(PLAYER.maxHealth, player.health + amount);
}

export function addArmor(player, amount) {
  player.armor = Math.min(PLAYER.maxArmor, player.armor + amount);
}

/** The weapon's current stats (damage, cooldown, bullet speed). */
export function currentWeapon(player) {
  return WEAPONS[player.weapon];
}

/** Switch weapons with the 1 / 2 keys. */
export function switchWeapon(player, key) {
  if (key === 'pistol') player.weapon = 'pistol';
  else if (key === 'smg' && player.ammo.smg > 0) player.weapon = 'smg';
}

/** Step out of the car beside it, on foot again. */
export function exitCar(player, car) {
  player.inCar = null;
  const side = car.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * 40;
  player.y = car.y + Math.sin(side) * 40;
  player.angle = car.angle;
}

/** Climb into a car: the player rides at the car's position from now on. */
export function enterCar(player, car) {
  player.inCar = car;
  car.driver = 'player';
  player.x = car.x;
  player.y = car.y;
}
