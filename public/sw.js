/* MaintlyQR service worker (etapa A, 28/10/2026).
 * - Navegaciones: red primero; si no hay red, la última copia de esa página
 *   guardada; si tampoco hay, /offline.
 * - Archivos estáticos de Next (/_next/static), íconos e imágenes: caché
 *   primero, se actualizan en segundo plano.
 * - API propia (/api/) y Supabase: nunca se cachean acá (los datos sin
 *   señal los maneja la app en IndexedDB, ver src/lib/offline/).
 * Versión en CACHE: subirla invalida todo lo guardado. */
const CACHE = "mly-v4";
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

// Chrome no deja servirle a una navegación una respuesta que vino de una
// redirección (p. ej. /dashboard -> /es/dashboard). Se guarda una copia
// "limpia" sin la marca de redirigida.
async function cleanCopy(res) {
  if (!res.redirected) return res.clone();
  const body = await res.clone().arrayBuffer();
  return new Response(body, { status: 200, statusText: "OK", headers: res.headers });
}

function isStatic(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_next/image") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/images/") || /\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Fotos de equipos y de perfil en el storage público de Supabase: caché
  // primero (se guardan la primera vez que se ven) para verlas sin señal.
  if (url.origin !== self.location.origin) {
    if (/\.supabase\.co$/.test(url.hostname) && url.pathname.includes("/storage/v1/object/public/")) {
      event.respondWith(
        caches.match(req).then((cached) => cached || fetch(req).then((res) => { if (res.ok || res.type === "opaque") caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; }))
      );
    }
    return;                                                     // resto (Supabase API, Google): directo
  }
  if (url.pathname.startsWith("/api/")) return;                // API propia: directo

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            cleanCopy(res).then((copy) => caches.open(CACHE).then((c) => {
              c.put(req, copy.clone());
              if (res.redirected) c.put(new URL(res.url).pathname, copy); // también bajo la URL final
            }));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true })) || (await caches.match(OFFLINE_URL)))
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

// Precarga ("WARM"): la app, cuando tiene señal, manda la lista de
// pantallas principales. Se baja el HTML de cada una y todos los archivos
// de código (/_next/static/...) que esa pantalla necesita, así sin señal
// no falta nada aunque el usuario nunca haya entrado ahí.
async function warm(urls) {
  const cache = await caches.open(CACHE);
  for (const u of urls) {
    try {
      const res = await fetch(u, { credentials: "same-origin" });
      if (!res.ok) continue;
      const html = await res.clone().text();
      const copy = await cleanCopy(res);
      await cache.put(u, copy.clone());
      if (res.redirected) await cache.put(new URL(res.url).pathname, copy);
      const assets = new Set();
      const re = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;
      let m; while ((m = re.exec(html))) assets.add(m[1]);
      for (const a of assets) {
        if (await cache.match(a)) continue;
        try { const r = await fetch(a); if (r.ok) await cache.put(a, r); } catch { /* sigue con el resto */ }
      }
    } catch { /* sin red: se reintenta en la próxima apertura */ }
  }
}

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "WARM" && Array.isArray(event.data.urls)) event.waitUntil(warm(event.data.urls));
});
