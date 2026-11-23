// Shared fixtures. `echoTour` mirrors the plugin's redaction acceptance fixture
// (testframe-plugin-spring RedactionBoundaryTest): a secret declared in sources.local.private.yaml
// and echoed back by the HTTP target, as it arrives at the browser — already redacted.

import type { CardResult, FrameFinishedEvent, FrameStartedEvent, StreamCard } from '../src/protocol';
import { createTour, type Tour } from '../src/tour-state';

/** A secret with characters whose raw, JSON-escaped and URL-encoded forms all differ. */
export const SECRET = 'p@ss+w"rd\\1';
/** The plugin's own fixture secret, so both sides of the acceptance test use the same value. */
export const PLUGIN_SECRET = 'Sup3rS3cretApiKey';
export const MASK = '***';

const NOW = new Date('2026-11-22T17:03:07.120Z');

const card = (partial: Partial<CardResult> & { varName: string; status: CardResult['status'] }): CardResult => ({
  title: partial.varName,
  text: `[Step 1] ${partial.varName}: ok`,
  output: '',
  ranAt: '2026-11-22T17:03:07.200Z',
  offsetMs: 80,
  elapsedMs: 12,
  code: null,
  skippedBy: null,
  detail: {},
  ...partial
} as CardResult);

const started = (cards: StreamCard[], sources: FrameStartedEvent['sources'], inputs: FrameStartedEvent['inputs'] = {}): FrameStartedEvent => ({
  event: 'frame-started',
  runId: 'run-1',
  frame: 'fixture',
  environment: 'local',
  pluginVersion: '0.4.0',
  at: '2026-11-22T17:03:07.100Z',
  inputs,
  sources,
  cards
});

const finished = (status: FrameFinishedEvent['status'], counts: FrameFinishedEvent['counts'], elapsedMs = 412): FrameFinishedEvent => ({
  event: 'frame-finished',
  status,
  stopped: status === 'passed' ? null : status === 'failed' ? 'error' : 'cancelled',
  elapsedMs,
  counts
});

/**
 * The redaction fixture: one frame, one openapi card whose request header and echoed response
 * body carry the masked secret, and a mongo source whose URI user-info is masked.
 */
export function echoTour(): Tour {
  const cards: StreamCard[] = [
    {
      step: 1,
      varName: 'getEcho',
      title: 'Get echo',
      source: 'openapi/echo-api',
      subtype: 'restapi',
      endpoint: 'GET /echo',
      openapiId: 'echo',
      code: ''
    }
  ];
  const sources: FrameStartedEvent['sources'] = {
    'openapi/echo-api': {
      baseUrl: 'http://127.0.0.1:18081/spec.json',
      apiBase: 'http://127.0.0.1:18081',
      headers: { 'x-api-key': MASK, authorization: MASK },
      privateFields: ['headers.x-api-key', 'headers.authorization']
    },
    'mongo/products-db': {
      baseUrl: `mongodb://${MASK}@db:27017/products`,
      privateFields: ['base-url']
    }
  };
  const result = card({
    varName: 'getEcho',
    status: 'success',
    text: '[Step 1] Get echo: HTTP 200 (4ms)',
    output: `{ "apiKey": "${MASK}", "dsn": "mongodb://${MASK}@db:27017/products" }`,
    detail: {
      request: {
        method: 'GET',
        url: 'http://127.0.0.1:18081/echo',
        headers: { 'x-api-key': MASK, authorization: MASK },
        body: null
      },
      response: {
        status: 200,
        headers: { 'content-type': 'application/json' },
        elapsedMs: 4,
        body: { apiKey: MASK, dsn: `mongodb://${MASK}@db:27017/products`, token: MASK },
        truncated: false
      },
      published: { getEcho: { apiKey: MASK, dsn: `mongodb://${MASK}@db:27017/products` } }
    }
  });
  const tour = createTour({ project: 'echo-project', environment: 'local', lang: 'en', frames: ['echo-secret'], now: NOW });
  return {
    ...tour,
    id: '20261122-140307',
    pluginVersion: '0.4.0',
    status: 'finished',
    finishedAt: '2026-11-22T17:03:08.000Z',
    result: 'passed',
    frames: [
      {
        frame: 'echo-secret',
        status: 'passed',
        attempts: 1,
        started: { ...started(cards, sources), frame: 'echo-secret' },
        results: [result],
        finished: finished('passed', { success: 1, error: 0, skipped: 0, notRun: 0 })
      }
    ]
  };
}

/**
 * A richer tour for the screens and the report layout: a passed frame with a mongo call, a
 * rawvalue input (overridden), a failing jsonassert script and a conditional that skipped a card;
 * and a failed frame with an HTTP error plus a not-run card.
 */
