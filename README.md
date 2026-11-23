# testframe-tour-ui

The **test tour**: the screens, the tour state and the PDF report (spec: `agents/specs/test-tour.md` at the
repo root — it wins over this file). One React implementation, consumed by two hosts:

| Host | How it consumes this package | Tour API base |
|---|---|---|
| the plugin (`modules/testframe-plugin-spring`) | the static Vite bundle in `dist/`, copied into `src/main/resources/static/tour/` and served at `/tour` | `/api/v1/tour` |
| the IDE (`modules/testframe-ide`) | the **TypeScript sources**, compiled by Next/Turbopack (tsconfig `paths`) | `/api/tour` (the IDE's proxy to the plugin) |

The tour owns its state in the browser (IndexedDB) and **writes nothing to any project folder**.

## Commands

```bash
bun install
bun test            # the screen logic, the IndexedDB resume, the PDF redaction acceptance test
bun run typecheck   # tsc --noEmit
bun run build       # vite build → dist/, then scripts/sync-plugin.ts copies it into the plugin
bun run fonts       # regenerate src/pdf/font-data.ts from src/fonts/*.ttf
bun run dev         # the static app on a Vite dev server (see "Developing against the plugin")
```

`bun run build` is what puts the screens in the plugin jar: build here, then package the plugin
(`./mvnw package`). `src/main/resources/static/tour/` is generated output and is not committed.

## How the IDE consumes it (and why)

The IDE resolves `@testframe/tour-ui` through `compilerOptions.paths` in
`modules/testframe-ide/tsconfig.json` to `../testframe-tour-ui/src/index.ts`, the same mechanism it
already uses for `@jsonassert/jsonassert-js`. There is **no `node_modules` entry**: bun's `file:`
protocol installs a package as per-file symlinks, and Turbopack refuses to parse a symlinked
`package.json` (`invalid JSON: a redirect can't be parsed as json`).

Two consequences, both handled in the IDE's configuration:

- `modules/testframe-ide/next.config.ts` sets `turbopack.root` to the monorepo root (so files
  outside the IDE are in the project graph) and pins `react`/`react-dom` to the IDE's own copies
  via `turbopack.resolveAlias`. Without the alias this package would resolve React from its own
  `node_modules` and the page would hold two React instances — hooks would throw.
- `modules/testframe-ide/tsconfig.json` pins `react`/`react-dom` types the same way, so `tsc` sees
  one copy of `@types/react`.

The styling is injected as a `<style>` element (`src/styles.ts`) instead of a `.css` import, so
neither host has to configure a CSS pipeline or a Tailwind content path for this package.

## Fonts

The PDF registers subset DejaVu Sans and DejaVu Sans Mono (`src/fonts/*.ttf`, DejaVu license in
`src/fonts/LICENSE`). `bun run fonts` subsets them to Latin + Greek + Cyrillic + the punctuation,
arrow, math and shape symbols a report can contain, and writes them as base64 data URLs into
`src/pdf/font-data.ts` — **that file is generated and committed**, so a fresh clone builds and
tests without running the generator. Data URLs (rather than font files) mean neither host has to
serve a font asset.

## The PDF stays out of the initial bundle

`src/pdf/index.ts` is the only module that touches `@react-pdf/renderer`, and it does so through
`await import(...)` inside `generatePdf()`. The report components (`src/pdf/document.tsx`) and the
fonts are therefore fetched when the user clicks **Download PDF**, not before.

## Layout

| Path | What it is |
|---|---|
| `src/index.ts` | the public entry point (both hosts) |
| `src/tour-app.tsx` | the three screens and the tour state, wired to an injected API base and store |
| `src/screens/` | `start-screen`, `frame-screen`, `final-screen` |
| `src/protocol.ts` | the wire shapes: the tour API and the NDJSON run events |
| `src/tour-state.ts` | the tour record and its pure transitions (run, re-run, skip, finish, resume) |
| `src/store.ts` | IndexedDB persistence, one record per (origin, project) |
| `src/api.ts`, `src/ndjson.ts` | the tour API client and the NDJSON reader |
| `src/selection.ts`, `src/inputs.ts` | the start screen's checks; the input JSON editors |
| `src/format.ts`, `src/labels.ts` | dates/durations/values and the status labels, shared with the PDF |
| `src/i18n/` | `en.json` (authoritative), `pt-BR.json`, the translator; PDF strings under `pdf.*` |
| `src/components.tsx`, `src/styles.ts` | the screen components and the injected stylesheet |
| `src/pdf/` | the report (`document.tsx`), the fonts, the lazy entry point |
| `src/main.tsx`, `index.html` | the plugin's static entry point |
| `scripts/` | `generate-fonts.ts`, `sync-plugin.ts` |
| `tests/` | `bun test` suites |

## Developing against the plugin

```bash
TESTFRAME_RUNNER_URL=http://127.0.0.1:<runnerPort> bun run dev
```

The Vite dev server proxies `/api/v1` to that URL (adding `Authorization: Bearer` when
`TESTFRAME_RUNNER_TOKEN` is set). No port is hardcoded here: the repo-root scripts resolve them
from `package.json > config`.

## Rules

- **No secret can appear here.** The plugin redacts every string before it leaves, so the tour
  state and the PDF only ever hold `***`. Nothing in this package may fetch, reconstruct or cache
  a credential, and `tests/pdf-redaction.test.ts` fails if a secret reaches the report text.
- **Nothing is written to a project.** The tour lives in IndexedDB and in the browser only.
- UI copy goes through `src/i18n/`; `en.json` is authoritative and `pt-BR.json` must carry exactly
  the same keys (`tests/i18n.test.ts` checks). Code, comments and docs are in English.
