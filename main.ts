// Nightshade: The Quiet Heist — the hand-in program (Node 22, stdlib only).
//
// The game lives in game/ beside this file: plain static files a desktop
// browser loads offline (game/index.html plus its ES modules, no library,
// no network request). This program copies game/ and screenshots/ into
// the output directory and writes dossier.json there with make.fun's
// vendored game library, so the judge reads the screenshots and the
// source outline the dossier carries.
//
// The grader runs it twice in a fresh container with no network; outside
// the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name: string): void {
  const from = join(repoRoot, name);
  if (!existsSync(from)) return;
  cpSync(from, join(outDir, name), { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
copyTree('screenshots');

// The gate's caps, as buildDossier takes them: the dossier's text is
// capped at 160 KiB; the rest refuse an entry the sealed scorer would
// refuse (more than 4 screenshots or one over 256 KiB; more than 993
// files or 48 MiB under game/, or a game/ path over 1000 bytes).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
