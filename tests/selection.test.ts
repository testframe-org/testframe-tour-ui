// The start screen's decisions (docs/test-tour.md, screen 1) and the frame screen's mongo-write
// warning (screen 2, "Write warning").

import { describe, expect, test } from 'bun:test';
import type { EnvironmentSummary, FrameSummary, StreamCard } from '../src/protocol';
import {
  MONGO_WRITE_SUBTYPES,
  canStart,
  configuredSources,
  missingSources,
  mongoSourceRefs,
  mongoWriteCards,
  sortedFrameNames
} from '../src/selection';

const frame = (name: string, sources: string[], extra: Partial<FrameSummary> = {}): FrameSummary => ({
  name,
  steps: 2,
  cards: 4,
  inputs: 1,
  sources,
  errors: [],
  ...extra
});

const FRAMES: FrameSummary[] = [
  frame('zeta', ['openapi/product-api']),
  frame('alpha', ['mongo/products-db', 'openapi/product-api']),
  frame('middle', ['kafka/events'], { errors: ['step-1/bad-card.md: unknown subtype'] })
];

const ENVIRONMENTS: EnvironmentSummary[] = [
  { name: 'local', sources: ['openapi/product-api', 'mongo/products-db'] },
  { name: 'hml', sources: ['openapi/product-api'] },
  { name: 'broken', sources: [] }
];

const mongoCard = (varName: string, subtype: string, collection = 'products'): StreamCard => ({
  step: 1,
  varName,
  title: varName,
  source: 'mongo/products-db',
  subtype,
  collection,
  code: '[{}]'
});

describe('the frames checklist', () => {
  test('frames are listed sorted by name', () => {
    expect(sortedFrameNames(FRAMES)).toEqual(['alpha', 'middle', 'zeta']);
  });

  test('a frame with load errors stays in the list and keeps its errors', () => {
    const withErrors = sortedFrameNames(FRAMES).map((name) => FRAMES.find((f) => f.name === name)!);
    expect(withErrors[1].errors).toHaveLength(1);
  });
});

describe('missing sources', () => {
  test('nothing is missing when the environment configures every ref the selected frames use', () => {
    expect(missingSources(FRAMES, ['alpha', 'zeta'], configuredSources(ENVIRONMENTS, 'local'))).toEqual([]);
  });

  test('a ref the environment does not configure is listed with the frames that need it', () => {
    const missing = missingSources(FRAMES, ['alpha', 'zeta'], configuredSources(ENVIRONMENTS, 'hml'));
    expect(missing).toEqual([{ ref: 'mongo/products-db', frames: ['alpha'] }]);
  });

  test('several frames needing the same missing ref share one entry, in the selection order', () => {
    const frames = [frame('one', ['sql/orders-db']), frame('two', ['sql/orders-db', 'openapi/product-api'])];
    expect(missingSources(frames, ['two', 'one'], ['openapi/product-api'])).toEqual([
      { ref: 'sql/orders-db', frames: ['two', 'one'] }
    ]);
  });

  test('unchecked frames are not considered', () => {
    expect(missingSources(FRAMES, ['zeta'], configuredSources(ENVIRONMENTS, 'hml'))).toEqual([]);
  });

  test('an environment with nothing configured reports every ref', () => {
    const missing = missingSources(FRAMES, ['alpha'], configuredSources(ENVIRONMENTS, 'broken'));
    expect(missing.map((entry) => entry.ref).sort()).toEqual(['mongo/products-db', 'openapi/product-api']);
  });

  test('an unknown environment configures nothing', () => {
    expect(configuredSources(ENVIRONMENTS, 'nope')).toEqual([]);
    expect(configuredSources(ENVIRONMENTS, null)).toEqual([]);
  });
});

describe('start', () => {
  test('needs an environment, at least one frame and no missing source', () => {
    expect(canStart('local', ['alpha'], [])).toBe(true);
    expect(canStart(null, ['alpha'], [])).toBe(false);
    expect(canStart('local', [], [])).toBe(false);
    expect(canStart('local', ['alpha'], [{ ref: 'mongo/products-db', frames: ['alpha'] }])).toBe(false);
  });
});

describe('the mongo write warning', () => {
  test('every write subtype is recognised, reads are not', () => {
    const cards = [...MONGO_WRITE_SUBTYPES.map((subtype) => mongoCard(`w${subtype}`, subtype)), mongoCard('read', 'find'), mongoCard('agg', 'aggregation')];
    expect(mongoWriteCards(cards).map((card) => card.subtype)).toEqual([...MONGO_WRITE_SUBTYPES]);
  });

  test('a non-mongo card with a write-looking subtype is not a mongo write', () => {
    expect(mongoWriteCards([{ ...mongoCard('x', 'insertOne'), source: 'openapi/product-api' }])).toEqual([]);
    expect(mongoWriteCards([{ ...mongoCard('x', 'insertOne'), source: null }])).toEqual([]);
  });

  test('before the first run the warning comes from the frame summary mongo refs', () => {
    expect(mongoSourceRefs(frame('alpha', ['mongo/products-db', 'openapi/product-api']))).toEqual(['mongo/products-db']);
    expect(mongoSourceRefs(frame('zeta', ['openapi/product-api']))).toEqual([]);
    expect(mongoSourceRefs(undefined)).toEqual([]);
  });
});
