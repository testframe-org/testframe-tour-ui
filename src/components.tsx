// The screen components the three tour screens share: status badges, code blocks, key/value rows
// and the card detail view (the evidence of docs/runner-protocol.md, "CardResult"). The PDF has
// its own rendering of the same evidence (react-pdf cannot render DOM elements), but both read the
// same detail keys and the same labels (labels.ts).

import { useState, type ReactNode } from 'react';
import { formatNumber, inlineTextOf, textOf, truncateBlock } from './format';
import type { Translator } from './i18n';
import { toneOf } from './labels';
import type { CardResult, Statement } from './protocol';

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={`tft-badge tft-badge-${toneOf(status)}`}>{label}</span>;
}

export function Spinner() {
  return <span className="tft-spinner" aria-hidden="true" />;
}

export function Alert({ tone, children }: { tone: 'warn' | 'error' | 'info'; children: ReactNode }) {
  return <div className={`tft-alert tft-alert-${tone}`}>{children}</div>;
}

export function KeyValue({ rows }: { rows: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="tft-kv">
      {rows.map(([label, value], index) => (
        <div key={`${label}-${index}`} style={{ display: 'contents' }}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A monospace block, cut at MAX_BLOCK_LINES lines with the "truncated (n more lines)" note. */
export function CodeBlock({ text, t }: { text: string; t: Translator }) {
  const block = truncateBlock(text);
  if (block.text.trim() === '' && block.hidden === 0) return null;
  return (
    <div>
      <pre className="tft-code">{block.text}</pre>
      {block.hidden > 0 ? (
        <div className="tft-hint">{t('detail.longBlock', { n: block.hidden })}</div>
      ) : null}
    </div>
  );
}

function StatementsTable({ statements, t }: { statements: Statement[]; t: Translator }) {
  return (
    <table className="tft-table">
      <thead>
        <tr>
          <th style={{ width: 44 }}>{t('detail.colLine')}</th>
          <th>{t('detail.colStatement')}</th>
          <th>{t('detail.colActual')}</th>
          <th style={{ width: 44 }}>{t('detail.colOperator')}</th>
          <th>{t('detail.colExpected')}</th>
          <th style={{ width: 64 }}>{t('detail.colPassed')}</th>
        </tr>
      </thead>
      <tbody>
        {statements.map((statement, index) => {
          const assertion = statement.kind === 'assert';
          return (
            <tr key={`${statement.line}-${index}`}>
              <td className="tft-num">{formatNumber(statement.line, 'en')}</td>
              <td className="tft-mono">{statement.statement}</td>
              <td className="tft-mono">
                {inlineTextOf(assertion ? statement.actual : statement.value)}
              </td>
              <td>{assertion ? statement.operator : ''}</td>
              <td className="tft-mono">{assertion ? inlineTextOf(statement.expected) : '—'}</td>
              <td>
                {assertion ? (
                  <StatusBadge status={statement.passed ? 'success' : 'error'} label={String(statement.passed)} />
                ) : (
                  <span className="tft-muted">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The evidence of one card: request/response, mongo call/result, statements, condition, published. */
export function DetailView({ result, t }: { result: CardResult; t: Translator }) {
  const detail = result.detail ?? {};
  const bindings = Object.entries(detail.bindings ?? {});
  const published = Object.entries(detail.published ?? {});
  const { request, response, call, result: mongoResult, condition } = detail;

  return (
    <div>
      {bindings.length > 0 ? (
        <div>
          <div className="tft-h3">{t('detail.bindings')}</div>
          <KeyValue rows={bindings.map(([name, value]) => [name, <span className="tft-mono">{inlineTextOf(value)}</span>])} />
        </div>
      ) : null}

      {request ? (
        <div>
          <div className="tft-h3">{t('detail.request')}</div>
          <KeyValue
            rows={[
              ['method', <span className="tft-mono">{request.method}</span>],
              ['url', <span className="tft-mono">{String(request.url)}</span>],
              ...(Object.keys(request.headers ?? {}).length > 0
                ? ([
                    [
                      t('detail.headers'),
                      <span className="tft-mono">
                        {Object.entries(request.headers ?? {})
                          .map(([name, value]) => `${name}: ${value}`)
                          .join(', ')}
                      </span>
                    ]
                  ] as const)
                : [])
            ]}
          />
          <CodeBlock text={textOf(request.body)} t={t} />
        </div>
      ) : null}

      {response ? (
        <div>
          <div className="tft-h3">{t('detail.response')}</div>
          <KeyValue
            rows={[
              [t('detail.status'), <span className="tft-mono">{formatNumber(response.status, 'en')}</span>],
              [t('detail.elapsed'), `${formatNumber(response.elapsedMs ?? 0, 'en')} ms`]
            ]}
          />
          {Object.keys(response.headers ?? {}).length > 0 ? (
            <KeyValue
              rows={[
                [
                  t('detail.headers'),
                  <span className="tft-mono">
                    {Object.entries(response.headers ?? {})
                      .map(([name, value]) => `${name}: ${value}`)
                      .join(', ')}
                  </span>
                ]
              ]}
            />
          ) : null}
          <CodeBlock text={textOf(response.body)} t={t} />
          {response.truncated ? <div className="tft-hint">{t('detail.truncated')}</div> : null}
        </div>
      ) : null}

      {call ? (
        <div>
          <div className="tft-h3">{t('detail.call')}</div>
          <KeyValue
            rows={[
              ['source', <span className="tft-mono">{call.source}</span>],
              ['database', <span className="tft-mono">{call.database}</span>],
              ['collection', <span className="tft-mono">{call.collection}</span>],
              ['operation', <span className="tft-mono">{call.operation}</span>]
            ]}
          />
          <CodeBlock text={textOf(call.args)} t={t} />
        </div>
      ) : null}

      {mongoResult ? (
        <div>
          <div className="tft-h3">{t('detail.result')}</div>
          <KeyValue
            rows={[
              ['operation', <span className="tft-mono">{mongoResult.operation}</span>],
              ['collection', <span className="tft-mono">{mongoResult.collection}</span>],
              ['count', mongoResult.count === undefined ? '—' : formatNumber(mongoResult.count, 'en')]
            ]}
          />
          <CodeBlock text={textOf(mongoResult.result)} t={t} />
        </div>
      ) : null}

      {detail.statements && detail.statements.length > 0 ? (
        <div>
          <div className="tft-h3">{t('detail.statements')}</div>
          <StatementsTable statements={detail.statements} t={t} />
        </div>
      ) : null}

      {condition ? (
        <div>
          <div className="tft-h3">{t('detail.condition')}</div>
          <KeyValue
            rows={[
              ['expression', <span className="tft-mono">{condition.expression}</span>],
              [t('detail.expressionValue'), <span className="tft-mono">{inlineTextOf(condition.value)}</span>],
              [t('detail.decision'), <StatusBadge status={condition.decision === 'continue' ? 'success' : 'skipped'} label={condition.decision} />],
              [t('detail.skippedCards'), (condition.skipped ?? []).join(', ') || '—']
            ]}
          />
        </div>
      ) : null}

      {'value' in detail ? (
        <div>
          <div className="tft-h3">{t('detail.value')}</div>
          <CodeBlock text={textOf(detail.value)} t={t} />
        </div>
      ) : null}

      {published.length > 0 ? (
        <div>
          <div className="tft-h3">{t('detail.published')}</div>
          {published.map(([name, value]) => (
            <div key={name}>
              <div className="tft-h3 tft-mono">{name}</div>
              <CodeBlock text={textOf(value)} t={t} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A collapsible section: the card's detail, hidden until asked for. */
export function Collapsible({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="tft-btn tft-btn-sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {label}
      </button>
      {open ? <div className="tft-run-body">{children}</div> : null}
    </div>
  );
}
