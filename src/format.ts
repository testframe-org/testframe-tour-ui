// Formatting shared by the screens and the PDF: dates in the browser's time zone, durations,
// numbers and the JSON text of a value. One implementation, so the report and the screens can
// never disagree about what a value looks like.

import type { Lang } from './tour-state';

const LOCALE: Record<Lang, string> = { en: 'en-GB', 'pt-BR': 'pt-BR' };

/** Blocks longer than this are cut in the PDF, with a "truncated (n more lines)" note. */
export const MAX_BLOCK_LINES = 200;

export const localeOf = (lang: Lang): string => LOCALE[lang] ?? LOCALE.en;

/** `22/11/2026, 17:03:07 GMT-3` (en) / the same in pt-BR: local date-time with zone offset. */
export function formatDateTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  // dateStyle/timeStyle cannot be combined with timeZoneName, so the components are spelled out.
  return new Intl.DateTimeFormat(localeOf(lang), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  }).format(date);
}

/** The time part only, for a card's `ranAt` in a table. */
export function formatTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(localeOf(lang), { timeStyle: 'medium' }).format(date);
}

export function formatNumber(value: number, lang: Lang): string {
  return new Intl.NumberFormat(localeOf(lang)).format(value);
}

/** `412 ms` below a second, `1.2 s` above. */
export function formatDuration(ms: number | null | undefined, lang: Lang): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  if (ms < 1000) return `${formatNumber(ms, lang)} ms`;
  return `${new Intl.NumberFormat(localeOf(lang), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(ms / 1000)} s`;
}

/** The text of a value: pretty JSON when it is not a string, the string itself otherwise. */
export function textOf(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

/** One-line text of a value (a badge, a table cell): JSON without indentation. */
export function inlineTextOf(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export interface TruncatedBlock {
  text: string;
  /** How many lines were cut (0 when the block fits). */
  hidden: number;
}

/** Cuts a block at {@link MAX_BLOCK_LINES} lines. */
export function truncateBlock(text: string): TruncatedBlock {
  const lines = text.split('\n');
  if (lines.length <= MAX_BLOCK_LINES) return { text, hidden: 0 };
  return { text: lines.slice(0, MAX_BLOCK_LINES).join('\n'), hidden: lines.length - MAX_BLOCK_LINES };
}

/** Cuts one long line at `max` characters, for table cells. */
export function cutLine(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}
