// One message catalog for the screens and for the PDF (docs/test-tour.md, "i18n"): English is
// authoritative, pt-BR is complete. `pdf.*` keys are the report's strings. Never translated:
// project data (titles, code, values) and every protocol token (`status`, `result`, `decision`).

import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import en from './en.json';
import ptBR from './pt-BR.json';
import type { Lang } from '../tour-state';

export type Messages = typeof en;
export type TKey = keyof Messages;

/** pt-BR must carry exactly the keys of en: a key added to en and forgotten here fails the typecheck. */
const ptCatalog: Messages = ptBR;

export const catalogs: Record<Lang, Messages> = { en, 'pt-BR': ptCatalog };

export type Translator = (key: TKey, vars?: Record<string, string | number>) => string;

/** The catalog of one language as a plain function: the PDF uses it outside the React tree. */
export function translator(lang: Lang): Translator {
  const messages = catalogs[lang] ?? catalogs.en;
  return (key, vars) => {
    let text: string = messages[key] ?? catalogs.en[key] ?? String(key);
    if (vars) {
      for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
    }
    return text;
  };
}

export interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translator;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ lang, setLang, children }: { lang: Lang; setLang: (lang: Lang) => void; children: ReactNode }) {
  const value = useMemo<I18nValue>(() => ({ lang, setLang, t: translator(lang) }), [lang, setLang]);
  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
