import type { Capture, MagicTable } from "../types";

const DB_NAME = "mbo-db";
const DB_VERSION = 1;

// Store names
const CAPTURES_STORE = "captures";
const MAGIC_TABLE_STORE = "magicTable";
const METADATA_STORE = "metadata";

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

      // Create captures store (key = captureId)
      if (!db.objectStoreNames.contains(CAPTURES_STORE)) {
        db.createObjectStore(CAPTURES_STORE);
      }

      // Create magic table store
      if (!db.objectStoreNames.contains(MAGIC_TABLE_STORE)) {
        db.createObjectStore(MAGIC_TABLE_STORE);
      }

      // Create metadata store (for timestamps, etc.)
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: "key" });
      }
    };
  });
}

/**
 * Save all captures to IndexedDB
 */
export async function saveCaptureMapToIndexedDB(capturesMap: Record<string, Capture>): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([CAPTURES_STORE], "readwrite");
  const store = transaction.objectStore(CAPTURES_STORE);

  // Clear existing data and add new data
  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => resolve();
    clearRequest.onerror = () => reject(clearRequest.error);
  });

  // Store each capture
  const entries = Object.entries(capturesMap);
  for (const [captureId, capture] of entries) {
    store.put(capture, captureId);
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
 * Get all captures from IndexedDB
 */
export async function getAllCapturesFromIndexedDB(): Promise<Capture[]> {
  const db = await openDB();
  const transaction = db.transaction([CAPTURES_STORE], "readonly");
  const store = transaction.objectStore(CAPTURES_STORE);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result as Capture[]);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Save magic table to IndexedDB
 */
export async function saveMagicTableToIndexedDB(magicTable: MagicTable): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([MAGIC_TABLE_STORE], "readwrite");
  const store = transaction.objectStore(MAGIC_TABLE_STORE);

  store.put(magicTable, "magicTable");

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
 * Get magic table from IndexedDB
 */
export async function getMagicTableFromIndexedDB(): Promise<MagicTable | null> {
  const db = await openDB();
  const transaction = db.transaction([MAGIC_TABLE_STORE], "readonly");
  const store = transaction.objectStore(MAGIC_TABLE_STORE);

  return new Promise((resolve, reject) => {
    const request = store.get("magicTable");
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
 * Save lastUpdated timestamp to IndexedDB
 */
export async function saveLastUpdatedToIndexedDB(timestamp: number): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([METADATA_STORE], "readwrite");
    const store = transaction.objectStore(METADATA_STORE);

    const entry: MetadataEntry = { key: "lastUpdated", value: timestamp };
    store.put(entry);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        console.log("✅ Timestamp saved to IndexedDB:", timestamp);
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        console.error("❌ Failed to save timestamp to IndexedDB:", transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error("❌ Error in saveLastUpdatedToIndexedDB:", error);
    throw error;
  }
}

/**
 * Get lastUpdated timestamp from IndexedDB
 */
export async function getLastUpdatedFromIndexedDB(): Promise<number | null> {
  const db = await openDB();
  const transaction = db.transaction([METADATA_STORE], "readonly");
  const store = transaction.objectStore(METADATA_STORE);

  return new Promise((resolve, reject) => {
    const request = store.get("lastUpdated");
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
 * Clear all data from IndexedDB (useful for debugging)
 */
export async function clearAllIndexedDB(): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([CAPTURES_STORE, MAGIC_TABLE_STORE, METADATA_STORE], "readwrite");

  transaction.objectStore(CAPTURES_STORE).clear();
  transaction.objectStore(MAGIC_TABLE_STORE).clear();
  transaction.objectStore(METADATA_STORE).clear();

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
