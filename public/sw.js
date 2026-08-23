const CACHE = "merosadak-v3";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => {
      return c.addAll([
        "/index.html",
        "/manifest.json",
        "/data/palika-names.json",
        "/data/nepal_boundary.geojson"
      ]).then(() => self.skipWaiting());
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const networkFetch = fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
