// public/sw.js
// Service Worker disabled during local development to prevent caching issues

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

// Pass all network requests straight through without caching or blocking
self.addEventListener("fetch", (event) => {
  return;
});
