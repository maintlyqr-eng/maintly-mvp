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
  }, []);
  return null;
}
