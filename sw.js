const CACHE_VERSION = "nuance-v6.2-20260906";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k)))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  // API calls must always go to the network.
  if (url.pathname.startsWith("/api/")) return;

  // For page navigation / index.html, always prefer the NETWORK.
  // This is the key Safari stale-version fix.
  if (req.mode === "navigate" || url.pathname === "/" || url.pathname === "/index.html") {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then(response => response)
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Manifest should also be fresh.
  if (url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      fetch(req, { cache: "no-store" }).catch(() => caches.match(req))
    );
    return;
  }

  // Static icons/assets: cache-first is fine.
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