export function productTour(): Tour {
  const firstCards: StreamCard[] = [
    { step: 1, varName: 'getActiveProducts', title: 'Get active products', source: 'mongo/products-db', subtype: 'find', collection: 'products', code: '[\n  { "ativo": true }\n]' },
    { step: 1, varName: 'activeProducts', title: 'Active products', source: 'rawvalue', subtype: 'json', code: '[]' },
    { step: 1, varName: 'hasProducts', title: 'Has products', source: 'jsonassert', subtype: 'conditional', code: '$count(activeProducts) > 0' },
    { step: 2, varName: 'productPayload', title: 'Product payload', source: 'rawvalue', subtype: 'json', code: '{ "nome": "saved" }' },
    { step: 2, varName: 'createProduct', title: 'Create product copy', source: 'openapi/product-api', subtype: 'restapi', endpoint: 'POST /api/products', code: '' },
    { step: 2, varName: 'assertCreatedProduct', title: 'Assert created product', source: 'jsonassert', subtype: 'script', code: 'assert createdProduct.preco == 100' }
  ];
  const firstSources: FrameStartedEvent['sources'] = {
    'mongo/products-db': { baseUrl: 'mongodb://localhost:27017/products', privateFields: [] },
    'openapi/product-api': {
      baseUrl: 'http://localhost:18081/api/docs/openapi.json',
      apiBase: 'http://localhost:18081',
      headers: { 'x-tenant': 'testframe' },
      privateFields: []
    }
  };
  const firstInputs: FrameStartedEvent['inputs'] = {
    productPayload: { step: 2, overridden: true, value: { nome: 'Tour copy', preco: 99 }, saved: { nome: 'saved' } }
  };
  const firstResults: CardResult[] = [
    card({
      varName: 'getActiveProducts',
      status: 'success',
      text: '[Step 1] Get active products: mongo products.find → 2 (67ms)',
      output: '[ { "nome": "Kit Testes E2E" } ]',
      detail: {
        bindings: {},
        call: { source: 'mongo/products-db', database: 'products', collection: 'products', operation: 'find', args: [{ ativo: true }] },
        result: { operation: 'find', collection: 'products', count: 2, result: [{ nome: 'Kit Testes E2E' }] },
        published: { getActiveProducts: [{ nome: 'Kit Testes E2E' }] }
      }
    }),
    card({ varName: 'activeProducts', status: 'success', detail: { value: [{ nome: 'Kit Testes E2E' }], published: { activeProducts: [{ nome: 'Kit Testes E2E' }] } } }),
    card({
      varName: 'hasProducts',
      status: 'success',
      detail: { condition: { expression: '$count(activeProducts) > 0', value: true, decision: 'continue', skipped: [] } }
    }),
    card({ varName: 'productPayload', status: 'success', detail: { value: { nome: 'Tour copy', preco: 99 } } }),
    card({
      varName: 'createProduct',
      status: 'success',
      text: '[Step 2] Create product copy: HTTP 201 (42ms)',
      detail: {
        request: { method: 'POST', url: 'http://localhost:18081/api/products', headers: { 'x-tenant': 'testframe' }, body: { nome: 'Tour copy', preco: 99 } },
        response: { status: 201, headers: { 'content-type': 'application/json' }, elapsedMs: 42, body: { id: '6740', nome: 'Tour copy', preco: 99 }, truncated: false }
      }
    }),
    card({
      varName: 'assertCreatedProduct',
      status: 'error',
      text: '[Step 2] Assert created product: assertion failed',
      output: 'assert createdProduct.preco == 100 failed',
      detail: {
        statements: [
          { line: 1, kind: 'assert', statement: 'assert createdProduct.preco == 100', passed: false, actual: 99, operator: '==', expected: 100, jsonata: '$.createdProduct.preco = 100', error: null }
        ]
      }
    })
  ];

  const secondCards: StreamCard[] = [
    { step: 1, varName: 'deleteAll', title: 'Delete all products', source: 'mongo/products-db', subtype: 'deleteMany', collection: 'products', code: '[\n  {}\n]' },
    { step: 1, varName: 'neverRuns', title: 'Never runs', source: 'rawvalue', subtype: 'json', code: 'null' }
  ];
  const secondResults: CardResult[] = [
    card({
      varName: 'deleteAll',
      status: 'error',
      text: '[Step 1] Delete all products: HTTP 500',
      output: 'connection refused',
      detail: {
        response: { status: 500, headers: {}, elapsedMs: 3, body: { message: 'connection refused' }, truncated: false }
      }
    })
  ];

  const tour = createTour({
    project: 'product-test',
    environment: 'local',
    lang: 'pt-BR',
    frames: ['active-products-echo', 'product-crud'],
    now: NOW
  });
  return {
    ...tour,
    id: '20261122-140307',
    pluginVersion: '0.4.0',
    status: 'finished',
    finishedAt: '2026-11-22T17:04:00.000Z',
    result: 'failed',
    frames: [
      {
        frame: 'active-products-echo',
        status: 'failed',
        attempts: 2,
        inputs: { productPayload: '{ "nome": "Tour copy", "preco": 99 }' },
        started: { ...started(firstCards, firstSources, firstInputs), frame: 'active-products-echo' },
        results: firstResults,
        finished: finished('failed', { success: 5, error: 1, skipped: 0, notRun: 0 }, 1200)
      },
      {
        frame: 'product-crud',
        status: 'failed',
        attempts: 1,
        started: { ...started(secondCards, { 'mongo/products-db': firstSources['mongo/products-db'] }), frame: 'product-crud' },
        results: secondResults,
        finished: finished('failed', { success: 0, error: 1, skipped: 0, notRun: 1 }, 30)
      }
    ]
  };
}
