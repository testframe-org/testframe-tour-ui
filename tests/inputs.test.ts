// The frame screen's input editors (agents/specs/test-tour.md, "Inputs" and "Input cards").

import { describe, expect, test } from 'bun:test';
import type { InputCard } from '../src/protocol';
import { firstInvalid, formatJson, isChanged, parseJson, resetDraft, runInputs, toDrafts } from '../src/inputs';

const INPUTS: InputCard[] = [
  { step: 2, varName: 'productPayload', title: 'Product payload', value: '{"nome":"Copy","preco":10}' },
  { step: 3, varName: 'empty', title: '', value: '' }
];

describe('prefill', () => {
  test('the saved value arrives formatted, and the editor starts on it', () => {
    const drafts = toDrafts(INPUTS);
    expect(drafts[0].saved).toBe('{\n  "nome": "Copy",\n  "preco": 10\n}');
    expect(drafts[0].text).toBe(drafts[0].saved);
    expect(drafts[0].step).toBe(2);
    expect(drafts[0].title).toBe('Product payload');
  });

  test('a saved value that is not JSON is kept as it is and shows as invalid', () => {
    const [draft] = toDrafts([{ step: 1, varName: 'x', title: 'X', value: 'not json' }]);
    expect(draft.text).toBe('not json');
    expect(firstInvalid([draft])?.varName).toBe('x');
  });

  test('{{bindings}} inside strings survive the formatting', () => {
    const [draft] = toDrafts([{ step: 1, varName: 'p', title: 'P', value: '{"nome":"{{getActiveProducts.0.nome}} (copy)"}' }]);
    expect(draft.text).toContain('{{getActiveProducts.0.nome}} (copy)');
    expect(firstInvalid([draft])).toBeNull();
  });
});

describe('live local validation', () => {
  test('valid JSON parses, invalid JSON reports the parse error, empty text is an error', () => {
    expect(parseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseJson('  42  ')).toEqual({ ok: true, value: 42 });
    expect(parseJson('{')).toMatchObject({ ok: false });
    expect(parseJson('')).toEqual({ ok: false, error: 'empty' });
  });

  test('the first invalid input is the one Run reports', () => {
    const drafts = toDrafts(INPUTS).map((draft, index) => (index === 0 ? { ...draft, text: '{oops' } : draft));
    expect(firstInvalid(drafts)?.varName).toBe('productPayload');
  });

  test('no invalid input when every one parses', () => {
    const drafts = toDrafts(INPUTS).map((draft) => ({ ...draft, text: '{}' }));
    expect(firstInvalid(drafts)).toBeNull();
  });
});

describe('changed and reset', () => {
  test('a changed input is marked and Reset goes back to the saved value', () => {
    const [draft] = toDrafts(INPUTS);
    expect(isChanged(draft)).toBe(false);
    const edited = { ...draft, text: '{"nome":"Tour copy"}' };
    expect(isChanged(edited)).toBe(true);
    const reset = resetDraft(edited);
    expect(reset.text).toBe(draft.saved);
    expect(isChanged(reset)).toBe(false);
  });

  test('formatJson pretty-prints valid text and leaves invalid text alone', () => {
    expect(formatJson('{"a":[1,2]}')).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}');
    expect(formatJson('{oops')).toBe('{oops');
  });
});

describe('the run request', () => {
  test('every input travels with its current text, changed or not', () => {
    const drafts = toDrafts(INPUTS).map((draft) => (draft.varName === 'productPayload' ? { ...draft, text: '{"nome":"Tour copy"}' } : draft));
    expect(runInputs(drafts)).toEqual({ productPayload: '{"nome":"Tour copy"}', empty: '' });
  });

  test('a frame without inputs sends an empty map', () => {
    expect(runInputs(toDrafts([]))).toEqual({});
  });
});
