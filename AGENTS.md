# AGENTS.md — testframe-tour-ui (the test tour)

React + TypeScript package: the **tour screens, the tour state and the PDF report**. Spec:
`docs/test-tour.md` at the repo root — it wins over this file. Build, layout, hosting and the font
pipeline: `README.md` in this folder.

## Golden rules

- **It owns the tour and nothing else.** No project file is read or written here, ever: the tour
  state lives in browser IndexedDB (`src/store.ts`) and the report is generated in the browser. If
  a feature seems to need a write to a project, it belongs in the IDE.
- **No secret can appear here.** The plugin redacts every string before it leaves, so the state and
  the PDF only ever hold `***`. Never fetch, reconstruct, cache or re-derive a credential;
  `tests/pdf-redaction.test.ts` is the gate.
- **One implementation, two hosts.** The IDE compiles `src/index.ts` directly (tsconfig `paths`) and
  the plugin serves the static Vite bundle at `/tour`. Anything host-specific — a CSS pipeline, a
  font URL, a bundler alias — is a bug: it would make the two hosts behave differently.
- **`@react-pdf/renderer` and the fonts stay lazy.** They are reachable only through the dynamic
  import in `src/pdf/index.ts`; never import `src/pdf/document.tsx` or `src/pdf/fonts.ts` eagerly.
- The plugin's tour API is stateless and read-only. `POST .../frames/{frame}/run` streams NDJSON;
  every event is applied to the state and the record is persisted after each one.

## Conventions

- All decisions the screens make are pure functions in `src/tour-state.ts`, `src/selection.ts`,
  `src/inputs.ts` and `src/format.ts` — change them there and the tests pin them. Screens only
  render and dispatch.
- UI copy goes through `src/i18n/{en,pt-BR}.json` (en authoritative, pt-BR complete, PDF strings
  under `pdf.*`). Protocol tokens (`passed`, `error`, `skip-rest-of-step`, …) are never translated;
  their labels are (`src/labels.ts`, shared with the PDF).
- Styling is injected plain CSS with a `tft-` prefix (`src/styles.ts`) — not Tailwind, so neither
  host has to scan this package.
- Wire shapes live in `src/protocol.ts` and mirror `docs/test-tour.md` and `docs/runner-protocol.md`.
  When the plugin's API changes, change them here in the same pass.

## Commands

```bash
bun install
bun test            # screen logic, IndexedDB resume, the PDF redaction acceptance test
bun run typecheck   # tsc --noEmit
bun run build       # vite build → dist/, then sync into the plugin's static/tour/
bun run fonts       # regenerate src/pdf/font-data.ts (only when the TTFs change)
```

After `bun run build`, the plugin jar carries the screens: `cd ../testframe-plugin-spring &&
./mvnw package`. Nothing here writes to a project folder or to the repo root.
