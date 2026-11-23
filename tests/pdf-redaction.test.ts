// The tour-ui half of the redaction acceptance test (docs/test-tour.md, "Redaction", item 5): the
// text extracted from the generated PDF contains no occurrence of a secret — raw, JSON-escaped or
// URL-encoded. The fixture mirrors the plugin's RedactionBoundaryTest: a secret declared in
// sources.{env}.private.yaml, sent as an openapi header and as a mongo URI password, echoed back
// by the HTTP target. The plugin redacts it, so the tour state holds only `***`; this test proves
// the PDF faithfully renders that redacted evidence and reintroduces nothing from browser state.

import { describe, expect, test } from 'bun:test';
import { IDBFactory } from 'fake-indexeddb';
import { generatePdf, pdfFileName } from '../src/pdf';
import { createTourStore } from '../src/store';
import { MASK, PLUGIN_SECRET, SECRET, echoTour } from './fixtures';
import { extractPdfText } from './pdf-text';

/** The three forms the plugin's redactor matches, so the PDF must not carry any of them. */
const formsOf = (secret: string): { form: string; value: string }[] => [
  { form: 'raw', value: secret },
  { form: 'JSON-escaped', value: JSON.stringify(secret).slice(1, -1) },
  { form: 'URL-encoded', value: encodeURIComponent(secret) }
];

async function pdfBytes(): Promise<Uint8Array> {
  const blob = await generatePdf(echoTour());
  return new Uint8Array(await blob.arrayBuffer());
}

describe('the PDF carries no secret', () => {
  test('it is a PDF at all, named tour-{project}-{id}.pdf', async () => {
    const bytes = await pdfBytes();
    expect(bytes.length).toBeGreaterThan(1000);
    expect(Buffer.from(bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
    expect(pdfFileName(echoTour())).toBe('tour-echo-project-20261122-140307.pdf');
  });

  test('neither secret appears in the extracted text, in any of its three forms', async () => {
    const text = await extractPdfText(await pdfBytes());
    for (const secret of [SECRET, PLUGIN_SECRET]) {
      for (const { form, value } of formsOf(secret)) {
        expect(text.includes(value), `${form} form of the secret reached the PDF: ${value}`).toBe(false);
      }
    }
  });

  test('the mask is there, so the absence of the secret is not an empty report', async () => {
    const text = await extractPdfText(await pdfBytes());
    expect(text.includes(MASK)).toBe(true);
    // The echo target's answer, the request header and the mongo URI all reached the report masked.
    expect(text).toContain('apiKey');
    expect(text).toContain(`mongodb://${MASK}@db:27017/products`);
    expect(text).toContain('x-api-key');
    expect(text).toContain('getEcho');
    expect(text).toContain('echo-secret');
    expect(text).toContain('echo-project');
  });

  test('the same holds for the pt-BR report', async () => {
    const blob = await generatePdf(echoTour(), 'pt-BR');
    const text = await extractPdfText(new Uint8Array(await blob.arrayBuffer()));
    for (const secret of [SECRET, PLUGIN_SECRET]) {
      for (const { value } of formsOf(secret)) expect(text.includes(value)).toBe(false);
    }
    expect(text).toContain('Tour de testes');
    expect(text.includes(MASK)).toBe(true);
  });

  test('a tour that went through IndexedDB still produces a clean report', async () => {
    // The record holds only redacted data, so reading it back cannot reintroduce a secret either.
    const store = createTourStore(new IDBFactory());
    await store.save(echoTour());
    const loaded = await store.load('echo-project');
    expect(loaded).not.toBeNull();
    const text = await extractPdfText(new Uint8Array(await (await generatePdf(loaded!)).arrayBuffer()));
    for (const secret of [SECRET, PLUGIN_SECRET]) {
      for (const { value } of formsOf(secret)) expect(text.includes(value)).toBe(false);
    }
    expect(text.includes(MASK)).toBe(true);
  });
});
