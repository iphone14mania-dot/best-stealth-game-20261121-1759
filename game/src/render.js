// Nightshade: The Quiet Heist — everything the player sees.
// One canvas, one logical view of 1280 x 720: a 48 px HUD bar on top
// and the 40 x 21 tile level below it. The renderer scales that view
// to the window with letterboxing, so a screenshot at 1280 x 720 is
// exactly the logical view. Colours are the night-museum palette:
// dark slate floors, shadowed aisles, warm lamplight, and vision
// cones in yellow, amber and red by the guard's state.

import {
  COLS,
  HUD_H,
  ROWS,
  TILE,
  VIEW_H,
  VIEW_W,
} from './config.js';
import { conePolygon } from './vision.js';
import { GUARD_ALARM, GUARD_SEARCH, GUARD_SUSPICIOUS } from './guards.js';
import { coinPos, playerHidden } from './world.js';
import { levelFacts } from './levels.js';

const FLOOR_A = '#242b38';
const FLOOR_B = '#222936';
const SHADOW = '#1a212e';
const WALL = '#39445a';
const WALL_TOP = '#4d5a75';
const CRATE = '#7a5a33';
const CRATE_DARK = '#5d4426';
const BUSH = '#2d5a2e';
const BUSH_LIGHT = '#3a7040';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let ox = 0;
  let oy = 0;
  let lastW = 0;
  let lastH = 0;
  let lastDpr = 0;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === lastW && h === lastH && dpr === lastDpr) {
      // Same window: only re-apply the transform (drawing resets it).
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
      return;
    }
    lastW = w;
    lastH = h;
    lastDpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    scale = Math.min(w / VIEW_W, h / VIEW_H);
    ox = (w - VIEW_W * scale) / 2;
    oy = (h - VIEW_H * scale) / 2;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  }

  // Tile coordinates to logical pixels (the playfield starts under the HUD).
  const px = (x) => x * TILE;
  const py = (y) => HUD_H + y * TILE;

  function drawTiles(world) {
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const t = world.tiles[y][x];
        const left = px(x);
        const top = py(y);
        if (t === '#') {
          ctx.fillStyle = WALL;
          ctx.fillRect(left, top, TILE, TILE);
          ctx.fillStyle = WALL_TOP;
          ctx.fillRect(left, top, TILE, 5);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(left, top + TILE - 4, TILE, 4);
        } else if (t === ',') {
          ctx.fillStyle = SHADOW;
          ctx.fillRect(left, top, TILE, TILE);
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? FLOOR_A : FLOOR_B;
          ctx.fillRect(left, top, TILE, TILE);
        }
        if (t === 'C') {
          ctx.fillStyle = CRATE;
          ctx.fillRect(left + 2, top + 2, TILE - 4, TILE - 4);
          ctx.strokeStyle = CRATE_DARK;
          ctx.lineWidth = 2;
          ctx.strokeRect(left + 4, top + 4, TILE - 8, TILE - 8);
          ctx.beginPath();
          ctx.moveTo(left + 4, top + 4);
          ctx.lineTo(left + TILE - 4, top + TILE - 4);
          ctx.moveTo(left + TILE - 4, top + 4);
          ctx.lineTo(left + 4, top + TILE - 4);
          ctx.stroke();
        }
        if (t === 'B') {
          ctx.fillStyle = BUSH;
          ctx.beginPath();
          ctx.arc(left + 10, top + 20, 9, 0, Math.PI * 2);
          ctx.arc(left + 22, top + 12, 10, 0, Math.PI * 2);
          ctx.arc(left + 24, top + 23, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = BUSH_LIGHT;
          ctx.beginPath();
          ctx.arc(left + 14, top + 12, 4, 0, Math.PI * 2);
          ctx.arc(left + 24, top + 19, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawLoot(world) {
    for (const t of world.treasures) {
      if (t.taken) continue;
      const cx = px(t.x);
      const cy = py(t.y);
      ctx.fillStyle = 'rgba(255, 200, 60, 0.25)';
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5c33c';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!world.gem.taken) {
      const cx = px(world.gem.x);
      const cy = py(world.gem.y);
      const pulse = 1 + Math.sin(performance.now() / 300) * 0.12;
      ctx.fillStyle = 'rgba(80, 220, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(cx, cy, 17 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4fd8ff';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 11);
      ctx.lineTo(cx + 8, cy);
      ctx.lineTo(cx, cy + 11);
      ctx.lineTo(cx - 8, cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#d8f6ff';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx + 4, cy);
      ctx.lineTo(cx, cy + 6);
      ctx.lineTo(cx - 4, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawExit(world) {
    const cx = px(world.exit.x);
    const cy = py(world.exit.y);
    const open = world.gem.taken;
    ctx.fillStyle = open ? 'rgba(90, 255, 140, 0.25)' : 'rgba(160, 160, 160, 0.15)';
    ctx.fillRect(cx - 15, cy - 15, 30, 30);
    ctx.strokeStyle = open ? '#5aff8c' : '#8a8a8a';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - 13, cy - 13, 26, 26);
    ctx.fillStyle = open ? '#5aff8c' : '#9a9a9a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? 'EXIT' : 'LOCK', cx, cy - 22);
  }

  function coneColour(state) {
    if (state === GUARD_ALARM) return 'rgba(255, 70, 70, 0.34)';
    if (state === GUARD_SUSPICIOUS || state === GUARD_SEARCH) return 'rgba(255, 180, 60, 0.30)';
    return 'rgba(255, 235, 120, 0.22)';
  }

  function drawGuards(world) {
    // Faint route dots first: patrols you can learn at a glance.
    for (const g of world.guards) {
      ctx.fillStyle = 'rgba(140, 170, 255, 0.20)';
      for (const wp of g.route) {
        ctx.beginPath();
        ctx.arc(px(wp.x), py(wp.y), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const g of world.guards) {
      const poly = conePolygon(world.tiles, g, g.state === GUARD_ALARM);
      ctx.fillStyle = coneColour(g.state);
      ctx.beginPath();
      ctx.moveTo(px(poly[0].x), py(poly[0].y));
      for (let i = 1; i < poly.length; i += 1) ctx.lineTo(px(poly[i].x), py(poly[i].y));
      ctx.closePath();
      ctx.fill();
    }
    for (const g of world.guards) {
      const cx = px(g.x);
      const cy = py(g.y);
      const body = g.state === GUARD_ALARM ? '#a83232' : g.state === GUARD_SUSPICIOUS || g.state === GUARD_SEARCH ? '#a87a1e' : '#2b3a67';
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#dfe6ff';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Facing tick.
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(g.facing) * 14, cy + Math.sin(g.facing) * 14);
      ctx.strokeStyle = '#dfe6ff';
      ctx.stroke();
      if (g.state === GUARD_SUSPICIOUS || g.state === GUARD_SEARCH) {
        ctx.fillStyle = '#ffcc44';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', cx, cy - 18);
      } else if (g.state === GUARD_ALARM) {
        ctx.fillStyle = '#ff5555';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', cx, cy - 18);
      }
    }
  }

  function drawPlayer(world) {
    const p = world.player;
    const cx = px(p.x);
    const cy = py(p.y);
    const hidden = playerHidden(world);
    ctx.globalAlpha = hidden ? 0.55 : 1;
    ctx.fillStyle = '#1b1f2a';
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hidden ? '#7ddb8a' : '#f2f2f2';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(p.facing) * 13, cy + Math.sin(p.facing) * 13);
    ctx.strokeStyle = '#f2f2f2';
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (hidden) {
      ctx.fillStyle = '#7ddb8a';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HIDDEN', cx, cy - 20);
    }
    // Detection meter arc over the player's head.
    if (world.meter > 0.02 && world.status === 'playing') {
      const w = 30;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(cx - w / 2 - 1, cy - 30, w + 2, 6);
      ctx.fillStyle = world.meter >= 0.99 ? '#ff4444' : world.meter >= 0.35 ? '#ffbb33' : '#7ddb8a';
      ctx.fillRect(cx - w / 2, cy - 29, w * world.meter, 4);
    }
    // Smoke clouds.
    for (const c of world.smoke) {
      ctx.fillStyle = 'rgba(200, 200, 210, 0.45)';
      ctx.beginPath();
      ctx.arc(px(c.x), py(c.y), c.r * TILE, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(230, 230, 240, 0.35)';
      ctx.beginPath();
      ctx.arc(px(c.x) - 10, py(c.y) - 6, c.r * TILE * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    // The coin in flight.
    const coin = coinPos(world);
    if (coin) {
      ctx.fillStyle = '#f5c33c';
      ctx.beginPath();
      ctx.arc(px(coin.x), py(coin.y), 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHud(world, ui) {
    ctx.fillStyle = '#12161f';
    ctx.fillRect(0, 0, VIEW_W, HUD_H);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, HUD_H - 1, VIEW_W, 1);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8ecf5';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(world.level.name, 14, HUD_H / 2 - 9);
    ctx.fillStyle = '#9aa5bd';
    ctx.font = '12px system-ui, sans-serif';
    const lootGot = world.treasures.filter((t) => t.taken).length;
    const facts = levelFacts(world.level);
    ctx.fillText(`Loot ${lootGot}/${facts.treasures}   Gem ${world.gem.taken ? 'taken' : '—'}   ${world.gem.taken ? 'Reach the EXIT' : 'Steal the gem, then reach the exit'}`, 14, HUD_H / 2 + 11);

    // Gadgets.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8ecf5';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`Coin [Q] x${world.player.coins}`, 640, HUD_H / 2 - 9);
    ctx.fillText(`Smoke [E] x${world.player.smoke}`, 640, HUD_H / 2 + 11);

    // Timer and score.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e8ecf5';
    ctx.font = 'bold 14px system-ui, sans-serif';
    const mins = Math.floor(world.time / 60);
    const secs = Math.floor(world.time % 60);
    ctx.fillText(`${mins}:${String(secs).padStart(2, '0')}   Score ${ui.score}`, 1110, HUD_H / 2 - 9);
    ctx.fillStyle = world.ghost ? '#7ddb8a' : '#9aa5bd';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(world.ghost ? 'GHOST — never seen' : 'ghost lost', 1110, HUD_H / 2 + 11);

    // Detection meter, right side.
    const mx = 1130;
    const mw = 136;
    ctx.textAlign = 'left';
    ctx.fillStyle = world.meter >= 0.99 ? '#ff5555' : world.meter >= 0.35 ? '#ffbb33' : '#7ddb8a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(world.alarmed ? 'ALARM' : world.meter >= 0.35 ? 'SUSPICIOUS' : 'UNSEEN', mx, HUD_H / 2 - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(mx, HUD_H / 2 + 2, mw, 8);
    ctx.fillStyle = world.meter >= 0.99 ? '#ff4444' : world.meter >= 0.35 ? '#ffbb33' : '#7ddb8a';
    ctx.fillRect(mx, HUD_H / 2 + 2, mw * world.meter, 8);
  }

  function panel(title, lines, hint, accent) {
    ctx.fillStyle = 'rgba(8, 10, 16, 0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 640;
    const h = 130 + lines.length * 30;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    ctx.fillStyle = '#171c28';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent || '#4d5a75';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2f4fa';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(title, VIEW_W / 2, y + 52);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#c4ccd9';
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, y + 96 + i * 30));
    ctx.fillStyle = '#8b95ab';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(hint, VIEW_W / 2, y + h - 24);
  }

  function drawTitle(world, ui) {
    ctx.fillStyle = '#0e1219';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // A faint level behind the menu, so the title shows the game.
    if (world) {
      ctx.globalAlpha = 0.35;
      drawTiles(world);
      drawLoot(world);
      drawExit(world);
      drawGuards(world);
      drawPlayer(world);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(10, 13, 20, 0.72)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2f4fa';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText('NIGHTSHADE', VIEW_W / 2, 120);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('The Quiet Heist — five wings, one thief, no witnesses', VIEW_W / 2, 158);
    ctx.fillStyle = '#c4ccd9';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('WASD / arrows move   ·   Shift sneak   ·   Space run   ·   Q coin   ·   E smoke   ·   click a tile to throw a coin', VIEW_W / 2, 196);
    ctx.fillText('Steal the gem, then reach the exit unseen. Bushes and shadows hide you; smoke breaks sight.', VIEW_W / 2, 220);

    // Level select.
    const listY = 268;
    ui.levels.forEach((lv, i) => {
      const y = listY + i * 64;
      const selected = i === ui.selected;
      const locked = i >= ui.unlocked;
      ctx.fillStyle = selected ? '#24304a' : '#171c28';
      ctx.fillRect(340, y, 600, 52);
      ctx.strokeStyle = selected ? '#9fd8ff' : '#333d52';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(340, y, 600, 52);
      ctx.textAlign = 'left';
      ctx.fillStyle = locked ? '#6b7488' : '#f2f4fa';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.fillText(locked ? `${lv.name}  —  locked` : lv.name, 360, y + 22);
      ctx.fillStyle = '#9aa5bd';
      ctx.font = '12px system-ui, sans-serif';
      const facts = levelFacts(lv);
      const best = ui.best[i];
      ctx.fillText(`${facts.guards} guards · ${facts.treasures} treasures · par ${Math.floor(lv.par / 60)}:${String(lv.par % 60).padStart(2, '0')}${best ? ` · best ${best}` : ''}`, 360, y + 41);
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8b95ab';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('↑ ↓ choose a heist   ·   Enter start   ·   M mute   ·   your progress is saved on this computer', VIEW_W / 2, listY + 5 * 64 + 24);
    if (ui.totalBest > 0) {
      ctx.fillStyle = '#f5c33c';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(`Total best score: ${ui.totalBest}`, VIEW_W / 2, listY + 5 * 64 + 50);
    }
  }

  return {
    resize,
    view() {
      return { scale, ox, oy };
    },
    draw(world, screen, ui) {
      resize();
      ctx.fillStyle = '#0b0e14';
      ctx.fillRect(-ox / scale - 10, -oy / scale - 10, VIEW_W + 40, VIEW_H + 40);
      if (screen === 'title') {
        drawTitle(world, ui);
        return;
      }
      drawTiles(world);
      drawLoot(world);
      drawExit(world);
      drawGuards(world);
      drawPlayer(world);
      drawHud(world, ui);
      if (screen === 'paused') {
        panel('Paused', ['Take a breath. The guards wait for you.'], 'P / Esc resume   ·   R restart level   ·   Q quit to the menu', '#9fd8ff');
      } else if (screen === 'caught') {
        panel('CAUGHT!', [`A guard laid hands on you in ${world.level.name}.`, 'The night is young — try a quieter route.'], 'R retry the heist   ·   Q back to the menu', '#ff5555');
      } else if (screen === 'level-done') {
        const b = ui.breakdown;
        panel('Heist complete', [
          `${world.level.name} — out clean.`,
          `Loot ${b.lootCount}/${b.lootTotal}  ·  +${b.loot}`,
          `Target gem  ·  +${b.gem}`,
          b.ghost ? `Ghost bonus — never seen  ·  +${b.ghost}` : 'Ghost bonus — lost (you were spotted)',
          `Time bonus  ·  +${b.timeBonus}`,
          `Level score: ${b.total}`,
        ], 'Enter next heist   ·   Q back to the menu', '#5aff8c');
      } else if (screen === 'game-done') {
        panel('THE QUIET HEIST — DONE', [
          'All five wings, every gem, no witnesses left talking.',
          `Total score: ${ui.totalScore}`,
          ui.totalBest > 0 ? `Best total on this computer: ${ui.totalBest}` : '',
        ].filter(Boolean), 'Enter back to the menu', '#f5c33c');
      }
    },
  };
}
