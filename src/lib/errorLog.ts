// Server-only helper análogo a src/lib/auditLog.ts, pero para el panel
// técnico de errores y rendimiento (incremento 19 de Item 6, Fase 3) en vez
// del log de auditoría de acciones de admin. Escribe a platform_error_logs
// (ver migración 038).
//
// Dos formas de llegar acá:
//   1. Errores de servidor: se llama directo desde dentro de un catch/rama
//      de error de una ruta de API (ver bulk-data/route.ts y
//      analytics/route.ts para los 2 puntos ya instrumentados).
//   2. Errores de cliente: llegan indirectamente vía POST /api/log-error
//      (ver ese route.ts), que valida el body del navegador y termina
//      llamando a esta misma función con source: "client".
//
// Deliberadamente NO instrumentado en todas las ~40 rutas de API del panel
// — eso sería una superficie enorme para un solo incremento y la mayoría
// de los "error" que esas rutas devuelven hoy son errores esperados de
// validación (permisos, datos faltantes), no crashes. Se instrumentó
// puntualmente bulk-data y analytics por ser las rutas de lectura más
// centrales (alimentan Dashboard, Papelera y Analytics). Extender esto a
// más rutas queda como posible incremento futuro si hace falta.
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_STACK_LENGTH = 8000;

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export async function logServerError(params: {
  source: "client" | "server";
  severity?: "error" | "warning";
  message: string;
  stack?: string | null;
  route?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  context?: unknown;
}) {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("platform_error_logs").insert({
      source: params.source,
      severity: params.severity ?? "error",
      message: truncate(params.message || "(sin mensaje)", MAX_MESSAGE_LENGTH),
      stack: params.stack ? truncate(params.stack, MAX_STACK_LENGTH) : null,
      route: params.route ?? null,
      user_agent: params.userAgent ?? null,
      ip_address: params.ipAddress ?? null,
      context: params.context ?? null,
    });
    if (error) console.error("Failed to write platform error log:", error.message);
  } catch (err) {
    // Best-effort, igual que logAdminAction(): que falle el logueo de un
    // error nunca debe tapar o interrumpir el error original.
    console.error("Failed to write platform error log:", err);
  }
}
