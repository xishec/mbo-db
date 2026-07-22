import type { DatabaseData, PendingEvent, DET, BirdEvent } from "../types";
import type { Environment } from "../firebase";
import { INDEPENDENT_MAP_NAMES } from "../types/mapNames";

const DB_NAME = "mbo-db-20260503";
const DB_VERSION = 20260504;

// Store names
const METADATA_STORE = "metadata";
const DATA_STORE = "data";
const QUEUE_STORE = "queue";
// Bird events are stored per-env, per-row keyed by event id. Writing ONE
// event no longer requires re-serializing the entire 700K-event blob —
// that's the 10+ second save lag we saw on slow laptops. The `data` store
// keeps only independent metadata; event-derived indexes are rebuilt.
//
// One store per env (birdEvents_alpha, birdEvents_prod) so switching
// environments doesn't force a re-download — each env's rows live in
// their own store and survive independently.
const BIRD_EVENTS_STORE_PREFIX = "birdEvents_";
const birdEventsStoreName = (env: Environment) => `${BIRD_EVENTS_STORE_PREFIX}${env}`;
const ALL_BIRD_EVENTS_STORES = ["birdEvents_alpha", "birdEvents_prod"] as const;
// Legacy single-env store + its marker, dropped in v20260504.
const LEGACY_EVENTS_STORE = "birdEvents";
const LEGACY_EVENTS_ENV_KEY = "birdEventsEnvironment";

function createCachedMetadata(data: Partial<DatabaseData>): DatabaseData {
  const independentData = { ...data };
  delete independentData.birdEventsMap;
  delete independentData.yearsToProgramMap;
  delete independentData.programsMap;
  delete independentData.bandIdToBirdEventIdsMap;
  delete independentData.bandGroupsMap;
  delete independentData.bandSizeToBandIdMap;

  // These maps are rebuilt from the event rows on every load. Empty stubs
  // preserve DatabaseData's serialized shape without caching large,
  // immediately-discarded copies.
  return {
    ...independentData,
    birdEventsMap: {},
    yearsToProgramMap: {},
    programsMap: {},
    bandIdToBirdEventIdsMap: {},
    bandGroupsMap: {},
    bandSizeToBandIdMap: {} as DatabaseData["bandSizeToBandIdMap"],
    dismissedConflictsMap: independentData.dismissedConflictsMap ?? {},
  };
}

interface MetadataEntry {
  key: string;
  value: number | string;
}

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    // Schema upgrades must complete synchronously inside this callback —
    // any async gap inside a version-change transaction risks auto-commit
    // and silent failure. We deliberately do NOT copy rows from the
    // legacy store: on a phone that's a multi-minute cursor scan which
    // would hang the loader. Instead, we drop the legacy store, let the
    // per-env stores come up empty, and rely on the next load's "no
    // cached events" branch to re-fetch from Firebase. The queue store
    // is preserved so no in-flight user work is lost.
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const upgradeTx = (event.target as IDBOpenDBRequest).transaction;

      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE);
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
      for (const name of ALL_BIRD_EVENTS_STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }

      // Drop the legacy single-env events store and its env marker. The
      // next load sees `cachedEventCount === 0` and takes the full-
      // download branch — correct for the fresh-start semantics.
      if (db.objectStoreNames.contains(LEGACY_EVENTS_STORE)) {
        db.deleteObjectStore(LEGACY_EVENTS_STORE);
      }
      if (upgradeTx && db.objectStoreNames.contains(METADATA_STORE)) {
        upgradeTx.objectStore(METADATA_STORE).delete(LEGACY_EVENTS_ENV_KEY);
      }
    };
  });
}

export async function clearQueue(environment?: Environment): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], "readwrite");
  const store = transaction.objectStore(QUEUE_STORE);
  if (environment) {
    const request = store.getAll();
    request.onsuccess = () => {
      for (const pending of request.result as PendingEvent[]) {
        if (pending.environment === environment) store.delete(pending.id);
      }
    };
  } else {
    store.clear();
  }
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function clearEnvironmentCache(environment: Environment): Promise<void> {
  const db = await openDB();
  const eventsStoreName = birdEventsStoreName(environment);
  const transaction = db.transaction(
    [DATA_STORE, METADATA_STORE, eventsStoreName],
    "readwrite",
  );
  const metaStore = transaction.objectStore(METADATA_STORE);
  transaction.objectStore(DATA_STORE).delete(environment);
  transaction.objectStore(eventsStoreName).clear();
  metaStore.delete(`lastUpdated_${environment}`);
  for (const m of INDEPENDENT_MAP_NAMES) metaStore.delete(`lastModified_${m}_${environment}`);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function clearAllIndexedDB(): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(
    [METADATA_STORE, DATA_STORE, QUEUE_STORE, ...ALL_BIRD_EVENTS_STORES],
    "readwrite",
  );

  transaction.objectStore(METADATA_STORE).clear();
  transaction.objectStore(DATA_STORE).clear();
  transaction.objectStore(QUEUE_STORE).clear();
  for (const name of ALL_BIRD_EVENTS_STORES) {
    transaction.objectStore(name).clear();
  }

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
export async function saveDataToIndexedDB(environment: Environment, data: DatabaseData): Promise<void> {
  const db = await openDB();
  const eventsStoreName = birdEventsStoreName(environment);
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      [DATA_STORE, eventsStoreName],
      "readwrite",
    );
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };

    const dataStore = transaction.objectStore(DATA_STORE);
    const eventsStore = transaction.objectStore(eventsStoreName);

    const { birdEventsMap } = data;
    dataStore.put(createCachedMetadata(data), environment);

    if (birdEventsMap) {
      // Whole-dataset replace (initial load / full refresh) — clear first
      // so the store reflects exactly this env's events.
      eventsStore.clear();
      for (const id in birdEventsMap) {
        eventsStore.put(birdEventsMap[id], id);
      }
    }
  });
}

