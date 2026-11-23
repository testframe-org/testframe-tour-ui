'use client';

// The tour app: the three screens and the tour state, wired to one host-injected API base URL and
// one IndexedDB store. It owns the tour (agents/specs/test-tour.md, "Tour state") and writes nothing to
// any project folder. Both hosts render this same component: the IDE from its /tour page with
// apiBase "/api/tour", the plugin's static bundle at /tour with apiBase "/api/v1/tour".

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createTourApi, reasonOf, type FetchLike } from './api';
import { useTourStyles } from './styles';
import { I18nProvider } from './i18n';
import type { FrameSummary } from './protocol';
import { FrameScreen } from './screens/frame-screen';
import { FinalScreen } from './screens/final-screen';
import { StartScreen } from './screens/start-screen';
import { createTourStore, type TourStore } from './store';
import { finishTour, type Lang, type Tour } from './tour-state';

type Screen = 'start' | 'frame' | 'final';

export interface TourAppProps {
  /** The tour API base: `/api/v1/tour` in the plugin, `/api/tour` in the IDE. */
  apiBase: string;
  /** Preselected project (`/tour?project={name}`); the IDE always passes it. */
  project?: string | null;
  /** Preselected environment (`&env={env}`): the IDE's current environment. */
  environment?: string | null;
  /** The initial UI language; the language chosen at Start becomes the tour's. */
  lang?: Lang;
  /** Offered as "back to the editor" on the start screen (the IDE passes it). */
  onExit?: () => void;
  /** Injectable for tests. */
  fetchImpl?: FetchLike;
  idbFactory?: IDBFactory;
  now?: () => Date;
}

/** The frame a resumed tour stops at: the first one that is not settled, else the last. */
export function resumeIndex(tour: Tour): number {
  const index = tour.frames.findIndex((frame) => ['pending', 'running', 'interrupted'].includes(frame.status));
  return index === -1 ? Math.max(0, tour.frames.length - 1) : index;
}

export function TourApp({
  apiBase,
  project = null,
  environment = null,
  lang: initialLang = 'en',
  onExit,
  fetchImpl,
  idbFactory,
  now
}: TourAppProps) {
  useTourStyles();
  const api = useMemo(() => createTourApi(apiBase, fetchImpl), [apiBase, fetchImpl]);
  const store: TourStore = useMemo(() => createTourStore(idbFactory), [idbFactory]);
  const nowFn = useMemo(() => now ?? ((): Date => new Date()), [now]);

  const [lang, setLang] = useState<Lang>(initialLang);
  const [tour, setTour] = useState<Tour | null>(null);
  const [screen, setScreen] = useState<Screen>('start');
  const [index, setIndex] = useState(0);
  const [summaries, setSummaries] = useState<FrameSummary[] | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const tourRef = useRef<Tour | null>(null);

  // The record is written after every event, so a reload never loses evidence.
  const adopt = useCallback(
    (next: Tour | null) => {
      tourRef.current = next;
      setTour(next);
      if (!next) return;
      store.save(next).catch((e: unknown) => setStoreError(reasonOf(e)));
    },
    [store]
  );

  const mutate = useCallback(
    (fn: (current: Tour) => Tour) => {
      const current = tourRef.current;
      if (!current) return;
      const next = fn(current);
      if (next !== current) adopt(next);
    },
    [adopt]
  );

  // The frames' summaries back the frame screen's load errors and its mongo-source warning.
  const tourProject = tour?.project ?? null;
  useEffect(() => {
    if (!tourProject) {
      setSummaries(null);
      return;
    }
    let cancelled = false;
    api
      .frames(tourProject)
      .then((frames) => {
        if (!cancelled) setSummaries(frames);
      })
      .catch(() => {
        if (!cancelled) setSummaries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [api, tourProject]);

  const start = useCallback(
    (created: Tour) => {
      setLang(created.lang);
      adopt(created);
      setIndex(0);
      setScreen('frame');
    },
    [adopt]
  );

  const resume = useCallback(
    (stored: Tour) => {
      setLang(stored.lang);
      adopt(stored);
      setIndex(resumeIndex(stored));
      setScreen(stored.status === 'finished' ? 'final' : 'frame');
    },
    [adopt]
  );

  const finish = useCallback(() => {
    mutate((current) => finishTour(current, nowFn()));
    setScreen('final');
  }, [mutate, nowFn]);

  const newTour = useCallback(() => {
    const previous = tourRef.current;
    tourRef.current = null;
    setTour(null);
    setIndex(0);
    setScreen('start');
    if (previous) store.remove(previous.project).catch((e: unknown) => setStoreError(reasonOf(e)));
  }, [store]);

  const frameName = tour?.frames[index]?.frame ?? null;

  return (
    <I18nProvider lang={lang} setLang={setLang}>
      <div className="tft-root">
        {storeError ? (
          <div className="tft-shell" style={{ paddingBottom: 0 }}>
            <div className="tft-alert tft-alert-error">{storeError}</div>
          </div>
        ) : null}
        {screen === 'start' || !tour || !frameName ? (
          <StartScreen
            api={api}
            store={store}
            project={project}
            environment={environment}
            now={nowFn}
            onStart={start}
            onResume={resume}
            onExit={onExit}
          />
        ) : screen === 'final' ? (
          <FinalScreen tour={tour} onNewTour={newTour} />
        ) : (
          <FrameScreen
            api={api}
            tour={tour}
            frameName={frameName}
            summary={summaries?.find((frame) => frame.name === frameName)}
            mutate={mutate}
            onNavigate={setIndex}
            onFinish={finish}
            onBackToStart={() => setScreen('start')}
          />
        )}
      </div>
    </I18nProvider>
  );
}
