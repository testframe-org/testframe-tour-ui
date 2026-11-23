// The tour state machine (docs/test-tour.md, "Tour state"): the transitions the screens drive and
// the rules the report depends on.

import { describe, expect, test } from 'bun:test';
import type { CardFinishedEvent, FrameFinishedEvent, FrameStartedEvent, StreamCard } from '../src/protocol';
import {
  applyEvent,
  beginRun,
  cardUiStatus,
  countsOf,
  createTour,
  elapsedOf,
  finishTour,
  frameIndex,
  frameOf,
  newTourId,
  pdfFileName,
  resumeTour,
  skipFrame,
  stepsOf,
  tourResult
} from '../src/tour-state';

const NOW = new Date(2026, 10, 22, 14, 3, 7); // local time, as the browser would give it
const FRAMES = ['b-frame', 'a-frame', 'c-frame'];

const tour = () => createTour({ project: 'product-test', environment: 'local', lang: 'en', frames: FRAMES, now: NOW });

const card = (varName: string, step = 1): StreamCard => ({
  step,
  varName,
  title: varName,
  source: 'rawvalue',
  subtype: 'json',
  code: '{}'
});

const startedEvent = (cards: StreamCard[]): FrameStartedEvent => ({
  event: 'frame-started',
  runId: 'run-1',
  frame: 'a-frame',
  environment: 'local',
  pluginVersion: '0.4.0',
  at: '2026-11-22T17:03:30.010Z',
  inputs: {},
  sources: {},
  cards
});

const cardFinished = (varName: string, status: 'success' | 'error' | 'skipped' = 'success'): CardFinishedEvent => ({
  event: 'card-finished',
  step: 1,
  result: {
    varName,
    status,
    text: `[Step 1] ${varName}: ok`,
    output: '',
    ranAt: '2026-11-22T17:03:30.020Z',
    offsetMs: 10,
    elapsedMs: 5,
    code: null,
    skippedBy: null,
    detail: {}
  }
});

const frameFinished = (status: 'passed' | 'failed' | 'interrupted', notRun = 0): FrameFinishedEvent => ({
  event: 'frame-finished',
  status,
  stopped: status === 'passed' ? null : status === 'failed' ? 'error' : 'cancelled',
  elapsedMs: 412,
  counts: { success: 2 - notRun, error: status === 'failed' ? 1 : 0, skipped: 0, notRun }
});

describe('tour id and creation', () => {
  test('the id is yyyyMMdd-HHmmss in local time', () => {
    expect(newTourId(NOW)).toBe('20261122-140307');
  });

  test('a new tour keeps the start screen order and starts every frame pending', () => {
    const state = tour();
    expect(state.id).toBe('20261122-140307');
    expect(state.status).toBe('open');
    expect(state.result).toBeNull();
    expect(state.frames.map((f) => f.frame)).toEqual(FRAMES);
    expect(state.frames.every((f) => f.status === 'pending' && f.attempts === 0)).toBe(true);
    expect(pdfFileName(state)).toBe('tour-product-test-20261122-140307.pdf');
  });

  test('frameIndex/frameOf find a frame by name', () => {
    const state = tour();
    expect(frameIndex(state, 'a-frame')).toBe(1);
    expect(frameOf(state, 'missing')).toBeUndefined();
  });
});

