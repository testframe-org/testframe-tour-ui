// Copies the static build (dist/) into the plugin's resources so the jar serves the tour screens
// at /tour (agents/specs/test-tour.md; plan Phase 5, item 5). Run by `bun run build`; the plugin's
// src/main/resources/static/tour/ is generated output and is not committed.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = `${root}/dist`;
const target = `${root}/../testframe-plugin-spring/src/main/resources/static/tour`;

/** Kept in the target: it is the only file there that is committed. */
const KEEP = new Set(['.gitignore']);

if (!existsSync(dist) || !existsSync(`${dist}/index.html`)) {
  console.error(`no build in ${dist} — run \`vite build\` first`);
  process.exit(1);
}

mkdirSync(target, { recursive: true });
for (const entry of readdirSync(target)) {
  if (!KEEP.has(entry)) rmSync(`${target}/${entry}`, { recursive: true, force: true });
}
cpSync(dist, target, { recursive: true });

const copied = readdirSync(target).filter((entry) => !KEEP.has(entry));
console.log(`tour-ui build synced to ${target} (${copied.join(', ')})`);
