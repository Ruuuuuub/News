// Service worker : l'appli s'ouvre même hors connexion (dernières actus en cache).
const CACHE = "matinale-v1";
const SHELL = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest", "assets/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Réseau d'abord (pour avoir les actus fraîches), cache en secours.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const key = url.pathname.endsWith("news.json") ? new Request(url.origin + url.pathname) : e.request;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); return res; })
      .catch(() => caches.match(key).then((r) => r || caches.match("index.html")))
  );
});
