// Nightshade: The Quiet Heist — boot and the one loop.
// ?shot=cover|alarm|hide|vault stages that scene instead of running the
// game, paints it twice and sets window.__shotReady for a screenshot.
// Otherwise the game runs: a title screen with level select, then play
// in fixed 1/60 s steps, with pause, caught, level-complete and
// game-complete screens. Progress (unlocked heists, best scores) is
// saved in localStorage.

import { LEVELS } from './levels.js';
import {
  WORLD_CAUGHT,
  WORLD_DONE,
  createWorld,
  resetWorld,
  scoreBreakdown,
  stepWorld,
} from './world.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';
import {
  HUD_H,
  SAVE_KEY,
  SCREEN_CAUGHT,
  SCREEN_GAME_DONE,
  SCREEN_LEVEL_DONE,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  STEP,
  TILE,
} from './config.js';
import * as sfx from './audio.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.best) && typeof parsed.unlocked === 'number') return parsed;
    }
  } catch {
    // Storage can be off: progress then lasts this visit only.
  }
  return { unlocked: 1, best: [0, 0, 0, 0, 0], totalBest: 0 };
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Ignore: the game still plays without saved progress.
  }
}

// Screenshot mode: stage the scene, paint it twice, signal readiness.
if (shot) {
  const scene = stageShot(shot);
  let painted = 0;
  (function paint() {
    renderer.draw(scene.world, scene.screen, scene.ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  })();
} else {
  runGame();
}

function runGame() {
  const input = createInput(canvas);
  const save = loadSave();
  let screen = SCREEN_TITLE;
  let selected = 0;
  let levelIndex = 0;
  let world = createWorld(LEVELS[0], 0);
  let runTotal = 0;
  let breakdown = null;
  let accumulator = 0;
  let last = performance.now();

  // The tile under the mouse cursor, for aiming a coin with Q.
  function mouseTile() {
    const view = renderer.view();
    const x = (input.state.mouseX - view.ox) / (view.scale * TILE);
    const y = (input.state.mouseY - view.oy - HUD_H * view.scale) / (view.scale * TILE);
    return { x, y };
  }

  function startLevel(index, keepTotal) {
    levelIndex = index;
    world = createWorld(LEVELS[index], index);
    if (!keepTotal) runTotal = 0;
    breakdown = null;
    screen = SCREEN_PLAY;
  }

  function currentLoot() {
    const loot = world.treasures.filter((t) => t.taken).length * 100;
    return loot + (world.gem.taken ? 300 : 0);
  }

  function ui() {
    return {
      score: runTotal + currentLoot(),
      breakdown,
      levels: LEVELS,
      selected,
      unlocked: save.unlocked,
      best: save.best,
      totalBest: save.totalBest,
      totalScore: runTotal,
    };
  }

  function playEventSounds(events) {
    for (const e of events) {
      if (e.kind === 'player-step') sfx.playPlayerStep(world.player.sneak);
      else if (e.kind === 'guard-step') sfx.playGuardStep(e.x, e.y, world.player.x, world.player.y);
      else if (e.kind === 'pickup') sfx.playPickup();
      else if (e.kind === 'gem') sfx.playGem();
      else if (e.kind === 'alarm') sfx.playAlarm();
      else if (e.kind === 'caught') sfx.playCaught();
      else if (e.kind === 'coin-throw') sfx.playCoinThrow();
      else if (e.kind === 'coin-land') sfx.playCoinLand();
      else if (e.kind === 'smoke') sfx.playSmoke();
      else if (e.kind === 'win') sfx.playWin();
    }
  }

  function finishLevel() {
    breakdown = scoreBreakdown(world);
    runTotal += breakdown.total;
    if (breakdown.total > (save.best[levelIndex] || 0)) save.best[levelIndex] = breakdown.total;
    if (levelIndex + 1 < LEVELS.length) {
      save.unlocked = Math.max(save.unlocked, levelIndex + 2);
      writeSave(save);
      screen = SCREEN_LEVEL_DONE;
    } else {
      if (runTotal > save.totalBest) save.totalBest = runTotal;
      writeSave(save);
      screen = SCREEN_GAME_DONE;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;
    input.state.view = renderer.view();

    if (input.wasPressed('KeyM')) sfx.setMuted(!sfx.isMuted());

    if (screen === SCREEN_TITLE) {
      if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) selected = (selected + LEVELS.length - 1) % LEVELS.length;
      if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) selected = (selected + 1) % LEVELS.length;
      if (input.wasPressed('Enter') && selected < save.unlocked) {
        sfx.playClick();
        startLevel(selected);
      }
    } else if (screen === SCREEN_PLAY) {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
        screen = SCREEN_PAUSED;
      } else if (input.wasPressed('KeyR')) {
        resetWorld(world);
      } else {
        const mv = input.moveVector();
        const coinTarget = input.takeClickTile();
        let coin = coinTarget;
        if (!coin && input.wasPressed('KeyQ')) {
          if (input.state.mouseSeen) {
            coin = mouseTile();
          } else {
            coin = {
              x: world.player.x + Math.cos(world.player.facing) * 4,
              y: world.player.y + Math.sin(world.player.facing) * 4,
            };
          }
        }
        const stepInput = {
          mx: mv.x,
          my: mv.y,
          sneak: input.sneak(),
          run: input.run(),
          coin,
          smoke: input.wasPressed('KeyE'),
        };
        accumulator += dt;
        while (accumulator >= STEP) {
          const events = stepWorld(world, stepInput, STEP);
          playEventSounds(events);
          stepInput.coin = null;
          stepInput.smoke = false;
          accumulator -= STEP;
          if (world.status === WORLD_CAUGHT) {
            screen = SCREEN_CAUGHT;
            break;
          }
          if (world.status === WORLD_DONE) {
            finishLevel();
            break;
          }
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) screen = SCREEN_PLAY;
      else if (input.wasPressed('KeyR')) {
        resetWorld(world);
        screen = SCREEN_PLAY;
      } else if (input.wasPressed('KeyQ')) screen = SCREEN_TITLE;
    } else if (screen === SCREEN_CAUGHT) {
      if (input.wasPressed('KeyR') || input.wasPressed('Enter')) {
        resetWorld(world);
        screen = SCREEN_PLAY;
      } else if (input.wasPressed('KeyQ')) screen = SCREEN_TITLE;
    } else if (screen === SCREEN_LEVEL_DONE) {
      if (input.wasPressed('Enter')) {
        startLevel(levelIndex + 1, true);
      } else if (input.wasPressed('KeyQ')) screen = SCREEN_TITLE;
    } else if (screen === SCREEN_GAME_DONE) {
      if (input.wasPressed('Enter') || input.wasPressed('KeyQ')) screen = SCREEN_TITLE;
    }

    renderer.draw(world, screen, ui());
    input.clearPressed();
  }

  renderer.resize();
  requestAnimationFrame(frame);
}
