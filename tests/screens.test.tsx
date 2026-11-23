// The screens' rendering, without a browser: react-dom/server renders the components with real
// data, which pins what the user sees (labels, statuses, counts, evidence blocks) and proves the
// screens and their i18n wiring do not throw. The screens' decisions themselves are pure functions
// covered by selection.test.ts, inputs.test.ts and tour-state.test.ts.

import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTourApi } from '../src/api';
import { CodeBlock, DetailView, KeyValue, StatusBadge } from '../src/components';
import { MAX_BLOCK_LINES } from '../src/format';
import { I18nProvider, translator } from '../src/i18n';
import { cardLabel } from '../src/labels';
import type { CardResult } from '../src/protocol';
import { FinalScreen } from '../src/screens/final-screen';
import { FrameScreen } from '../src/screens/frame-screen';
import { createTour, type Lang, type Tour } from '../src/tour-state';
import { productTour } from './fixtures';

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const render = (children: ReactNode, lang: Lang = 'en'): string =>
  renderToStaticMarkup(<I18nProvider lang={lang} setLang={() => undefined}>{children}</I18nProvider>);

const t = translator('en');

describe('the final screen', () => {
  const tour: Tour = productTour();

  test('it shows the tour result, its metadata and one row per frame', () => {
    const html = render(<FinalScreen tour={tour} onNewTour={() => undefined} />, 'pt-BR');
    expect(html).toContain('Tour finalizado');
    expect(html).toContain('falhou'); // the tour result
    expect(html).toContain('product-test');
    expect(html).toContain('20261122-140307');
    expect(html).toContain('0.4.0');
    expect(html).toContain('active-products-echo');
    expect(html).toContain('product-crud');
    expect(html).toContain('Baixar PDF');
    expect(html).toContain('Novo tour');
  });

  test('the summary counts come from the last attempt', () => {
    const html = render(<FinalScreen tour={tour} onNewTour={() => undefined} />, 'en');
    // active-products-echo: 5 success, 1 error; product-crud: 1 error, 1 not run.
    expect(html).toContain('>5<');
    expect(html).toContain('>1<');
    expect(html).toContain('Download PDF');
  });

  test('the PDF language defaults to the tour language and both languages are offered', () => {
    const html = render(<FinalScreen tour={tour} onNewTour={() => undefined} />, 'en');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('English');
    expect(html).toContain('Português (Brasil)');
  });
});

describe('the card evidence', () => {
  const resultOf = (varName: string): CardResult =>
    productTour()
      .frames.flatMap((frame) => frame.results ?? [])
      .find((result) => result.varName === varName)!;

  test('a mongo card shows its call and its result, never a URI', () => {
    const html = render(<DetailView result={resultOf('getActiveProducts')} t={t} />);
    expect(html).toContain('Mongo call');
    expect(html).toContain('products');
    expect(html).toContain('find');
    expect(html).toContain('Mongo result');
    expect(html).not.toContain('mongodb://');
  });

  test('an openapi card shows the request and the response as sent and received', () => {
    const html = render(<DetailView result={resultOf('createProduct')} t={t} />);
    expect(html).toContain('Request');
    expect(html).toContain('POST');
    expect(html).toContain('http://localhost:18081/api/products');
    expect(html).toContain('x-tenant: testframe');
    expect(html).toContain('Response');
    expect(html).toContain('201');
  });

  test('a failing assert shows both sides and the failed mark', () => {
    const html = render(<DetailView result={resultOf('assertCreatedProduct')} t={t} />);
    expect(html).toContain('Statements');
    expect(html).toContain('assert createdProduct.preco == 100');
    expect(html).toContain('99');
    expect(html).toContain('100');
    expect(html).toContain('false');
  });

  test('a conditional shows its decision', () => {
    const html = render(<DetailView result={resultOf('hasProducts')} t={t} />);
    expect(html).toContain('Condition');
    expect(html).toContain('$count(activeProducts) &gt; 0');
    expect(html).toContain('continue');
  });

  test('published variables are listed by var-name', () => {
    const html = render(<DetailView result={resultOf('getActiveProducts')} t={t} />);
    expect(html).toContain('Published variables');
    expect(html).toContain('getActiveProducts');
    expect(html).toContain('Kit Testes E2E');
  });
});

