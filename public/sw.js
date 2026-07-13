const CACHE_VERSION = "vlingo-crm-pwa-v1";
const STATIC_CACHE = `${CACHE_VERSION}:static`;
const STATIC_ASSETS = [
  "/offline.html",
  "/branding/vlingo-logo.jpeg",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
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

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html")),
    );
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