describe('a run', () => {
  test('beginRun counts the attempt and drops the previous evidence', () => {
    let state = tour();
    state = applyEvent(state, 'a-frame', startedEvent([card('one')]));
    state = applyEvent(state, 'a-frame', cardFinished('one'));
    state = applyEvent(state, 'a-frame', frameFinished('passed'));
    expect(frameOf(state, 'a-frame')?.results).toHaveLength(1);

    state = beginRun(state, 'a-frame', { one: '{}' });
    const frame = frameOf(state, 'a-frame')!;
    expect(frame.status).toBe('running');
    expect(frame.attempts).toBe(1);
    expect(frame.started).toBeUndefined();
    expect(frame.results).toBeUndefined();
    expect(frame.finished).toBeUndefined();
    expect(frame.inputs).toEqual({ one: '{}' });
  });

  test('frame-started then card-finished then frame-finished build the evidence', () => {
    let state = beginRun(tour(), 'a-frame', {});
    state = applyEvent(state, 'a-frame', startedEvent([card('one'), card('two')]));
    expect(frameOf(state, 'a-frame')?.status).toBe('running');
    expect(state.pluginVersion).toBe('0.4.0');

    state = applyEvent(state, 'a-frame', cardFinished('one'));
    state = applyEvent(state, 'a-frame', cardFinished('two', 'skipped'));
    state = applyEvent(state, 'a-frame', frameFinished('passed'));

    const frame = frameOf(state, 'a-frame')!;
    expect(frame.status).toBe('passed');
    expect(frame.results?.map((r) => r.varName)).toEqual(['one', 'two']);
    expect(countsOf(frame)).toEqual({ success: 2, error: 0, skipped: 0, notRun: 0 });
    expect(elapsedOf(frame)).toBe(412);
  });

  test('a re-run replaces the evidence and only bumps attempts', () => {
    let state = beginRun(tour(), 'a-frame', {});
    state = applyEvent(state, 'a-frame', startedEvent([card('one')]));
    state = applyEvent(state, 'a-frame', cardFinished('one', 'error'));
    state = applyEvent(state, 'a-frame', frameFinished('failed'));
    expect(frameOf(state, 'a-frame')?.attempts).toBe(1);

    state = beginRun(state, 'a-frame', {});
    state = applyEvent(state, 'a-frame', startedEvent([card('one')]));
    state = applyEvent(state, 'a-frame', cardFinished('one'));
    state = applyEvent(state, 'a-frame', frameFinished('passed'));

    const frame = frameOf(state, 'a-frame')!;
    expect(frame.attempts).toBe(2);
    expect(frame.status).toBe('passed');
    expect(frame.results).toHaveLength(1);
    expect(frame.results?.[0].status).toBe('success');
  });

  test('an error event interrupts the frame and keeps the message', () => {
    let state = beginRun(tour(), 'a-frame', {});
    state = applyEvent(state, 'a-frame', startedEvent([card('one')]));
    state = applyEvent(state, 'a-frame', { event: 'error', message: 'the plugin went away' });
    const frame = frameOf(state, 'a-frame')!;
    expect(frame.status).toBe('interrupted');
    expect(frame.error).toBe('the plugin went away');
  });

  test('events of another frame never touch this one', () => {
    let state = beginRun(tour(), 'a-frame', {});
    state = applyEvent(state, 'a-frame', startedEvent([card('one')]));
    state = applyEvent(state, 'b-frame', cardFinished('one'));
    expect(frameOf(state, 'a-frame')?.results).toEqual([]);
    expect(frameOf(state, 'b-frame')?.status).toBe('pending');
  });

  test('cardUiStatus walks pending → running → result, and not-run after a stop', () => {
    let state = beginRun(tour(), 'a-frame', {});
    state = applyEvent(state, 'a-frame', startedEvent([card('one'), card('two')]));
    const cards = stepsOf(frameOf(state, 'a-frame')!).flatMap((step) => step.cards);
    expect(cardUiStatus(frameOf(state, 'a-frame')!, cards[0], 'one')).toBe('running');
    expect(cardUiStatus(frameOf(state, 'a-frame')!, cards[1], 'one')).toBe('pending');

    state = applyEvent(state, 'a-frame', cardFinished('one', 'error'));
    state = applyEvent(state, 'a-frame', frameFinished('failed', 1));
    expect(cardUiStatus(frameOf(state, 'a-frame')!, cards[0], null)).toBe('error');
    expect(cardUiStatus(frameOf(state, 'a-frame')!, cards[1], null)).toBe('not-run');
  });

  test('stepsOf groups the cards by step, in run order', () => {
    const state = applyEvent(beginRun(tour(), 'a-frame', {}), 'a-frame', startedEvent([card('a', 1), card('b', 1), card('c', 2)]));
    expect(stepsOf(frameOf(state, 'a-frame')!)).toEqual([
      { step: 1, cards: [expect.objectContaining({ varName: 'a' }), expect.objectContaining({ varName: 'b' })] },
      { step: 2, cards: [expect.objectContaining({ varName: 'c' })] }
    ]);
  });
});

describe('skip, finish and resume', () => {
  test('skip only applies before any run', () => {
    let state = skipFrame(tour(), 'b-frame');
    expect(frameOf(state, 'b-frame')?.status).toBe('not-run');

    state = applyEvent(state, 'b-frame', startedEvent([card('one')]));
    state = applyEvent(state, 'b-frame', frameFinished('passed'));
    state = skipFrame(state, 'b-frame');
    expect(frameOf(state, 'b-frame')?.status).toBe('passed');
  });

  test('at finish, pending frames become not-run and the result is computed', () => {
    let state = tour();
    state = applyEvent(state, 'a-frame', startedEvent([card('one')]));
    state = applyEvent(state, 'a-frame', frameFinished('passed'));
    state = skipFrame(state, 'b-frame');
    state = finishTour(state, new Date(2026, 10, 22, 15, 0, 0));

    expect(state.status).toBe('finished');
    expect(state.finishedAt).toBe(new Date(2026, 10, 22, 15, 0, 0).toISOString());
    expect(frameOf(state, 'c-frame')?.status).toBe('not-run');
    expect(state.result).toBe('incomplete');
  });

  test('the result is failed when any frame failed, passed only when all passed', () => {
    const frame = (status: 'passed' | 'failed' | 'interrupted' | 'not-run') => ({ frame: 'x', status, attempts: 1 });
    expect(tourResult([frame('passed'), frame('passed')])).toBe('passed');
    expect(tourResult([frame('passed'), frame('failed')])).toBe('failed');
    expect(tourResult([frame('failed'), frame('interrupted')])).toBe('failed');
    expect(tourResult([frame('passed'), frame('interrupted')])).toBe('incomplete');
    expect(tourResult([frame('passed'), frame('not-run')])).toBe('incomplete');
  });

  test('a frame that was running when the page went away comes back interrupted', () => {
    let state = beginRun(tour(), 'a-frame', {});
    state = applyEvent(state, 'a-frame', startedEvent([card('one')]));
    expect(frameOf(state, 'a-frame')?.status).toBe('running');

    const resumed = resumeTour(state);
    expect(frameOf(resumed, 'a-frame')?.status).toBe('interrupted');
    expect(frameOf(resumed, 'b-frame')?.status).toBe('pending');
    // The evidence collected so far survives the reload.
    expect(frameOf(resumed, 'a-frame')?.started?.cards).toHaveLength(1);
  });
});
