// Skyharbor Run — hand-in program (Node 22, standard library only).
//
// The game itself lives in game/ as plain static files (game/index.html plus
// its ES modules) that a desktop browser plays fully offline. This program is
// what hands the entry in: it copies game/ and screenshots/ from beside this
// file into the output directory and writes dossier.json there, built by the
// vendored make.fun library from the copied files.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name: string): void {
  const from = join(repoRoot, name);
  if (existsSync(from)) cpSync(from, join(outputDir, name), { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
copyTree('game');
copyTree('screenshots');

// The caps mirror the scorer's gate: at most 4 screenshots of 256 KiB each,
// at most 993 files / 48 MiB under game/, no game/ path over 1000 bytes, and
// the dossier's source text trimmed to 160 KiB.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
