// Missions and the story: a chain of six jobs for fixer Mara Solis, plus a taxi
// side activity. Each mission is a list of small objectives (go there, get in a
// car, drive there, kill that many, survive this long) with dialogue lines.
// The engine only tracks objectives; the game loop calls updateMissions each step.
import { spawnEnemySquad } from './combat.js';
import { addWanted } from './police.js';
import { randomRoadPoint } from './world.js';

export const MISSION_DEFS = [
  {
    title: '1 — First Wheels',
    reward: 200,
    briefing: [
      'MARA: Dario. You want work in Solmar, you need wheels.',
      'MARA: There is a Sunrise parked by the marina road. Take it. Nobody will miss it.',
      'MARA: Bring it to my garage in Old Town. Drive careful — the paint is new.',
    ],
    objectives: [
      { type: 'enterCar', label: 'Steal the parked car by the marina', x: 640, y: 320, r: 90 },
      { type: 'driveTo', label: 'Drive to Mara\'s garage in Old Town', x: 960, y: 960, r: 80 },
    ],
  },
  {
    title: '2 — The Getaway',
    reward: 400,
    briefing: [
      'MARA: The Sharks hit my courier. I need you to pick him up — fast.',
      'MARA: Get to the docks, grab Javi, then lose the cops and reach the hideout.',
      'MARA: Two stars will be on you the moment you leave. Do not stop.',
    ],
    objectives: [
      { type: 'goto', label: 'Reach the docks to pick up Javi', x: 2240, y: 1920, r: 90 },
      { type: 'driveTo', label: 'Escape to the hideout — lose the heat on the way', x: 640, y: 1760, r: 90, wanted: 2 },
    ],
  },
  {
    title: '3 — Sunset Delivery',
    reward: 500,
    briefing: [
      'MARA: A package for the Harbor. It must be there before sunset.',
      'MARA: Seventy-five seconds. The bridge is the only way across the canal.',
      'MARA: Do not crash it. Do not open it. Do not be late.',
    ],
    objectives: [
      { type: 'goto', label: 'Pick up the package at Palm Park', x: 940, y: 500, r: 70 },
      { type: 'timedDrive', label: 'Deliver to the Harbor before the clock runs out', x: 2560, y: 1760, r: 90, time: 75 },
    ],
  },
  {
    title: '4 — Dockside Shootout',
    reward: 700,
    briefing: [
      'MARA: The Vipers moved on the docks. Five of them, armed.',
      'MARA: Clear them out. Take a gun from the stash by the park first.',
      'MARA: Come back breathing and the docks are ours.',
    ],
    objectives: [
      { type: 'goto', label: 'Reach the docks', x: 2240, y: 1920, r: 110, spawn: { count: 5, gang: 'Vipers' } },
      { type: 'kill', label: 'Clear out the Vipers', count: 5, x: 2240, y: 1920, r: 160 },
    ],
  },
  {
    title: '5 — The Heist Setup',
    reward: 900,
    briefing: [
      'MARA: The big one needs a Marlin — the black one parked at the hotel.',
      'MARA: Three guards watch it. Handle them, take the car, bring it to the garage.',
      'MARA: Quiet would be nice. Loud also works. Your call.',
    ],
    objectives: [
      { type: 'goto', label: 'Reach the hotel car park', x: 2240, y: 640, r: 110, spawn: { count: 3, gang: 'Sharks' } },
      { type: 'kill', label: 'Deal with the guards', count: 3, x: 2240, y: 640, r: 160 },
      { type: 'enterCar', label: 'Take the black Marlin', x: 2240, y: 640, r: 120 },
      { type: 'driveTo', label: 'Deliver the Marlin to Mara\'s garage', x: 960, y: 960, r: 80 },
    ],
  },
  {
    title: '6 — King of Solmar',
    reward: 1500,
    briefing: [
      'MARA: Tonight the Sharks come for the plaza. All of them.',
      'MARA: Hold the plaza. Eight of them. Then drive to the marina and watch the sun come up.',
      'MARA: Do this, Dario, and Solmar is yours.',
    ],
    objectives: [
      { type: 'goto', label: 'Reach the plaza in Downtown', x: 1920, y: 640, r: 120, spawn: { count: 8, gang: 'Sharks' } },
      { type: 'kill', label: 'Hold the plaza — take down the Sharks', count: 8, x: 1920, y: 640, r: 200 },
      { type: 'driveTo', label: 'Drive to the marina for the sunrise', x: 320, y: 1200, r: 100 },
    ],
  },
];

