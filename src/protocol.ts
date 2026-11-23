// The wire shapes of the tour API and of the run stream (docs/test-tour.md, "Tour API" and
// "Run events"; docs/runner-protocol.md, "CardResult"). These are the plugin's read-only
// decoders' output: the tour UI never reads a project file and never invents a field.

/** A card's outcome, as the plugin reports it. */
export type CardStatus = 'success' | 'error' | 'skipped';

/** Why a frame run stopped: an error card, the run deadline, or a cancel. */
export type StopReason = 'error' | 'deadline' | 'cancelled' | null;

/** A frame's outcome, as the plugin reports it in `frame-finished`. */
export type FrameRunStatus = 'passed' | 'failed' | 'interrupted';

/** Card counts of one frame run. */
export interface Counts {
  success: number;
  error: number;
  skipped: number;
  notRun: number;
}

/** `GET /projects` entry. */
export interface ProjectSummary {
  name: string;
  frames: string[];
}

/** `GET /projects/{project}/environments` entry: an environment and the source refs configured in it. */
export interface EnvironmentSummary {
  name: string;
  sources: string[];
}

export interface EnvironmentsResponse {
  environments: EnvironmentSummary[];
  errors: string[];
}

/** `GET /projects/{project}/frames` entry. */
export interface FrameSummary {
  name: string;
  steps: number;
  cards: number;
  inputs: number;
  /** The source refs (`{type}/{name}`) this frame's cards use. */
  sources: string[];
  /** Load problems of the frame; it stays selectable and its invalid cards fail when run. */
  errors: string[];
}

/** One input card (`GET /projects/{project}/frames/{frame}/inputs`): `value` is its saved code. */
export interface InputCard {
  step: number;
  varName: string;
  title: string;
  value: string;
}

/** One `{{binding}}` of a card code and the value it resolved to. */
export type BindingsDetail = Record<string, unknown>;

export interface RequestDetail {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface ResponseDetail {
  status: number;
  headers: Record<string, string>;
  elapsedMs: number;
  body: unknown;
  truncated?: boolean;
}

export interface CallDetail {
  source: string;
  database: string;
  collection: string;
  operation: string;
  args: unknown[];
}

export interface ResultDetail {
  operation: string;
  collection: string;
  count?: number;
  result: unknown;
}

export interface AssertStatement {
  line: number;
  kind: 'assert';
  statement: string;
  passed: boolean;
  actual: unknown;
  operator: string;
  expected: unknown;
  jsonata: string | null;
  error: string | null;
}

export interface ExpressionStatement {
  line: number;
  kind: 'expression';
  statement: string;
  value: unknown;
}

export type Statement = AssertStatement | ExpressionStatement;

export interface ConditionDetail {
  expression: string;
  value: unknown;
  decision: 'continue' | 'skip-rest-of-step';
  skipped: string[];
}

/**
 * The structured evidence of a card. Every key is present when it applies; unknown keys the
 * plugin may add later are kept (the screens show them as raw JSON).
 */
export interface CardDetail {
  bindings?: BindingsDetail;
  value?: unknown;
  request?: RequestDetail;
  response?: ResponseDetail;
  call?: CallDetail;
  result?: ResultDetail;
  statements?: Statement[];
  condition?: ConditionDetail;
  published?: Record<string, unknown>;
  [key: string]: unknown;
}

/** One card's result (`docs/runner-protocol.md`, "CardResult"). */
export interface CardResult {
  varName: string;
  status: CardStatus;
  text: string;
  output: string;
  ranAt: string;
  offsetMs: number;
  elapsedMs: number;
  code: string | null;
  skippedBy: string | null;
  detail: CardDetail;
}

/** One card of `frame-started.cards`, in run order, as it will run (inputs applied). */
export interface StreamCard {
  step: number;
  varName: string;
  title: string;
  source: string | null;
  subtype: string | null;
  collection?: string;
  endpoint?: string;
  openapiId?: string;
  code: string;
}

/** One input of `frame-started.inputs`: the value the run uses, plus the saved one when overridden. */
export interface StreamInput {
  step: number;
  overridden: boolean;
  value: unknown;
  saved?: unknown;
}

/** One resolved source of `frame-started.sources`; values from private layers are already `***`. */
export interface StreamSource {
  baseUrl: string;
  apiBase?: string;
  headers?: Record<string, string>;
  privateFields: string[];
  error?: string;
  warning?: string;
}

export interface FrameStartedEvent {
  event: 'frame-started';
  runId?: string;
  frame: string;
  environment: string;
  pluginVersion: string;
  at: string;
  inputs: Record<string, StreamInput>;
  sources: Record<string, StreamSource>;
  cards: StreamCard[];
}

export interface CardStartedEvent {
  event: 'card-started';
  step: number;
  varName: string;
  at: string;
}

export interface CardFinishedEvent {
  event: 'card-finished';
  step: number;
  result: CardResult;
}

export interface FrameFinishedEvent {
  event: 'frame-finished';
  status: FrameRunStatus;
  stopped: StopReason;
  elapsedMs: number;
  counts: Counts;
}

/** An unexpected failure after the stream started; the frame is then `interrupted`. */
export interface StreamErrorEvent {
  event: 'error';
  message: string;
}

export type RunEvent =
  | FrameStartedEvent
  | CardStartedEvent
  | CardFinishedEvent
  | FrameFinishedEvent
  | StreamErrorEvent;

/** `POST /projects/{project}/frames/{frame}/run` body. */
export interface TourRunRequest {
  runId: string;
  environment: string;
  inputs: Record<string, string>;
}
