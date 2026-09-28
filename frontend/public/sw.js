/* MacroMate service worker: cache-first for hashed assets, network-first
   for navigations (with offline fallback to the cached shell). API calls
   are never intercepted. */

const ASSET_CACHE = "mm-assets-v1";
const SHELL_CACHE = "mm-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![ASSET_CACHE, SHELL_CACHE].includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return; // API lives on another origin
  if (url.pathname.startsWith("/api/")) return;

  // immutable hashed build assets: cache-first
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const resp = await fetch(request);
        if (resp.ok) cache.put(request, resp.clone());
        return resp;
      })
    );
    return;
  }

  // navigations: network-first, offline fallback to the cached shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy));
          }
          return resp;
        })
        .catch(() => caches.open(SHELL_CACHE).then((cache) => cache.match("/")))
    );
  }
});
