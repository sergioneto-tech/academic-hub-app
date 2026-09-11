const APP_VERSION = "1.5.7";
const SW_VERSION = "1.5.7-controlled-update-4-repair";
const CACHE = `academic-hub-${SW_VERSION}`;
const APP_SHELL_KEY = new URL("./__academic_hub_app_shell__", self.location.href).href;
const NOTIFICATION_ICON = "./academic-hub-notification-gold.svg";
const NOTIFICATION_BADGE = "./academic-hub-notification-badge.png";
const APP_SHELL_VERSION_MARKER = `<meta name="academic-hub-version" content="${APP_VERSION}"`;
const APP_SHELL_FETCH_ATTEMPTS = 4;
const APP_SHELL_RETRY_MS = 650;
const REPAIR_BUILD_AUTO_ACTIVATE = true;

const PRECACHE_URLS = [
  "./manifest.webmanifest?v=11",
  "./academic-hub-icon-v10-192.png",
  "./academic-hub-icon-v10-512.png",
  NOTIFICATION_ICON,
  NOTIFICATION_BADGE,
  "./release-notes.json?v=1.5.7",
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function responseFromText(response, text) {
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  headers.delete("location");

  return new Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function makeRedirectSafeResponse(response) {
  if (!response.redirected) return response;
  return responseFromText(response, await response.text());
}

async function fetchVerifiedAppShell() {
  const shellUrl = new URL("./", self.registration.scope);
  let lastError = new Error("App shell não verificado");

  for (let attempt = 1; attempt <= APP_SHELL_FETCH_ATTEMPTS; attempt += 1) {
    try {
      shellUrl.searchParams.set("ah_shell", `${APP_VERSION}-${Date.now()}-${attempt}`);
      const response = await fetch(new Request(shellUrl.href, {
        cache: "no-store",
        redirect: "follow",
      }));
      if (!response.ok) throw new Error(`App shell HTTP ${response.status}`);

      const text = await response.text();
      if (!text.includes(APP_SHELL_VERSION_MARKER)) {
        throw new Error(`App shell não corresponde à versão ${APP_VERSION}`);
      }

      return responseFromText(response, text);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < APP_SHELL_FETCH_ATTEMPTS) await delay(APP_SHELL_RETRY_MS);
    }
  }

  throw lastError;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE_URLS).catch(() => {});

    // Uma release só pode ficar pronta se o HTML obtido corresponder à mesma
    // versão do Service Worker. Isto evita o estado Android em que um worker
    // novo ficava associado ao app-shell da release anterior.
    const appShell = await fetchVerifiedAppShell();
    await cache.put(APP_SHELL_KEY, appShell.clone());

    // Este build é uma reparação da própria 1.5.7, sem mudança funcional de
    // versão. Ativa-se sozinho para substituir caches 1.5.7 inconsistentes.
    // Nas releases seguintes esta flag deve voltar a false/removida.
    if (REPAIR_BUILD_AUTO_ACTIVATE) await self.skipWaiting();
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
  if (event?.data?.type === "GET_VERSION" && event.ports?.[0]) {
    event.ports[0].postMessage({ appVersion: APP_VERSION, swVersion: SW_VERSION });
  }
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

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const installedShell = await cache.match(APP_SHELL_KEY);
      if (installedShell) return installedShell.clone();

      // Não grava HTML não verificado em caso de perda inesperada do cache.
      // Serve a rede apenas como fallback temporário; um novo ciclo de registo
      // voltará a construir um app-shell validado.
      const networkResponse = await fetch(new Request(request, {
        cache: "no-store",
        redirect: "follow",
      }));
      if (!networkResponse.ok) return networkResponse;
      return makeRedirectSafeResponse(networkResponse);
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
  const isRelease = suppliedData.kind === "release";
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
    actions: isRelease ? [{ action: "update", title: "Atualizar agora" }] : undefined,
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
