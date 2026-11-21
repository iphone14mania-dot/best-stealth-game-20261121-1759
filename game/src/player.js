// Nightshade: The Quiet Heist — the player: movement, stance and gadgets.
// The player moves in tile coordinates with a small collision radius and
// slides along walls. Three stances: sneak (slow, quiet), walk (normal)
// and run (fast, loud — hold the run key). Gadgets: a thrown coin that
// lands with a noise guards investigate, and a smoke puff that blocks
// sight for a few seconds.

import {
  COIN_RANGE,
  NOISE_COIN,
  NOISE_RUN,
  NOISE_SNEAK,
  NOISE_WALK,
  PLAYER_RUN,
  PLAYER_SNEAK,
  PLAYER_WALK,
  SMOKE_RADIUS,
  SMOKE_TIME,
} from './config.js';
import { blocksMove } from './vision.js';

export function createPlayer(start, coins, smoke) {
  return {
    x: start.x,
    y: start.y,
    facing: 0,
    moving: false,
    sneak: false,
    run: false,
    stance: 'walk',
    coins,
    smoke,
    stepPhase: 0,
    stepped: false,
    coinFlight: null,
    hidden: false,
  };
}

// Move the player by the input vector (already normalised) for dt
// seconds, sliding along walls. Returns the noise this step made,
// or null when the player stood still.
export function movePlayer(tiles, p, ix, iy, sneak, run, dt) {
  p.sneak = sneak;
  p.run = run && !sneak;
  p.stance = sneak ? 'sneak' : p.run ? 'run' : 'walk';
  const speed = sneak ? PLAYER_SNEAK : p.run ? PLAYER_RUN : PLAYER_WALK;
  p.moving = ix !== 0 || iy !== 0;
  p.stepped = false;
  if (!p.moving) return null;
  const len = Math.hypot(ix, iy);
  const nx = ix / len;
  const ny = iy / len;
  p.facing = Math.atan2(ny, nx);
  const mx = nx * speed * dt;
  const my = ny * speed * dt;
  const r = 0.28;
  if (!blocksMove(tiles, Math.floor(p.x + mx + Math.sign(mx) * r), Math.floor(p.y))) p.x += mx;
  if (!blocksMove(tiles, Math.floor(p.x), Math.floor(p.y + my + Math.sign(my) * r))) p.y += my;
  p.stepPhase += (speed * dt) / 1.4;
  if (p.stepPhase >= 1) {
    p.stepPhase -= 1;
    p.stepped = true;
    const radius = sneak ? NOISE_SNEAK : p.run ? NOISE_RUN : NOISE_WALK;
    return { x: p.x, y: p.y, radius, kind: 'step' };
  }
  return null;
}

// Throw a coin toward (tx, ty), clamped to COIN_RANGE tiles from the
// player. The coin flies for a fixed half second, then lands with a
// noise guards walk over to investigate. Returns false when out of coins.
export function throwCoin(p, tx, ty) {
  if (p.coins <= 0 || p.coinFlight) return false;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  const k = d > COIN_RANGE ? COIN_RANGE / d : 1;
  p.coins -= 1;
  p.coinFlight = {
    fromX: p.x,
    fromY: p.y,
    toX: p.x + dx * k,
    toY: p.y + dy * k,
    t: 0,
  };
  return true;
}

// Advance the coin in flight. Returns a noise when it lands, else null.
export function updateCoin(p, dt) {
  if (!p.coinFlight) return null;
  const c = p.coinFlight;
  c.t += dt / 0.5;
  if (c.t >= 1) {
    const noise = { x: c.toX, y: c.toY, radius: NOISE_COIN, kind: 'coin' };
    p.coinFlight = null;
    return noise;
  }
  return null;
}

// Where the coin is drawn while it flies (a little arc, for the eye).
export function coinDrawPos(p) {
  const c = p.coinFlight;
  if (!c) return null;
  const t = c.t;
  return {
    x: c.fromX + (c.toX - c.fromX) * t,
    y: c.fromY + (c.toY - c.fromY) * t - Math.sin(t * Math.PI) * 0.8,
  };
}

// Release a smoke puff at the player's feet. Returns the cloud object
// the world keeps, or null when out of smoke.
export function puffSmoke(p) {
  if (p.smoke <= 0) return null;
  p.smoke -= 1;
  return { x: p.x, y: p.y, r: SMOKE_RADIUS, t: SMOKE_TIME };
}
