// Entrypoint: copies game/ + screenshots/ to the output dir
// ($MAKEFUN_OUTPUT_DIR) and writes dossier.json there via the
// vendored buildDossier. Any stray dossier.json in the source
// tree is skipped during the copy so it can never overwrite
// the generated dossier.
//
// Rush Hour Ramen — make.fun entrypoint.
//
// When the grader runs `node /bot/main.ts`, this file:
//   1. finds the entry root (the directory containing this file),
//   2. finds the output directory ($MAKEFUN_OUTPUT_DIR, default "/output"),
//   3. copies game/ and screenshots/ from the entry root into the output
//      directory, preserving relative paths and copying bytes exactly,
//   4. builds the dossier for the copied tree with the vendored library and
//      writes it to <output>/dossier.json.
//
// Deterministic by construction: directory entries are visited in code-unit
// order, no timestamps or randomness are used anywhere, and file contents are
// copied byte for byte.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

// The directory containing this file is the entry root, wherever the
// grader has mounted it.
const entryRoot = dirname(fileURLToPath(import.meta.url));

// The grader tells us where to write; "/output" is the conventional default.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

/** Code-unit order, the same on every machine (localeCompare is not). */
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Recursively copy the directory `src` into `dst`, creating directories as
 * needed and copying every file's bytes exactly. Entries are processed in
 * sorted order so the traversal is deterministic.
 */
function copyTree(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  const names = readdirSync(src).sort(byCodeUnit);
  for (const name of names) {
    const from = join(src, name);
    const to = join(dst, name);
    const info = statSync(from);
    if (info.isDirectory()) {
      copyTree(from, to);
    } else if (info.isFile() && name !== "dossier.json") {
      copyFileSync(from, to);
    }
  }
}

// Copy the two payload trees into the output directory.
for (const tree of ["game", "screenshots"]) {
  const src = join(entryRoot, tree);
  if (existsSync(src)) {
    copyTree(src, join(outputDir, tree));
  }
}

// Build the dossier from the copied tree and write it next to it. The caps
// are sized well above this entry's real content (~15 game files, well under
// 1 MiB of source, 4 screenshots) so nothing is truncated.
const caps = {
  text_max_bytes: 4 * 1024 * 1024,
  screenshots: { max: 8, max_bytes: 4 * 1024 * 1024 },
  game_max_files: 1024,
  game_max_bytes: 64 * 1024 * 1024,
  game_path_max_bytes: 1000,
};
const dossier: Uint8Array = buildDossier(outputDir, caps);
writeFileSync(join(outputDir, "dossier.json"), dossier);
