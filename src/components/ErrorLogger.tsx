"use client";

import { useEffect } from "react";

// Incremento 19 de Item 6 (Fase 3, "Panel técnico de errores y
// rendimiento" — elegido por Facu de los 3 ítems que quedaban en esa
// fase). Componente invisible, sin UI propia: se monta una vez por página
// y escucha errores de JavaScript sin capturar del navegador, más una
// señal básica de rendimiento (tiempo de carga de la página), y los manda
// a POST /api/log-error para que terminen en el panel "Errores" del Admin.
//
// Montado en dos lugares (ver DashboardHeaderIntl.tsx y admin/page.tsx) —
// mismo criterio de "un solo componente compartido" que
// PlatformStatusBanner.tsx del incremento 17, en vez de repetir esta
// lógica en cada página.
//
// Deliberadamente simple: sin librería de error tracking (Sentry, etc. —
// eso sería la "integración con herramientas externas" de otro ítem de la
// Fase 3, no este), sin buffer/retry si falla el POST, sin capturar
// errores de React en sí (eso requeriría un Error Boundary por árbol de
// componentes, una superficie mucho más grande) — solo los dos hooks
// globales que cubren la gran mayoría de crashes reales en producción:
// una excepción sin catch y una promesa rechazada sin .catch().
const SLOW_LOAD_THRESHOLD_MS = 4000;
const MAX_REPORTS_PER_PAGE_LOAD = 20;

export default function ErrorLogger() {
  useEffect(() => {
    let reportCount = 0;
    const seen = new Set<string>();

    function report(payload: { message: string; stack?: string; severity?: "error" | "warning"; context?: unknown }) {
      // Dedup + tope por carga de página — evita que un error que se
      // repite en loop (ej. un render que falla una y otra vez) inunde la
      // tabla o mande cientos de pedidos de red.
      const fingerprint = `${payload.severity ?? "error"}:${payload.message}:${payload.stack?.slice(0, 200) ?? ""}`;
      if (seen.has(fingerprint) || reportCount >= MAX_REPORTS_PER_PAGE_LOAD) return;
      seen.add(fingerprint);
      reportCount++;

      fetch("/api/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: payload.message,
          stack: payload.stack,
          severity: payload.severity,
          route: window.location.pathname,
          context: payload.context,
        }),
      }).catch(() => {
        // Fire-and-forget de verdad: si falla la red, no hay nada más que
        // hacer — no se reintenta ni se guarda para después.
      });
    }

    function handleError(event: ErrorEvent) {
      report({
        message: event.message || "Unknown error",
        stack: event.error?.stack,
      });
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      report({
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    // Señal de rendimiento: si la carga de esta página tardó más de lo
    // esperado, se registra como "warning" (no es un error) — la mitad
    // "rendimiento" del panel, sin necesitar ninguna instrumentación
    // nueva del lado del servidor.
    function checkLoadTime() {
      const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
      if (nav && nav.loadEventEnd > SLOW_LOAD_THRESHOLD_MS) {
        report({
          message: `Carga de página lenta: ${Math.round(nav.loadEventEnd)}ms`,
          severity: "warning",
          context: { durationMs: Math.round(nav.loadEventEnd) },
        });
      }
    }
    if (document.readyState === "complete") {
      checkLoadTime();
    } else {
      window.addEventListener("load", checkLoadTime, { once: true });
    }

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("load", checkLoadTime);
    };
  }, []);

  return null;
}
