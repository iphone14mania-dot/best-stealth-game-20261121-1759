// Nightshade: The Quiet Heist — the staged scenes behind ?shot=cover|alarm|hide|vault.
// Each scene is a real game state: a fresh world of one level, its
// player and guards placed on legal tiles with legal states, drawn by
// the same renderer the game uses. Nothing is faked or composited —
// the frame is what the game really looks like at that moment.

import { LEVELS } from './levels.js';
import { createWorld } from './world.js';
import { GUARD_ALARM, GUARD_SUSPICIOUS } from './guards.js';

function place(world, px, py, stance) {
  world.player.x = px;
  world.player.y = py;
  world.player.stance = stance || 'walk';
  world.player.sneak = stance === 'sneak';
  world.player.run = stance === 'run';
}

function poseGuard(world, index, x, y, facing, state) {
  const g = world.guards[index];
  g.x = x;
  g.y = y;
  g.facing = facing;
  if (state) g.state = state;
}

// The cover: level 1 mid-heist — the player sneaking through the
// shadowed middle hall, two patrol cones sweeping, the gem and the
// exit both in frame.
function stageCover() {
  const world = createWorld(LEVELS[0], 0);
  place(world, 20.5, 10.5, 'sneak');
  world.player.facing = -Math.PI / 2;
  poseGuard(world, 0, 12.5, 7.5, 0);
  poseGuard(world, 1, 28.5, 11.5, Math.PI);
  poseGuard(world, 2, 20.5, 4.5, Math.PI / 2);
  world.meter = 0.12;
  return world;
}

// The near miss: level 2, the meter almost full, one guard charging
// with a red cone and another turning to look.
function stageAlarm() {
  const world = createWorld(LEVELS[1], 1);
  place(world, 20.5, 8.5, 'run');
  world.player.facing = Math.PI;
  world.meter = 0.9;
  world.alarmed = true;
  world.ghost = false;
  world.everSeen = true;
  poseGuard(world, 0, 10.5, 2.5, Math.PI / 2, GUARD_SUSPICIOUS);
  world.guards[0].lastSeen = { x: 20.5, y: 8.5 };
  poseGuard(world, 1, 25.5, 8.5, Math.PI, GUARD_ALARM);
  world.guards[1].lastSeen = { x: 20.5, y: 8.5 };
  poseGuard(world, 2, 30.5, 12.5, 0);
  poseGuard(world, 3, 8.5, 18.5, 0);
  world.treasures[0].taken = true;
  world.time = 73;
  return world;
}

// Hiding: level 3, the player tucked in a bush while a guard's cone
// sweeps past a tile away.
function stageHide() {
  const world = createWorld(LEVELS[2], 2);
  place(world, 17.5, 4.5, 'sneak');
  world.player.facing = Math.PI / 2;
  poseGuard(world, 0, 8.5, 2.5, 0);
  poseGuard(world, 1, 30.5, 8.5, Math.PI);
  poseGuard(world, 2, 20.5, 6.5, -Math.PI / 2);
  poseGuard(world, 3, 10.5, 14.5, 0);
  poseGuard(world, 4, 36.5, 11.5, Math.PI);
  world.meter = 0.1;
  world.time = 121;
  return world;
}

// The Grand Vault: level 5, seven guards, cones everywhere, the
// player closing on the gem with the meter climbing.
function stageVault() {
  const world = createWorld(LEVELS[4], 4);
  place(world, 20.5, 10.5, 'sneak');
  world.player.facing = Math.PI / 2;
  poseGuard(world, 0, 8.5, 2.5, 0);
  poseGuard(world, 1, 30.5, 8.5, Math.PI);
  poseGuard(world, 2, 12.5, 5.5, Math.PI / 2);
  poseGuard(world, 3, 8.5, 12.5, 0);
  poseGuard(world, 4, 30.5, 18.5, Math.PI);
  poseGuard(world, 5, 10.5, 15.5, -Math.PI / 2);
  poseGuard(world, 6, 22.5, 15.5, -Math.PI / 2);
  world.meter = 0.3;
  world.treasures[0].taken = true;
  world.treasures[1].taken = true;
  world.time = 187;
  return world;
}

// Set up the named scene and return the world, the screen and the
// HUD values to draw with it. Any other name is the cover.
export function stageShot(name) {
  let world;
  if (name === 'alarm') world = stageAlarm();
  else if (name === 'hide') world = stageHide();
  else if (name === 'vault') world = stageVault();
  else world = stageCover();
  return {
    world,
    screen: 'play',
    ui: { score: 0, breakdown: null, levels: LEVELS, selected: 0, unlocked: 5, best: [], totalBest: 0, totalScore: 0 },
  };
}