export function startMission(state, index) {
  const def = MISSION_DEFS[index];
  if (!def) return null;
  const mission = {
    index, def, step: 0, kills: 0, timer: 0,
    dialogue: [...def.briefing], dialogueShown: false,
    complete: false,
  };
  state.mission = mission;
  state.missionIndex = index;
  state.message = def.title;
  return mission;
}

export function currentObjective(state) {
  const m = state.mission;
  if (!m || m.complete) return null;
  return m.def.objectives[m.step] || null;
}

function objectivePosition(state, obj) {
  return { x: obj.x, y: obj.y };
}

/** Advance the active mission; returns 'complete' when the mission is finished. */
export function updateMissions(state, dt) {
  const m = state.mission;
  if (!m || m.complete) return null;
  const obj = currentObjective(state);
  if (!obj) return null;
  // Wanted heat for an escape objective applies the moment the objective begins,
  // not when it ends — the cops are already on you when you leave.
  if (obj.wanted && !obj.wantedApplied) {
    obj.wantedApplied = true;
    addWanted(state, obj.wanted);
  }
  const player = state.player;
  if (obj.timer === undefined && obj.time !== undefined) obj.timer = obj.time;
  if (obj.timer !== undefined) {
    obj.timer -= dt;
    if (obj.timer <= 0 && obj.type === 'timedDrive') {
      state.message = 'Too late — the delivery failed. Try again.';
      state.mission = null;
      return 'failed';
    }
  }
  let done = false;
  if (obj.type === 'goto' || obj.type === 'driveTo' || obj.type === 'timedDrive') {
    const d = Math.hypot(player.x - obj.x, player.y - obj.y);
    done = d < obj.r;
  } else if (obj.type === 'enterCar') {
    done = !!player.inCar;
  } else if (obj.type === 'kill') {
    done = (m.kills || 0) >= obj.count && state.enemies.length === 0;
  }
  if (!done) return null;
  // A goto that spawns enemies does so the moment the player arrives.
  if (obj.spawn && !obj.spawned) {
    obj.spawned = true;
    spawnEnemySquad(state, obj.x, obj.y, obj.spawn.count, obj.spawn.gang);
    addWanted(state, 1);
  }
  m.step += 1;
  m.kills = 0;
  if (m.step >= m.def.objectives.length) {
    m.complete = true;
    state.cash += m.def.reward;
    state.message = `${m.def.title} complete — $${m.def.reward} earned.`;
    state.missionsDone = (state.missionsDone || 0) + 1;
    state.mission = null;
    state.missionIndex = m.index + 1;
    if (state.missionIndex < MISSION_DEFS.length) {
      state.nextMissionReady = true;
    } else {
      state.storyComplete = true;
      state.message = 'KING OF SOLMAR — you finished the story. Free roam: keep earning.';
    }
    return 'complete';
  }
  state.message = `Objective: ${currentObjective(state).label}`;
  return 'advanced';
}

/** Start the next mission from the mission marker (press E near it, or auto-start). */
export function maybeStartNextMission(state) {
  if (state.mission || state.missionIndex >= MISSION_DEFS.length) return false;
  startMission(state, state.missionIndex);
  return true;
}

// ---- Taxi side activity -------------------------------------------------

/** Start a fare while driving: a passenger waits at a nearby road point. */
export function startTaxiFare(state) {
  if (!state.player.inCar || state.taxi) return false;
  const pickup = randomRoadPoint(state.city, state.random);
  const dest = randomRoadPoint(state.city, state.random);
  state.taxi = {
    stage: 'pickup', pickup, dest,
    fare: 60 + Math.floor(Math.hypot(dest.x - pickup.x, dest.y - pickup.y) / 12),
    timer: 90,
  };
  state.message = 'Taxi fare: pick up the passenger (green marker).';
  return true;
}

export function updateTaxi(state, dt) {
  const t = state.taxi;
  if (!t) return;
  t.timer -= dt;
  const player = state.player;
  const target = t.stage === 'pickup' ? t.pickup : t.dest;
  if (Math.hypot(player.x - target.x, player.y - target.y) < 70) {
    if (t.stage === 'pickup') {
      t.stage = 'dropoff';
      t.timer = 90;
      state.message = 'Passenger aboard — drive to the destination.';
    } else {
      state.cash += t.fare;
      state.message = `Fare complete — $${t.fare} earned. Press T for another.`;
      state.taxi = null;
    }
    return;
  }
  if (t.timer <= 0) {
    state.message = 'The passenger gave up waiting. Fare lost.';
    state.taxi = null;
  }
}
