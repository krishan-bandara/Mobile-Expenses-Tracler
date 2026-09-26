// Minimal app-shell cache so the installed PWA opens instantly and the
// static shell still renders when you're offline. Data (transactions,
// categories, etc.) is handled separately by the Dexie queue in
// src/lib/db/offline.ts, not by this service worker.
const CACHE_NAME = "expense-tracker-shell-v1";
const SHELL_URLS = ["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  // Never cache API calls or Supabase requests — those need to be live.
  if (request.url.includes("/api/") || request.url.includes("supabase.co")) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => cached)
      );
    })
  );
});
