const SW_VERSION = "1.0.0-install11";
const CACHE = `academic-hub-${SW_VERSION}`;

const PRECACHE_URLS = [
  "./manifest.webmanifest?v=9",
  "./academic-hub-icon-current-v8.svg",
  "./release-notes.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key === CACHE ? null : caches.delete(key))))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") self.skipWaiting();
});

function putInCache(req, res) {
  const copy = res.clone();
  caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
  return res;
}

function networkFirst(req, fallbackToRoot = false) {
  return fetch(req, { cache: "no-store" })
    .then((res) => (res && res.ok ? putInCache(req, res) : res))
    .catch(() => caches.match(req).then((cached) => cached || (fallbackToRoot ? caches.match("./") : undefined)));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = req.mode === "navigate";
  const isVersionSensitiveAsset = url.pathname.includes("/assets/");
  const mustBeFresh =
    url.pathname.endsWith("/sw.js") ||
    url.pathname.includes("manifest.webmanifest") ||
    url.pathname.endsWith(".html") ||
    isNavigation ||
    isVersionSensitiveAsset;

  if (mustBeFresh) {
    event.respondWith(networkFirst(req, isNavigation));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => (res && res.ok ? putInCache(req, res) : res))
        .catch(() => undefined);
      return cached || network;
    })
  );
});
