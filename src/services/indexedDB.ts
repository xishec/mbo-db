import type { AlphaData } from "../types";

const DB_NAME = "mbo-db";
const DB_VERSION = 2;

// Store names
const METADATA_STORE = "metadata";
const ALPHA_DATA_STORE = "alphaData";

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
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create metadata store (for timestamps, etc.)
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: "key" });
      }

      // Create alpha data store (for complete environment data cache)
      if (!db.objectStoreNames.contains(ALPHA_DATA_STORE)) {
        db.createObjectStore(ALPHA_DATA_STORE);
      }
    };
  });
}

/**
 * Clear all data from IndexedDB (useful for debugging)
 */
export async function clearAllIndexedDB(): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([METADATA_STORE, ALPHA_DATA_STORE], "readwrite");

  transaction.objectStore(METADATA_STORE).clear();
  transaction.objectStore(ALPHA_DATA_STORE).clear();

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
 * Save complete alpha data to IndexedDB
 */
export async function saveAlphaDataToIndexedDB(environment: string, data: AlphaData): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([ALPHA_DATA_STORE], "readwrite");
  const store = transaction.objectStore(ALPHA_DATA_STORE);

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
 * Get complete alpha data from IndexedDB
 */
export async function getAlphaDataFromIndexedDB(environment: string): Promise<AlphaData | null> {
  const db = await openDB();
  const transaction = db.transaction([ALPHA_DATA_STORE], "readonly");
  const store = transaction.objectStore(ALPHA_DATA_STORE);

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
export async function saveEnvironmentLastUpdated(environment: string, timestamp: number): Promise<void> {
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
export async function getEnvironmentLastUpdated(environment: string): Promise<number | null> {
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
