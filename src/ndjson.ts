// The NDJSON reader of a run stream (docs/test-tour.md, "Run events"): one JSON object per line,
// flushed per event. It is one `fetch` read line by line — the same format `/api/v1/run` streams.

/** Raised when a line of the stream is not JSON, or when the stream ends in the middle of a line. */
export class NdjsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NdjsonError';
  }
}

/**
 * Splits a text into complete lines plus the incomplete remainder. `\r\n` is accepted because the
 * stream may pass through a proxy that normalizes line endings.
 */
export function splitLines(buffer: string): { lines: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n');
  const rest = parts.pop() ?? '';
  return { lines: parts.filter((line) => line.trim() !== ''), rest };
}

/**
 * Reads `response.body` and calls `onEvent` with every parsed object, in order. Resolves when the
 * stream ends; a malformed line — including a last line cut off by a dropped connection — rejects
 * with {@link NdjsonError}. A stream that ends without a trailing newline is accepted: what
 * remains is its last line.
 */
export async function readNdjson<T>(response: Response, onEvent: (event: T) => void): Promise<void> {
  const body = response.body;
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { lines, rest } = splitLines(buffer);
    buffer = rest;
    for (const line of lines) onEvent(parseEvent<T>(line));
  }
  buffer += decoder.decode();
  const { lines, rest } = splitLines(buffer);
  for (const line of lines) onEvent(parseEvent<T>(line));
  if (rest.trim() !== '') onEvent(parseEvent<T>(rest));
}

function parseEvent<T>(line: string): T {
  try {
    return JSON.parse(line) as T;
  } catch (e) {
    throw new NdjsonError(`not JSON: ${line.slice(0, 200)} (${(e as Error).message})`);
  }
}
