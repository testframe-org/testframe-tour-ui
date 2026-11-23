// The tour API client: the exact requests it sends (the IDE's proxy rejects a POST with no JSON
// content type) and how it reads the NDJSON run stream.

import { describe, expect, test } from 'bun:test';
import { NdjsonError } from '../src/ndjson';
import { TourApiError, createTourApi, problemsOf, reasonOf } from '../src/api';
import type { RunEvent } from '../src/protocol';

interface Call {
  url: string;
  init?: RequestInit;
}

function recorder(handler: (url: string, init?: RequestInit) => Response) {
  const calls: Call[] = [];
  const fn = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { fn, calls };
}

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });

/** A stream whose chunks deliberately cut JSON lines in the middle. */
function ndjsonResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  });
  return new Response(stream, { status, headers: { 'Content-Type': 'application/x-ndjson' } });
}

describe('the read routes', () => {
  test('every path is built on the injected base, with no trailing slash twice', async () => {
    const { fn, calls } = recorder(() => jsonResponse({}));
    const api = createTourApi('/api/tour/', fn);
    await api.projects();
    await api.environments('product-test');
    await api.frames('product-test');
    await api.inputs('product-test', 'active-products-echo');
    expect(calls.map((call) => call.url)).toEqual([
      '/api/tour/projects',
      '/api/tour/projects/product-test/environments',
      '/api/tour/projects/product-test/frames',
      '/api/tour/projects/product-test/frames/active-products-echo/inputs'
    ]);
  });

  test('project and frame names are URL-encoded', async () => {
    const { fn, calls } = recorder(() => jsonResponse({ inputs: [] }));
    await createTourApi('/api/tour', fn).inputs('a b/c', 'frame&1');
    expect(calls[0].url).toBe('/api/tour/projects/a%20b%2Fc/frames/frame%261/inputs');
  });

  test('the responses are unwrapped, with empty defaults', async () => {
    const { fn } = recorder((url) => {
      if (url.endsWith('/projects')) return jsonResponse({ projects: [{ name: 'p', frames: ['f'] }] });
      if (url.endsWith('/environments')) return jsonResponse({ environments: [{ name: 'local', sources: ['mongo/db'] }] });
      if (url.endsWith('/frames')) return jsonResponse({ frames: [{ name: 'f', steps: 1, cards: 2, inputs: 1, sources: ['mongo/db'], errors: [] }] });
      return jsonResponse({ frame: 'f', inputs: [{ step: 1, varName: 'v', title: 'V', value: '{}' }] });
    });
    const api = createTourApi('/api/v1/tour', fn);
    expect(await api.projects()).toEqual([{ name: 'p', frames: ['f'] }]);
    expect(await api.environments('p')).toEqual({ environments: [{ name: 'local', sources: ['mongo/db'] }], errors: [] });
    expect((await api.frames('p'))[0].name).toBe('f');
    expect(await api.inputs('p', 'f')).toEqual([{ step: 1, varName: 'v', title: 'V', value: '{}' }]);
  });

  test('a non-2xx answer carries the server reason and every problem', async () => {
    const { fn } = recorder(() => jsonResponse({ status: 400, message: 'invalid inputs', problems: ['a: invalid JSON: x', 'b: not an input'] }, { status: 400 }));
    const error = await createTourApi('/api/tour', fn).frames('p').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TourApiError);
    expect((error as TourApiError).status).toBe(400);
    expect(reasonOf(error)).toBe('invalid inputs');
    expect(problemsOf(error)).toEqual(['a: invalid JSON: x', 'b: not an input']);
  });

  test('a non-JSON error body still becomes an ApiError', async () => {
    const { fn } = recorder(() => new Response('boom', { status: 502 }));
    const error = (await createTourApi('/api/tour', fn).projects().catch((e: unknown) => e)) as TourApiError;
    expect(error.status).toBe(502);
    expect(reasonOf(error)).toContain('boom');
  });
});

