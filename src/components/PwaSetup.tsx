"use client";

import { useEffect } from "react";

// Registra el service worker (public/sw.js) una vez que la página cargó.
// Si hay una versión nueva esperando, la activa y recarga una sola vez
// para que la app instalada no se quede con código viejo.
export default function PwaSetup() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // en desarrollo molesta más de lo que ayuda
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return; reloaded = true;
      window.location.reload();
    });
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) sw.postMessage("SKIP_WAITING");
        });
      });
    }).catch(() => { /* sin SW: la app sigue andando como web normal */ });

    // Precarga de pantallas para sin señal (ver warm() en sw.js). Unos
    // segundos después de abrir, para no competir con la carga de la
    // página. Se repite en cada apertura con señal: así siempre está el
    // código de la versión actual.
    const warm = () => {
      if (!navigator.onLine) return;
      const loc = window.location.pathname.match(/^\/(es|pt)(\/|$)/)?.[1];
      const pre = loc ? `/${loc}` : "";
      const base = ["/dashboard", "/dashboard/assets", "/dashboard/services", "/dashboard/scheduled", "/dashboard/qr-codes", "/dashboard/calendar", "/dashboard/settings", "/dashboard/sync", "/login"];
      // Sin prefijo (la dirección de arranque de la app) y con el idioma actual.
      // Las de arranque primero: son las que se necesitan sí o sí sin señal.
      const pages = pre ? ["/dashboard?source=pwa", "/dashboard", ...base.map((p) => pre + p)] : ["/dashboard?source=pwa", ...base];
      navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: "WARM", urls: [...pages, "/offline"] }));
      // Módulos que se cargan bajo demanda (QR del activo, lector de QR):
      // pedirlos ahora para que el service worker los deje guardados.
      void import("qr-code-styling").catch(() => {});
      void import("jsqr").catch(() => {});
    };
    const timer = window.setTimeout(warm, 3000);
    window.addEventListener("online", warm);
    return () => { window.clearTimeout(timer); window.removeEventListener("online", warm); };
  }, []);
  return null;
}
