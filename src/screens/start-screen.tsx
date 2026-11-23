// Screen 1 — Start (agents/specs/test-tour.md, "Screens"): pick the environment and the frames, with the
// missing-source check up front. Start creates the tour in the browser; it sends no request.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TourApi } from '../api';
import { reasonOf } from '../api';
import { Alert, Spinner } from '../components';
import { formatDateTime } from '../format';
import { useI18n } from '../i18n';
import { frameLabel, tourLabel } from '../labels';
import type { EnvironmentSummary, FrameSummary, ProjectSummary } from '../protocol';
import { canStart, configuredSources, missingSources, sortedFrameNames, type MissingSource } from '../selection';
import type { TourStore } from '../store';
import { createTour, LANGS, type Lang, type Tour } from '../tour-state';

export interface StartScreenProps {
  api: TourApi;
  store: TourStore;
  /** Preselected by the host (`/tour?project={name}`); the IDE always passes it. */
  project: string | null;
  /** The IDE's current environment (`&env={env}`). */
  environment: string | null;
  now: () => Date;
  onStart: (tour: Tour) => void;
  onResume: (tour: Tour) => void;
  onExit?: () => void;
}

interface Loaded {
  projects: ProjectSummary[];
  environments: EnvironmentSummary[];
  sourceErrors: string[];
  frames: FrameSummary[];
}

