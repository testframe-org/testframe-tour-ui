// The tour UI's client of the stateless tour API (docs/test-tour.md, "Tour API"). The base URL is
// injected by the host: `/api/v1/tour` in the plugin, `/api/tour` in the IDE. Every answer is
// already redacted by the plugin, so nothing here has to know about secrets.

import { readNdjson } from './ndjson';
import type {
  EnvironmentsResponse,
  FrameSummary,
  InputCard,
  ProjectSummary,
  RunEvent,
  TourRunRequest
} from './protocol';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** A `{status, message, problems?}` answer of the tour API. */
export class TourApiError extends Error {
  readonly status: number;
  /** The server's `message`, without the status prefix. */
  readonly reason: string;
  /** Every problem the server listed (a rejected run lists all of them). */
  readonly problems: string[];

  constructor(status: number, message: string, reason = message, problems: string[] = []) {
    super(message);
    this.name = 'TourApiError';
    this.status = status;
    this.reason = reason;
    this.problems = problems;
  }
}

/** The error text to show: the server's reason when there is one, else the message. */
export const reasonOf = (e: unknown): string =>
  e instanceof TourApiError && e.reason ? e.reason : (e as Error)?.message ?? String(e);

/** Every problem of a rejected request (the reason alone when the server listed none). */
export const problemsOf = (e: unknown): string[] =>
  e instanceof TourApiError && e.problems.length ? e.problems : [reasonOf(e)];

async function toApiError(res: Response): Promise<TourApiError> {
  let body = '';
  try {
    body = await res.text();
  } catch {
    return new TourApiError(res.status, `HTTP ${res.status}`);
  }
  try {
    const parsed = JSON.parse(body) as { message?: unknown; problems?: unknown };
    if (typeof parsed.message === 'string') {
      const problems = Array.isArray(parsed.problems)
        ? parsed.problems.filter((p): p is string => typeof p === 'string')
        : [];
      return new TourApiError(res.status, `${res.status} ${parsed.message}`, parsed.message, problems);
    }
  } catch {
    /* not JSON: the body is the reason */
  }
  return new TourApiError(res.status, body ? `${res.status} ${body.slice(0, 300)}` : `HTTP ${res.status}`, body);
}

/** A client UUID for one run, used only to cancel it. */
export function newRunId(random: () => string = () => crypto.randomUUID()): string {
  return random();
}

export interface TourApi {
  /** `GET /projects`. */
  projects(): Promise<ProjectSummary[]>;
  /** `GET /projects/{project}/environments`. */
  environments(project: string): Promise<EnvironmentsResponse>;
  /** `GET /projects/{project}/frames`. */
  frames(project: string): Promise<FrameSummary[]>;
  /** `GET /projects/{project}/frames/{frame}/inputs`. */
  inputs(project: string, frame: string): Promise<InputCard[]>;
  /**
   * `POST /projects/{project}/frames/{frame}/run`: streams the NDJSON events to `onEvent`.
   * Rejects with {@link TourApiError} for a non-2xx answer (detected before the first event).
   */
  run(project: string, frame: string, body: TourRunRequest, onEvent: (e: RunEvent) => void, signal?: AbortSignal): Promise<void>;
  /** `POST /runs/{runId}/cancel`: 202, or 404 when no such run is in progress. */
  cancel(runId: string): Promise<void>;
}

const enc = (segment: string): string => encodeURIComponent(segment);

export function createTourApi(base: string, fetchImpl: FetchLike = (...args) => fetch(...args)): TourApi {
  const url = (path: string): string => `${base.replace(/\/+$/, '')}${path}`;

  async function getJson<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(url(path), { headers: { Accept: 'application/json' } });
    } catch (e) {
      throw new TourApiError(0, `the tour API did not answer: ${(e as Error).message}`);
    }
    if (!res.ok) throw await toApiError(res);
    return (await res.json()) as T;
  }

  return {
    async projects() {
      const body = await getJson<{ projects: ProjectSummary[] }>('/projects');
      return body.projects ?? [];
    },
    async environments(project) {
      const body = await getJson<EnvironmentsResponse>(`/projects/${enc(project)}/environments`);
      return { environments: body.environments ?? [], errors: body.errors ?? [] };
    },
    async frames(project) {
      const body = await getJson<{ frames: FrameSummary[] }>(`/projects/${enc(project)}/frames`);
      return body.frames ?? [];
    },
    async inputs(project, frame) {
      const body = await getJson<{ frame: string; inputs: InputCard[] }>(
        `/projects/${enc(project)}/frames/${enc(frame)}/inputs`
      );
      return body.inputs ?? [];
    },
    async run(project, frame, body, onEvent, signal) {
      let res: Response;
      try {
        res = await fetchImpl(url(`/projects/${enc(project)}/frames/${enc(frame)}/run`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
          body: JSON.stringify(body),
          signal
        });
      } catch (e) {
        if (signal?.aborted) return;
        throw new TourApiError(0, `the tour API did not answer: ${(e as Error).message}`);
      }
      if (!res.ok) throw await toApiError(res);
      await readNdjson<RunEvent>(res, onEvent);
    },
    async cancel(runId) {
      let res: Response;
      try {
        // The IDE's proxy route rejects a POST whose Content-Type is not JSON (415), so the header
        // is sent even though a cancel has no body.
        res = await fetchImpl(url(`/runs/${enc(runId)}/cancel`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
        });
      } catch (e) {
        throw new TourApiError(0, `the tour API did not answer: ${(e as Error).message}`);
      }
      if (!res.ok) throw await toApiError(res);
    }
  };
}
