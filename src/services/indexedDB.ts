import type { DatabaseData, PendingEvent, DET } from "../types";
import { INDEPENDENT_MAP_NAMES } from "../types/mapNames";

const DB_NAME = "mbo-db-20260420";
const DB_VERSION = 1;

// Store names
const METADATA_STORE = "metadata";
const DATA_STORE = "data";
const QUEUE_STORE = "queue";

interface MetadataEntry {
  key: string;
  value: number | string;
}

/**
 * Initialize IndexedDB and create object stores
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create metadata store (for timestamps, etc.)
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: "key" });
      }

      // Create data store (for complete environment data cache)
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE);
      }

      // Create queue store (for offline sync)
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
    };
  });
}

/**
 * Clear all data from IndexedDB (useful for debugging)
 */
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
  const transaction = db.transaction([DATA_STORE, METADATA_STORE], "readwrite");
  const metaStore = transaction.objectStore(METADATA_STORE);
  transaction.objectStore(DATA_STORE).delete(environment);
  metaStore.delete(`lastUpdated_${environment}`);
  for (const m of INDEPENDENT_MAP_NAMES) metaStore.delete(`lastModified_${m}_${environment}`);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function clearAllIndexedDB(): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([METADATA_STORE, DATA_STORE, QUEUE_STORE], "readwrite");

  transaction.objectStore(METADATA_STORE).clear();
  transaction.objectStore(DATA_STORE).clear();
  transaction.objectStore(QUEUE_STORE).clear();

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
 * Save complete environment data to IndexedDB
 */
export async function saveDataToIndexedDB(environment: string, data: DatabaseData): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([DATA_STORE], "readwrite");
  const store = transaction.objectStore(DATA_STORE);

  store.put(data, environment);

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
 * Get complete environment data from IndexedDB
 */
export async function getDataFromIndexedDB(environment: string): Promise<DatabaseData | null> {
  const db = await openDB();
  const transaction = db.transaction([DATA_STORE], "readonly");
  const store = transaction.objectStore(DATA_STORE);

  return new Promise((resolve, reject) => {
    const request = store.get(environment);
    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
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

/**
 * Add a pending event to the queue
 */
export async function addToQueue(pendingEvent: PendingEvent): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], "readwrite");
  const queueStore = transaction.objectStore(QUEUE_STORE);

  // Add to queue
  queueStore.put(pendingEvent);

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
 * Get all pending events from the queue
 */
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
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Remove a pending bird event from the queue
 */
export async function removeFromQueue(eventId: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], "readwrite");
  const store = transaction.objectStore(QUEUE_STORE);

  store.delete(eventId);

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
 * Atomically swap a queued entry: delete `oldId` and add `newEntry` in the
 * same transaction. If the tx aborts, neither change is applied, so we never
 * end up with both gone or both present after a crash.
 */
export async function replaceInQueue(oldId: string, newEntry: PendingEvent): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], "readwrite");
  const store = transaction.objectStore(QUEUE_STORE);

  store.delete(oldId);
  store.put(newEntry);

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
 * Get count of pending events in queue
 */
export async function getQueueCount(): Promise<number> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], "readonly");
  const store = transaction.objectStore(QUEUE_STORE);

  return new Promise((resolve, reject) => {
    const request = store.count();
    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Update DET in IndexedDB cache
 */
export async function updateDETInCache(environment: string, det: DET): Promise<void> {
  const db = await openDB();
  
  // Get existing data
  const getData = db.transaction([DATA_STORE], "readonly");
  const data = await new Promise<DatabaseData | null>((resolve, reject) => {
    const request = getData.objectStore(DATA_STORE).get(environment);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  
  if (!data) {
    db.close();
    throw new Error(`No cached data found for environment: ${environment}`);
  }
  
  // Update DET
  const updatedData = {
    ...data,
    DETsMap: {
      ...(data.DETsMap || {}),
      [det.date]: det,
    },
  };
  
  // Save back to IndexedDB
  const putData = db.transaction([DATA_STORE], "readwrite");
  putData.objectStore(DATA_STORE).put(updatedData, environment);
  
  return new Promise((resolve, reject) => {
    putData.oncomplete = () => {
      db.close();
      resolve();
    };
    putData.onerror = () => {
      db.close();
      reject(putData.error);
    };
  });
}


