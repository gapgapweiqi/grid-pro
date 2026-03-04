/**
 * Sync Manager — processes offline mutation queue when connectivity is restored.
 * Listens for online events and flushes pending items to the server.
 */

import { writable, get } from 'svelte/store';
import { syncQueueGetPending, syncQueueUpdate, syncQueueRemove, syncQueueCount } from './offline-db';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';
const MAX_RETRIES = 3;

// --- Stores ---
export const isOnline = writable(true);
export const isSyncing = writable(false);
export const pendingSyncCount = writable(0);

let _initialized = false;
let _syncTimer: ReturnType<typeof setTimeout> | null = null;

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth.token');
}

/** Initialize sync manager — call once from root layout */
export function initSyncManager() {
  if (_initialized || typeof window === 'undefined') return;
  _initialized = true;

  isOnline.set(navigator.onLine);

  window.addEventListener('online', () => {
    isOnline.set(true);
    // Flush sync queue after a small delay (let connection stabilize)
    scheduleSyncFlush(1500);
  });

  window.addEventListener('offline', () => {
    isOnline.set(false);
    if (_syncTimer) {
      clearTimeout(_syncTimer);
      _syncTimer = null;
    }
  });

  // Initial count
  refreshPendingCount();

  // If already online, try flushing any leftover items from previous session
  if (navigator.onLine) {
    scheduleSyncFlush(3000);
  }
}

function scheduleSyncFlush(delayMs: number) {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    _syncTimer = null;
    flushSyncQueue();
  }, delayMs);
}

/** Flush all pending sync items to the server */
export async function flushSyncQueue(): Promise<void> {
  if (get(isSyncing) || !navigator.onLine) return;

  const items = await syncQueueGetPending();
  if (items.length === 0) {
    pendingSyncCount.set(0);
    return;
  }

  isSyncing.set(true);

  for (const item of items) {
    try {
      await syncQueueUpdate(item.id!, { status: 'syncing' });

      const token = getToken();
      const headers: Record<string, string> = { ...item.headers };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';

      const res = await fetch(`${API_URL}${item.path}`, {
        method: item.method,
        headers,
        body: item.body || undefined,
      });

      if (res.ok) {
        // Success — remove from queue
        await syncQueueRemove(item.id!);
      } else if (res.status >= 400 && res.status < 500) {
        // Client error (4xx) — won't succeed on retry, remove
        await syncQueueRemove(item.id!);
      } else {
        // Server error (5xx) — retry later
        const retries = (item.retries || 0) + 1;
        if (retries >= MAX_RETRIES) {
          await syncQueueUpdate(item.id!, { status: 'failed', retries, error: `HTTP ${res.status}` });
        } else {
          await syncQueueUpdate(item.id!, { status: 'pending', retries });
        }
      }
    } catch (err: any) {
      // Network error — stop flushing, we're probably offline again
      await syncQueueUpdate(item.id!, { status: 'pending' });
      break;
    }
  }

  isSyncing.set(false);
  await refreshPendingCount();
}

/** Refresh the pending count store */
export async function refreshPendingCount(): Promise<void> {
  const count = await syncQueueCount();
  pendingSyncCount.set(count);
}
