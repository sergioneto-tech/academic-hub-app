const APP_VERSION = "1.6.7";
const SW_VERSION = "1.6.7-transparency-1";
const CACHE = `academic-hub-${SW_VERSION}`;
const APP_SHELL_KEY = new URL("./__academic_hub_app_shell__", self.location.href).href;
const NOTIFICATION_ICON = "./academic-hub-notification-gold.svg";
const NOTIFICATION_BADGE = "./academic-hub-notification-badge.png";
const APP_SHELL_VERSION_MARKER = `<meta name="academic-hub-version" content="${APP_VERSION}"`;
const APP_SHELL_FETCH_ATTEMPTS = 4;
const APP_SHELL_RETRY_MS = 650;
const AUTO_ACTIVATE = false;

const PRECACHE_URLS = [
  "./manifest.webmanifest?v=11",
  "./academic-hub-icon-v10-192.png",
  "./academic-hub-icon-v10-512.png",
  NOTIFICATION_ICON,
  NOTIFICATION_BADGE,
  "./release-notes.json?v=1.6.7",
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function responseFromText(response, text) {
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(text, { status: response.status, statusText: response.statusText, headers });
}

async function fetchVerifiedAppShell(request) {
  let lastError = null;
  for (let attempt = 1; attempt <= APP_SHELL_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(request, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.clone().text();
      if (text.includes(APP_SHELL_VERSION_MARKER)) return responseFromText(response, text);
      lastError = new Error(`app-shell ainda não corresponde a ${APP_VERSION}`);
    } catch (error) { lastError = error; }
    if (attempt < APP_SHELL_FETCH_ATTEMPTS) await delay(APP_SHELL_RETRY_MS * attempt);
  }
  throw lastError ?? new Error("Não foi possível validar o app-shell");
}

function extractAppShellAssetUrls(html) {
  const urls = new Set();
  const pattern = /(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    try {
      const url = new URL(match[1], self.registration.scope);
      if (url.origin === self.location.origin) urls.add(url.href);
    } catch {
      // Ignora referências inválidas no HTML; o app-shell já foi validado acima.
    }
  }

  return [...urls];
}

async function cacheInstalledAppAssets(cache, appShell) {
  let html = "";
  try {
    html = await appShell.clone().text();
  } catch {
    return;
  }

  const assetUrls = extractAppShellAssetUrls(html);
  await Promise.all(assetUrls.map(async (assetUrl) => {
    try {
      const request = new Request(assetUrl, { cache: "no-store" });
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
    } catch {
      // Um asset complementar não deve bloquear toda a instalação.
    }
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const shellUrl = new URL("./", self.location.href).href;
    const shellResponse = await fetchVerifiedAppShell(new Request(shellUrl));
    await cache.put(APP_SHELL_KEY, shellResponse.clone());
    await cacheInstalledAppAssets(cache, shellResponse);
    const staticUrls = PRECACHE_URLS.filter((url) => url !== "./");
    if (staticUrls.length) await cache.addAll(staticUrls);
    if (AUTO_ACTIVATE) await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("academic-hub-") && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") { self.skipWaiting(); return; }
  if (event.data?.type === "GET_VERSION") {
    const reply = { appVersion: APP_VERSION, swVersion: SW_VERSION };
    if (event.ports?.[0]) event.ports[0].postMessage(reply);
    else if (event.source && "postMessage" in event.source) event.source.postMessage({ type: "VERSION", ...reply });
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try { return await fetch(req, { cache: "no-store" }); }
      catch {
        const cache = await caches.open(CACHE);
        return (await cache.match(APP_SHELL_KEY)) || (await cache.match("./")) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok) { const cache = await caches.open(CACHE); cache.put(req, res.clone()); }
      return res;
    } catch { return cached || Response.error(); }
  })());
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { body: event.data?.text?.() || "" }; }
  const title = data.title || "Academic Hub";
  const options = {
    body: data.body || "Tens uma nova notificação no Academic Hub.",
    icon: data.icon || NOTIFICATION_ICON,
    badge: data.badge || NOTIFICATION_BADGE,
    tag: data.tag || "academic-hub",
    renotify: Boolean(data.renotify),
    data: { url: data.url || data?.data?.url || "./", ...(data.data || {}) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification?.data?.url || "./", self.location.href).href;
  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

    for (const client of clientList) {
      if ("postMessage" in client) {
        client.postMessage({ type: "ACADEMIC_HUB_NOTIFICATION_NAVIGATE", url: targetUrl });
      }
      if ("focus" in client) return client.focus();
    }

    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    return undefined;
  })());
});
