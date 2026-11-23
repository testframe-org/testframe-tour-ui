// The PDF report (docs/test-tour.md, "PDF"): cover, summary, one section per frame with the
// evidence of every card, and a failures appendix. Built in the browser from the tour state alone
// — the state holds only data the plugin already redacted, so the report cannot carry a secret.
// This module is reached only through ./index.ts's lazy import, keeping @react-pdf/renderer and
// the fonts out of the initial bundle.

import { Document, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { cutLine, formatDateTime, formatDuration, formatNumber, inlineTextOf, textOf, truncateBlock } from '../format';
import type { Translator } from '../i18n';
import { cardLabel, frameLabel, resultLabel, toneOf } from '../labels';
import type { CardResult, Statement, StreamCard } from '../protocol';
import { cardsOf, stepsOf, type CardUiStatus, type Tour, type TourFrame } from '../tour-state';
import './fonts';
import { MONO, SANS } from './fonts';

const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#cbd5e1';
const SOFT = '#f1f5f9';
const PASS = '#15803d';
const FAIL = '#b91c1c';
const WARN = '#b45309';
const SKIP = '#475569';
const NOTRUN = '#94a3b8';
const LINK = '#1d4ed8';

export const frameAnchor = (frame: string): string => `frame-${frame}`;
export const cardAnchor = (frame: string, varName: string): string => `card-${frame}-${varName}`;

const TONE_COLOR: Record<string, string> = { pass: PASS, fail: FAIL, warn: WARN, skip: SKIP, run: LINK, idle: NOTRUN };

const statusColor = (status: string): string => TONE_COLOR[toneOf(status)] ?? NOTRUN;

const s = StyleSheet.create({
  page: { fontFamily: SANS, fontSize: 8.5, color: INK, paddingTop: 34, paddingBottom: 40, paddingHorizontal: 34 },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 34,
    right: 34,
    fontFamily: SANS,
    fontSize: 7,
    color: MUTED,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 4,
    textAlign: 'center'
  },
  title: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  tagline: { fontSize: 9, color: MUTED, marginBottom: 22 },
  h1: { fontSize: 15, fontWeight: 700, marginBottom: 8 },
  h2: { fontSize: 12.5, fontWeight: 700, marginBottom: 6 },
  h3: { fontSize: 9.5, fontWeight: 700, marginBottom: 3, marginTop: 8 },
  result: { fontSize: 34, fontWeight: 700, marginTop: 18, marginBottom: 18 },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { width: 110, color: MUTED },
  value: { flex: 1 },
  table: { marginTop: 4, marginBottom: 10 },
  tableHead: { flexDirection: 'row', backgroundColor: SOFT, borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 3, paddingHorizontal: 4 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 3, paddingHorizontal: 4 },
  cell: { paddingRight: 4 },
  block: {
    fontFamily: MONO,
    fontSize: 7,
    backgroundColor: SOFT,
    borderWidth: 0.5,
    borderColor: LINE,
    borderRadius: 2,
    padding: 4,
    marginBottom: 4
  },
  // No italic: only the regular and bold faces of the two families are registered, and react-pdf
  // throws when a style asks for a face it cannot resolve.
  note: { fontSize: 7, color: MUTED, marginBottom: 4 },
  muted: { color: MUTED },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, marginTop: 7 },
  cardTitle: { fontWeight: 700, fontSize: 9.5, flex: 1 },
  badge: { fontSize: 7.5, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2, color: '#ffffff', marginLeft: 4 },
  stepHead: { marginTop: 12, marginBottom: 2, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: LINE, fontSize: 10, fontWeight: 700 },
  link: { color: '#1d4ed8', textDecoration: 'none' },
  kvInline: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }
});

const cellWidth = (percent: number) => ({ width: `${percent}%` as const });

/** A page of the report, with the footer `{project} · tour {id} · page n of m` on every page. */
function Report({ tour, t, children }: { tour: Tour; t: Translator; children: ReactNode }) {
  return (
    <Page size="A4" style={s.page}>
      {children}
      {/* `fixed` repeats this element on every page; `render` is where the page numbers come from. */}
      <Text
        style={s.footer}
        fixed
        render={({ pageNumber, totalPages }) =>
          t('pdf.footer', { project: tour.project, id: tour.id, page: pageNumber, pages: totalPages })
        }
      />
    </Page>
  );
}

