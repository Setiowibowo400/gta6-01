// Saving and loading: cash, mission progress, position, health and armour in
// localStorage. Nothing sensitive, nothing from any wallet — just the game.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone || 0,
      x: state.player.x,
      y: state.player.y,
      health: state.player.health,
      armor: state.player.armor,
      ammoSmg: state.player.ammo.smg,
      kills: state.kills || 0,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage off: nothing to clear.
  }
}
