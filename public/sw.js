// Service worker minimal : rend l'app installable et affiche la dernière
// version connue de la page si le réseau est coupé. Les appels à l'IA
// (/api/...) ne sont jamais mis en cache.
const CACHE = "jumeau-v1";
const COQUILLE = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Pages : réseau d'abord, cache en secours.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((rep) => {
          const copie = rep.clone();
          caches.open(CACHE).then((c) => c.put("/", copie));
          return rep;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // Fichiers statiques (JS, CSS, polices, icônes) : cache d'abord.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(req).then(
        (trouve) =>
          trouve ||
          fetch(req).then((rep) => {
            const copie = rep.clone();
            caches.open(CACHE).then((c) => c.put(req, copie));
            return rep;
          }),
      ),
    );
  }
});
