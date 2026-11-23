// The formatting shared by the screens and the PDF (dates with a zone offset, durations, the
// 200-line cut of a long block).

import { describe, expect, test } from 'bun:test';
import { MAX_BLOCK_LINES, cutLine, formatDateTime, formatDuration, formatNumber, formatTime, inlineTextOf, textOf, truncateBlock } from '../src/format';

const AT = '2026-11-22T17:03:07.120Z';

describe('dates', () => {
  test('a date-time carries the zone offset of the browser, in both languages', () => {
    const en = formatDateTime(AT, 'en');
    const pt = formatDateTime(AT, 'pt-BR');
    // 22/11/2026, 17:03:07 GMT+0 (the offset depends on the machine's zone).
    expect(en).toMatch(/^22\/11\/2026[,.]?\s+\d{2}:\d{2}:\d{2}/);
    expect(pt).toMatch(/^22\/11\/2026[,.]?\s+\d{2}:\d{2}:\d{2}/);
    expect(en).toMatch(/GMT|UTC/);
    expect(pt).toMatch(/GMT|UTC/);
  });

  test('a missing or unreadable instant is shown as a dash or as it came', () => {
    expect(formatDateTime(null, 'en')).toBe('—');
    expect(formatDateTime(undefined, 'en')).toBe('—');
    expect(formatDateTime('not-a-date', 'en')).toBe('not-a-date');
  });

  test('the time-only form is shorter than the full one', () => {
    expect(formatTime(AT, 'en')).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(formatTime(null, 'en')).toBe('—');
  });
});

describe('numbers and durations', () => {
  test('a duration is in ms below a second and in seconds above', () => {
    expect(formatDuration(412, 'en')).toBe('412 ms');
    expect(formatDuration(1200, 'en')).toBe('1.2 s');
    expect(formatDuration(0, 'en')).toBe('0 ms');
    expect(formatDuration(null, 'en')).toBe('—');
  });

  test('numbers follow the locale', () => {
    expect(formatNumber(1234, 'en')).toBe('1,234');
    expect(formatNumber(1234, 'pt-BR')).toBe('1.234');
  });
});

describe('values as text', () => {
  test('a string is kept as it is, anything else becomes pretty JSON', () => {
    expect(textOf('plain')).toBe('plain');
    expect(textOf({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(textOf(null)).toBe('');
    expect(inlineTextOf({ a: 1 })).toBe('{"a":1}');
    expect(inlineTextOf(undefined)).toBe('');
  });
});

describe('long blocks', () => {
  const lines = (n: number): string => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n');

  test('a block of exactly MAX_BLOCK_LINES is not cut', () => {
    expect(truncateBlock(lines(MAX_BLOCK_LINES))).toEqual({ text: lines(MAX_BLOCK_LINES), hidden: 0 });
  });

  test('a longer block is cut and reports how many lines are missing', () => {
    const block = truncateBlock(lines(MAX_BLOCK_LINES + 7));
    expect(block.hidden).toBe(7);
    expect(block.text.split('\n')).toHaveLength(MAX_BLOCK_LINES);
    expect(block.text).toContain(`line ${MAX_BLOCK_LINES}`);
    expect(block.text).not.toContain(`line ${MAX_BLOCK_LINES + 1}`);
  });

  test('a table cell is cut on one line', () => {
    expect(cutLine('a\nb   c', 100)).toBe('a b c');
    expect(cutLine('0123456789', 6)).toBe('01234…');
    expect(cutLine('short', 10)).toBe('short');
  });
});
