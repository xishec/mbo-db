import type { DatabaseData, PendingEvent, DET, BirdEvent } from "../types";
import { INDEPENDENT_MAP_NAMES } from "../types/mapNames";

const DB_NAME = "mbo-db-20260503";
const DB_VERSION = 20260503;

// Store names
const METADATA_STORE = "metadata";
const DATA_STORE = "data";
const QUEUE_STORE = "queue";
// Bird events are stored per-row keyed by event id. Writing ONE event no
// longer requires re-serializing the entire 700K-event blob — that's the
// 10+ second save lag we saw on slow laptops. The `data` store keeps the
// small index maps (programs, bandGroups, etc.) and the metadata needed
// to know which environment's events are loaded.
const BIRD_EVENTS_STORE = "birdEvents";
// Key of the scalar metadata row that tracks which environment the rows
// in BIRD_EVENTS_STORE currently belong to. Used to detect environment
// switches and clear the per-event store rather than mixing rows.
const EVENTS_ENV_KEY = "birdEventsEnvironment";

interface MetadataEntry {
  key: string;
  value: number | string;
}

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE);
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(BIRD_EVENTS_STORE)) {
        db.createObjectStore(BIRD_EVENTS_STORE);
      }
      // Upgrade path for existing users: older versions stored the full
      // birdEventsMap inside DATA_STORE under the environment key. Splat
      // those rows into the per-event store so the first save post-upgrade
      // isn't forced to download everything again.
      //
      // The upgrade transaction is the one on `event.target.transaction`;
      // we can't open a new one here. We splat synchronously inside it.
      if (event.oldVersion < 2) {
        const upgradeTx = (event.target as IDBOpenDBRequest).transaction;
        if (upgradeTx) {
          const dataStore = upgradeTx.objectStore(DATA_STORE);
          const eventsStore = upgradeTx.objectStore(BIRD_EVENTS_STORE);
          const metaStore = upgradeTx.objectStore(METADATA_STORE);
          const cursorReq = dataStore.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (!cursor) return;
            const envKey = cursor.key as string;
            const blob = cursor.value as DatabaseData | undefined;
            if (blob?.birdEventsMap) {
              for (const [id, ev] of Object.entries(blob.birdEventsMap)) {
                eventsStore.put(ev, id);
              }
              // Remove the per-event map from the big blob so it no longer
              // gets re-serialized on every save.
              const { birdEventsMap: _removed, ...rest } = blob;
              void _removed;
              dataStore.put(rest, envKey);
              metaStore.put({ key: EVENTS_ENV_KEY, value: envKey } satisfies MetadataEntry);
            }
            cursor.continue();
          };
        }
      }
    };
  });
}

export async function clearQueue(): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], "readwrite");
  transaction.objectStore(QUEUE_STORE).clear();
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function clearEnvironmentCache(environment: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(
    [DATA_STORE, METADATA_STORE, BIRD_EVENTS_STORE],
    "readwrite",
  );
  const metaStore = transaction.objectStore(METADATA_STORE);
  transaction.objectStore(DATA_STORE).delete(environment);
  transaction.objectStore(BIRD_EVENTS_STORE).clear();
  metaStore.delete(`lastUpdated_${environment}`);
  metaStore.delete(EVENTS_ENV_KEY);
  for (const m of INDEPENDENT_MAP_NAMES) metaStore.delete(`lastModified_${m}_${environment}`);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function clearAllIndexedDB(): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(
    [METADATA_STORE, DATA_STORE, QUEUE_STORE, BIRD_EVENTS_STORE],
    "readwrite",
  );

  transaction.objectStore(METADATA_STORE).clear();
  transaction.objectStore(DATA_STORE).clear();
  transaction.objectStore(QUEUE_STORE).clear();
  transaction.objectStore(BIRD_EVENTS_STORE).clear();

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

/**
 * Save environment data to IndexedDB (WITHOUT birdEventsMap — use
 * saveBirdEventsBulk or putBirdEvent for events).
 *
 * If `data.birdEventsMap` is provided, its entries are splatted into the
 * per-event store and stripped from the DATA_STORE blob; the caller gets
 * the incremental per-save benefit automatically.
 */
export async function saveDataToIndexedDB(environment: string, data: DatabaseData): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      [DATA_STORE, BIRD_EVENTS_STORE, METADATA_STORE],
      "readwrite",
    );
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };

    const dataStore = transaction.objectStore(DATA_STORE);
    const eventsStore = transaction.objectStore(BIRD_EVENTS_STORE);
    const metaStore = transaction.objectStore(METADATA_STORE);

    const { birdEventsMap, ...rest } = data;
    // Cache a minimal stub so getDataFromIndexedDB can detect "cached
    // data exists" without reading the whole events table.
    dataStore.put({ ...rest, birdEventsMap: {} }, environment);

    if (birdEventsMap) {
      // Whole-dataset replace (initial load / full refresh) — clear first
      // so the store reflects exactly this env's events.
      eventsStore.clear();
      for (const [id, ev] of Object.entries(birdEventsMap)) {
        eventsStore.put(ev, id);
      }
      metaStore.put({ key: EVENTS_ENV_KEY, value: environment } satisfies MetadataEntry);
    }
  });
}

