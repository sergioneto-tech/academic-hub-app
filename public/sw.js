const SW_VERSION = "1.5.6-controlled-update-2";
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
  "./release-notes.json?v=1.5.6",
];

async function makeRedirectSafeResponse(response) {
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

async function fetchFreshAppShell() {
  const shellUrl = new URL("./", self.registration.scope).href;
  const response = await fetch(new Request(shellUrl, {
    cache: "no-store",
    redirect: "follow",
  }));
  if (!response.ok) throw new Error(`App shell HTTP ${response.status}`);
  return makeRedirectSafeResponse(response);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE_URLS).catch(() => {});

    // Cada Service Worker guarda o HTML correspondente à sua própria release.
    // Enquanto este worker estiver em waiting, o worker anterior continua a
    // servir o app-shell anterior e não deixa entrar bundles da versão nova.
    try {
      const appShell = await fetchFreshAppShell();
      await cache.put(APP_SHELL_KEY, appShell.clone());
    } catch {
      // Se o shell não puder ser obtido durante a instalação, a navegação faz
      // fallback à rede depois da ativação, sem bloquear a atualização.
    }

    // Não chama skipWaiting aqui. A ativação continua dependente do botão Atualizar.
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

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (NETWORK_ONLY_PATHS.has(url.pathname)) {
    event.respondWith(fetch(new Request(request, { cache: "no-store" })));
    return;
  }

  // Navegação: serve primeiro o app-shell da versão ativa. Assim o HTML/JS novo
  // só entra depois de o Service Worker novo ter sido ativado pelo utilizador.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const installedShell = await cache.match(APP_SHELL_KEY);
      if (installedShell) return makeRedirectSafeResponse(installedShell.clone());

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
        throw error;
      }
    })());
    return;
  }

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
