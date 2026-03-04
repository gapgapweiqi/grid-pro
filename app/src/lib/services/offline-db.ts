/**
 * Offline Database — IndexedDB wrapper for local data persistence.
 * Stores API responses locally so the app works 100% offline.
 * Uses a simple key-value approach with timestamps for staleness checks.
 */

const DB_NAME = 'gridpro-offline';
const DB_VERSION = 1;
const STORE_CACHE = 'api-cache';
const STORE_SYNC = 'sync-queue';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC)) {
        const store = db.createObjectStore(STORE_SYNC, { keyPath: 'id', autoIncrement: true });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

// ===== API Cache (key-value) =====

export interface CacheEntry {
  key: string;
  data: any;
  cachedAt: number;
}

/** Store an API response in IndexedDB */
export async function cacheSet(key: string, data: any): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CACHE, 'readwrite');
    tx.objectStore(STORE_CACHE).put({ key, data, cachedAt: Date.now() } as CacheEntry);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Silently fail — offline cache is best-effort
  }
}

/** Get a cached API response from IndexedDB */
export async function cacheGet(key: string): Promise<CacheEntry | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CACHE, 'readonly');
    const req = tx.objectStore(STORE_CACHE).get(key);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Delete a specific cache entry */
export async function cacheDelete(key: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CACHE, 'readwrite');
    tx.objectStore(STORE_CACHE).delete(key);
  } catch {
    // ignore
  }
}

/** Delete all cache entries matching a prefix */
export async function cacheDeleteByPrefix(prefix: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CACHE, 'readwrite');
    const store = tx.objectStore(STORE_CACHE);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        if ((cursor.value as CacheEntry).key.startsWith(prefix)) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  } catch {
    // ignore
  }
}

// ===== Sync Queue (for offline mutations) =====

export interface SyncItem {
  id?: number;
  method: string;
  path: string;
  body?: string;
  headers?: Record<string, string>;
  status: 'pending' | 'syncing' | 'failed';
  createdAt: number;
  retries: number;
  error?: string;
}

/** Add a mutation to the sync queue */
export async function syncQueueAdd(item: Omit<SyncItem, 'id' | 'status' | 'createdAt' | 'retries'>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SYNC, 'readwrite');
    tx.objectStore(STORE_SYNC).add({
      ...item,
      status: 'pending',
      createdAt: Date.now(),
      retries: 0,
    } as SyncItem);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

/** Get all pending sync items */
export async function syncQueueGetPending(): Promise<SyncItem[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SYNC, 'readonly');
    const index = tx.objectStore(STORE_SYNC).index('status');
    const req = index.getAll('pending');
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/** Update a sync item's status */
export async function syncQueueUpdate(id: number, updates: Partial<SyncItem>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SYNC, 'readwrite');
    const store = tx.objectStore(STORE_SYNC);
    const req = store.get(id);
    req.onsuccess = () => {
      if (req.result) {
        store.put({ ...req.result, ...updates });
      }
    };
  } catch {
    // ignore
  }
}

/** Remove a completed sync item */
export async function syncQueueRemove(id: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SYNC, 'readwrite');
    tx.objectStore(STORE_SYNC).delete(id);
  } catch {
    // ignore
  }
}

/** Get count of pending sync items */
export async function syncQueueCount(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SYNC, 'readonly');
    const index = tx.objectStore(STORE_SYNC).index('status');
    const req = index.count('pending');
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}
