// Nightshade: The Quiet Heist — the world: one level's state and rules.
// This file knows nothing about the screen or sound: it takes an input
// each step, moves the player and the guards, fills or drains the
// detection meter, and reports what happened as events the game loop
// turns into sounds and screens. A Node test can drive it headlessly.

import {
  ALARM_AT,
  DETECT_DRAIN,
  DETECT_FILL,
  SCORE_GEM,
  SCORE_GHOST,
  SCORE_TIME_PER_SEC,
  SCORE_TREASURE,
  SUSPICIOUS_AT,
} from './config.js';
import { parseMap } from './levels.js';
import { createGuard, updateGuard, GUARD_ALARM } from './guards.js';
import { coinDrawPos, createPlayer, movePlayer, puffSmoke, throwCoin, updateCoin } from './player.js';
import { exposureAt } from './vision.js';

export const WORLD_PLAYING = 'playing';
export const WORLD_CAUGHT = 'caught';
export const WORLD_DONE = 'done';

export function createWorld(levelDef, levelIndex) {
  const parsed = parseMap(levelDef);
  const world = {
    levelIndex,
    level: levelDef,
    tiles: parsed.tiles,
    player: createPlayer(parsed.player, levelDef.coins, levelDef.smoke),
    guards: levelDef.guards.map(createGuard),
    gem: { ...parsed.gem, taken: false },
    exit: parsed.exit,
    treasures: parsed.treasures,
    smoke: [],
    meter: 0,
    alarmed: false,
    ghost: true,
    everSeen: false,
    time: 0,
    status: WORLD_PLAYING,
    score: 0,
    events: [],
    noise: [],
  };
  return world;
}

// Fresh state for the same level (restart after being caught).
export function resetWorld(world) {
  const fresh = createWorld(world.level, world.levelIndex);
  Object.assign(world, fresh);
}

