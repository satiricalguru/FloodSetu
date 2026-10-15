/* FloodSetu service worker — app shell precache, network-first API, offline fallback. Hand-written (DECISIONS D10). */
const SHELL = "floodsetu-shell-v3";
const PRECACHE = ["/sos", "/rescuer", "/awareness", "/offline.html", "/icon.svg", "/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // POSTs go through the IndexedDB outbox, never cached
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(req).catch(() => new Response(JSON.stringify({ offline: true }), { status: 503, headers: { "content-type": "application/json" } })));
    return;
  }
  if (url.pathname.startsWith("/_next/static") || /\.(svg|woff2?|png|css|js)$/.test(url.pathname)) {
    // stale-while-revalidate: serve cache instantly offline, always refresh in the background
    e.respondWith(caches.open(SHELL).then((c) => c.match(req).then((hit) => { const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit); return hit || net; })));
    return;
  }
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); return res; }).catch(() => caches.match(req).then((hit) => hit || caches.match("/offline.html"))));
  }
});
self.addEventListener("sync", (e) => {
  if (e.tag === "floodsetu-outbox") e.waitUntil(self.clients.matchAll().then((cs) => cs.forEach((c) => c.postMessage({ type: "flush-outbox" }))));
});
