// Screen 2 — one per selected frame (docs/test-tour.md, screen 2): the input JSON editors,
// Run / Cancel, live progress from the NDJSON stream, the result with its evidence, Run again,
// Skip frame and the Back / Next / Finish tour navigation.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TourApi } from '../api';
import { newRunId, problemsOf, reasonOf } from '../api';
import { Alert, CodeBlock, DetailView, KeyValue, Spinner, StatusBadge } from '../components';
import { formatDateTime, formatDuration } from '../format';
import { useI18n } from '../i18n';
import { firstInvalid, formatJson, isChanged, resetDraft, runInputs, toDrafts, type InputDraft } from '../inputs';
import { cardLabel, frameLabel } from '../labels';
import type { FrameSummary } from '../protocol';
import { mongoSourceRefs, mongoWriteCards } from '../selection';
import {
  applyEvent,
  beginRun,
  cardUiStatus,
  cardsOf,
  countsOf,
  frameIndex,
  frameOf,
  skipFrame,
  stepsOf,
  type Tour,
  type TourFrame
} from '../tour-state';

/** `editing` → `running` → `done`; from `done`, **Run again** goes back to `editing`. */
type Phase = 'editing' | 'running' | 'done';

const phaseOf = (frame: TourFrame | undefined): Phase => {
  if (!frame) return 'editing';
  if (frame.status === 'running') return 'running';
  if (frame.status === 'passed' || frame.status === 'failed' || frame.status === 'interrupted') return 'done';
  return 'editing';
};

export interface FrameScreenProps {
  api: TourApi;
  tour: Tour;
  frameName: string;
  /** The frame's summary from `GET /frames`, when it is known (load errors, mongo sources). */
  summary: FrameSummary | undefined;
  /** Applies a transition to the tour and persists it: the store is written after every event. */
  mutate: (fn: (tour: Tour) => Tour) => void;
  onNavigate: (index: number) => void;
  onFinish: () => void;
  onBackToStart: () => void;
}

