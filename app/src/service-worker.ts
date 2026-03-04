/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

const STATIC_CACHE = `gridpro-static-${version}`;
const API_CACHE = 'gridpro-api-v1'; // kept for cleanup of old caches
const IMAGE_CACHE = 'gridpro-images-v1'; // persistent across deploys
const FONT_CACHE = 'gridpro-fonts-v1'; // persistent across deploys — Google Fonts

const ASSETS = [
  ...build,
  ...files
];

// The SPA fallback page — must be cached separately because SvelteKit
// excludes the fallback from the `files` list in $service-worker.
const FALLBACK_PAGE = '/index.html';


self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Precache all build assets — fetch in batches to avoid network congestion on mobile
      // Each batch strips redirect flags (Safari rejects redirected responses from SW)
      const BATCH_SIZE = 10;
      for (let i = 0; i < ASSETS.length; i += BATCH_SIZE) {
        const batch = ASSETS.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (url) => {
            try {
              const res = await fetch(new Request(url, { redirect: 'follow' }));
              if (res.ok) {
                await cache.put(url, res.redirected ? cleanResponse(res) : res);
              }
            } catch {
              // Skip assets that fail to fetch (offline install edge case)
            }
          })
        );
      }
      // Explicitly cache the SPA fallback page — fetch + clean to strip redirect flag
      try {
        const res = await fetch(new Request(`${self.location.origin}/index.html`, { redirect: 'follow' }));
        if (res.ok) {
          await cache.put(FALLBACK_PAGE, cleanResponse(res));
        }
      } catch {
        // Fallback: skip if unreachable
      }
    }).then(() => {
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== IMAGE_CACHE && key !== FONT_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => {
      self.clients.claim();
      // Notify all clients that a new version is active so they can reload
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'SW_UPDATED', version });
        }
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET for static caching
  if (event.request.method !== 'GET') return;

  // Google Fonts — cache for offline use
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(handleFontRequest(event.request, url));
    return;
  }

  // Skip other non-same-origin requests
  if (url.origin !== self.location.origin) return;

  // Navigation → cache-first for SPA shell (instant PWA startup), revalidate in background
  // CRITICAL: Safari PWA rejects ANY redirected response from SW for navigation.
  // We wrap handleNavigate with a safety net that guarantees a clean response.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      handleNavigate().then((res) => {
        // Final safety net — if response is still somehow redirected, create clean copy
        if (res.redirected) return cleanResponse(res);
        return res;
      }).catch(() => {
        // Nuclear fallback — return minimal HTML
        return new Response(
          '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/"></head><body></body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
      })
    );
    return;
  }

  // R2 images → cache-first (persistent across deploys)
  if (url.pathname.startsWith('/api/images/')) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => new Response('', { status: 404 }));
        })
      )
    );
    return;
  }

  // API requests — skip SW caching, let CachingAdapter (IndexedDB) handle it
  if (url.pathname.startsWith('/api/')) {
    return; // pass through to network — CachingAdapter provides smart caching
  }

  // Static assets → cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && ASSETS.includes(url.pathname)) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});


// ===== Navigation handler =====
// Browsers reject redirected responses from service workers for navigation requests.
// We MUST always return a fresh Response() to strip the .redirected flag.
function cleanResponse(response: Response): Response {
  // Create a brand new Response to strip .redirected and .type flags
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function handleNavigate(): Promise<Response> {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(FALLBACK_PAGE);

  // If we have a valid (non-redirected) cached shell, serve it and revalidate in background
  if (cached && !cached.redirected && cached.ok) {
    // Background revalidate — fire and forget
    fetchAndCacheFallback(cache).catch(() => {});
    return cached;
  }

  // Cache is missing or bad (redirected) — must fetch from network
  try {
    return await fetchAndCacheFallback(cache);
  } catch {
    // Absolute last resort — synthetic HTML that reloads the page
    return new Response(
      '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/"></head><body></body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

async function fetchAndCacheFallback(cache: Cache): Promise<Response> {
  const response = await fetch(new Request(`${self.location.origin}/index.html`, {
    credentials: 'same-origin',
    redirect: 'follow',
  }));
  if (response.ok) {
    // Always create a clean copy — strips .redirected flag before caching
    const clean = cleanResponse(response.clone());
    cache.put(FALLBACK_PAGE, clean);
    // Return a clean copy to the browser too (never return a redirected response)
    return cleanResponse(response);
  }
  return response;
}

// ===== Google Fonts caching =====
async function handleFontRequest(request: Request, url: URL): Promise<Response> {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);

  // Font files (gstatic.com) are immutable (hashed URLs) → cache-first
  if (url.hostname === 'fonts.gstatic.com') {
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      return cached || new Response('', { status: 404 });
    }
  }

  // Font CSS (googleapis.com) → stale-while-revalidate
  if (cached) {
    // Serve cached immediately, update in background
    fetch(request)
      .then((response) => {
        if (response.ok) cache.put(request, response.clone());
      })
      .catch(() => {}); // offline — skip
    return cached;
  }

  // No cache — must fetch
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

// ===== Push Notification Handlers =====

/** Check notification preferences from IndexedDB or fall back to allowing all */
async function shouldShowNotification(category?: string): Promise<boolean> {
  if (!category) return true;
  try {
    // Service workers can't access localStorage — check via cache or default to true
    const cache = await caches.open('push-prefs');
    const resp = await cache.match('/push-preferences');
    if (resp) {
      const prefs = await resp.json();
      if (category === 'announcement' && prefs.announcements === false) return false;
      if (category === 'doc_update' && prefs.docUpdates === false) return false;
      if (category === 'payment' && prefs.payments === false) return false;
    }
  } catch {}
  return true;
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();

    const showNotif = async () => {
      const allowed = await shouldShowNotification(payload.data?.category);
      if (!allowed) return;

      const options: NotificationOptions = {
        body: payload.body || '',
        icon: payload.icon || '/icons/icon-192.png',
        badge: payload.badge || '/icons/icon-192.png',
        image: payload.image || payload.imageUrl || undefined,
        data: payload.data || {},
        vibrate: [200, 100, 200],
        tag: payload.tag || 'grid-doc-notification',
        renotify: true,
      };

      await self.registration.showNotification(payload.title || 'Grid Doc', options);
    };

    event.waitUntil(showNotif());
  } catch {
    // Fallback for plain text payload
    event.waitUntil(
      self.registration.showNotification('Grid Doc', {
        body: event.data.text(),
        icon: '/icons/icon-192.png',
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) (client as any).navigate(url);
          return;
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  // Legacy: clean up old API cache if it still exists
  if (event.data?.type === 'INVALIDATE_API_CACHE' || event.data?.type === 'CLEAR_API_CACHE') {
    caches.delete(API_CACHE).catch(() => {});
  }
});