describe('the run stream', () => {
  const body = { runId: 'run-1', environment: 'local', inputs: { productPayload: '{"preco":99}' } };

  test('the run is a POST with a JSON content type, the NDJSON accept header and the body', async () => {
    const { fn, calls } = recorder(() => ndjsonResponse([]));
    await createTourApi('/api/tour', fn).run('product-test', 'active-products-echo', body, () => undefined);
    expect(calls[0].url).toBe('/api/tour/projects/product-test/frames/active-products-echo/run');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Accept']).toBe('application/x-ndjson');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual(body);
  });

  test('events arrive in order, including a line split across chunks and blank lines', async () => {
    const { fn } = recorder(() =>
      ndjsonResponse([
        '{"event":"frame-started","frame":"f","environment":"local","pluginVersion":"0.4.0","at":"t","inputs":{},"sources":{},"cards":[]}\n',
        '{"event":"ca',
        'rd-started","step":1,"varName":"a","at":"t"}\n\n',
        '{"event":"card-finished","step":1,"result":{"varName":"a","status":"success","text":"ok","output":"","ranAt":"t","offsetMs":1,"elapsedMs":1,"code":null,"skippedBy":null,"detail":{}}}\r\n',
        '{"event":"frame-finished","status":"passed","stopped":null,"elapsedMs":9,"counts":{"success":1,"error":0,"skipped":0,"notRun":0}}'
      ])
    );
    const events: RunEvent[] = [];
    await createTourApi('/api/tour', fn).run('p', 'f', body, (event) => events.push(event));
    expect(events.map((event) => event.event)).toEqual(['frame-started', 'card-started', 'card-finished', 'frame-finished']);
    expect((events[3] as { counts: { success: number } }).counts.success).toBe(1);
  });

  test('a run error before the first event is an ApiError, not a stream error', async () => {
    const { fn } = recorder(() => jsonResponse({ status: 404, message: 'unknown environment: hml' }, { status: 404 }));
    const error = (await createTourApi('/api/tour', fn).run('p', 'f', body, () => undefined).catch((e: unknown) => e)) as TourApiError;
    expect(error.status).toBe(404);
    expect(reasonOf(error)).toBe('unknown environment: hml');
  });

  test('a malformed line and a truncated last line reject', async () => {
    const bad = recorder(() => ndjsonResponse(['not json\n']));
    await expect(createTourApi('/api/tour', bad.fn).run('p', 'f', body, () => undefined)).rejects.toBeInstanceOf(NdjsonError);

    const truncated = recorder(() => ndjsonResponse(['{"event":"card-started"']));
    await expect(createTourApi('/api/tour', truncated.fn).run('p', 'f', body, () => undefined)).rejects.toBeInstanceOf(NdjsonError);
  });

  test('an empty body is not an error', async () => {
    const { fn } = recorder(() => new Response(null, { status: 200 }));
    const events: RunEvent[] = [];
    await createTourApi('/api/tour', fn).run('p', 'f', body, (event) => events.push(event));
    expect(events).toEqual([]);
  });
});

describe('cancel', () => {
  test('cancel is a POST with a JSON content type and no body', async () => {
    const { fn, calls } = recorder(() => new Response(null, { status: 202 }));
    await createTourApi('/api/tour', fn).cancel('run-1');
    expect(calls[0].url).toBe('/api/tour/runs/run-1/cancel');
    expect(calls[0].init?.method).toBe('POST');
    expect((calls[0].init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(calls[0].init?.body).toBeUndefined();
  });

  test('404 (no such run in progress) is reported', async () => {
    const { fn } = recorder(() => jsonResponse({ status: 404, message: 'no such run in progress: run-9' }, { status: 404 }));
    const error = (await createTourApi('/api/tour', fn).cancel('run-9').catch((e: unknown) => e)) as TourApiError;
    expect(error.status).toBe(404);
    expect(reasonOf(error)).toContain('no such run in progress');
  });
});
