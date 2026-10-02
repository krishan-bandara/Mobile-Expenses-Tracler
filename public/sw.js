// Minimal app-shell cache so the installed PWA opens instantly and the
// static shell still renders when you're offline. Data (transactions,
// categories, etc.) is handled separately by the Dexie queue in
// src/lib/db/offline.ts, not by this service worker.
//
// Bumped to v2 along with the fetch strategy below: v1 was cache-first
// for everything, which meant that after any new deployment, a
// browser with the old service worker still installed would keep
// serving the old cached HTML/JS chunks — and since a rebuild doesn't
// guarantee the exact old chunk filenames still exist on the server,
// a manual refresh could end up requesting JS files that were simply
// gone, surfacing as an error. Network-first fixes that: cache is now
// only a fallback for genuinely offline use, never preferred over a
// live request when one succeeds.
const CACHE_NAME = "expense-tracker-shell-v2";
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
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request))
  );
});
