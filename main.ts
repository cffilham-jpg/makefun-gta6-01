// Entry point for the gta6-01 grader: package the game for judging.
// Copies game/ and screenshots/ from this repository into the output
// directory (or $MAKEFUN_OUTPUT_DIR outside the grader) and writes
// dossier.json with the kit's buildDossier. Runs twice and must write
// identical bytes both times, so every file list is sorted and nothing
// here depends on the clock, the environment or traversal order.
import { readdirSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

// Copy a directory tree, entries in sorted order, regular files only.
function copyTree(sourceDir: string, targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });
  const entries = readdirSync(sourceDir, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name, 'en')
  );
  for (const entry of entries) {
    const from = join(sourceDir, entry.name);
    const to = join(targetDir, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) copyFileSync(from, to);
    else throw new Error(`refusing to package non-regular entry: ${from}`);
  }
}

mkdirSync(outDir, { recursive: true });
for (const folder of ['game', 'screenshots']) {
  rmSync(join(outDir, folder), { recursive: true, force: true });
  copyTree(join(repoRoot, folder), join(outDir, folder));
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
