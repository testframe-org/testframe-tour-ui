'use client';

// The public entry point of @testframe/tour-ui (docs/test-tour.md, "Tour UI").
//
// Two hosts, one implementation:
//   - the IDE compiles these sources directly (tsconfig "paths" → src/index.ts) and renders
//     <TourApp apiBase="/api/tour" … /> on its /tour page;
//   - the plugin serves the static Vite bundle of the same sources at /tour (src/main.tsx), whose
//     API base is "/api/v1/tour".
//
// @react-pdf/renderer, the report components and the subset DejaVu fonts are all behind the
// dynamic import in src/pdf/index.ts, so nothing heavy is in the initial bundle of either host.

export { TourApp, resumeIndex, type TourAppProps } from './tour-app';

// The tour API client (docs/test-tour.md, "Tour API").
export {
  TourApiError,
  createTourApi,
  newRunId,
  problemsOf,
  reasonOf,
  type FetchLike,
  type TourApi
} from './api';
export { NdjsonError, readNdjson, splitLines } from './ndjson';

// The tour state and its persistence (docs/test-tour.md, "Tour state").
export * from './tour-state';
export { createTourStore, type TourStore } from './store';

// The screens' decisions, exposed for the hosts and for the tests.
export {
  MONGO_WRITE_SUBTYPES,
  canStart,
  configuredSources,
  missingSources,
  mongoSourceRefs,
  mongoWriteCards,
  sortedFrameNames,
  type MissingSource
} from './selection';
export { firstInvalid, formatJson, isChanged, parseJson, resetDraft, runInputs, toDrafts, type InputDraft, type JsonCheck } from './inputs';

// Formatting and labels shared by the screens and the PDF.
export {
  MAX_BLOCK_LINES,
  cutLine,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatTime,
  inlineTextOf,
  localeOf,
  textOf,
  truncateBlock,
  type TruncatedBlock
} from './format';
export { cardLabel, frameLabel, resultLabel, toneOf, tourLabel, type Tone } from './labels';

// i18n: one catalog for the screens and the PDF.
export { I18nProvider, catalogs, translator, useI18n, type I18nValue, type Messages, type TKey, type Translator } from './i18n';

// The PDF, loaded on demand by downloadPdf/generatePdf. (`pdfFileName` comes from ./tour-state.)
export { downloadPdf, generatePdf } from './pdf';

// The stylesheet, injected once by TourApp.
export { TOUR_STYLES, injectTourStyles, useTourStyles } from './styles';

// The wire shapes of the tour API and of the run stream.
export type {
  AssertStatement,
  BindingsDetail,
  CallDetail,
  CardDetail,
  CardFinishedEvent,
  CardResult,
  CardStartedEvent,
  CardStatus,
  ConditionDetail,
  Counts,
  EnvironmentSummary,
  EnvironmentsResponse,
  ExpressionStatement,
  FrameFinishedEvent,
  FrameRunStatus,
  FrameStartedEvent,
  FrameSummary,
  InputCard,
  ProjectSummary,
  RequestDetail,
  ResponseDetail,
  ResultDetail,
  RunEvent,
  Statement,
  StopReason,
  StreamCard,
  StreamErrorEvent,
  StreamInput,
  StreamSource,
  TourRunRequest
} from './protocol';
