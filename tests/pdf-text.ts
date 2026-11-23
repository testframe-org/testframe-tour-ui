// Extracts the text of a generated PDF. pdf.js is the only reliable way: @react-pdf/renderer
// embeds subset fonts with a custom encoding, so the text in the content stream is glyph indices,
// not readable bytes.

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const document = await getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    verbosity: 0
  }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ('str' in item ? String(item.str) : ''))
        .join(' ')
    );
  }
  await document.destroy();
  return pages.join('\n');
}

export async function pdfPages(bytes: Uint8Array): Promise<number> {
  const document = await getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
  const pages = document.numPages;
  await document.destroy();
  return pages;
}
