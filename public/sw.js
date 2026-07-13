const CACHE_VERSION = "vlingo-crm-pwa-v3";
const STATIC_CACHE = `${CACHE_VERSION}:static`;
const PAGE_CACHE = `${CACHE_VERSION}:pages`;
const RUNTIME_CACHE = `${CACHE_VERSION}:runtime`;
const STATIC_ASSETS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/branding/vlingo-logo.jpeg",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function canCache(response) {
  return response && response.ok && response.type !== "opaque";
}

async function networkFirst(request, cacheName, fallback) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (canCache(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request)) || (fallback ? await caches.match(fallback) : Response.error());
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (canCache(response)) {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function cacheUrls(urls) {
  const cache = await caches.open(PAGE_CACHE);
  await Promise.all(urls.map(async (value) => {
    try {
      const request = new Request(value, { credentials: "include" });
      const response = await fetch(request);
      if (canCache(response)) {
        await cache.put(request, response);
      }
    } catch {
      // A failed warm-up should not interrupt the active app.
    }
  }));
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === "CACHE_URLS" && Array.isArray(event.data.urls)) {
    event.waitUntil(cacheUrls(event.data.urls).then(() => {
      event.source?.postMessage({ requestId: event.data.requestId, type: "CACHE_COMPLETE" });
    }));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js" || url.pathname === "/firebase-messaging-sw.js") {
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_CACHE, "/offline.html"));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || ["font", "image", "script", "style"].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") {
    event.respondWith(networkFirst(request, PAGE_CACHE));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data && event.notification.data.href ? event.notification.data.href : "/";
  const targetUrl = new URL(href, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
      const existingClient = clients.find((client) => client.url === targetUrl || client.url.startsWith(targetUrl));
      if (existingClient) {
        return existingClient.focus();
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});
