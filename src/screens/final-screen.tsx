// Screen 3 — Final (docs/test-tour.md, screen 3): the tour result, the summary table, Download PDF
// and New tour. Finishing is final — the tour can no longer run frames — but the PDF can be
// downloaded again, in either language, until **New tour** discards the tour.

import { useState } from 'react';
import { Alert, StatusBadge } from '../components';
import { formatDateTime, formatDuration, formatNumber } from '../format';
import { useI18n } from '../i18n';
import { frameLabel, resultLabel } from '../labels';
import { downloadPdf, generatePdf, pdfFileName } from '../pdf';
import { reasonOf } from '../api';
import { LANGS, countsOf, elapsedOf, type Lang, type Tour } from '../tour-state';

export interface FinalScreenProps {
  tour: Tour;
  /** **New tour**: the stored record is deleted and the start screen comes back. */
  onNewTour: () => void;
}

export function FinalScreen({ tour, onNewTour }: FinalScreenProps) {
  const { lang, t } = useI18n();
  // The PDF language defaults to the tour's; the final screen also offers the other one.
  const [pdfLang, setPdfLang] = useState<Lang>(tour.lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const startedAt = new Date(tour.startedAt).getTime();
  const finishedAt = tour.finishedAt ? new Date(tour.finishedAt).getTime() : null;
  const duration = finishedAt === null ? null : finishedAt - startedAt;

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      downloadPdf(await generatePdf(tour, pdfLang), pdfFileName(tour));
    } catch (e) {
      setError(t('final.pdfFail', { msg: reasonOf(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tft-shell">
      <div className="tft-card">
        <h1 className="tft-h1">{t('final.title')}</h1>
        <p className="tft-tagline">{t('final.subtitle')}</p>
        <div className="tft-hint">{t('final.resultLabel')}</div>
        <div
          className="tft-result-hero"
          style={{ color: tour.result === 'passed' ? 'var(--tft-pass)' : tour.result === 'failed' ? 'var(--tft-fail)' : 'var(--tft-warn)' }}
        >
          {tour.result ? resultLabel(t, tour.result) : '—'}
        </div>
        <dl className="tft-kv">
          <dt>{t('start.project')}</dt>
          <dd>{tour.project}</dd>
          <dt>{t('final.tourId')}</dt>
          <dd className="tft-mono">{tour.id}</dd>
          <dt>{t('start.environment')}</dt>
          <dd>{tour.environment}</dd>
          <dt>{t('final.startedAt')}</dt>
          <dd>{formatDateTime(tour.startedAt, lang)}</dd>
          <dt>{t('final.finishedAt')}</dt>
          <dd>{formatDateTime(tour.finishedAt, lang)}</dd>
          <dt>{t('final.duration')}</dt>
          <dd>{formatDuration(duration, lang)}</dd>
          <dt>{t('final.pluginVersion')}</dt>
          <dd className="tft-mono">{tour.pluginVersion ?? '—'}</dd>
        </dl>
      </div>

      <div className="tft-card">
        <div className="tft-h2">{t('final.summary')}</div>
        <table className="tft-table">
          <thead>
            <tr>
              <th>{t('final.colFrame')}</th>
              <th>{t('final.colStatus')}</th>
              <th className="tft-num">{t('final.colAttempts')}</th>
              <th className="tft-num">{t('final.colSuccess')}</th>
              <th className="tft-num">{t('final.colError')}</th>
              <th className="tft-num">{t('final.colSkipped')}</th>
              <th className="tft-num">{t('final.colNotRun')}</th>
              <th className="tft-num">{t('final.colDuration')}</th>
            </tr>
          </thead>
          <tbody>
            {tour.frames.map((frame) => {
              const counts = countsOf(frame);
              return (
                <tr key={frame.frame}>
                  <td>{frame.frame}</td>
                  <td>
                    <StatusBadge status={frame.status} label={frameLabel(t, frame.status)} />
                  </td>
                  <td className="tft-num">{formatNumber(frame.attempts, lang)}</td>
                  <td className="tft-num">{formatNumber(counts.success, lang)}</td>
                  <td className="tft-num">{formatNumber(counts.error, lang)}</td>
                  <td className="tft-num">{formatNumber(counts.skipped, lang)}</td>
                  <td className="tft-num">{formatNumber(counts.notRun, lang)}</td>
                  <td className="tft-num">{formatDuration(elapsedOf(frame), lang)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="tft-card">
        <div className="tft-field">
          <span className="tft-label">{t('final.pdfLang')}</span>
          <div className="tft-lang" role="group" aria-label={t('final.pdfLang')}>
            {LANGS.map((option: Lang) => (
              <button key={option} type="button" aria-pressed={pdfLang === option} onClick={() => setPdfLang(option)}>
                {t(option === 'en' ? 'lang.en' : 'lang.pt-BR')}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="tft-btn tft-btn-primary" disabled={busy} onClick={() => void download()}>
            {busy ? t('final.downloading') : t('final.downloadPdf')}
          </button>
          {confirming ? (
            <>
              <span className="tft-hint">{t('final.newTourConfirm')}</span>
              <button
                type="button"
                className="tft-btn tft-btn-danger"
                onClick={() => {
                  setConfirming(false);
                  onNewTour();
                }}
              >
                {t('common.yes')}
              </button>
              <button type="button" className="tft-btn" onClick={() => setConfirming(false)}>
                {t('common.no')}
              </button>
            </>
          ) : (
            <button type="button" className="tft-btn" disabled={busy} onClick={() => setConfirming(true)}>
              {t('final.newTour')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
