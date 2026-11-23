// The tour state (docs/test-tour.md, "Tour state"): what the browser owns. It is built from the
// run events alone, kept in IndexedDB (state/store.ts) and is the single input of the PDF. Every
// function here is pure so the screens and the tests share one implementation.

import type { CardResult, Counts, FrameFinishedEvent, FrameStartedEvent, RunEvent, StreamCard } from './protocol';

export type Lang = 'en' | 'pt-BR';

export const LANGS: readonly Lang[] = ['en', 'pt-BR'];

/** `open` while frames may still run; `finished` after **Finish tour** (final: nothing runs again). */
export type TourStatus = 'open' | 'finished';

export type FrameStatus = 'pending' | 'running' | 'passed' | 'failed' | 'interrupted' | 'not-run';

export type TourResult = 'passed' | 'failed' | 'incomplete';

/** The status of a card as the frame screen draws it. */
export type CardUiStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped' | 'not-run';

export interface TourFrame {
  frame: string;
  status: FrameStatus;
  /** How many times this frame ran; a re-run replaces `started`, `results` and `finished`. */
  attempts: number;
  started?: FrameStartedEvent;
  results?: CardResult[];
  finished?: FrameFinishedEvent;
  /** The input text last used, by var-name: **Run again** goes back to editing with it. */
  inputs?: Record<string, string>;
  /** The message of an `error` event, when the stream broke before `frame-finished`. */
  error?: string;
}

export interface Tour {
  /** `yyyyMMdd-HHmmss` in the browser's local time at Start; used in the PDF and its file name. */
  id: string;
  project: string;
  environment: string;
  /** The UI language at Start; it fixes the PDF language. */
  lang: Lang;
  pluginVersion: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: TourStatus;
  result: TourResult | null;
  frames: TourFrame[];
}

export const EMPTY_COUNTS: Counts = { success: 0, error: 0, skipped: 0, notRun: 0 };

