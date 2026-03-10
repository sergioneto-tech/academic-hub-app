const SW_VERSION = "0.2.3";
const CACHE = `academic-hub-${SW_VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll([
        "./",
        "./index.html",
        "./manifest.webmanifest",
        "./pwa-192.png",
        "./pwa-512.png",
        "./release-notes.json",
      ]).catch(() => {})
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

function putInCache(req, res) {
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  return res;
}

// Network-first para navegação e assets críticos do build.
// Isto evita servir JS/CSS antigos após novo deploy.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isNav = req.mode === "navigate";
  const isBuildAsset = /\/assets\//.test(url.pathname) || /\.(js|css|mjs)$/.test(url.pathname);
  const isVersionNotes = url.pathname.endsWith("release-notes.json");

  if (isNav || isBuildAsset || isVersionNotes) {
    event.respondWith(
      fetch(req)
        .then((res) => putInCache(req, res))
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => putInCache(req, res));
    })
  );
});

self.addEventListener("message", (event) => {
  if (!event?.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
