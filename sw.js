// Immutable-asset cache for GitHub Pages static snapshot: caches content-hashed media/* and assets/*
// without caching HTML, JSON, feeds, or sw.js itself so news and layout updates reach readers at once.
const CACHE_NAME = "gamehot-immutable-v1";
const MAX_ENTRIES = 600;
const SCOPE_PATH = new URL(self.registration.scope).pathname;
const MEDIA_PREFIX = `${SCOPE_PATH}media/`;
const ASSETS_PREFIX = `${SCOPE_PATH}assets/`;
const HASHED_ASSET = /-[a-zA-Z0-9_-]{8,}\.(?:css|js|svg|woff2)$/;

function isImmutable(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith(MEDIA_PREFIX)) return !url.search;
  return url.pathname.startsWith(ASSETS_PREFIX) && HASHED_ASSET.test(url.pathname) && !url.search;
}

async function trimCache(cache) {
  const keys = await cache.keys();
  const excess = keys.length - MAX_ENTRIES;
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name.startsWith("gamehot-immutable-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  let url;
  try { url = new URL(event.request.url); } catch { return; }
  if (!isImmutable(url)) return;
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const response = await fetch(event.request);
      if (response.ok && response.type === "basic") {
        event.waitUntil(cache.put(event.request, response.clone()).then(() => trimCache(cache)).catch(() => {}));
      }
      return response;
    }),
  );
});
