const SW_VERSION = "1.3.1-assessment2";
const CACHE = `academic-hub-${SW_VERSION}`;
const NOTIFICATION_ICON = "./academic-hub-notification-gold.svg";
const NOTIFICATION_BADGE = "./academic-hub-notification-badge.png";
const NOTIFICATION_GOLD = "#CB9D48";

const PRECACHE_URLS = [
  "./manifest.webmanifest?v=11",
  "./academic-hub-icon-v10-192.png",
  "./academic-hub-icon-v10-512.png",
  NOTIFICATION_ICON,
  NOTIFICATION_BADGE,
  "./release-notes.json?v=1.3.1",
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
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    color: NOTIFICATION_GOLD,
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

    const absolute = new URL(target, self.registration.scope).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = windows.find((item) => item.visibilityState === "visible") || windows[0];

    if (client) {
      try {
        await client.focus();
        if ("navigate" in client) {
          const navigated = await client.navigate(absolute);
          if (navigated) return navigated;
        }
      } catch {
        // Se o cliente existente não aceitar navegação, abre uma nova janela PWA.
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
