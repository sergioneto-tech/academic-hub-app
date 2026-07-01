const SW_VERSION = "0.2.5";
const CACHE = `academic-hub-${SW_VERSION}`;

const PRECACHE_URLS = [
  "./manifest.webmanifest",
  "./pwa-192.png",
  "./pwa-512.png",
  "./release-notes.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key === CACHE ? null : caches.delete(key))))
    )
  );
  self.clients.claim();
});

function putInCache(req, res) {
  const copy = res.clone();
  caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = req.mode === "navigate";
  const isFreshFile =
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/sw.js") ||
    url.pathname.endsWith("/release-notes.json");

  // HTML, SW e notas de versão devem tentar sempre rede primeiro.
  // Isto evita a app ficar presa no bundle antigo depois de uma atualização.
  if (isNavigation || isFreshFile) {
    event.respondWith(
      fetch(req)
        .then((res) => putInCache(req, res))
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html") || caches.match("./")))
    );
    return;
  }

  // Assets estáticos continuam cache-first para manter a PWA utilizável offline.
  event.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => putInCache(req, res))
    )
  );
});

// Aplicar a atualização apenas quando a app mandar esta mensagem.
self.addEventListener("message", (event) => {
  if (!event?.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