function KeyValue({ rows }: { rows: [string, string][] }) {
  return (
    <View>
      {rows.map(([label, value]) => (
        <View style={s.row} key={label}>
          <Text style={s.label}>{label}</Text>
          <Text style={s.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

/** A monospace block, cut at MAX_BLOCK_LINES lines with the "truncated (n more lines)" note. */
function CodeBlock({ text, t }: { text: string; t: Translator }) {
  const block = truncateBlock(text);
  if (block.text.trim() === '' && block.hidden === 0) return null;
  return (
    <View>
      <Text style={s.block}>{block.text}</Text>
      {block.hidden > 0 ? <Text style={s.note}>{t('pdf.longBlock', { n: block.hidden })}</Text> : null}
    </View>
  );
}

function StatusBadge({ status, t }: { status: CardUiStatus; t: Translator }) {
  return <Text style={{ ...s.badge, backgroundColor: statusColor(status) }}>{cardLabel(t, status)}</Text>;
}

// ------------------------------------------------------------------ cover

function Cover({ tour, t }: { tour: Tour; t: Translator }) {
  const duration = tour.finishedAt
    ? new Date(tour.finishedAt).getTime() - new Date(tour.startedAt).getTime()
    : null;
  return (
    <Report tour={tour} t={t}>
      <Text style={s.title}>{t('pdf.title')}</Text>
      <Text style={s.tagline}>{tour.project}</Text>
      <Text style={{ ...s.result, color: statusColor(tour.result ?? 'incomplete') }}>
        {tour.result ? resultLabel(t, tour.result) : '—'}
      </Text>
      <KeyValue
        rows={[
          [t('pdf.project'), tour.project],
          [t('pdf.environment'), tour.environment],
          [t('pdf.result'), tour.result ? resultLabel(t, tour.result) : '—'],
          [t('pdf.started'), formatDateTime(tour.startedAt, tour.lang)],
          [t('pdf.finished'), formatDateTime(tour.finishedAt, tour.lang)],
          [t('pdf.duration'), formatDuration(duration, tour.lang)],
          [t('pdf.tourId'), tour.id],
          [t('pdf.pluginVersion'), tour.pluginVersion ?? '—']
        ]}
      />
    </Report>
  );
}

// ---------------------------------------------------------------- summary

/** The resolved connections of every frame that ran, by source ref (first attempt wins). */
function connectionsOf(tour: Tour): { ref: string; baseUrl: string; headers: string[]; privateFields: string[] }[] {
  const byRef = new Map<string, { ref: string; baseUrl: string; headers: string[]; privateFields: string[] }>();
  for (const frame of tour.frames) {
    for (const [ref, source] of Object.entries(frame.started?.sources ?? {})) {
      if (byRef.has(ref)) continue;
      byRef.set(ref, {
        ref,
        baseUrl: source.baseUrl,
        headers: Object.keys(source.headers ?? {}),
        privateFields: source.privateFields ?? []
      });
    }
  }
  return [...byRef.values()];
}

function Summary({ tour, t }: { tour: Tour; t: Translator }) {
  const connections = connectionsOf(tour);
  const head = [
    [t('pdf.colFrame'), 30],
    [t('pdf.colStatus'), 13],
    [t('pdf.colAttempts'), 9],
    [t('pdf.colSuccess'), 9],
    [t('pdf.colError'), 8],
    [t('pdf.colSkipped'), 9],
    [t('pdf.colNotRun'), 10],
    [t('pdf.colDuration'), 12]
  ] as const;
  return (
    <Report tour={tour} t={t}>
      <Text style={s.h1}>{t('pdf.summary')}</Text>
      <View style={s.table}>
        <View style={s.tableHead}>
          {head.map(([label, width]) => (
            <Text key={label} style={{ ...s.cell, ...cellWidth(width), fontWeight: 700 }}>
              {label}
            </Text>
          ))}
        </View>
        {tour.frames.map((frame) => {
          const counts = frame.finished?.counts;
          return (
            <View style={s.tableRow} key={frame.frame}>
              <View style={cellWidth(30)}>
                <Link src={`#${frameAnchor(frame.frame)}`} style={s.link}>
                  <Text>{frame.frame}</Text>
                </Link>
              </View>
              <Text style={{ ...s.cell, ...cellWidth(13), color: statusColor(frame.status) }}>
                {frameLabel(t, frame.status)}
              </Text>
              <Text style={{ ...s.cell, ...cellWidth(9) }}>{formatNumber(frame.attempts, tour.lang)}</Text>
              <Text style={{ ...s.cell, ...cellWidth(9) }}>{formatNumber(counts?.success ?? 0, tour.lang)}</Text>
              <Text style={{ ...s.cell, ...cellWidth(8) }}>{formatNumber(counts?.error ?? 0, tour.lang)}</Text>
              <Text style={{ ...s.cell, ...cellWidth(9) }}>{formatNumber(counts?.skipped ?? 0, tour.lang)}</Text>
              <Text style={{ ...s.cell, ...cellWidth(10) }}>{formatNumber(counts?.notRun ?? 0, tour.lang)}</Text>
              <Text style={{ ...s.cell, ...cellWidth(12) }}>{formatDuration(frame.finished?.elapsedMs ?? 0, tour.lang)}</Text>
            </View>
          );
        })}
      </View>

      <Text style={s.h2}>{t('pdf.connections')}</Text>
      {connections.length === 0 ? <Text style={s.muted}>—</Text> : null}
      {connections.length > 0 ? (
        <View style={s.table}>
          <View style={s.tableHead}>
            <Text style={{ ...s.cell, ...cellWidth(20), fontWeight: 700 }}>{t('pdf.colSource')}</Text>
            <Text style={{ ...s.cell, ...cellWidth(38), fontWeight: 700 }}>{t('pdf.colBaseUrl')}</Text>
            <Text style={{ ...s.cell, ...cellWidth(22), fontWeight: 700 }}>{t('pdf.colHeaders')}</Text>
            <Text style={{ ...s.cell, ...cellWidth(20), fontWeight: 700 }}>{t('pdf.colPrivate')}</Text>
          </View>
          {connections.map((source) => (
            <View style={s.tableRow} key={source.ref}>
              <Text style={{ ...s.cell, ...cellWidth(20), fontFamily: MONO, fontSize: 7 }}>{source.ref}</Text>
              <Text style={{ ...s.cell, ...cellWidth(38), fontFamily: MONO, fontSize: 7 }}>{cutLine(source.baseUrl, 120)}</Text>
              <Text style={{ ...s.cell, ...cellWidth(22), fontFamily: MONO, fontSize: 7 }}>
                {source.headers.join(', ') || '—'}
              </Text>
              <Text style={{ ...s.cell, ...cellWidth(20), fontFamily: MONO, fontSize: 7 }}>
                {source.privateFields.join(', ') || '—'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Report>
  );
}

// ------------------------------------------------------------- card detail

function Statements({ statements, t }: { statements: Statement[]; t: Translator }) {
  return (
    <View style={s.table}>
      <View style={s.tableHead}>
        <Text style={{ ...s.cell, ...cellWidth(6), fontWeight: 700 }}>{t('pdf.colLine')}</Text>
        <Text style={{ ...s.cell, ...cellWidth(40), fontWeight: 700 }}>{t('pdf.colStatement')}</Text>
        <Text style={{ ...s.cell, ...cellWidth(20), fontWeight: 700 }}>{t('pdf.colActual')}</Text>
        <Text style={{ ...s.cell, ...cellWidth(6), fontWeight: 700 }}>{t('pdf.colOperator')}</Text>
        <Text style={{ ...s.cell, ...cellWidth(20), fontWeight: 700 }}>{t('pdf.colExpected')}</Text>
        <Text style={{ ...s.cell, ...cellWidth(8), fontWeight: 700 }}>{t('pdf.colPassed')}</Text>
      </View>
      {statements.map((statement) => {
        const assertion = statement.kind === 'assert';
        const failed = assertion && !statement.passed;
        return (
          <View
            style={{ ...s.tableRow, ...(failed ? { backgroundColor: '#fef2f2' } : null) }}
            key={`${statement.line}-${statement.statement}`}
          >
            <Text style={{ ...s.cell, ...cellWidth(6) }}>{formatNumber(statement.line, 'en')}</Text>
            <Text style={{ ...s.cell, ...cellWidth(40), fontFamily: MONO, fontSize: 7 }}>{cutLine(statement.statement, 200)}</Text>
            <Text style={{ ...s.cell, ...cellWidth(20), fontFamily: MONO, fontSize: 7 }}>
              {assertion ? cutLine(inlineTextOf(statement.actual), 80) : cutLine(inlineTextOf(statement.value), 80)}
            </Text>
            <Text style={{ ...s.cell, ...cellWidth(6) }}>{assertion ? statement.operator : ''}</Text>
            <Text style={{ ...s.cell, ...cellWidth(20), fontFamily: MONO, fontSize: 7 }}>
              {assertion ? cutLine(inlineTextOf(statement.expected), 80) : t('detail.expressionValue')}
            </Text>
            <Text style={{ ...s.cell, ...cellWidth(8), color: assertion ? (statement.passed ? PASS : FAIL) : MUTED }}>
              {assertion ? String(statement.passed) : '—'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function CardDetailBlocks({ result, t }: { result: CardResult; t: Translator }) {
  const detail = result.detail ?? {};
  const bindings = Object.entries(detail.bindings ?? {});
  const published = Object.entries(detail.published ?? {});
  const request = detail.request;
  const response = detail.response;
  const call = detail.call;
  const mongoResult = detail.result;
  const condition = detail.condition;

  return (
    <View>
      {bindings.length > 0 ? (
        <View>
          <Text style={s.h3}>{t('pdf.bindings')}</Text>
          <KeyValue rows={bindings.map(([name, value]) => [name, cutLine(inlineTextOf(value), 160)])} />
        </View>
      ) : null}

      {request ? (
        <View>
          <Text style={s.h3}>{t('pdf.request')}</Text>
          <KeyValue rows={[[`${request.method}`, cutLine(String(request.url), 180)]]} />
          {Object.keys(request.headers ?? {}).length > 0 ? (
            <KeyValue
              rows={[
                [
                  t('pdf.headers'),
                  Object.entries(request.headers ?? {})
                    .map(([name, value]) => `${name}: ${value}`)
                    .join(', ')
                ]
              ]}
            />
          ) : null}
          {request.body === undefined || request.body === null || request.body === '' ? null : (
            <CodeBlock text={textOf(request.body)} t={t} />
          )}
        </View>
      ) : null}

      {response ? (
        <View>
          <Text style={s.h3}>{t('pdf.response')}</Text>
          <KeyValue
            rows={[
              [t('pdf.status'), String(response.status)],
              [t('detail.elapsed'), `${formatNumber(response.elapsedMs ?? 0, 'en')} ms`]
            ]}
          />
          <CodeBlock text={textOf(response.body)} t={t} />
          {response.truncated ? <Text style={s.note}>{t('detail.truncated')}</Text> : null}
        </View>
      ) : null}

      {call ? (
        <View>
          <Text style={s.h3}>{t('pdf.call')}</Text>
          <KeyValue
            rows={[
              ['source', call.source ?? ''],
              ['database', call.database ?? ''],
              ['collection', call.collection ?? ''],
              ['operation', call.operation ?? '']
            ]}
          />
          <CodeBlock text={textOf(call.args)} t={t} />
        </View>
      ) : null}

      {mongoResult ? (
        <View>
          <Text style={s.h3}>{t('pdf.result')}</Text>
          <KeyValue
            rows={[
              ['operation', mongoResult.operation ?? ''],
              ['collection', mongoResult.collection ?? ''],
              ['count', mongoResult.count === undefined ? '—' : formatNumber(mongoResult.count, 'en')]
            ]}
          />
          <CodeBlock text={textOf(mongoResult.result)} t={t} />
        </View>
      ) : null}

      {detail.statements && detail.statements.length > 0 ? (
        <View>
          <Text style={s.h3}>{t('pdf.statements')}</Text>
          <Statements statements={detail.statements} t={t} />
        </View>
      ) : null}

      {condition ? (
        <View>
          <Text style={s.h3}>{t('pdf.condition')}</Text>
          <KeyValue
            rows={[
              ['expression', cutLine(condition.expression ?? '', 200)],
              [t('detail.expressionValue'), inlineTextOf(condition.value)],
              [t('pdf.decision'), condition.decision ?? ''],
              [t('pdf.skippedCards'), (condition.skipped ?? []).join(', ') || '—']
            ]}
          />
        </View>
      ) : null}

      {'value' in detail ? (
        <View>
          <Text style={s.h3}>{t('pdf.value')}</Text>
          <CodeBlock text={textOf(detail.value)} t={t} />
        </View>
      ) : null}

      {published.length > 0 ? (
        <View>
          <Text style={s.h3}>{t('pdf.published')}</Text>
          {published.map(([name, value]) => (
            <View key={name}>
              <Text style={{ ...s.h3, fontFamily: MONO, fontSize: 7.5 }}>{name}</Text>
              <CodeBlock text={textOf(value)} t={t} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CardSection({ tour, frame, card, result, t }: { tour: Tour; frame: TourFrame; card: StreamCard; result: CardResult | undefined; t: Translator }) {
  const status: CardUiStatus = result ? result.status : frame.finished ? 'not-run' : 'pending';
  const typeOf = [card.source ?? '—', card.subtype ?? null].filter(Boolean).join(' · ');
  return (
    <View id={cardAnchor(frame.frame, card.varName)}>
      <View style={s.cardHead}>
        <Text style={s.cardTitle}>{card.title || card.varName}</Text>
        <StatusBadge status={status} t={t} />
      </View>
      <KeyValue
        rows={[
          ['var-name', card.varName],
          [t('detail.type'), typeOf],
          ...(card.collection ? [['collection', card.collection] as [string, string]] : []),
          ...(card.endpoint ? [['endpoint', card.endpoint] as [string, string]] : []),
          ...(result
            ? ([
                [t('detail.ranAt'), formatDateTime(result.ranAt, tour.lang)],
                [t('detail.elapsed'), formatDuration(result.elapsedMs, tour.lang)]
              ] as [string, string][])
            : [])
        ]}
      />
      {result?.skippedBy ? <Text style={s.note}>{t('pdf.skippedBy', { varName: result.skippedBy })}</Text> : null}
      {status === 'not-run' || status === 'pending' ? (
        <Text style={s.muted}>{t('pdf.notRun')}</Text>
      ) : (
        <View>
          {card.code && card.code.trim() !== '' ? (
            <View>
              <Text style={s.h3}>{t('pdf.code')}</Text>
              <CodeBlock text={card.code} t={t} />
            </View>
          ) : null}
          {result ? <CardDetailBlocks result={result} t={t} /> : null}
          {result && result.status === 'error' && result.output ? (
            <View>
              <Text style={s.h3}>{t('pdf.output')}</Text>
              <CodeBlock text={result.output} t={t} />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ------------------------------------------------------------------ frames

function FrameSection({ tour, frame, t }: { tour: Tour; frame: TourFrame; t: Translator }) {
  const started = frame.started;
  const results = frame.results ?? [];
  const resultOf = (varName: string): CardResult | undefined => results.find((r) => r.varName === varName);
  const inputs = Object.entries(started?.inputs ?? {});
  return (
    <Report tour={tour} t={t}>
      <View id={frameAnchor(frame.frame)}>
        <Text style={s.h1}>{frame.frame}</Text>
        <KeyValue
          rows={[
            [t('pdf.colStatus'), frameLabel(t, frame.status)],
            [t('pdf.colAttempts'), t('pdf.attempts', { n: frame.attempts })],
            [t('pdf.colDuration'), formatDuration(frame.finished?.elapsedMs ?? 0, tour.lang)],
            ...(frame.finished
              ? ([
                  [
                    t('pdf.summary'),
                    t('frame.counts', {
                      success: frame.finished.counts.success,
                      error: frame.finished.counts.error,
                      skipped: frame.finished.counts.skipped,
                      notRun: frame.finished.counts.notRun
                    })
                  ]
                ] as [string, string][])
              : []),
            ...(frame.error ? ([[t('pdf.streamError'), frame.error]] as [string, string][]) : [])
          ]}
        />
        {Object.entries(started?.sources ?? {})
          .filter(([, source]) => source.error || source.warning)
          .map(([ref, source]) => (
            <Text key={ref} style={s.note}>
              {t('pdf.sourceError', { ref, msg: source.error ?? source.warning ?? '' })}
            </Text>
          ))}
      </View>

      {!started ? (
        <Text style={s.muted}>{t('pdf.noEvidence')}</Text>
      ) : (
        <View>
          <Text style={s.h2}>{t('pdf.inputs')}</Text>
          {inputs.length === 0 ? <Text style={s.muted}>{t('pdf.noInputs')}</Text> : null}
          {inputs.map(([varName, input]) => (
            <View key={varName}>
              <Text style={s.h3}>
                {varName} · {t('pdf.step', { n: input.step })}
              </Text>
              <Text style={s.note}>{input.overridden ? t('pdf.usedValue') : t('pdf.savedValue')}</Text>
              <CodeBlock text={textOf(input.value)} t={t} />
              {input.overridden ? (
                <View>
                  <Text style={s.note}>{t('pdf.savedValue')}</Text>
                  <CodeBlock text={textOf(input.saved)} t={t} />
                </View>
              ) : null}
            </View>
          ))}

          {stepsOf(frame).map(({ step, cards }) => (
            <View key={step}>
              <Text style={s.stepHead}>{t('pdf.step', { n: step })}</Text>
              {cards.map((card) => (
                <CardSection
                  key={card.varName}
                  tour={tour}
                  frame={frame}
                  card={card}
                  result={resultOf(card.varName)}
                  t={t}
                />
              ))}
            </View>
          ))}
        </View>
      )}
    </Report>
  );
}

// --------------------------------------------------------------- failures

interface Failure {
  frame: TourFrame;
  card: StreamCard | undefined;
  result: CardResult;
}

/** Every `error` card of the tour, in tour order. */
export function failuresOf(tour: Tour): Failure[] {
  const failures: Failure[] = [];
  for (const frame of tour.frames) {
    const cards = cardsOf(frame);
    for (const result of frame.results ?? []) {
      if (result.status !== 'error') continue;
      failures.push({ frame, card: cards.find((c) => c.varName === result.varName), result });
    }
  }
  return failures;
}

/** The reason of a failure: the failing assert with both sides, or the HTTP status and body. */
function failureReason(result: CardResult, t: Translator): string {
  const detail = result.detail ?? {};
  const failed = (detail.statements ?? []).find(
    (statement): statement is Extract<Statement, { kind: 'assert' }> => statement.kind === 'assert' && !statement.passed
  );
  if (failed) {
    return `${failed.statement}\n  ${t('pdf.colActual')}: ${inlineTextOf(failed.actual)} ${failed.operator} ${t('pdf.colExpected')}: ${inlineTextOf(failed.expected)}${failed.error ? `\n  ${failed.error}` : ''}`;
  }
  if (detail.response) {
    return `HTTP ${detail.response.status}\n${textOf(detail.response.body)}`;
  }
  return result.output;
}

function Failures({ tour, t }: { tour: Tour; t: Translator }) {
  const failures = failuresOf(tour);
  if (failures.length === 0) return null;
  return (
    <Report tour={tour} t={t}>
      <Text style={s.h1}>{t('pdf.failures')}</Text>
      {failures.map(({ frame, card, result }) => (
        <View key={`${frame.frame}-${result.varName}`} style={{ marginBottom: 10 }}>
          <View style={s.cardHead}>
            <View style={{ flex: 1 }}>
              <Link src={`#${cardAnchor(frame.frame, result.varName)}`} style={s.link}>
                <Text style={s.h2}>
                  {frame.frame} · {t('pdf.step', { n: card?.step ?? 0 })} · {result.varName}
                </Text>
              </Link>
            </View>
            <StatusBadge status="error" t={t} />
          </View>
          <Text style={{ ...s.cell, marginBottom: 2 }}>{cutLine(result.text, 200)}</Text>
          <Text style={s.h3}>{t('pdf.failureReason')}</Text>
          <CodeBlock text={failureReason(result, t)} t={t} />
        </View>
      ))}
    </Report>
  );
}

// --------------------------------------------------------------- document

export function TourDocument({ tour, t }: { tour: Tour; t: Translator }) {
  return (
    <Document
      title={`${t('pdf.title')} — ${tour.project} — ${tour.id}`}
      author="testframe"
      subject={tour.project}
      language={tour.lang === 'en' ? 'en' : 'pt-BR'}
    >
      <Cover tour={tour} t={t} />
      <Summary tour={tour} t={t} />
      {tour.frames.map((frame) => (
        <FrameSection key={frame.frame} tour={tour} frame={frame} t={t} />
      ))}
      <Failures tour={tour} t={t} />
    </Document>
  );
}