/**
 * Save only the non-event fields. Use on every save to avoid re-serializing
 * 700K events when the bird events store is already up to date (actions
 * persist the new/updated event via putBirdEvent directly).
 */
export async function saveDatabaseMetadataOnly(
  environment: string,
  partial: Partial<Omit<DatabaseData, "birdEventsMap">>,
): Promise<void> {
  const db = await openDB();
  // Read in one tx, write in another. Awaiting inside a single tx causes
  // auto-commit in Safari/Firefox after the read resolves, so the
  // subsequent put() throws.
  const current = await new Promise<DatabaseData | null>((resolve, reject) => {
    const tx = db.transaction([DATA_STORE], "readonly");
    const req = tx.objectStore(DATA_STORE).get(environment);
    tx.onerror = () => reject(tx.error);
    req.onsuccess = () => resolve((req.result as DatabaseData | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });

  const { birdEventsMap: _drop, ...rest } = current ?? ({} as DatabaseData);
  void _drop;
  const merged = { ...rest, ...partial, birdEventsMap: {} } as DatabaseData;

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([DATA_STORE], "readwrite");
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
    tx.objectStore(DATA_STORE).put(merged, environment);
  });
}

/**
 * Get complete environment data (maps + all bird events) from IndexedDB.
 * Reads the big blob and the per-event store, merging them back together
 * for consumers that expect the unified shape.
 */
export async function getDataFromIndexedDB(environment: string): Promise<DatabaseData | null> {
  const db = await openDB();
  const captured: {
    data: DatabaseData | null;
    keys: string[];
    vals: BirdEvent[];
    envMeta: string | null;
  } = { data: null, keys: [], vals: [], envMeta: null };

  // Register oncomplete/onerror BEFORE awaiting — otherwise the tx can
  // commit inside the await and the handlers attach to a dead tx.
  const txClosed = new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      [DATA_STORE, BIRD_EVENTS_STORE, METADATA_STORE],
      "readonly",
    );
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);

    const dataStore = transaction.objectStore(DATA_STORE);
    const eventsStore = transaction.objectStore(BIRD_EVENTS_STORE);
    const metaStore = transaction.objectStore(METADATA_STORE);

    const dataReq = dataStore.get(environment);
    const keysReq = eventsStore.getAllKeys();
    const valsReq = eventsStore.getAll();
    const metaReq = metaStore.get(EVENTS_ENV_KEY);

    dataReq.onsuccess = () => {
      captured.data = (dataReq.result as DatabaseData | undefined) ?? null;
    };
    keysReq.onsuccess = () => {
      captured.keys = keysReq.result as string[];
    };
    valsReq.onsuccess = () => {
      captured.vals = valsReq.result as BirdEvent[];
    };
    metaReq.onsuccess = () => {
      const row = metaReq.result as MetadataEntry | undefined;
      captured.envMeta = (row?.value as string | undefined) ?? null;
    };
  });

  try {
    await txClosed;
  } finally {
    db.close();
  }

  if (!captured.data) return null;
  // If the per-event store holds a different environment's data (e.g. user
  // switched alpha↔prod), discard those events so we don't mix envs.
  const eventsForEnv: Record<string, BirdEvent> = {};
  if (captured.envMeta === environment) {
    for (let i = 0; i < captured.keys.length; i++) {
      eventsForEnv[captured.keys[i]] = captured.vals[i];
    }
  }
  return { ...captured.data, birdEventsMap: eventsForEnv };
}