// One fixed step. `input` is { mx, my, sneak, run, coin: {x,y}|null, smoke: bool }.
// Returns the world's events for this step (sounds and screens read them).
export function stepWorld(world, input, dt) {
  world.events.length = 0;
  if (world.status !== WORLD_PLAYING) return world.events;
  world.time += dt;
  world.noise.length = 0;

  // The player moves first; a footstep is a noise guards can hear.
  const stepNoise = movePlayer(world.tiles, world.player, input.mx, input.my, input.sneak, input.run, dt);
  if (stepNoise) world.noise.push(stepNoise);
  if (world.player.stepped) world.events.push({ kind: 'player-step' });

  // Gadgets.
  if (input.coin) {
    if (throwCoin(world.player, input.coin.x, input.coin.y)) world.events.push({ kind: 'coin-throw' });
  }
  const landed = updateCoin(world.player, dt);
  if (landed) {
    world.noise.push(landed);
    world.events.push({ kind: 'coin-land', x: landed.x, y: landed.y });
  }
  if (input.smoke) {
    const cloud = puffSmoke(world.player);
    if (cloud) {
      world.smoke.push(cloud);
      world.events.push({ kind: 'smoke' });
    }
  }
  for (let i = world.smoke.length - 1; i >= 0; i -= 1) {
    world.smoke[i].t -= dt;
    if (world.smoke[i].t <= 0) world.smoke.splice(i, 1);
  }

  // The guards move and look. A guard that reaches the player catches them.
  const ctx = {
    tiles: world.tiles,
    player: world.player,
    smoke: world.smoke,
    noise: world.noise,
    alarmRaised: false,
  };
  if (world.alarmPulse) {
    ctx.alarmRaised = true;
    world.alarmPulse = false;
  }
  for (const guard of world.guards) {
    if (updateGuard(guard, ctx, dt)) {
      world.status = WORLD_CAUGHT;
      world.events.push({ kind: 'caught' });
      return world.events;
    }
    if (guard.stepped) world.events.push({ kind: 'guard-step', x: guard.x, y: guard.y });
  }

  // The detection meter: every guard with eyes on the player fills it,
  // faster up close, slower when the player sneaks or stands in shadow
  // or brush. Nobody watching and it drains back down.
  let seeing = 0;
  for (const guard of world.guards) {
    if (!guard.sees) continue;
    seeing += 1;
    const range = guard.state === GUARD_ALARM ? 8 : 6.5;
    const closeness = Math.max(0.15, 1 - guard.dist / range);
    const stance = world.player.sneak ? 0.55 : world.player.run ? 1.5 : 1;
    const light = exposureAt(world.tiles, world.player.x, world.player.y);
    world.meter += DETECT_FILL * closeness * stance * light * dt;
  }
  if (seeing === 0) world.meter = Math.max(0, world.meter - DETECT_DRAIN * dt);
  world.meter = Math.min(ALARM_AT, world.meter);
  if (world.meter >= SUSPICIOUS_AT) world.everSeen = true;

  // A full meter raises the alarm: the guards hunt you now.
  if (world.meter >= ALARM_AT && !world.alarmed) {
    world.alarmed = true;
    world.alarmPulse = true;
    world.ghost = false;
    world.events.push({ kind: 'alarm' });
  }
  // The alarm cools once every guard has given up the chase — but not
  // on the step it was raised, before the pulse has reached the guards.
  const anyChasing = world.guards.some((g) => g.state === GUARD_ALARM);
  if (world.alarmed && !anyChasing && !world.alarmPulse) {
    world.alarmed = false;
    world.meter = Math.min(world.meter, 0.4);
  }

  // Loot: walk over a treasure to pocket it, the gem to arm the exit.
  for (const t of world.treasures) {
    if (!t.taken && Math.hypot(t.x - world.player.x, t.y - world.player.y) < 0.6) {
      t.taken = true;
      world.events.push({ kind: 'pickup', x: t.x, y: t.y });
    }
  }
  if (!world.gem.taken && Math.hypot(world.gem.x - world.player.x, world.gem.y - world.player.y) < 0.6) {
    world.gem.taken = true;
    world.events.push({ kind: 'gem' });
  }

  // The exit opens once the gem is yours.
  if (world.gem.taken && Math.hypot(world.exit.x - world.player.x, world.exit.y - world.player.y) < 0.7) {
    world.status = WORLD_DONE;
    world.score = scoreWorld(world);
    world.events.push({ kind: 'win' });
  }
  return world.events;
}

// Loot value plus a time bonus and the ghost bonus for never being caught.
export function scoreWorld(world) {
  const loot = world.treasures.filter((t) => t.taken).length * SCORE_TREASURE;
  const gem = world.gem.taken ? SCORE_GEM : 0;
  const ghost = world.ghost ? SCORE_GHOST : 0;
  const timeBonus = Math.max(0, Math.floor(world.level.par - world.time)) * SCORE_TIME_PER_SEC;
  return loot + gem + ghost + timeBonus;
}

export function scoreBreakdown(world) {
  const lootCount = world.treasures.filter((t) => t.taken).length;
  return {
    loot: lootCount * SCORE_TREASURE,
    lootCount,
    lootTotal: world.treasures.length,
    gem: world.gem.taken ? SCORE_GEM : 0,
    ghost: world.ghost ? SCORE_GHOST : 0,
    timeBonus: Math.max(0, Math.floor(world.level.par - world.time)) * SCORE_TIME_PER_SEC,
    total: scoreWorld(world),
  };
}

// Is the player hidden right now (in a bush or inside a smoke cloud)?
export function playerHidden(world) {
  const { x, y } = world.player;
  const t = world.tiles[Math.floor(y)]?.[Math.floor(x)];
  if (t === 'B') return true;
  return world.smoke.some((c) => Math.hypot(c.x - x, c.y - y) < c.r);
}

// The coin's drawn position while it flies, or null.
export function coinPos(world) {
  return coinDrawPos(world.player);
}
