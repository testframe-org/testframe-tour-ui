// Tour persistence and the reload rule (docs/test-tour.md, "Tour state"): browser IndexedDB, one
// record per (origin, project), and a frame that was running when the page went away comes back
// `interrupted`.

import { describe, expect, test } from 'bun:test';
import { IDBFactory } from 'fake-indexeddb';
import type { FrameStartedEvent } from '../src/protocol';
import { createTourStore } from '../src/store';
import { applyEvent, beginRun, createTour, frameOf, type Tour } from '../src/tour-state';

const NOW = new Date('2026-11-22T17:03:07.120Z');

const tour = (project = 'product-test'): Tour =>
  createTour({ project, environment: 'local', lang: 'pt-BR', frames: ['a-frame', 'b-frame'], now: NOW });

const startedEvent: FrameStartedEvent = {
  event: 'frame-started',
  runId: 'run-1',
  frame: 'a-frame',
  environment: 'local',
  pluginVersion: '0.4.0',
  at: '2026-11-22T17:03:07.200Z',
  inputs: {},
  sources: {},
  cards: [{ step: 1, varName: 'one', title: 'One', source: 'rawvalue', subtype: 'json', code: '{}' }]
};

/** A tour stopped in the middle of a frame, as a page reload would leave it. */
const runningTour = (): Tour => {
  let state = beginRun(tour(), 'a-frame', { one: '{}' });
  state = applyEvent(state, 'a-frame', startedEvent);
  return state;
};

describe('IndexedDB', () => {
  test('a saved tour is read back with its evidence', async () => {
    const store = createTourStore(new IDBFactory());
    const state = runningTour();
    await store.save(state);
    const loaded = await store.load('product-test');
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(state.id);
    expect(loaded!.lang).toBe('pt-BR');
    expect(loaded!.frames).toHaveLength(2);
    expect(frameOf(loaded!, 'a-frame')?.started?.cards).toHaveLength(1);
    expect(frameOf(loaded!, 'a-frame')?.attempts).toBe(1);
  });

  test('a frame that was running becomes interrupted on load, and keeps what it collected', async () => {
    const store = createTourStore(new IDBFactory());
    await store.save(runningTour());
    const loaded = (await store.load('product-test'))!;
    expect(frameOf(loaded, 'a-frame')?.status).toBe('interrupted');
    expect(frameOf(loaded, 'a-frame')?.started).toBeDefined();
    expect(frameOf(loaded, 'b-frame')?.status).toBe('pending');
  });

  test('a settled frame is left alone by a load', async () => {
    const store = createTourStore(new IDBFactory());
    const state = applyEvent(runningTour(), 'a-frame', {
      event: 'frame-finished',
      status: 'passed',
      stopped: null,
      elapsedMs: 10,
      counts: { success: 1, error: 0, skipped: 0, notRun: 0 }
    });
    await store.save(state);
    const loaded = await store.load('product-test');
    expect(frameOf(loaded!, 'a-frame')?.status).toBe('passed');
  });

  test('one record per project: a new tour of the same project replaces the old one', async () => {
    const store = createTourStore(new IDBFactory());
    await store.save(tour());
    await store.save({ ...tour(), id: 'second', environment: 'hml' });
    const loaded = await store.load('product-test');
    expect(loaded!.id).toBe('second');
    expect(loaded!.environment).toBe('hml');
  });

  test('projects do not collide', async () => {
    const store = createTourStore(new IDBFactory());
    await store.save(tour('one'));
    await store.save(tour('two'));
    expect((await store.load('one'))!.project).toBe('one');
    expect((await store.load('two'))!.project).toBe('two');
  });

  test('New tour deletes the record', async () => {
    const store = createTourStore(new IDBFactory());
    await store.save(tour());
    await store.remove('product-test');
    expect(await store.load('product-test')).toBeNull();
  });

  test('an unknown project has no tour', async () => {
    expect(await createTourStore(new IDBFactory()).load('nothing-here')).toBeNull();
  });

  test('rapid writes are serialized, so the last event wins', async () => {
    const store = createTourStore(new IDBFactory());
    const writes: Promise<void>[] = [];
    for (let i = 0; i < 25; i++) {
      writes.push(store.save({ ...tour(), id: `id-${i}` }));
    }
    await Promise.all(writes);
    expect((await store.load('product-test'))!.id).toBe('id-24');
  });
});

describe('without IndexedDB', () => {
  test('the store still works in memory, so a tour can run where IndexedDB is unavailable', async () => {
    // bun has no global indexedDB: createTourStore() falls back to memory.
    expect(globalThis.indexedDB).toBeUndefined();
    const store = createTourStore();
    await store.save(runningTour());
    const loaded = await store.load('product-test');
    expect(frameOf(loaded!, 'a-frame')?.status).toBe('interrupted');
    await store.remove('product-test');
    expect(await store.load('product-test')).toBeNull();
  });
});