/**
 * Insert or update a single bird event. O(1) — the 700K-event blob is
 * untouched. This is what addBirdEvent calls on the hot path.
 */
export async function putBirdEvent(event: BirdEvent): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([BIRD_EVENTS_STORE], "readwrite");
  transaction.objectStore(BIRD_EVENTS_STORE).put(event, event.id);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

/**
 * Delete a single bird event from the per-event store. Used when a
 * still-queued event is replaced — the old row should disappear entirely
 * rather than hang around with `modifiedEventId` set.
 */
export async function deleteBirdEvent(id: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([BIRD_EVENTS_STORE], "readwrite");
  transaction.objectStore(BIRD_EVENTS_STORE).delete(id);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

/**
 * Batch upsert. Used by syncQueue after writing N events to RTDB — stamps
 * `syncedAt` on each locally in a single IDB transaction.
 */
export async function putBirdEvents(events: BirdEvent[]): Promise<void> {
  if (events.length === 0) return;
  const db = await openDB();
  const transaction = db.transaction([BIRD_EVENTS_STORE], "readwrite");
  const store = transaction.objectStore(BIRD_EVENTS_STORE);
  for (const ev of events) store.put(ev, ev.id);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function saveMetadata(key: string, value: number | string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([METADATA_STORE], "readwrite");
  transaction.objectStore(METADATA_STORE).put({ key, value } satisfies MetadataEntry);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function getMetadata(key: string): Promise<number | string | null> {
  const db = await openDB();
  const transaction = db.transaction([METADATA_STORE], "readonly");
  return new Promise((resolve, reject) => {
    const request = transaction.objectStore(METADATA_STORE).get(key);
    request.onsuccess = () => {
      db.close();
      const result = request.result as MetadataEntry | undefined;
      resolve(result?.value ?? null);
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function saveLastUpdated(environment: string, timestamp: number): Promise<void> {
  return saveMetadata(`lastUpdated_${environment}`, timestamp);
}

export async function getLastUpdated(environment: string): Promise<number | null> {
  return getMetadata(`lastUpdated_${environment}`) as Promise<number | null>;
}

export async function addToQueue(pendingEvent: PendingEvent): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], "readwrite");
  transaction.objectStore(QUEUE_STORE).put(pendingEvent);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function getQueuedEvents(): Promise<PendingEvent[]> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], "readonly");
  const store = transaction.objectStore(QUEUE_STORE);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result as PendingEvent[]);
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function removeFromQueue(eventId: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], "readwrite");
  transaction.objectStore(QUEUE_STORE).delete(eventId);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

/**
 * Atomically swap a queued entry: delete `oldId` and add `newEntry` in the
 * same transaction. If the tx aborts, neither change is applied.
 */
export async function replaceInQueue(oldId: string, newEntry: PendingEvent): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], "readwrite");
  const store = transaction.objectStore(QUEUE_STORE);
  store.delete(oldId);
  store.put(newEntry);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function getQueueCount(): Promise<number> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], "readonly");
  return new Promise((resolve, reject) => {
    const request = transaction.objectStore(QUEUE_STORE).count();
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function updateDETInCache(environment: string, det: DET): Promise<void> {
  const db = await openDB();
  const data = await new Promise<DatabaseData | null>((resolve, reject) => {
    const tx = db.transaction([DATA_STORE], "readonly");
    const req = tx.objectStore(DATA_STORE).get(environment);
    tx.onerror = () => reject(tx.error);
    req.onsuccess = () => resolve((req.result as DatabaseData | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });

  if (!data) {
    db.close();
    throw new Error(`No cached data found for environment: ${environment}`);
  }

  const updatedData = {
    ...data,
    DETsMap: { ...(data.DETsMap || {}), [det.date]: det },
  };

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([DATA_STORE], "readwrite");
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
    tx.objectStore(DATA_STORE).put(updatedData, environment);
  });
}
