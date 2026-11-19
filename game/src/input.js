// Keyboard and mouse input. Held keys give movement and driving; one-shot
// presses (confirm, pause, enter car, taxi, mute, weapon switch) are queued as
// bit flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice. The mouse position is tracked in screen pixels
// and converted to world coordinates by main.js (it knows the camera).
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_TAXI = 8;
export const ACTION_MUTE = 16;
export const ACTION_WEAPON1 = 32;
export const ACTION_WEAPON2 = 64;

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 640;
  let mouseY = 360;
  let mouseDown = false;
  let firing = false;

  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS[event.code]) held.add(event.code);
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.add(event.code);
    else if (event.code === 'Space' || event.code === 'Enter') {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyE') {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (event.code === 'KeyT') {
      if (!event.repeat) actions |= ACTION_TAXI;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code === 'Digit1') {
      if (!event.repeat) actions |= ACTION_WEAPON1;
    } else if (event.code === 'Digit2') {
      if (!event.repeat) actions |= ACTION_WEAPON2;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    firing = false;
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    firing = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
    firing = false;
  });

  function moveVector() {
    let x = 0;
    let y = 0;
    for (const code of held) {
      const v = MOVE_KEYS[code];
      if (v) { x += v[0]; y += v[1]; }
    }
    return { x, y };
  }

  return {
    /** Raw WASD/arrows vector (-1..1 each axis), for on-foot movement. */
    get moveX() { return moveVector().x; },
    get moveY() { return moveVector().y; },
    /** Aim point in screen pixels; main.js turns it into world coordinates. */
    get mouseX() { return mouseX; },
    get mouseY() { return mouseY; },
    /** True while the mouse button (or Space) is held: hold to fire an auto weapon. */
    get firing() { return firing || held.has('Space'); },
    get sprint() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    /** Driving: W/S throttle, A/D steering. */
    get throttle() {
      const up = held.has('KeyW') || held.has('ArrowUp');
      const down = held.has('KeyS') || held.has('ArrowDown');
      return (up ? 1 : 0) - (down ? 1 : 0);
    },
    get steer() {
      const left = held.has('KeyA') || held.has('ArrowLeft');
      const right = held.has('KeyD') || held.has('ArrowRight');
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    get handbrake() { return held.has('Space'); },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
