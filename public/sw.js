const SW_VERSION = "1.2.3-push4";
const CACHE = `academic-hub-${SW_VERSION}`;

const PRECACHE_URLS = [
  "./manifest.webmanifest?v=11",
  "./academic-hub-icon-v10-192.png",
  "./academic-hub-icon-v10-512.png",
  "./academic-hub-notification-badge.png",
  "./release-notes.json?v=1.2.3",
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

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Academic Hub", body: event.data?.text() || "Novo alerta académico." }; }
  const title = data.title || "Academic Hub";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "Tens um novo alerta académico.",
    icon: data.icon || "./academic-hub-icon-v10-192.png",
    badge: data.badge || "./academic-hub-notification-badge.png",
    data: { url: data.url || "./#/calendario" },
    tag: data.tag || undefined,
    renotify: false,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || "./#/calendario";
  event.waitUntil((async () => {
    if (/^https?:\/\//i.test(target) && !target.startsWith(self.location.origin)) {
      return self.clients.openWindow(target);
    }
    const absolute = new URL(target, self.location.origin).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        try { if ("navigate" in client) await client.navigate(absolute); } catch {}
        return client.focus();
      }
    }
    return self.clients.openWindow(absolute);
  })());
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
  const isReleaseNotes = url.pathname.endsWith("/release-notes.json");
  const mustBeFresh =
    url.pathname.endsWith("/sw.js") ||
    url.pathname.includes("manifest.webmanifest") ||
    url.pathname.endsWith(".html") ||
    isReleaseNotes ||
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
