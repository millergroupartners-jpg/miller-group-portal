/*
 * Minimal service worker: exists only to satisfy the PWA install criteria
 * (manifest + icons + SW + HTTPS). Deliberately does NO caching — the SPA
 * ships hashed assets and index.html must never be served stale.
 *
 * WARNING: never add respondWith(caches.match(...)) here without a versioned
 * precache strategy. And if this SW is ever removed, first ship a release
 * where it calls registration.unregister() — otherwise installed clients
 * keep the old controller forever.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* passthrough — no respondWith */ });