/**
 * Persist an incremental server refresh without clearing the per-event store.
 * Metadata and changed event rows share one transaction, so a failed write
 * cannot leave the cache metadata ahead of the cached events.
 */
export async function saveDataDeltaToIndexedDB(
  environment: Environment,
  data: DatabaseData,
  changedEvents: Record<string, BirdEvent>,
): Promise<void> {
  const db = await openDB();
  const eventsStoreName = birdEventsStoreName(environment);
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([DATA_STORE, eventsStoreName], "readwrite");
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };

    transaction.objectStore(DATA_STORE).put(createCachedMetadata(data), environment);
    const eventsStore = transaction.objectStore(eventsStoreName);
    for (const id in changedEvents) {
      eventsStore.put(changedEvents[id], id);
    }
  });
}

/**
 * Save only the non-event fields. Use on every save to avoid re-serializing
 * 700K events when the bird events store is already up to date (actions
 * persist the new/updated event via putBirdEvent directly).
 */
export async function saveDatabaseMetadataOnly(
  environment: Environment,
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

  const merged = createCachedMetadata({ ...(current ?? {}), ...partial });

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
export async function getDataFromIndexedDB(environment: Environment): Promise<DatabaseData | null> {
  const db = await openDB();
  const eventsStoreName = birdEventsStoreName(environment);
  const captured: {
    data: DatabaseData | null;
    vals: BirdEvent[];
  } = { data: null, vals: [] };

  // Register oncomplete/onerror BEFORE awaiting — otherwise the tx can
  // commit inside the await and the handlers attach to a dead tx.
  const txClosed = new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      [DATA_STORE, eventsStoreName],
      "readonly",
    );
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);

    const dataStore = transaction.objectStore(DATA_STORE);
    const eventsStore = transaction.objectStore(eventsStoreName);

    const dataReq = dataStore.get(environment);
    const valsReq = eventsStore.getAll();

    dataReq.onsuccess = () => {
      captured.data = (dataReq.result as DatabaseData | undefined) ?? null;
    };
    valsReq.onsuccess = () => {
      captured.vals = valsReq.result as BirdEvent[];
    };
  });

  try {
    await txClosed;
  } finally {
    db.close();
  }

  if (!captured.data) return null;
  const eventsForEnv: Record<string, BirdEvent> = {};
  for (const event of captured.vals) {
    eventsForEnv[event.id] = event;
  }
  return { ...captured.data, birdEventsMap: eventsForEnv };
}

/**
 * Insert or update a single bird event. O(1) — the 700K-event blob is
 * untouched. This is what addBirdEvent calls on the hot path.
 */
export async function putBirdEvent(environment: Environment, event: BirdEvent): Promise<void> {
  const db = await openDB();
  const storeName = birdEventsStoreName(environment);
  const transaction = db.transaction([storeName], "readwrite");
  transaction.objectStore(storeName).put(event, event.id);
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
export async function deleteBirdEvent(environment: Environment, id: string): Promise<void> {
  const db = await openDB();
  const storeName = birdEventsStoreName(environment);
  const transaction = db.transaction([storeName], "readwrite");
  transaction.objectStore(storeName).delete(id);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

/**
 * Batch upsert. Used by syncQueue after writing N events to RTDB — stamps
 * `syncedAt` on each locally in a single IDB transaction.
 */
export async function putBirdEvents(environment: Environment, events: BirdEvent[]): Promise<void> {
  if (events.length === 0) return;
  const db = await openDB();
  const storeName = birdEventsStoreName(environment);
  const transaction = db.transaction([storeName], "readwrite");
  const store = transaction.objectStore(storeName);
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

export async function saveLastUpdated(environment: Environment, timestamp: number): Promise<void> {
  return saveMetadata(`lastUpdated_${environment}`, timestamp);
}

export async function getLastUpdated(environment: Environment): Promise<number | null> {
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

export async function getQueuedEvents(environment?: Environment): Promise<PendingEvent[]> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], "readonly");
  const store = transaction.objectStore(QUEUE_STORE);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      db.close();
      const queued = request.result as PendingEvent[];
      resolve(environment ? queued.filter((pending) => pending.environment === environment) : queued);
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

/** Delete several successfully-synced queue rows in one transaction. */
export async function removeManyFromQueue(eventIds: Iterable<string>): Promise<void> {
  const ids = [...eventIds];
  if (ids.length === 0) return;

  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], "readwrite");
  const store = transaction.objectStore(QUEUE_STORE);
  for (const id of ids) store.delete(id);
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

export async function updateDETInCache(environment: Environment, det: DET): Promise<void> {
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