/** The tour id: `yyyyMMdd-HHmmss`, local time. */
export function newTourId(now: Date): string {
  const p = (n: number, width = 2): string => String(n).padStart(width, '0');
  return `${p(now.getFullYear(), 4)}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

export interface NewTourInput {
  project: string;
  environment: string;
  lang: Lang;
  /** The selected frames, in the start screen's order (by name). */
  frames: string[];
  now: Date;
}

/** A new tour: every selected frame starts `pending`. Created in the browser, no request. */
export function createTour(input: NewTourInput): Tour {
  return {
    id: newTourId(input.now),
    project: input.project,
    environment: input.environment,
    lang: input.lang,
    pluginVersion: null,
    startedAt: input.now.toISOString(),
    finishedAt: null,
    status: 'open',
    result: null,
    frames: input.frames.map((frame) => ({ frame, status: 'pending' as FrameStatus, attempts: 0 }))
  };
}

const withFrame = (tour: Tour, frame: string, fn: (f: TourFrame) => TourFrame): Tour => ({
  ...tour,
  frames: tour.frames.map((f) => (f.frame === frame ? fn(f) : f))
});

export const frameOf = (tour: Tour, frame: string): TourFrame | undefined => tour.frames.find((f) => f.frame === frame);

export const frameIndex = (tour: Tour, frame: string): number => tour.frames.findIndex((f) => f.frame === frame);

/** A frame starts running: the attempt is counted and the previous evidence is dropped. */
export function beginRun(tour: Tour, frame: string, inputs: Record<string, string>): Tour {
  return withFrame(tour, frame, (f) => ({
    frame: f.frame,
    status: 'running',
    attempts: f.attempts + 1,
    inputs
  }));
}

/**
 * Applies one run event of `frame` to the tour. Events of another frame are ignored (the UI runs
 * one frame at a time, but a late event must never corrupt another frame's evidence).
 */
export function applyEvent(tour: Tour, frame: string, event: RunEvent): Tour {
  switch (event.event) {
    case 'frame-started':
      return withFrame(
        { ...tour, pluginVersion: event.pluginVersion ?? tour.pluginVersion },
        frame,
        (f) => ({ ...f, status: 'running', started: event, results: [], finished: undefined, error: undefined })
      );
    case 'card-started':
      // The running card is transient UI state; the persisted record keeps the evidence only.
      return tour;
    case 'card-finished':
      return withFrame(tour, frame, (f) => ({ ...f, results: [...(f.results ?? []), event.result] }));
    case 'frame-finished':
      return withFrame(tour, frame, (f) => ({ ...f, status: event.status, finished: event }));
    case 'error':
      return withFrame(tour, frame, (f) => ({ ...f, status: 'interrupted', error: event.message }));
  }
}

/** **Skip frame** before any run: the frame ends `not-run` and never runs in this tour. */
export function skipFrame(tour: Tour, frame: string): Tour {
  return withFrame(tour, frame, (f) => (f.status === 'pending' ? { ...f, status: 'not-run' } : f));
}

/** `passed` when every frame passed, `failed` when any frame failed, else `incomplete`. */
export function tourResult(frames: readonly TourFrame[]): TourResult {
  if (frames.some((f) => f.status === 'failed')) return 'failed';
  if (frames.every((f) => f.status === 'passed')) return 'passed';
  return 'incomplete';
}

/** **Finish tour**: final. `pending` frames become `not-run` and the tour result is computed. */
export function finishTour(tour: Tour, now: Date): Tour {
  const frames = tour.frames.map((f) => (f.status === 'pending' ? { ...f, status: 'not-run' as FrameStatus } : f));
  return { ...tour, frames, status: 'finished', finishedAt: now.toISOString(), result: tourResult(frames) };
}

/**
 * A tour read back from IndexedDB: a frame that was `running` when the page went away becomes
 * `interrupted` (its stream is gone and the plugin stopped it on disconnect).
 */
export function resumeTour(tour: Tour): Tour {
  return {
    ...tour,
    frames: tour.frames.map((f) =>
      f.status === 'running' ? { ...f, status: 'interrupted' as FrameStatus, error: f.error ?? 'page-reloaded' } : f
    )
  };
}

/** The counts of a frame: the ones of its last attempt, zeros when it never finished. */
export const countsOf = (frame: TourFrame): Counts => frame.finished?.counts ?? EMPTY_COUNTS;

/** The duration of a frame's last attempt, in ms (0 when it never finished). */
export const elapsedOf = (frame: TourFrame): number => frame.finished?.elapsedMs ?? 0;

/** The result of a card of the frame's last attempt. */
export function resultOf(frame: TourFrame, varName: string): CardResult | undefined {
  return frame.results?.find((r) => r.varName === varName);
}

/**
 * The status the frame screen draws per card. `runningVar` is the card the stream just announced;
 * cards after a stop have no event and are `not-run` once the frame finished.
 */
export function cardUiStatus(frame: TourFrame, card: StreamCard, runningVar: string | null): CardUiStatus {
  const result = resultOf(frame, card.varName);
  if (result) return result.status;
  if (runningVar === card.varName) return 'running';
  return frame.finished ? 'not-run' : 'pending';
}

/** The cards of the frame's last attempt, in run order (empty before the first run). */
export const cardsOf = (frame: TourFrame): StreamCard[] => frame.started?.cards ?? [];

/** The steps of the frame's last attempt, in order, with their cards. */
export function stepsOf(frame: TourFrame): { step: number; cards: StreamCard[] }[] {
  const groups: { step: number; cards: StreamCard[] }[] = [];
  for (const card of cardsOf(frame)) {
    const last = groups[groups.length - 1];
    if (last && last.step === card.step) last.cards.push(card);
    else groups.push({ step: card.step, cards: [card] });
  }
  return groups;
}

/** Whether the tour may still run frames. */
export const isOpen = (tour: Tour): boolean => tour.status === 'open';

/** The tour file name of the PDF: `tour-{project}-{id}.pdf`. */
export const pdfFileName = (tour: Tour): string => `tour-${tour.project}-${tour.id}.pdf`;
