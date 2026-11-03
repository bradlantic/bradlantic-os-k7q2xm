// Brad OS service worker. Network first for pages so 2 hourly refreshes always show.
// Cached copy is only used when offline.
var CACHE = "brados-v1";
var CORE = ["./", "index.html", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).catch(function () {}));
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  var isPage = req.mode === "navigate" || req.destination === "document" || req.destination === "iframe" ||
    url.pathname.endsWith("/") || url.pathname.endsWith(".html") || url.pathname.endsWith(".webmanifest") || url.pathname.endsWith("sw.js");
  if (isPage) {
    e.respondWith(
      fetch(url.href, { cache: "no-store", credentials: "same-origin" }).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone(), key = url.origin + url.pathname;
          caches.open(CACHE).then(function (c) { c.put(key, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(url.origin + url.pathname).then(function (m) {
          return m || caches.match("./").then(function (h) {
            return h || new Response("Offline. Open again when you have signal.", { status: 503, headers: { "Content-Type": "text/plain" } });
          });
        });
      })
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(function (m) {
      return m || fetch(req).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    })
  );
});
