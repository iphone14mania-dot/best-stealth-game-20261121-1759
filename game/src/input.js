// Nightshade: The Quiet Heist — keyboard and mouse input.
// WASD and the arrow keys move; Shift sneaks, and holding the run key
// (Space) runs. Q throws a coin toward the mouse (or ahead of the
// player when the mouse never moved), E puffs smoke, M mutes, P or
// Escape pauses, Enter confirms, R restarts the level. A mouse click
// on the playfield throws a coin at that tile. Every action has a key,
// so the game is fully playable without a mouse.

import { HUD_H, TILE } from './config.js';

const KEY_UP = new Set(['KeyW', 'ArrowUp']);
const KEY_DOWN = new Set(['KeyS', 'ArrowDown']);
const KEY_LEFT = new Set(['KeyA', 'ArrowLeft']);
const KEY_RIGHT = new Set(['KeyD', 'ArrowRight']);

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const state = {
    mouseX: 0,
    mouseY: 0,
    mouseSeen: false,
    clickTile: null,
    // The canvas's letterbox: set by the renderer each frame so a click
    // lands on the tile under the cursor.
    view: { scale: 1, ox: 0, oy: 0 },
  };

  function onKeyDown(e) {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
  }
  function onKeyUp(e) {
    held.delete(e.code);
  }
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = e.clientX - rect.left;
    state.mouseY = e.clientY - rect.top;
    state.mouseSeen = true;
  }
  function onClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { scale, ox, oy } = state.view;
    const tileX = Math.floor((x - ox) / (scale * TILE));
    const tileY = Math.floor((y - oy - HUD_H * scale) / (scale * TILE));
    state.clickTile = { x: tileX + 0.5, y: tileY + 0.5 };
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('click', onClick);

  return {
    state,
    // The movement vector for this frame, from the held keys.
    moveVector() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        if (KEY_LEFT.has(code)) x -= 1;
        if (KEY_RIGHT.has(code)) x += 1;
        if (KEY_UP.has(code)) y -= 1;
        if (KEY_DOWN.has(code)) y += 1;
      }
      return { x, y };
    },
    sneak() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    run() {
      return held.has('Space');
    },
    // True once for a key pressed since the last frame; the loop clears
    // the set after reading it.
    wasPressed(code) {
      return pressed.has(code);
    },
    clearPressed() {
      pressed.clear();
    },
    takeClickTile() {
      const tile = state.clickTile;
      state.clickTile = null;
      return tile;
    },
  };
}
