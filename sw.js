const CACHE_NAME = "calc-cache-v2";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/maskable.svg",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.mode === "navigate") {
    event.respondWith(
      caches
        .match("./index.html")
        .then((cached) => cached || fetch(request))
        .catch(() => fetch(request))
    );
    return;
  }

  const isStaticAsset = ["style", "script", "image", "font"].includes(
    request.destination
  );

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches
      .match(request)
      .then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const responseClone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, responseClone));
            return response;
          })
      )
      .catch(() => fetch(request))
  );
});
