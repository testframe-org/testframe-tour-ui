// The PDF's fonts (docs/test-tour.md, "PDF"): subset DejaVu Sans and DejaVu Sans Mono, shipped
// with the package (src/fonts/, generated into ./font-data.ts) and registered as data URLs, so no
// host has to serve a font file. Registered on import: this module is only reachable from the
// lazily imported PDF chunk, so the fonts never land in the initial bundle.

import { Font } from '@react-pdf/renderer';
import { DEJAVU_SANS, DEJAVU_SANS_BOLD, DEJAVU_SANS_MONO, DEJAVU_SANS_MONO_BOLD } from './font-data';

export const SANS = 'DejaVu Sans';
export const MONO = 'DejaVu Sans Mono';

Font.register({
  family: SANS,
  fonts: [
    { src: DEJAVU_SANS, fontWeight: 400 },
    { src: DEJAVU_SANS_BOLD, fontWeight: 700 }
  ]
});

Font.register({
  family: MONO,
  fonts: [
    { src: DEJAVU_SANS_MONO, fontWeight: 400 },
    { src: DEJAVU_SANS_MONO_BOLD, fontWeight: 700 }
  ]
});

// Evidence carries long unbroken tokens (URLs, base64, minified JSON). The default hyphenation
// only breaks on spaces, so such a token would overflow the page: break it every 28 characters.
const BREAK_AT = 28;
Font.registerHyphenationCallback((word) => {
  if (word.length <= BREAK_AT) return [word];
  const parts: string[] = [];
  for (let i = 0; i < word.length; i += BREAK_AT) parts.push(word.slice(i, i + BREAK_AT));
  return parts;
});
