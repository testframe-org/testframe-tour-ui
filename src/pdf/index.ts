// The PDF's lazy entry point. `@react-pdf/renderer`, the report components and the fonts are all
// behind the dynamic import below, so none of them is in the initial bundle of either host: they
// are fetched when the user clicks **Download PDF**.

import { createElement } from 'react';
import { translator } from '../i18n';
import { pdfFileName, type Lang, type Tour } from '../tour-state';

export { pdfFileName };

const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

/** Renders the report of `tour` in `lang` (the tour's language by default) and returns the PDF bytes. */
export async function generatePdf(tour: Tour, lang: Lang = tour.lang): Promise<Blob> {
  const { pdf, renderToBuffer } = await import('@react-pdf/renderer');
  const { TourDocument } = await import('./document');
  const element = createElement(TourDocument, { tour: { ...tour, lang }, t: translator(lang) });
  // The two builds expose different renderers: the browser one renders through `pdf().toBlob()`,
  // the Node one (which the tests use) through `renderToBuffer`.
  if (isBrowser) return await pdf(element as Parameters<typeof pdf>[0]).toBlob();
  const rendered = (await renderToBuffer(element as Parameters<typeof renderToBuffer>[0])) as Uint8Array;
  return new Blob([rendered as unknown as BlobPart], { type: 'application/pdf' });
}

/** Offers `blob` to the browser as a download named `tour-{project}-{id}.pdf`. */
export function downloadPdf(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Long enough for the browser to have started the download.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
