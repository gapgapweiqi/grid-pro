// Self-destructing Service Worker — kills any stale SW registration on grid-doc.com
self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(e) {
  e.waitUntil(self.clients.claim());
  self.registration.unregister();
});
