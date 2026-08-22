const CACHE = "nepal-dist-v1";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["index.html", "manifest.json", "data/palika-names.json", "data/nepal_boundary.geojson"])));
});
self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});