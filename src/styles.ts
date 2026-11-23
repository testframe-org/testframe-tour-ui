// The tour screens' stylesheet, injected once into the document by the tour app.
//
// Plain CSS with a `tft-` prefix instead of Tailwind utilities on purpose: the package is consumed
// by two hosts — the IDE, which compiles these sources inside its own Tailwind build, and the
// plugin, which serves a static Vite bundle at /tour. Injected CSS needs no host configuration,
// scans no content path and cannot be purged by the other app's build.

import { useEffect } from 'react';

const STYLE_ID = 'testframe-tour-ui-styles';

export const TOUR_STYLES = `
.tft-root {
  --tft-ink: #0f172a;
  --tft-muted: #64748b;
  --tft-line: #e2e8f0;
  --tft-soft: #f1f5f9;
  --tft-bg: #f5f5f7;
  --tft-card: #ffffff;
  --tft-accent: #2563eb;
  --tft-pass: #15803d;
  --tft-fail: #b91c1c;
  --tft-warn: #b45309;
  --tft-skip: #475569;
  --tft-idle: #94a3b8;
  box-sizing: border-box;
  min-height: 100vh;
  width: 100%;
  margin: 0;
  padding: 0;
  background: var(--tft-bg);
  color: var(--tft-ink);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  text-align: left;
}
.tft-root *, .tft-root *::before, .tft-root *::after { box-sizing: border-box; }
.tft-mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; }
.tft-muted { color: var(--tft-muted); }
.tft-shell { max-width: 1080px; margin: 0 auto; padding: 20px 20px 96px; }

.tft-card {
  background: var(--tft-card); border: 1px solid var(--tft-line); border-radius: 12px;
  padding: 16px; margin-bottom: 14px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.tft-h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 4px; }
.tft-h2 { font-size: 14px; font-weight: 650; margin: 0 0 10px; }
.tft-h3 { font-size: 12px; font-weight: 650; margin: 12px 0 4px; color: var(--tft-ink); }
.tft-tagline { color: var(--tft-muted); margin: 0 0 16px; }

.tft-field { margin-bottom: 12px; }
.tft-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--tft-muted); margin-bottom: 4px; }
.tft-hint { font-size: 11px; color: var(--tft-muted); margin-top: 4px; }

.tft-select, .tft-input {
  width: 100%; padding: 7px 10px; font-size: 13px; font-family: inherit; color: var(--tft-ink);
  background: var(--tft-card); border: 1px solid var(--tft-line); border-radius: 8px;
}
.tft-select:focus, .tft-input:focus, .tft-editor:focus { outline: 2px solid rgba(37, 99, 235, 0.35); outline-offset: 1px; border-color: var(--tft-accent); }

.tft-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 7px 14px; font-size: 13px; font-weight: 550; font-family: inherit;
  border-radius: 8px; border: 1px solid var(--tft-line); background: var(--tft-card);
  color: var(--tft-ink); cursor: pointer; white-space: nowrap;
}
.tft-btn:hover:not(:disabled) { background: var(--tft-soft); }
.tft-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.tft-btn-primary { background: var(--tft-accent); border-color: var(--tft-accent); color: #fff; }
.tft-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
.tft-btn-danger { color: var(--tft-fail); border-color: rgba(185, 28, 28, 0.35); }
.tft-btn-danger:hover:not(:disabled) { background: rgba(185, 28, 28, 0.06); }
.tft-btn-sm { padding: 4px 9px; font-size: 12px; border-radius: 6px; }

.tft-nav {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 10px 20px; background: rgba(255, 255, 255, 0.94);
  border-top: 1px solid var(--tft-line); backdrop-filter: blur(8px);
}
.tft-nav-inner { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; width: 100%; max-width: 1080px; margin: 0 auto; }
.tft-nav-spacer { flex: 1 1 auto; }

.tft-badge {
  display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 600; line-height: 1.6; white-space: nowrap;
  border: 1px solid transparent;
}
.tft-badge-pass { color: var(--tft-pass); background: rgba(21, 128, 61, 0.1); border-color: rgba(21, 128, 61, 0.25); }
.tft-badge-fail { color: var(--tft-fail); background: rgba(185, 28, 28, 0.08); border-color: rgba(185, 28, 28, 0.22); }
.tft-badge-warn { color: var(--tft-warn); background: rgba(180, 83, 9, 0.1); border-color: rgba(180, 83, 9, 0.25); }
.tft-badge-skip { color: var(--tft-skip); background: rgba(71, 85, 105, 0.1); border-color: rgba(71, 85, 105, 0.2); }
.tft-badge-idle { color: var(--tft-idle); background: rgba(148, 163, 184, 0.12); border-color: rgba(148, 163, 184, 0.28); }
.tft-badge-run { color: var(--tft-accent); background: rgba(37, 99, 235, 0.1); border-color: rgba(37, 99, 235, 0.25); }

.tft-list { display: flex; flex-direction: column; gap: 6px; }
.tft-frame-item {
  display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px;
  border: 1px solid var(--tft-line); border-radius: 10px; background: var(--tft-card);
}
.tft-frame-item:hover { border-color: #cbd5e1; }
.tft-frame-item input[type="checkbox"] { width: 15px; height: 15px; margin-top: 2px; accent-color: var(--tft-accent); }
.tft-frame-name { font-weight: 600; font-size: 13px; }
.tft-frame-stats { font-size: 11px; color: var(--tft-muted); }

.tft-alert { padding: 10px 12px; border-radius: 10px; margin-bottom: 12px; font-size: 12px; border: 1px solid; }
.tft-alert-warn { color: var(--tft-warn); background: rgba(180, 83, 9, 0.07); border-color: rgba(180, 83, 9, 0.25); }
.tft-alert-error { color: var(--tft-fail); background: rgba(185, 28, 28, 0.06); border-color: rgba(185, 28, 28, 0.22); }
.tft-alert-info { color: var(--tft-muted); background: var(--tft-soft); border-color: var(--tft-line); }
.tft-alert ul { margin: 6px 0 0; padding-left: 18px; }

.tft-input-block { border: 1px solid var(--tft-line); border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; background: var(--tft-card); }
.tft-input-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.tft-input-title { font-weight: 650; font-size: 13px; }
.tft-editor {
  width: 100%; min-height: 108px; resize: vertical; padding: 8px 10px;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px; line-height: 1.5; color: var(--tft-ink);
  background: #fbfcfe; border: 1px solid var(--tft-line); border-radius: 8px; tab-size: 2;
}
.tft-editor-invalid { border-color: rgba(185, 28, 28, 0.5); background: rgba(185, 28, 28, 0.03); }

.tft-code {
  margin: 0; padding: 8px 10px; background: var(--tft-soft); border: 1px solid var(--tft-line);
  border-radius: 8px; overflow-x: auto; white-space: pre-wrap; word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 11.5px; line-height: 1.5; color: var(--tft-ink);
}

.tft-run-card { border: 1px solid var(--tft-line); border-radius: 10px; margin-bottom: 6px; background: var(--tft-card); overflow: hidden; }
.tft-run-head { display: flex; align-items: center; gap: 8px; padding: 8px 10px; }
.tft-run-head-main { flex: 1 1 auto; min-width: 0; }
.tft-run-title { font-weight: 600; font-size: 12.5px; }
.tft-run-text { font-size: 11.5px; color: var(--tft-muted); word-break: break-word; }
.tft-run-body { padding: 0 10px 10px; border-top: 1px solid var(--tft-soft); }
.tft-step-head { font-size: 12px; font-weight: 700; color: var(--tft-muted); text-transform: uppercase; letter-spacing: 0.05em; margin: 14px 0 6px; padding-bottom: 4px; border-bottom: 1px solid var(--tft-line); }
.tft-run-card-running { border-color: rgba(37, 99, 235, 0.5); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08); }
.tft-run-card-error { border-color: rgba(185, 28, 28, 0.4); }
.tft-run-card-notrun { opacity: 0.55; }

.tft-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.tft-table th, .tft-table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--tft-line); }
.tft-table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--tft-muted); font-weight: 600; background: var(--tft-soft); }
.tft-table td.tft-num { text-align: right; font-variant-numeric: tabular-nums; }

.tft-kv { display: grid; grid-template-columns: 150px 1fr; gap: 3px 10px; font-size: 12px; }
.tft-kv dt { color: var(--tft-muted); }
.tft-kv dd { margin: 0; word-break: break-word; }

.tft-lang { display: inline-flex; gap: 2px; padding: 2px; background: var(--tft-soft); border-radius: 8px; border: 1px solid var(--tft-line); }
.tft-lang button {
  padding: 3px 9px; font-size: 12px; font-family: inherit; border: 0; border-radius: 6px;
  background: transparent; color: var(--tft-muted); cursor: pointer;
}
.tft-lang button[aria-pressed="true"] { background: var(--tft-card); color: var(--tft-ink); font-weight: 600; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08); }

.tft-result-hero { font-size: 34px; font-weight: 750; letter-spacing: -0.03em; margin: 4px 0 12px; }
.tft-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(37, 99, 235, 0.3); border-top-color: var(--tft-accent); border-radius: 50%; animation: tft-spin 0.7s linear infinite; }
@keyframes tft-spin { to { transform: rotate(360deg); } }
`;

let injected = false;

/** Injects the stylesheet once per document. Safe to call from every screen and from both hosts. */
export function injectTourStyles(doc?: Document): void {
  if (injected) return;
  const target = doc ?? (typeof document === 'undefined' ? undefined : document);
  if (!target?.head) return;
  if (target.getElementById(STYLE_ID)) {
    injected = true;
    return;
  }
  const style = target.createElement('style');
  style.id = STYLE_ID;
  style.textContent = TOUR_STYLES;
  target.head.appendChild(style);
  injected = true;
}

/** Injects the stylesheet on mount. */
export function useTourStyles(): void {
  useEffect(() => {
    injectTourStyles();
  }, []);
}
