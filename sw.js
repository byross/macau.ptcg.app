
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open("ptcg-cache").then(cache => {
      return cache.addAll(["/", "/index.html", "/style.css", "/main.js", "/manifest.json"]);
    })
  );
});
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});