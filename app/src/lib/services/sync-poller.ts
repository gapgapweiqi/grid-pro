/**
 * SyncPoller — polls the server for version changes every N minutes.
 * When a version mismatch is detected, invalidates the CachingAdapter caches
 * so the next read will fetch fresh data from D1.
 * This enables seamless multi-device and team member data consistency.
 */
import { invalidateAllCaches } from './caching-adapter';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastUserVersion = 0;
let lastCompanyVersion = 0;
let currentCompanyId = '';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth.token');
}

async function checkVersion(): Promise<void> {
  const token = getToken();
  if (!token) return;

  try {
    let url = `${API_URL}/api/sync/version`;
    if (currentCompanyId) url += `?companyId=${currentCompanyId}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return;

    const json = await res.json() as any;
    if (!json.ok) return;

    const { userVersion, companyVersion } = json.data;

    let needsRefresh = false;

    if (lastUserVersion > 0 && userVersion > lastUserVersion) {
      console.log(`[sync] user version changed: ${lastUserVersion} → ${userVersion}`);
      needsRefresh = true;
    }

    if (lastCompanyVersion > 0 && companyVersion > lastCompanyVersion) {
      console.log(`[sync] company version changed: ${lastCompanyVersion} → ${companyVersion}`);
      needsRefresh = true;
    }

    lastUserVersion = userVersion;
    lastCompanyVersion = companyVersion;

    if (needsRefresh) {
      // Invalidate all caches so next reads fetch fresh data
      invalidateAllCaches();

      // Also clear the service worker API cache
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_API_CACHE' });
      }

      // Notify listeners
      for (const cb of syncCallbacks) {
        try { cb(); } catch {}
      }
    }
  } catch (e) {
    // Network error — skip this poll cycle
    console.warn('[sync] poll failed:', e);
  }
}

// ===== Public API =====

type SyncCallback = () => void;
const syncCallbacks: SyncCallback[] = [];

/** Register a callback for when remote data has changed */
export function onSyncUpdate(cb: SyncCallback): () => void {
  syncCallbacks.push(cb);
  return () => {
    const idx = syncCallbacks.indexOf(cb);
    if (idx >= 0) syncCallbacks.splice(idx, 1);
  };
}

/** Start polling for sync version changes */
export function startSyncPoller(companyId: string): void {
  currentCompanyId = companyId;
  stopSyncPoller();

  // Initial check after 3 seconds (not immediately, to not block startup)
  setTimeout(() => checkVersion(), 3000);

  pollTimer = setInterval(checkVersion, POLL_INTERVAL_MS);
}

/** Update the company being watched */
export function updateSyncCompany(companyId: string): void {
  currentCompanyId = companyId;
  // Reset versions so we re-learn the baseline
  lastCompanyVersion = 0;
}

/** Stop polling */
export function stopSyncPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
