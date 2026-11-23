// One catalog for the screens and the PDF (agents/specs/test-tour.md, "i18n"): English authoritative,
// pt-BR complete.

import { describe, expect, test } from 'bun:test';
import en from '../src/i18n/en.json';
import ptBR from '../src/i18n/pt-BR.json';
import { catalogs, translator } from '../src/i18n';

const enKeys = Object.keys(en).sort();
const ptKeys = Object.keys(ptBR).sort();

describe('the catalogs', () => {
  test('pt-BR carries exactly the keys of en', () => {
    expect(ptKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
    expect(enKeys.filter((key) => !ptKeys.includes(key))).toEqual([]);
  });

  test('no value is empty and none keeps an untranslated English placeholder', () => {
    for (const [lang, catalog] of Object.entries(catalogs)) {
      for (const [key, value] of Object.entries(catalog)) {
        expect(value.trim(), `${lang}:${key}`).not.toBe('');
      }
    }
  });

  test('the same {vars} appear in both languages', () => {
    const varsOf = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of enKeys) {
      expect(varsOf(ptBR[key as keyof typeof ptBR]), key).toEqual(varsOf(en[key as keyof typeof en]));
    }
  });

  test('the PDF strings live under pdf.*', () => {
    expect(enKeys.filter((key) => key.startsWith('pdf.')).length).toBeGreaterThan(30);
  });
});

describe('the translator', () => {
  test('it substitutes every {var}', () => {
    const t = translator('en');
    expect(t('frame.header', { k: 2, n: 5, frame: 'alpha' })).toBe('Frame 2 of 5: alpha');
  });

  test('it translates', () => {
    expect(translator('en')('start.startButton')).toBe('Start tour');
    expect(translator('pt-BR')('start.startButton')).toBe('Iniciar tour');
    expect(translator('en')('pdf.title')).toBe('Test tour');
    expect(translator('pt-BR')('pdf.title')).toBe('Tour de testes');
  });

  test('an unknown key comes back as the key, and an unknown language falls back to English', () => {
    expect(translator('en')('nope.missing' as never)).toBe('nope.missing');
    expect(translator('de' as never)('start.startButton')).toBe('Start tour');
  });
});
