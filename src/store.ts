// Tour persistence (docs/test-tour.md, "Tour state"): browser IndexedDB, one record per
// (origin, project), written after every event. No tour state ever reaches disk in a project —
// the plugin is read-only and serves the same UI, so the two hosts behave identically. The record
// holds only redacted data, because the plugin redacts before anything leaves it.

import { resumeTour, type Tour } from './tour-state';

const DB_NAME = 'testframe-tour';
const DB_VERSION = 1;
const STORE = 'tours';

export interface TourStore {
  /**
   * The unfinished or finished tour of `project`, or null. A frame that was `running` when the
   * page went away comes back `interrupted`: its stream is gone and the plugin stopped it.
   */
  load(project: string): Promise<Tour | null>;
  /** Writes the whole record (after every event). Concurrent writes are serialized. */
  save(tour: Tour): Promise<void>;
  /** **New tour** deletes the record. */
  remove(project: string): Promise<void>;
}

interface Backend {
  load(key: string): Promise<Tour | null>;
  save(tour: Tour): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Serializes writes so two events in a row never interleave their transactions. */
function serialized(backend: Backend): TourStore {
  let queue: Promise<void> = Promise.resolve();
  const enqueue = (task: () => Promise<void>): Promise<void> => {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  };
  return {
    load: (project) => backend.load(project),
    save: (tour) => enqueue(() => backend.save(tour)),
    remove: (project) => enqueue(() => backend.remove(project))
  };
}

function indexedDbBackend(factory: IDBFactory): Backend {
  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const request = factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'project' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('cannot open IndexedDB'));
      request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
    });

  const run = async <T>(mode: IDBTransactionMode, task: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = task(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
      });
    } finally {
      db.close();
    }
  };

  return {
    load: async (key) => (await run('readonly', (store) => store.get(key) as IDBRequest<Tour | undefined>)) ?? null,
    save: async (tour) => {
      await run('readwrite', (store) => store.put(tour) as IDBRequest<unknown>);
    },
    remove: async (key) => {
      await run('readwrite', (store) => store.delete(key) as IDBRequest<unknown>);
    }
  };
}

/** Used when the browser has no IndexedDB (private mode, an old webview): the tour works, it just cannot resume. */
function memoryBackend(): Backend {
  const records = new Map<string, Tour>();
  return {
    load: async (key) => records.get(key) ?? null,
    save: async (tour) => {
      records.set(tour.project, tour);
    },
    remove: async (key) => {
      records.delete(key);
    }
  };
}

/**
 * The tour store. `factory` is injectable so the tests run against `fake-indexeddb`; in the
 * browser it defaults to `globalThis.indexedDB`.
 */
export function createTourStore(factory?: IDBFactory): TourStore {
  const resolved = factory ?? globalThis.indexedDB;
  const backend = resolved ? indexedDbBackend(resolved) : memoryBackend();
  const store = serialized(backend);
  return {
    // Resuming is a load-time rule: a frame left `running` by a reload is `interrupted`.
    load: async (project) => {
      const tour = await store.load(project);
      return tour ? resumeTour(tour) : null;
    },
    save: store.save,
    remove: store.remove
  };
}