export function StartScreen({ api, store, project, environment, now, onStart, onResume, onExit }: StartScreenProps) {
  const { lang, setLang, t } = useI18n();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(project);
  const [env, setEnv] = useState<string | null>(environment);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [stored, setStored] = useState<Tour | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      return await api.projects();
    } catch (e) {
      setError(t('start.projectsFail', { msg: reasonOf(e) }));
      return [];
    }
  }, [api, t]);

  // The project list is only needed when the host did not preselect one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const projects = project ? [] : await loadProjects();
      if (!cancelled) {
        setLoaded((current) => ({
          projects,
          environments: current?.environments ?? [],
          sourceErrors: current?.sourceErrors ?? [],
          frames: current?.frames ?? []
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, loadProjects]);

  // Environments, frames and the stored tour follow the chosen project.
  useEffect(() => {
    if (!selectedProject) return;
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const [environments, frameList, storedTour] = await Promise.all([
          api.environments(selectedProject),
          api.frames(selectedProject),
          store.load(selectedProject)
        ]);
        if (cancelled) return;
        setLoaded((current) => ({
          projects: current?.projects ?? [],
          environments: environments.environments,
          sourceErrors: environments.errors,
          frames: frameList
        }));
        setStored(storedTour);
        setChecked(new Set(sortedFrameNames(frameList)));
        setEnv((current) =>
          current && environments.environments.some((e) => e.name === current)
            ? current
            : (environments.environments[0]?.name ?? null)
        );
      } catch (e) {
        if (!cancelled) setError(t('start.framesFail', { msg: reasonOf(e) }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, store, selectedProject, t]);

  const frames = loaded?.frames ?? [];
  const environments = loaded?.environments ?? [];
  const missing: MissingSource[] = useMemo(
    () => missingSources(frames, [...checked], configuredSources(environments, env)),
    [frames, checked, environments, env]
  );
  const selected = useMemo(() => sortedFrameNames(frames).filter((name) => checked.has(name)), [frames, checked]);
  const ready = canStart(env, selected, missing);

  const toggle = (name: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const start = () => {
    if (!selectedProject || !env) return;
    onStart(createTour({ project: selectedProject, environment: env, lang, frames: selected, now: now() }));
  };

  const discard = async () => {
    if (!selectedProject) return;
    try {
      await store.remove(selectedProject);
      setStored(null);
      setNotice(t('start.discarded'));
    } catch (e) {
      setError(t('start.discardFail', { msg: reasonOf(e) }));
    }
  };

  return (
    <div className="tft-shell">
      <div className="tft-card">
        <h1 className="tft-h1">{t('app.title')}</h1>
        <p className="tft-tagline">{t('app.tagline')}</p>

        <div className="tft-field">
          <label className="tft-label" htmlFor="tft-lang">
            {t('lang.label')}
          </label>
          <div className="tft-lang" id="tft-lang" role="group" aria-label={t('lang.label')}>
            {LANGS.map((option: Lang) => (
              <button key={option} type="button" aria-pressed={lang === option} onClick={() => setLang(option)}>
                {t(option === 'en' ? 'lang.en' : 'lang.pt-BR')}
              </button>
            ))}
          </div>
          <div className="tft-hint">{t('lang.switchHint')}</div>
        </div>
      </div>

      {stored ? (
        <div className="tft-card">
          <div className="tft-h2">{t('start.resumeTitle', { project: stored.project })}</div>
          <p className="tft-hint">
            {t('start.resumeHint', {
              id: stored.id,
              env: stored.environment,
              at: formatDateTime(stored.startedAt, lang),
              done: stored.frames.filter((f) => f.attempts > 0).length,
              total: stored.frames.length,
              status: stored.status === 'finished' ? tourLabel(t, stored.status) : frameSummaryLabel(stored, t)
            })}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="tft-btn tft-btn-primary" onClick={() => onResume(stored)}>
              {t('start.resume')}
            </button>
            <button type="button" className="tft-btn tft-btn-danger" onClick={() => void discard()}>
              {t('start.discard')}
            </button>
          </div>
        </div>
      ) : null}

      {notice ? <Alert tone="info">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="tft-card">
        <div className="tft-field">
          <label className="tft-label" htmlFor="tft-project">
            {t('start.project')}
          </label>
          {project ? (
            <input id="tft-project" className="tft-input" value={project} readOnly />
          ) : (
            <select
              id="tft-project"
              className="tft-select"
              value={selectedProject ?? ''}
              onChange={(event) => {
                setSelectedProject(event.target.value || null);
                setEnv(null);
              }}
            >
              <option value="">{t('start.projectPlaceholder')}</option>
              {(loaded?.projects ?? []).map((entry) => (
                <option key={entry.name} value={entry.name}>
                  {entry.name} ({entry.frames.length})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="tft-field">
          <label className="tft-label" htmlFor="tft-env">
            {t('start.environment')}
          </label>
          {environments.length === 0 ? (
            <div className="tft-hint">{loaded ? t('start.noEnvironment') : t('common.loading')}</div>
          ) : (
            <select id="tft-env" className="tft-select" value={env ?? ''} onChange={(event) => setEnv(event.target.value || null)}>
              <option value="">{t('start.environmentPlaceholder')}</option>
              {environments.map((entry) => (
                <option key={entry.name} value={entry.name}>
                  {entry.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {loaded?.sourceErrors.length ? <Alert tone="warn">{t('start.sourcesErrors', { msg: loaded.sourceErrors.join('; ') })}</Alert> : null}
      </div>

      <div className="tft-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div className="tft-h2" style={{ margin: 0, flex: '1 1 auto' }}>
            {t('start.frames')}
          </div>
          <button type="button" className="tft-btn tft-btn-sm" onClick={() => setChecked(new Set(sortedFrameNames(frames)))}>
            {t('start.selectAll')}
          </button>
          <button type="button" className="tft-btn tft-btn-sm" onClick={() => setChecked(new Set())}>
            {t('start.selectNone')}
          </button>
        </div>

        {!loaded ? (
          <div className="tft-hint">
            <Spinner /> {t('common.loading')}
          </div>
        ) : frames.length === 0 ? (
          <div className="tft-hint">{t('start.noFrames')}</div>
        ) : (
          <div className="tft-list">
            {sortedFrameNames(frames).map((name) => {
              const frame = frames.find((f) => f.name === name)!;
              return (
                <label className="tft-frame-item" key={name}>
                  <input type="checkbox" checked={checked.has(name)} onChange={() => toggle(name)} />
                  <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <span className="tft-frame-name">{name}</span>
                    <br />
                    <span className="tft-frame-stats">
                      {t('start.frameStats', { steps: frame.steps, cards: frame.cards, inputs: frame.inputs })}
                    </span>
                    {frame.errors.length > 0 ? (
                      <>
                        <br />
                        <span className="tft-frame-stats" style={{ color: 'var(--tft-warn)' }}>
                          {t('start.frameErrors', { n: frame.errors.length })}
                        </span>
                      </>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        <div className="tft-hint" style={{ marginTop: 10 }}>
          {t('start.selected', { n: selected.length, total: frames.length })}
        </div>
      </div>

      {missing.length > 0 ? (
        <Alert tone="warn">
          <strong>{t('start.missingSources')}</strong>
          <div>{t('start.missingSourcesHint', { env: env ?? '—' })}</div>
          <ul>
            {missing.map((entry) => (
              <li key={entry.ref}>
                <span className="tft-mono">{entry.ref}</span> — {t('start.missingNeededBy', { frames: entry.frames.join(', ') })}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="tft-nav">
        <div className="tft-nav-inner">
          {onExit ? (
            <button type="button" className="tft-btn" onClick={onExit}>
              {t('start.backToIde')}
            </button>
          ) : null}
          <div className="tft-nav-spacer" />
          {!ready ? <span className="tft-hint">{t('start.startDisabled')}</span> : null}
          <button type="button" className="tft-btn tft-btn-primary" disabled={!ready} onClick={start}>
            {t('start.startButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The stored tour's progress, as the frame status of the frame it stopped at. */
function frameSummaryLabel(tour: Tour, translate: ReturnType<typeof useI18n>['t']): string {
  const last = [...tour.frames].reverse().find((frame) => frame.status !== 'pending');
  return last ? frameLabel(translate, last.status) : frameLabel(translate, 'pending');
}
