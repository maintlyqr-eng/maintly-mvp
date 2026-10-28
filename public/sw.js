/* MaintlyQR service worker (etapa A, 28/10/2026).
 * - Navegaciones: red primero; si no hay red, la última copia de esa página
 *   guardada; si tampoco hay, /offline.
 * - Archivos estáticos de Next (/_next/static), íconos e imágenes: caché
 *   primero, se actualizan en segundo plano.
 * - API propia (/api/) y Supabase: nunca se cachean acá (los datos sin
 *   señal los maneja la app en IndexedDB, ver src/lib/offline/).
 * Versión en CACHE: subirla invalida todo lo guardado. */
const CACHE = "mly-v1";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

function isStatic(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/images/") || /\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // Supabase, Google, etc.: directo
  if (url.pathname.startsWith("/api/")) return;                // API propia: directo

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(OFFLINE_URL)))
    );
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fresh = fetch(req).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; }).catch(() => cached);
        return cached || fresh;
      })
    );
  }
});

// Mensaje desde la app para activar una versión nueva sin esperar.
self.addEventListener("message", (event) => { if (event.data === "SKIP_WAITING") self.skipWaiting(); });
