// The report's structure (agents/specs/test-tour.md, "PDF"): cover, summary with the resolved connections,
// one section per frame with its inputs and the evidence of every card, and the failures appendix.
// Rendered for real and read back with pdf.js, in both languages.

import { describe, expect, test } from 'bun:test';
import { generatePdf, pdfFileName } from '../src/pdf';
import { MAX_BLOCK_LINES } from '../src/format';
import type { Tour } from '../src/tour-state';
import { productTour } from './fixtures';
import { extractPdfText, pdfPages } from './pdf-text';

const tour: Tour = productTour();

/** Whitespace-free text: react-pdf breaks long tokens, and pdf.js returns items of its own choosing. */
const compact = (text: string): string => text.replace(/\s+/g, '');

async function report(lang: 'en' | 'pt-BR' = 'en'): Promise<{ bytes: Uint8Array; text: string }> {
  const bytes = new Uint8Array(await (await generatePdf(tour, lang)).arrayBuffer());
  return { bytes, text: compact(await extractPdfText(bytes)) };
}

describe('the report', () => {
  test('it renders in both languages and spans several pages', async () => {
    const en = await report('en');
    const pt = await report('pt-BR');
    expect(Buffer.from(en.bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
    expect(await pdfPages(en.bytes)).toBeGreaterThan(2);
    expect(await pdfPages(pt.bytes)).toBeGreaterThan(2);
    expect(en.text).toContain('Testtour');
    expect(pt.text).toContain('Tourdetestes');
    expect(pdfFileName(tour)).toBe('tour-product-test-20261122-140307.pdf');
  });

  test('the cover carries the tour metadata and its result', async () => {
    const { text } = await report();
    expect(text).toContain('product-test');
    expect(text).toContain('local');
    expect(text).toContain('20261122-140307');
    expect(text).toContain('0.4.0'); // plugin version
    expect(text).toContain('failed'); // the tour result
    expect(text).toContain('2'); // attempts of the first frame
  });

  test('the summary lists every frame and the resolved connections', async () => {
    const { text } = await report();
    expect(text).toContain('active-products-echo');
    expect(text).toContain('product-crud');
    expect(text).toContain('Summary');
    expect(text).toContain('Resolvedconnections');
    expect(text).toContain('mongo/products-db');
    expect(text).toContain('openapi/product-api');
    expect(text).toContain('mongodb://localhost:27017/products');
    expect(text).toContain('x-tenant');
  });

  test('a frame section shows its inputs, the overridden one with the saved value beside it', async () => {
    const { text } = await report();
    expect(text).toContain('Inputs');
    expect(text).toContain('productPayload');
    expect(text).toContain('used');
    expect(text).toContain('saved');
    expect(text).toContain('Tourcopy');
  });

  test('the evidence of every card kind is in the report', async () => {
    const { text } = await report();
    // mongo call and result
    expect(text).toContain('Mongocall');
    expect(text).toContain('Mongoresult');
    // openapi request and response
    expect(text).toContain('Request');
    expect(text).toContain('Response');
    expect(text).toContain('POST');
    expect(text).toContain('http://localhost:18081/api/products');
    // jsonassert statements with both sides of the failing assert
    expect(text).toContain('Statements');
    expect(text).toContain('assertcreatedProduct.preco==100');
    expect(text).toContain('99');
    expect(text).toContain('100');
    // the conditional and its decision
    expect(text).toContain('Condition');
    expect(text).toContain('continue');
    // published variables and the card code
    expect(text).toContain('Publishedvariables');
    expect(text).toContain('getActiveProducts');
    expect(text).toContain('KitTestesE2E');
  });

  test('a card that never ran is listed as not run', async () => {
    const { text } = await report();
    expect(text).toContain('neverRuns');
    expect(text).toContain('notrun');
  });

  test('the failures appendix lists every error card with its reason', async () => {
    const { text } = await report();
    expect(text).toContain('Failures');
    expect(text).toContain('assertCreatedProduct');
    expect(text).toContain('deleteAll');
    expect(text).toContain('Reason');
    // the failing assert with both sides, and the HTTP status of the other failure
    expect(text).toContain('actual:99');
    expect(text).toContain('expected:100');
    expect(text).toContain('HTTP500');
    expect(text).toContain('connectionrefused');
  });

  test('the footer names the project and the tour on every page', async () => {
    const { text } = await report();
    const occurrences = text.split('tour20261122-140307').length - 1;
    expect(occurrences).toBeGreaterThan(2);
    expect(text).toContain('page1of');
  });

  test('the pt-BR report translates its labels and keeps the project data', async () => {
    const { text } = await report('pt-BR');
    expect(text).toContain('Resumo');
    expect(text).toContain('Conexõesresolvidas');
    expect(text).toContain('Entradas');
    expect(text).toContain('Falhas');
    expect(text).toContain('página1de');
    // project data is never translated
    expect(text).toContain('active-products-echo');
    expect(text).toContain('KitTestesE2E');
  });

  test('a block longer than the limit is cut with the note', async () => {
    const long = Array.from({ length: MAX_BLOCK_LINES + 5 }, (_, i) => `row ${i + 1}`).join('\n');
    // Only an error card prints its `output` (agents/specs/test-tour.md, PDF section 3), so the long block
    // goes on the failing card of the second frame.
    const big: Tour = {
      ...tour,
      frames: [
        tour.frames[0],
        { ...tour.frames[1], results: [{ ...tour.frames[1].results![0], output: long }] }
      ]
    };
    const text = compact(await extractPdfText(new Uint8Array(await (await generatePdf(big, 'en')).arrayBuffer())));
    expect(text).toContain(`row${MAX_BLOCK_LINES}`);
    expect(text).not.toContain(`row${MAX_BLOCK_LINES + 1}`);
    expect(text).toContain('truncated(5morelines)');
  });
});
