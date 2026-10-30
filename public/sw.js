/* MaintlyQR service worker (etapa A, 28/10/2026).
 * - Navegaciones: red primero; si no hay red, la última copia de esa página
 *   guardada; si tampoco hay, /offline.
 * - Archivos estáticos de Next (/_next/static), íconos e imágenes: caché
 *   primero, se actualizan en segundo plano.
 * - API propia (/api/) y Supabase: nunca se cachean acá (los datos sin
 *   señal los maneja la app en IndexedDB, ver src/lib/offline/).
 * Versión en CACHE: subirla invalida todo lo guardado. */
const CACHE = "mly-v7";
// Imágenes, íconos y fotos: caché aparte que NO se borra al cambiar de
// versión (si no, cada deploy dejaba la app sin imágenes hasta volver a verlas).
const STATIC_CACHE = "mly-static";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest"];
const PRECACHE_STATIC = ["/icons/icon-192.png", "/icons/icon-512.png", "/images/car.png", "/images/moto.png", "/images/generador.png", "/images/excavator.png", "/images/barco.png", "/images/avion.png", "/images/Maintly_crop.png", "/images/maintly-logo-full.png"];
// Páginas de arranque de la app instalada: se guardan ya al instalar el SW.
const START_PAGES = ["/dashboard?source=pwa", "/dashboard"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE).then((c) => c.addAll(PRECACHE)),
      caches.open(STATIC_CACHE).then((c) => Promise.all(PRECACHE_STATIC.map((u) => c.add(u).catch(() => {})))),
    ]).then(() => warm(START_PAGES)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== STATIC_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
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

// Sin señal y sin esa página exacta guardada: cualquier página del panel ya
// guardada sirve (son pantallas de cliente que leen la base local).
async function dashboardFallback(url) {
  const m = url.pathname.match(/^(?:\/(es|pt))?\/dashboard(?:\/.*)?$/);
  if (!m) return null;
  const cache = await caches.open(CACHE);
  const bare = url.pathname.replace(/^\/(es|pt)(?=\/)/, "");
  const candidates = [];
  for (const pre of ["", "/es", "/pt"]) candidates.push(pre + bare);
  for (const pre of ["", "/es", "/pt"]) candidates.push(pre + "/dashboard");
  for (const c of candidates) { const r = await cache.match(c, { ignoreSearch: true }); if (r) return r; }
  return null;
}

function rscKey(url) {
  const path = url.pathname.replace(/\/$/, "") || "/";
  return path + "?__rsc";
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
        caches.match(req).then((cached) => cached || fetch(req).then((res) => { if (res.ok || res.type === "opaque") caches.open(STATIC_CACHE).then((c) => c.put(req, res.clone())); return res; }))
      );
    }
    return;                                                     // resto (Supabase API, Google): directo
  }
  if (url.pathname.startsWith("/api/")) return;                // API propia: directo

  // Navegación interna de Next (pedidos RSC): red primero; sin señal, el
  // último paquete guardado para esa ruta, así cambiar de sección es
  // instantáneo y no hace falta recargar la página entera.
  if (req.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    if (req.headers.get("Next-Router-Prefetch") === "1" || req.headers.get("Next-Router-Segment-Prefetch")) return; // prefetch parcial: no sirve de respaldo
    const key = rscKey(url);
    event.respondWith(
      fetch(req)
        .then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(key, res.clone())); return res; })
        .catch(async () => (await caches.match(key)) || Response.error())
    );
    return;
  }

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
        .catch(async () => (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true })) || (await dashboardFallback(url)) || (await caches.match(OFFLINE_URL)))
    );
    return;
  }

  if (isStatic(url)) {
    const bucket = url.pathname.startsWith("/_next/static/") ? CACHE : STATIC_CACHE;
    event.respondWith(
      caches.match(req).then((cached) => {
        const fresh = fetch(req).then((res) => { if (res.ok) caches.open(bucket).then((c) => c.put(req, res.clone())); return res; }).catch(() => cached);
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
  const assets = new Set();
  await Promise.all(urls.map(async (u) => {
    try {
      const res = await fetch(u, { credentials: "same-origin" });
      if (!res.ok) return;
      const html = await res.clone().text();
      const copy = await cleanCopy(res);
      await cache.put(u, copy.clone());
      if (res.redirected) await cache.put(new URL(res.url).pathname, copy);
      const re = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;
      let m; while ((m = re.exec(html))) assets.add(m[1]);
      // Paquete de navegación (RSC) de la misma ruta, para cambiar de
      // sección sin recargar cuando no hay señal.
      try {
        const final = new URL(res.url);
        const r2 = await fetch(final.pathname, { credentials: "same-origin", headers: { RSC: "1" } });
        if (r2.ok) await cache.put(rscKey(final), r2);
      } catch { /* sin paquete: la navegación recarga la página, como antes */ }
    } catch { /* sin red: se reintenta en la próxima apertura */ }
  }));
  const missing = [];
  for (const a of assets) if (!(await cache.match(a))) missing.push(a);
  // De a 6 a la vez: rápido sin ahogar la conexión del celular.
  for (let i = 0; i < missing.length; i += 6) {
    await Promise.all(missing.slice(i, i + 6).map(async (a) => { try { const r = await fetch(a); if (r.ok) await cache.put(a, r); } catch { /* sigue */ } }));
  }
}

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "WARM" && Array.isArray(event.data.urls)) event.waitUntil(warm(event.data.urls));
});
