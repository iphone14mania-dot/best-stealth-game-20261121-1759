// Nightshade: The Quiet Heist — sight lines, vision cones and light.
// Everything here works in tile coordinates (1 tile = 1 unit); the
// renderer is the only file that knows about pixels.

import { CONE_HALF, CONE_RANGE, CONE_RANGE_ALARM } from './config.js';

// A tile blocks sight when it is a wall or a crate. Bushes and shadow
// floor never block sight — they hide the player instead.
export function blocksSight(tiles, tx, ty) {
  if (ty < 0 || ty >= tiles.length || tx < 0 || tx >= tiles[0].length) return true;
  const t = tiles[ty][tx];
  return t === '#' || t === 'C';
}

export function blocksMove(tiles, tx, ty) {
  return blocksSight(tiles, tx, ty);
}

// True when a straight line from (x1, y1) to (x2, y2) crosses no
// sight-blocking tile. Samples the line every quarter tile, which is
// fine enough that a thin wall can never be slipped through.
export function hasLineOfSight(tiles, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 0.25));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (blocksSight(tiles, Math.floor(x1 + dx * t), Math.floor(y1 + dy * t))) return false;
  }
  return true;
}

// The tile under (x, y): '.' floor, ',' shadow, 'B' bush, '#' wall, 'C' crate.
export function tileAt(tiles, x, y) {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (ty < 0 || ty >= tiles.length || tx < 0 || tx >= tiles[0].length) return '#';
  return tiles[ty][tx];
}

// How exposed the player is where they stand: 1 in the open, less in
// shadow, almost nothing inside a bush.
export function exposureAt(tiles, x, y) {
  const t = tileAt(tiles, x, y);
  if (t === 'B') return 0.15;
  if (t === ',') return 0.7;
  return 1;
}

// Is the point (px, py) inside a guard's vision cone? The guard looks
// along `facing` (radians); the cone opens CONE_HALF either side of it
// and reaches CONE_RANGE tiles (further while alarmed). A smoke cloud
// between the guard and the point blocks the view entirely.
export function inCone(tiles, guard, px, py, alarmed, smoke) {
  const dx = px - guard.x;
  const dy = py - guard.y;
  const dist = Math.hypot(dx, dy);
  const range = alarmed ? CONE_RANGE_ALARM : CONE_RANGE;
  if (dist > range) return false;
  if (dist < 0.6) return true; // nose to nose: no cone can miss you
  const ang = Math.atan2(dy, dx);
  let diff = ang - guard.facing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > CONE_HALF) return false;
  if (!hasLineOfSight(tiles, guard.x, guard.y, px, py)) return false;
  for (const cloud of smoke) {
    if (segmentHitsCircle(guard.x, guard.y, px, py, cloud.x, cloud.y, cloud.r)) return false;
  }
  return true;
}

// Does the segment from (x1, y1) to (x2, y2) pass through the circle
// centred (cx, cy) with radius r? Used for smoke blocking sight.
function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const nx = x1 + dx * t;
  const ny = y1 + dy * t;
  return Math.hypot(cx - nx, cy - ny) < r;
}

// The cone's far edge for drawing: cast rays across the cone and stop
// each where sight is blocked, so the cone hugs the walls.
export function conePolygon(tiles, guard, alarmed, rays = 14) {
  const range = alarmed ? CONE_RANGE_ALARM : CONE_RANGE;
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= rays; i += 1) {
    const a = guard.facing - CONE_HALF + (2 * CONE_HALF * i) / rays;
    let d = range;
    for (let s = 0.5; s < range; s += 0.5) {
      if (blocksSight(tiles, Math.floor(guard.x + Math.cos(a) * s), Math.floor(guard.y + Math.sin(a) * s))) {
        d = s;
        break;
      }
    }
    points.push({ x: guard.x + Math.cos(a) * d, y: guard.y + Math.sin(a) * d });
  }
  return points;
}