export function FrameScreen({ api, tour, frameName, summary, mutate, onNavigate, onFinish, onBackToStart }: FrameScreenProps) {
  const { lang, t } = useI18n();
  const frame = frameOf(tour, frameName);
  const index = frameIndex(tour, frameName);
  const total = tour.frames.length;
  const isLast = index === total - 1;

  const [phase, setPhase] = useState<Phase>(() => phaseOf(frame));
  const [drafts, setDrafts] = useState<InputDraft[]>([]);
  const [inputsError, setInputsError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runningVar, setRunningVar] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // The inputs are loaded once per frame, not after every event: read the tour through a ref.
  const tourRef = useRef(tour);
  tourRef.current = tour;

  useEffect(() => {
    let cancelled = false;
    setInputsError(null);
    setRunError(null);
    setRunningVar(null);
    setOpenDetail(null);
    setPhase(phaseOf(frameOf(tourRef.current, frameName)));
    (async () => {
      try {
        const inputs = await api.inputs(tourRef.current.project, frameName);
        if (cancelled) return;
        const lastUsed = frameOf(tourRef.current, frameName)?.inputs;
        setDrafts(
          toDrafts(inputs).map((draft) =>
            lastUsed?.[draft.varName] === undefined ? draft : { ...draft, text: lastUsed[draft.varName] }
          )
        );
      } catch (e) {
        if (!cancelled) setInputsError(t('frame.inputsFail', { msg: reasonOf(e) }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, frameName, t]);

  // The stream is abandoned when the screen goes away; the plugin stops after the card in progress.
  useEffect(() => () => abortRef.current?.abort(), []);

  const invalid = firstInvalid(drafts);
  const running = phase === 'running';

  const run = useCallback(async () => {
    if (invalid) return;
    const inputs = runInputs(drafts);
    const id = newRunId();
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setRunError(null);
    setRunId(id);
    setRunningVar(null);
    setPhase('running');
    mutate((current) => beginRun(current, frameName, inputs));
    try {
      await api.run(
        tourRef.current.project,
        frameName,
        { runId: id, environment: tourRef.current.environment, inputs },
        (event) => {
          if (event.event === 'card-started') setRunningVar(event.varName);
          else setRunningVar(null);
          mutate((current) => applyEvent(current, frameName, event));
          if (event.event === 'frame-finished' || event.event === 'error') setPhase('done');
        },
        controller.signal
      );
      // The stream ended with no frame-finished: the plugin went away or the connection dropped.
      mutate((current) => {
        const after = frameOf(current, frameName);
        return after && after.status === 'running'
          ? applyEvent(current, frameName, { event: 'error', message: 'the stream ended before the frame finished' })
          : current;
      });
      setPhase((current) => (current === 'running' ? 'done' : current));
    } catch (e) {
      if (controller.signal.aborted) return;
      const problems = problemsOf(e);
      setRunError(t('frame.runFail', { msg: problems.join('; ') }));
      mutate((current) => applyEvent(current, frameName, { event: 'error', message: problems.join('; ') }));
      setPhase('done');
    } finally {
      setRunId(null);
      abortRef.current = null;
    }
  }, [api, drafts, frameName, invalid, mutate, t]);

  const cancel = async () => {
    if (!runId) return;
    try {
      await api.cancel(runId);
    } catch (e) {
      setRunError(t('frame.cancelFail', { msg: reasonOf(e) }));
    }
  };

  const skip = () => {
    mutate((current) => skipFrame(current, frameName));
    if (!isLast) onNavigate(index + 1);
  };

  const steps = frame ? stepsOf(frame) : [];
  const allCards = frame ? cardsOf(frame) : [];

  // The write warning (docs/test-tour.md, screen 2 "Write warning"): precise, naming the cards,
  // as soon as the frame's cards are known; from the frame's mongo sources before the first run.
  const writes = mongoWriteCards(allCards);
  const mongoRefs = summary ? mongoSourceRefs(summary) : [];
  const counts = frame ? countsOf(frame) : null;

  return (
    <div className="tft-shell">
      <div className="tft-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="tft-h1" style={{ margin: 0, flex: '1 1 auto' }}>
            {t('frame.header', { k: index + 1, n: total, frame: frameName })}
          </h1>
          {frame ? <StatusBadge status={frame.status} label={frameLabel(t, frame.status)} /> : null}
        </div>
        <div className="tft-hint">
          {t('frame.environment', { env: tour.environment })}
          {frame && frame.attempts > 0 ? ` · ${t('frame.attempts', { n: frame.attempts })}` : ''}
        </div>
        {summary && summary.errors.length > 0 ? (
          <div style={{ marginTop: 10 }}>
            <Alert tone="warn">{t('frame.loadErrors', { msg: summary.errors.join('; ') })}</Alert>
          </div>
        ) : null}
      </div>

      {writes.length > 0 ? (
        <Alert tone="warn">
          {t('frame.mongoWrite', {
            env: tour.environment,
            cards: writes
              .map((card) =>
                t('frame.mongoWriteCard', { varName: card.varName, subtype: card.subtype ?? '', collection: card.collection ?? '—' })
              )
              .join(', ')
          })}
        </Alert>
      ) : mongoRefs.length > 0 && !frame?.started ? (
        <Alert tone="warn">{t('frame.mongoMaybeWrite', { refs: mongoRefs.join(', '), env: tour.environment })}</Alert>
      ) : null}

      {inputsError ? <Alert tone="error">{inputsError}</Alert> : null}
      {runError ? <Alert tone="error">{runError}</Alert> : null}
      {frame?.error && phase === 'done' ? <Alert tone="error">{t('frame.streamError', { msg: frame.error })}</Alert> : null}

      <div className="tft-card">
        <div className="tft-h2">{t('frame.inputs')}</div>
        <div className="tft-hint" style={{ marginBottom: 10 }}>
          {t('frame.inputsHint')}
        </div>
        {drafts.length === 0 ? (
          <div className="tft-hint">{inputsError ? '' : t('frame.noInputs')}</div>
        ) : (
          drafts.map((draft) => {
            const check = firstInvalid([draft]);
            return (
              <div className="tft-input-block" key={draft.varName}>
                <div className="tft-input-head">
                  <span className="tft-input-title">{draft.title || draft.varName}</span>
                  <span className="tft-mono tft-muted">{draft.varName}</span>
                  <span className="tft-muted">{t('frame.step', { n: draft.step })}</span>
                  {isChanged(draft) ? <StatusBadge status="running" label={t('frame.changed')} /> : null}
                  <span style={{ flex: '1 1 auto' }} />
                  <button
                    type="button"
                    className="tft-btn tft-btn-sm"
                    disabled={running}
                    onClick={() =>
                      setDrafts((current) => current.map((d) => (d.varName === draft.varName ? { ...d, text: formatJson(d.text) } : d)))
                    }
                  >
                    {t('frame.format')}
                  </button>
                  <button
                    type="button"
                    className="tft-btn tft-btn-sm"
                    disabled={running || !isChanged(draft)}
                    onClick={() => setDrafts((current) => current.map((d) => (d.varName === draft.varName ? resetDraft(d) : d)))}
                  >
                    {t('frame.reset')}
                  </button>
                </div>
                <textarea
                  className={`tft-editor${check ? ' tft-editor-invalid' : ''}`}
                  value={draft.text}
                  spellCheck={false}
                  disabled={running}
                  aria-label={draft.varName}
                  onChange={(event) =>
                    setDrafts((current) => current.map((d) => (d.varName === draft.varName ? { ...d, text: event.target.value } : d)))
                  }
                />
                {check ? (
                  <div className="tft-hint" style={{ color: 'var(--tft-fail)' }}>
                    {t('frame.invalidJson', { msg: check.error })}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="tft-card">
        <div className="tft-h2">{t('frame.cards')}</div>
        {frame?.finished && counts ? (
          <div style={{ marginBottom: 10 }}>
            <KeyValue
              rows={[
                [t('frame.result'), frameLabel(t, frame.status)],
                [
                  t('final.summary'),
                  t('frame.counts', {
                    success: counts.success,
                    error: counts.error,
                    skipped: counts.skipped,
                    notRun: counts.notRun
                  })
                ],
                [t('detail.elapsed'), formatDuration(frame.finished.elapsedMs, lang)]
              ]}
            />
          </div>
        ) : null}
        {steps.length === 0 ? (
          <div className="tft-hint">{t('frame.noCards')}</div>
        ) : (
          steps.map(({ step, cards }) => (
            <div key={step}>
              <div className="tft-step-head">{t('frame.step', { n: step })}</div>
              {cards.map((card) => {
                const status = frame ? cardUiStatus(frame, card, runningVar) : 'pending';
                const result = frame?.results?.find((r) => r.varName === card.varName);
                const open = openDetail === card.varName;
                const tone =
                  status === 'running'
                    ? ' tft-run-card-running'
                    : status === 'error'
                      ? ' tft-run-card-error'
                      : status === 'not-run'
                        ? ' tft-run-card-notrun'
                        : '';
                return (
                  <div className={`tft-run-card${tone}`} key={card.varName}>
                    <div className="tft-run-head">
                      <div className="tft-run-head-main">
                        <div className="tft-run-title">{card.title || card.varName}</div>
                        <div className="tft-run-text tft-mono">
                          {card.varName}
                          {card.source ? ` · ${card.source}${card.subtype ? ` · ${card.subtype}` : ''}` : ''}
                        </div>
                        {result ? <div className="tft-run-text">{result.text}</div> : null}
                      </div>
                      {status === 'running' ? <Spinner /> : null}
                      <StatusBadge status={status} label={cardLabel(t, status)} />
                      {result ? (
                        <button
                          type="button"
                          className="tft-btn tft-btn-sm"
                          aria-expanded={open}
                          onClick={() => setOpenDetail(open ? null : card.varName)}
                        >
                          {open ? t('frame.hideDetail') : t('frame.showDetail')}
                        </button>
                      ) : null}
                    </div>
                    {open && result ? (
                      <div className="tft-run-body">
                        <KeyValue
                          rows={[
                            [t('detail.ranAt'), formatDateTime(result.ranAt, lang)],
                            [t('detail.elapsed'), formatDuration(result.elapsedMs, lang)]
                          ]}
                        />
                        {result.skippedBy ? (
                          <div className="tft-hint">{t('detail.skippedBy', { varName: result.skippedBy })}</div>
                        ) : null}
                        {card.code && card.code.trim() !== '' ? (
                          <div>
                            <div className="tft-h3">{t('frame.cardCode')}</div>
                            <CodeBlock text={card.code} t={t} />
                          </div>
                        ) : null}
                        {result.status === 'error' && result.output ? (
                          <div>
                            <div className="tft-h3">{t('detail.output')}</div>
                            <CodeBlock text={result.output} t={t} />
                          </div>
                        ) : null}
                        <DetailView result={result} t={t} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {invalid ? <div className="tft-hint">{t('frame.runBlockedByInput', { varName: invalid.varName })}</div> : null}

      <div className="tft-nav">
        <div className="tft-nav-inner">
          <button
            type="button"
            className="tft-btn"
            onClick={onBackToStart}
            disabled={running}
            title={running ? t('frame.leaveBlocked') : undefined}
          >
            {t('frame.toStart')}
          </button>
          <button
            type="button"
            className="tft-btn"
            disabled={running || index === 0}
            title={running ? t('frame.leaveBlocked') : undefined}
            onClick={() => onNavigate(index - 1)}
          >
            {t('frame.back')}
          </button>
          <div className="tft-nav-spacer" />
          {running ? (
            <>
              <span className="tft-hint">
                <Spinner /> {t('frame.running')}
              </span>
              <button type="button" className="tft-btn tft-btn-danger" onClick={() => void cancel()}>
                {t('frame.cancel')}
              </button>
            </>
          ) : (
            <>
              {frame?.status === 'pending' ? (
                <button type="button" className="tft-btn" onClick={skip}>
                  {t('frame.skip')}
                </button>
              ) : null}
              {phase === 'done' && frame && frame.attempts > 0 ? (
                <button type="button" className="tft-btn" onClick={() => setPhase('editing')}>
                  {t('frame.runAgain')}
                </button>
              ) : (
                <button type="button" className="tft-btn tft-btn-primary" onClick={() => void run()} disabled={invalid !== null}>
                  {t('frame.run')}
                </button>
              )}
              {isLast ? (
                <button type="button" className="tft-btn tft-btn-primary" onClick={onFinish}>
                  {t('frame.finish')}
                </button>
              ) : (
                <button
                  type="button"
                  className="tft-btn"
                  onClick={() => onNavigate(index + 1)}
                  title={running ? t('frame.leaveBlocked') : undefined}
                >
                  {t('frame.next')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
