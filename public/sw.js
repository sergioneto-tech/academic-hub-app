const SW_VERSION = "1.5.0-deeplink-1";
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
  "./release-notes.json?v=1.5.0",
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
  let payload = {};
  try {
    payload = event.data?.json?.() || {};
  } catch {
    payload = { body: event.data?.text?.() || "" };
  }

  const title = payload.title || "Academic Hub";
  const body = payload.body || "";
  const suppliedData = payload.data && typeof payload.data === "object" ? payload.data : {};
  const options = {
    body,
    icon: payload.icon || NOTIFICATION_ICON,
    badge: payload.badge || NOTIFICATION_BADGE,
    data: {
      ...suppliedData,
      url: payload.url || suppliedData.url || "./",
      title,
      body,
    },
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    silent: false,
    vibrate: payload.vibrate || [180, 80, 180],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

function buildNotificationTarget(notification) {
  const rawTarget = notification?.data?.url || "./";
  const target = new URL(rawTarget, self.registration.scope);

  // Para rotas internas do HashRouter, mantém o destino original e acrescenta
  // apenas contexto temporário para a app destacar a notificação que foi aberta.
  if (target.origin === self.location.origin && target.hash.startsWith("#/")) {
    const rawRoute = target.hash.slice(1);
    const queryIndex = rawRoute.indexOf("?");
    const routePath = queryIndex >= 0 ? rawRoute.slice(0, queryIndex) : rawRoute;
    const params = new URLSearchParams(queryIndex >= 0 ? rawRoute.slice(queryIndex + 1) : "");
    params.set("_push", "1");
    if (notification?.data?.title) params.set("_pushTitle", notification.data.title);
    if (notification?.data?.body) params.set("_pushBody", notification.data.body);
    const query = params.toString();
    target.hash = `#${routePath}${query ? `?${query}` : ""}`;
  }

  return target.href;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = buildNotificationTarget(event.notification);

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });

    for (const client of clientList) {
      let navigated = false;
      if ("navigate" in client) {
        try {
          await client.navigate(target);
          navigated = true;
        } catch {
          navigated = false;
        }
      }

      // Fallback importante para Safari/iPadOS quando WindowClient.navigate não
      // consegue alterar a rota de uma PWA já aberta.
      if (!navigated && "postMessage" in client) {
        client.postMessage({ type: "ACADEMIC_HUB_NOTIFICATION_NAVIGATE", url: target });
      }

      if ("focus" in client) return client.focus();
    }

    return clients.openWindow ? clients.openWindow(target) : undefined;
  })());
});
