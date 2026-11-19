# SOLMAR HEAT

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Setiowibowo400/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Setiowibowo400/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

A complete, original top-down 2D open-world crime game in plain HTML5 canvas +
vanilla JavaScript — no libraries, no network, no build step. Open `game/index.html`
in desktop Chrome (or serve `game/` with `node serve.ts`) and play.

## The game

You are **Dario Cruz**, back in the fictional sun-soaked coastal city of **Solmar**.
Fixer **Mara Solis** has six jobs for you: steal a car, pull a getaway, make a
sunset delivery, clear the docks of the Vipers, steal the black Marlin, and hold
the plaza against the Sharks. Between jobs, take taxi fares, grab pickups, and
try not to collect five stars.

## What's in it

- **A living city** — procedural seeded grid: roads, blocks, varied buildings,
  Marina Beach, Palm Park, a canal crossed by one bridge, and named districts.
- **On foot and by car** — walk, sprint, aim with the mouse, shoot; steal parked
  and traffic cars (E), drive with acceleration, braking, steering and drift.
- **Traffic and pedestrians** — cars hold their lanes and turn at intersections;
  pedestrians stroll the sidewalks and flee gunfire.
- **Wanted system** — 1–5 stars; police cars chase and ram, foot cops shoot and
  arrest; heat decays when you stay out of sight.
- **Missions and story** — six jobs with objectives, map markers and dialogue,
  plus taxi fares as a side activity.
- **Combat** — pistol and SMG, enemy gang AI, health/armour, ammo, health and
  cash pickups.
- **HUD** — health, armour, cash, wanted stars, weapon/ammo, objective, clock,
  district name, and a live minimap with player, police, mission and taxi blips.
- **Menus and save** — title screen with story intro, pause, wasted/busted
  screens, and a localStorage save (cash, mission progress, position).
- **Sound** — WebAudio-synthesised only: engine hum, sirens, gunshots, pickups,
  and an ambient music loop. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Mouse | Aim |
| Click / Space | Shoot (hold for SMG) |
| E | Enter / exit car |
| Shift | Sprint |
| T | Start a taxi fare (while driving) |
| 1 / 2 | Pistol / SMG |
| P | Pause |
| M | Mute |

## Screenshots

Staged deterministically with `?shot=start|play|chase|mission&seed=1`:

1. `1-start.jpg` — title screen over the living city
2. `2-play.jpg` — driving through Downtown Solmar
3. `3-chase.jpg` — three-star police chase with the minimap
4. `4-mission.jpg` — the dockside shootout, mission 4

## Structure

`game/src/` is split by job: `config.js` (tuning), `world.js` (city),
`player.js` (on foot), `vehicles.js` (cars and driving), `traffic.js`
(traffic and pedestrians), `police.js` (wanted system), `combat.js`
(bullets, enemies, pickups), `missions.js` (story and taxi), `hud.js`
(HUD and minimap), `render.js` (drawing and screens), `audio.js`
(synthesised sound), `save.js` (localStorage), `input.js` (keyboard and
mouse), `shots.js` (staged screenshot scenes), `main.js` (boot and loop).

All names, characters, places and story are original. Nothing from any
commercial game is used.
