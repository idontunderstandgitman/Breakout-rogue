// The version of the cache.
const                                                                                                  VERSION = '29869431'

// The name of the cache
const CACHE_NAME = `breakout-71-${VERSION}`;

// The static resources that the app needs to function.
const APP_STATIC_RESOURCES = ["/"];

// On install, cache the static resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_STATIC_RESOURCES);
    })(),
  );
});

// delete old caches on activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        }),
      );
      await clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (
    event.request.mode === "navigate" &&
    event.request.url.endsWith("/index.html?isPWA=true")
  ) {
    event.respondWith(caches.match("/"));
    return;
  }
});