describe('the mongo write warning', () => {
  const api = createTourApi('/api/tour', async () => jsonResponse({}));

  test('before the first run it warns from the frame summary mongo sources', () => {
    const tour: Tour = createTour({ project: 'p', environment: 'hml', lang: 'en', frames: ['writes'], now: new Date() });
    const html = render(
      <FrameScreen
        api={api}
        tour={tour}
        frameName="writes"
        summary={{ name: 'writes', steps: 1, cards: 2, inputs: 0, sources: ['mongo/products-db'], errors: [] }}
        mutate={() => undefined}
        onNavigate={() => undefined}
        onFinish={() => undefined}
        onBackToStart={() => undefined}
      />
    );
    expect(html).toContain('This frame uses the Mongo source(s) mongo/products-db and may write to hml.');
  });

  test('once the cards are known it names the write cards and the environment', () => {
    const tour: Tour = {
      ...createTour({ project: 'p', environment: 'hml', lang: 'en', frames: ['writes'], now: new Date() }),
      frames: [
        {
          frame: 'writes',
          status: 'passed',
          attempts: 1,
          started: {
            event: 'frame-started',
            frame: 'writes',
            environment: 'hml',
            pluginVersion: '0.4.0',
            at: '2026-11-22T17:03:07.100Z',
            inputs: {},
            sources: {},
            cards: [
              { step: 1, varName: 'wipe', title: 'Wipe products', source: 'mongo/products-db', subtype: 'deleteMany', collection: 'products', code: '[{}]' },
              { step: 1, varName: 'read', title: 'Read products', source: 'mongo/products-db', subtype: 'find', collection: 'products', code: '[{}]' }
            ]
          },
          results: [],
          finished: { event: 'frame-finished', status: 'passed', stopped: null, elapsedMs: 5, counts: { success: 2, error: 0, skipped: 0, notRun: 0 } }
        }
      ]
    };
    const html = render(
      <FrameScreen
        api={api}
        tour={tour}
        frameName="writes"
        summary={{ name: 'writes', steps: 1, cards: 2, inputs: 0, sources: ['mongo/products-db'], errors: [] }}
        mutate={() => undefined}
        onNavigate={() => undefined}
        onFinish={() => undefined}
        onBackToStart={() => undefined}
      />
    );
    expect(html).toContain('This frame writes to Mongo in hml: wipe (deleteMany on products)');
    expect(html).not.toContain('read (find on products)');
  });

  test('a frame without mongo sources shows no warning', () => {
    const tour: Tour = createTour({ project: 'p', environment: 'hml', lang: 'en', frames: ['plain'], now: new Date() });
    const html = render(
      <FrameScreen
        api={api}
        tour={tour}
        frameName="plain"
        summary={{ name: 'plain', steps: 1, cards: 1, inputs: 0, sources: ['openapi/product-api'], errors: [] }}
        mutate={() => undefined}
        onNavigate={() => undefined}
        onFinish={() => undefined}
        onBackToStart={() => undefined}
      />
    );
    expect(html).not.toContain('writes to Mongo');
    expect(html).not.toContain('may write to');
  });
});

describe('shared components', () => {
  test('a badge carries the tone of its status and the translated label', () => {
    expect(render(<StatusBadge status="error" label={cardLabel(t, 'error')} />)).toContain('tft-badge-fail');
    expect(render(<StatusBadge status="error" label={cardLabel(t, 'error')} />)).toContain('error');
    expect(render(<StatusBadge status="not-run" label={cardLabel(t, 'not-run')} />)).toContain('tft-badge-idle');
    expect(render(<StatusBadge status="running" label={cardLabel(t, 'running')} />)).toContain('tft-badge-run');
  });

  test('a long block is cut with the "truncated (n more lines)" note', () => {
    const lines = Array.from({ length: MAX_BLOCK_LINES + 40 }, (_, i) => `line ${i + 1}`);
    const html = render(<CodeBlock text={lines.join('\n')} t={t} />);
    expect(html).toContain(`line ${MAX_BLOCK_LINES}`);
    expect(html).not.toContain(`line ${MAX_BLOCK_LINES + 1}`);
    expect(html).toContain('truncated (40 more lines)');
  });

  test('a short block is not cut', () => {
    const html = render(<CodeBlock text={'a\nb'} t={t} />);
    expect(html).not.toContain('truncated');
  });

  test('an empty block renders nothing', () => {
    expect(render(<CodeBlock text="   " t={t} />)).toBe('');
  });

  test('key/value rows keep their order', () => {
    const html = render(<KeyValue rows={[['one', '1'], ['two', '2']]} />);
    expect(html.indexOf('one')).toBeLessThan(html.indexOf('two'));
  });
});
