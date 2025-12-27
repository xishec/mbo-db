import type { AlphaData, PendingBirdEvent } from "../types";

const DB_NAME = "mbo-db";
const DB_VERSION = 3; // Increment for queue store

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
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      
      // Verify all required stores exist
      const hasAllStores = 
        db.objectStoreNames.contains(METADATA_STORE) &&
        db.objectStoreNames.contains(DATA_STORE) &&
        db.objectStoreNames.contains(QUEUE_STORE);
      
      if (!hasAllStores) {
        // Close and delete the database, then recreate
        db.close();
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
        deleteRequest.onsuccess = () => {
          // Retry opening with upgrade
          openDB().then(resolve).catch(reject);
        };
        deleteRequest.onerror = () => reject(deleteRequest.error);
      } else {
        resolve(db);
      }
    };

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
export async function saveDataToIndexedDB(environment: string, data: AlphaData): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([DATA_STORE], "readwrite");
  const store = transaction.objectStore(DATA_STORE);

  store.put(data, environment);

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      db.close();
      console.log(`✅ ${environment} data saved to IndexedDB`);
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
export async function getDataFromIndexedDB(environment: string): Promise<AlphaData | null> {
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

/**
 * Save environment-specific lastUpdated timestamp to IndexedDB
 */
export async function saveLastUpdated(environment: string, timestamp: number): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([METADATA_STORE], "readwrite");
    const store = transaction.objectStore(METADATA_STORE);

    const entry: MetadataEntry = { key: `lastUpdated_${environment}`, value: timestamp };
    store.put(entry);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        console.log(`✅ ${environment} timestamp saved to IndexedDB:`, timestamp);
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        console.error(`❌ Failed to save ${environment} timestamp to IndexedDB:`, transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error("❌ Error in saveEnvironmentLastUpdated:", error);
    throw error;
  }
}

/**
 * Get environment-specific lastUpdated timestamp from IndexedDB
 */
export async function getLastUpdated(environment: string): Promise<number | null> {
  const db = await openDB();
  const transaction = db.transaction([METADATA_STORE], "readonly");
  const store = transaction.objectStore(METADATA_STORE);

  return new Promise((resolve, reject) => {
    const request = store.get(`lastUpdated_${environment}`);
    request.onsuccess = () => {
      db.close();
      const result = request.result as MetadataEntry | undefined;
      resolve(result ? (result.value as number) : null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Add a pending bird event to the queue
 */
export async function addToQueue(pendingEvent: PendingBirdEvent): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], "readwrite");
  const store = transaction.objectStore(QUEUE_STORE);

  store.put(pendingEvent);

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      db.close();
      console.log(`✅ Added to queue: ${pendingEvent.id}`);
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

/**
 * Get all pending bird events from the queue
 */
export async function getQueuedEvents(): Promise<PendingBirdEvent[]> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], "readonly");
  const store = transaction.objectStore(QUEUE_STORE);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result as PendingBirdEvent[]);
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
      console.log(`✅ Removed from queue: ${eventId}`);
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
