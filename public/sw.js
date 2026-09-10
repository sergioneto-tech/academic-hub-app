const SW_VERSION = "1.5.4-safari-recovery-3";
const CACHE = `academic-hub-${SW_VERSION}`;
const APP_SHELL_KEY = new URL("./__academic_hub_app_shell__", self.location.href).href;
const NOTIFICATION_ICON = "./academic-hub-notification-gold.svg";
const NOTIFICATION_BADGE = "./academic-hub-notification-badge.png";

const PRECACHE_URLS = [
  "./manifest.webmanifest?v=11",
  "./academic-hub-icon-v10-192.png",
  "./academic-hub-icon-v10-512.png",
  NOTIFICATION_ICON,
  NOTIFICATION_BADGE,
  "./release-notes.json?v=1.5.4",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    // Não pré-cacheia index.html: em Safari uma resposta que tenha passado por
    // redirect pode ficar marcada como redirected no Cache Storage e ser
    // rejeitada mais tarde numa navegação controlada pelo Service Worker.
    await caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {});

    // Recuperação extraordinária da versão 1.5.4: alguns clientes Safari/iOS
    // ficaram presos no worker anterior e nem conseguem abrir a UI para clicar
    // em "Atualizar". Esta release técnica assume controlo sem interação.
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("academic-hub-") && key !== CACHE)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") self.skipWaiting();
});

const NETWORK_ONLY_PATHS = new Set(["/sw.js", "/release-notes.json", "/security-status.json"]);

async function makeRedirectSafeResponse(response) {
  // WebKit/Safari pode recusar em event.respondWith() uma Response proveniente
  // do Cache Storage quando response.redirected === true. Reconstruir a resposta
  // remove os metadados internos do redirect sem alterar o HTML entregue à app.
  if (!response.redirected) return response;

  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  headers.delete("location");

  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Estes recursos têm de vir sempre da rede para a versão instalada conseguir
  // descobrir uma nova release ou o estado de segurança mais recente.
  if (NETWORK_ONLY_PATHS.has(url.pathname)) {
    event.respondWith(fetch(new Request(request, { cache: "no-store" })));
    return;
  }

  // Navegação: network-first e app-shell de fallback. A resposta guardada é
  // sempre normalizada quando existiu redirect, evitando o erro WebKit
  // "Response served by service worker has redirections".
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const networkResponse = await fetch(new Request(request, {
          cache: "no-store",
          redirect: "follow",
        }));

        if (!networkResponse.ok) return networkResponse;

        const safeResponse = await makeRedirectSafeResponse(networkResponse);
        await cache.put(APP_SHELL_KEY, safeResponse.clone());
        return safeResponse;
      } catch (error) {
        const installedShell = await cache.match(APP_SHELL_KEY);
        if (installedShell) return makeRedirectSafeResponse(installedShell);
        throw error;
      }
    })());
    return;
  }

  // Assets da aplicação: cache-first. Caches antigos são removidos na ativação,
  // por isso não se misturam bundles de releases diferentes.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(request, response.clone());
      return response;
    })
  );
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

      if (!navigated && "postMessage" in client) {
        client.postMessage({ type: "ACADEMIC_HUB_NOTIFICATION_NAVIGATE", url: target });
      }

      if ("focus" in client) return client.focus();
    }

    return clients.openWindow ? clients.openWindow(target) : undefined;
  })());
});
