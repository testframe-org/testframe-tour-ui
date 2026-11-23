// The display label and the colour tone of every status token, in one place. The screens and the
// PDF both use it, so a status can never be worded or coloured differently in the report. The
// protocol tokens themselves (`passed`, `error`, `skip-rest-of-step`, …) are never translated —
// only their labels are.

import type { TKey, Translator } from './i18n';
import type { CardUiStatus, FrameStatus, TourResult, TourStatus } from './tour-state';

export type Tone = 'pass' | 'fail' | 'warn' | 'skip' | 'run' | 'idle';

const CARD_KEYS: Record<CardUiStatus, TKey> = {
  pending: 'cardStatus.pending',
  running: 'cardStatus.running',
  success: 'cardStatus.success',
  error: 'cardStatus.error',
  skipped: 'cardStatus.skipped',
  'not-run': 'cardStatus.not-run'
};

const FRAME_KEYS: Record<FrameStatus, TKey> = {
  pending: 'frameStatus.pending',
  running: 'frameStatus.running',
  passed: 'frameStatus.passed',
  failed: 'frameStatus.failed',
  interrupted: 'frameStatus.interrupted',
  'not-run': 'frameStatus.not-run'
};

const RESULT_KEYS: Record<TourResult, TKey> = {
  passed: 'result.passed',
  failed: 'result.failed',
  incomplete: 'result.incomplete'
};

const TOUR_KEYS: Record<TourStatus, TKey> = {
  open: 'tourStatus.open',
  finished: 'tourStatus.finished'
};

export const cardLabel = (t: Translator, status: CardUiStatus): string => t(CARD_KEYS[status] ?? 'cardStatus.pending');
export const frameLabel = (t: Translator, status: FrameStatus): string => t(FRAME_KEYS[status] ?? 'frameStatus.pending');
export const resultLabel = (t: Translator, result: TourResult): string => t(RESULT_KEYS[result] ?? 'result.incomplete');
export const tourLabel = (t: Translator, status: TourStatus): string => t(TOUR_KEYS[status] ?? 'tourStatus.open');

/** The colour of a status token, shared by the screen badges and the PDF badges. */
export function toneOf(status: string): Tone {
  switch (status) {
    case 'passed':
    case 'success':
      return 'pass';
    case 'failed':
    case 'error':
      return 'fail';
    case 'interrupted':
    case 'incomplete':
      return 'warn';
    case 'skipped':
      return 'skip';
    case 'running':
      return 'run';
    default:
      return 'idle';
  }
}
