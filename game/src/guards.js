// Nightshade: The Quiet Heist — guard behaviour.
// A guard lives in one of four states:
//   patrol     walks its route, pausing to look around at each waypoint
//   suspicious heard or half-saw something: walks over to look
//   alarm      knows where you are: chases you
//   search     lost you mid-chase: checks the last place it saw you, then
//              gives up and goes back to its route
// The world owns the detection meter; a guard only reports whether it
// can see the player right now (its `sees` flag) and how far away.

import {
  CHASE_MEMORY,
  GUARD_ALERT,
  GUARD_CHASE,
  GUARD_PATROL,
  SEARCH_TIME,
  WAYPOINT_PAUSE,
} from './config.js';
import { blocksMove, inCone } from './vision.js';

export const GUARD_PATROL_STATE = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALARM = 'alarm';
export const GUARD_SEARCH = 'search';

// A guard starts at the first waypoint of its route, facing `facing`.
export function createGuard(def) {
  const [sx, sy] = def.route[0];
  return {
    x: sx + 0.5,
    y: sy + 0.5,
    facing: def.facing,
    route: def.route.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 })),
    leg: 1,
    legDir: 1,
    state: GUARD_PATROL_STATE,
    pause: 0,
    sweep: 0,
    stateTime: 0,
    lostTime: 0,
    target: null,
    lastSeen: null,
    sees: false,
    dist: 99,
    stepPhase: Math.random() * 2,
    stepped: false,
  };
}

// Move a point toward a target at `speed` tiles per second, sliding
// along walls instead of stopping dead on them.
function stepToward(tiles, g, tx, ty, speed, dt) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.05) return true;
  const mx = (dx / d) * speed * dt;
  const my = (dy / d) * speed * dt;
  const r = 0.28;
  if (!blocksMove(tiles, Math.floor(g.x + mx + Math.sign(mx) * r), Math.floor(g.y))) g.x += mx;
  if (!blocksMove(tiles, Math.floor(g.x), Math.floor(g.y + my + Math.sign(my) * r))) g.y += my;
  g.facing = Math.atan2(dy, dx);
  g.stepPhase += (speed * dt) / 1.1;
  if (g.stepPhase >= 1) {
    g.stepPhase -= 1;
    g.stepped = true;
  }
  return d < 0.15;
}

// A guard's view sweeps side to side while it stands still, so a
// patient player can time the gap.
function sweepLook(g, dt, centre) {
  g.sweep += dt;
  g.facing = centre + Math.sin(g.sweep * 1.6) * 0.9;
}

// `ctx` carries the tiles, the player, the smoke clouds, the noises
// heard this step and the shared alarm flag. Returns true when this
// guard has caught the player.
export function updateGuard(g, ctx, dt) {
  const { tiles, player, smoke } = ctx;
  g.sees = inCone(tiles, g, player.x, player.y, g.state === GUARD_ALARM, smoke);
  g.dist = Math.hypot(player.x - g.x, player.y - g.y);
  g.stepped = false;
  if (g.sees) {
    g.lastSeen = { x: player.x, y: player.y };
    g.lostTime = 0;
  } else {
    g.lostTime += dt;
  }

  // A noise pulls a calm or suspicious guard over to look.
  if (g.state !== GUARD_ALARM) {
    for (const noise of ctx.noise) {
      if (Math.hypot(noise.x - g.x, noise.y - g.y) <= noise.radius) {
        if (g.state !== GUARD_SUSPICIOUS || !g.target || Math.hypot(g.target.x - noise.x, g.target.y - noise.y) > 0.5) {
          g.state = GUARD_SUSPICIOUS;
          g.target = { x: noise.x, y: noise.y };
          g.stateTime = 0;
        }
      }
    }
  }

  // The world raises the alarm when the meter fills; the guard that
  // sees you chases, the others hurry to your last known spot.
  if (ctx.alarmRaised && g.state !== GUARD_ALARM && g.state !== GUARD_SEARCH) {
    if (g.sees || g.dist < 9) {
      g.state = g.sees ? GUARD_ALARM : GUARD_SUSPICIOUS;
      g.target = g.lastSeen ? { ...g.lastSeen } : { x: player.x, y: player.y };
      g.stateTime = 0;
    }
  }

  switch (g.state) {
    case GUARD_PATROL_STATE: {
      if (g.pause > 0) {
        g.pause -= dt;
        sweepLook(g, dt, g.route[g.leg] ? Math.atan2(g.route[g.leg].y - g.y, g.route[g.leg].x - g.x) : g.facing);
        break;
      }
      const wp = g.route[g.leg];
      if (stepToward(tiles, g, wp.x, wp.y, GUARD_PATROL, dt)) {
        g.pause = WAYPOINT_PAUSE;
        g.sweep = 0;
        g.leg += g.legDir;
        if (g.leg >= g.route.length) { g.leg = g.route.length - 2; g.legDir = -1; }
        if (g.leg < 0) { g.leg = 1; g.legDir = 1; }
      }
      break;
    }
    case GUARD_SUSPICIOUS: {
      g.stateTime += dt;
      if (g.target && stepToward(tiles, g, g.target.x, g.target.y, GUARD_ALERT, dt)) {
        sweepLook(g, dt, g.facing);
        if (g.stateTime > SEARCH_TIME * 0.6) {
          g.state = GUARD_PATROL_STATE;
          g.target = null;
          // Resume the route at the nearest waypoint.
          let best = 0;
          let bestD = Infinity;
          g.route.forEach((wp, i) => {
            const d = Math.hypot(wp.x - g.x, wp.y - g.y);
            if (d < bestD) { bestD = d; best = i; }
          });
          g.leg = best;
        }
      }
      break;
    }
    case GUARD_ALARM: {
      if (g.sees) {
        stepToward(tiles, g, player.x, player.y, GUARD_CHASE, dt);
      } else if (g.lastSeen) {
        stepToward(tiles, g, g.lastSeen.x, g.lastSeen.y, GUARD_CHASE, dt);
      }
      if (g.dist < 0.55) return true;
      if (g.lostTime > CHASE_MEMORY) {
        g.state = GUARD_SEARCH;
        g.target = g.lastSeen ? { ...g.lastSeen } : null;
        g.stateTime = 0;
      }
      break;
    }
    case GUARD_SEARCH: {
      g.stateTime += dt;
      if (g.target) stepToward(tiles, g, g.target.x, g.target.y, GUARD_ALERT, dt);
      sweepLook(g, dt, g.facing);
      if (g.stateTime > SEARCH_TIME) {
        g.state = GUARD_PATROL_STATE;
        g.target = null;
        let best = 0;
        let bestD = Infinity;
        g.route.forEach((wp, i) => {
          const d = Math.hypot(wp.x - g.x, wp.y - g.y);
          if (d < bestD) { bestD = d; best = i; }
        });
        g.leg = best;
      }
      break;
    }
    default:
      break;
  }
  return false;
}
