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

// Facu (26 jul 2026, tras el crash de React error #310 que se llevó abajo
// tanto el Dashboard como el propio Admin): "en este caso tambien se me
// habia caido el admin asi q no podria ver q tuve un error" — hasta acá,
// la única forma de enterarse de un error era abriendo la sección
// "Errores" del panel admin, que es exactamente lo que no se puede abrir
// si el admin también está caído. Esto manda un mail (vía Resend, mismo
// proveedor que send-welcome-email/route.ts) apenas se guarda un error de
// severidad "error", así que llega igual aunque nada de la app renderice.
//
// No hace falta configuración nueva de infraestructura: reusa
// RESEND_API_KEY (si ya está seteada para el mail de bienvenida, esto
// funciona solo) y agrega una env var nueva, ERROR_ALERT_EMAIL, con la
// dirección que debe recibir estos avisos. Sin esa env var, esto no hace
// nada (mismo patrón "no-op si falta configuración" que el resto de los
// mails de este proyecto) — el error se sigue guardando en la tabla igual.
const ALERT_DEDUP_WINDOW_MINUTES = 15;

async function shouldSendAlertEmail(
  admin: ReturnType<typeof getSupabaseAdmin>,
  message: string
): Promise<boolean> {
  // Evita inundar la bandeja de entrada si el mismo error se repite en
  // loop (un crash que se dispara en cada render, por ejemplo) — solo
  // manda el primer mail de una tanda, no uno por cada fila que se
  // inserta. Chequea ANTES de insertar la fila nueva, así esta misma no
  // se cuenta a sí misma.
  const since = new Date(Date.now() - ALERT_DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count } = await admin
    .from("platform_error_logs")
    .select("id", { count: "exact", head: true })
    .eq("severity", "error")
    .eq("message", message)
    .gte("created_at", since);
  return (count ?? 0) === 0;
}

async function sendErrorAlertEmail(params: {
  message: string;
  stack?: string | null;
  route?: string | null;
  source: "client" | "server";
}) {
  const apiKey = process.env.RESEND_API_KEY;
  // Facu (26 jul 2026): "puedo poner dos mails?" — ERROR_ALERT_EMAIL
  // admite una lista separada por comas (ej. "facu@x.com,socio@x.com"),
  // no solo una dirección.
  const to = (process.env.ERROR_ALERT_EMAIL || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (!apiKey || to.length === 0) return;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM_EMAIL || "MaintlyQR <onboarding@resend.dev>";
    const where = params.route ? ` en ${params.route}` : "";

    await resend.emails.send({
      from,
      to,
      subject: `⚠️ Error en MaintlyQR${where}`,
      text: [
        `Se registró un error (${params.source}) en MaintlyQR${where}.`,
        "",
        `Mensaje: ${params.message}`,
        params.stack ? `\nStack:\n${params.stack}` : "",
        "",
        "Este aviso se manda apenas se guarda el error, incluso si el panel de Errores del admin no carga — así te enterás igual.",
      ].filter(Boolean).join("\n"),
    });
  } catch (err) {
    // Best-effort — que falle el mail nunca debe tapar el error original
    // ni el guardado en la tabla, que ya pasó antes de llegar acá.
    console.error("Failed to send error alert email:", err);
  }
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
    const severity = params.severity ?? "error";
    const message = truncate(params.message || "(sin mensaje)", MAX_MESSAGE_LENGTH);

    const shouldAlert = severity === "error" && (await shouldSendAlertEmail(admin, message));

    const { error } = await admin.from("platform_error_logs").insert({
      source: params.source,
      severity,
      message,
      stack: params.stack ? truncate(params.stack, MAX_STACK_LENGTH) : null,
      route: params.route ?? null,
      user_agent: params.userAgent ?? null,
      ip_address: params.ipAddress ?? null,
      context: params.context ?? null,
    });
    if (error) console.error("Failed to write platform error log:", error.message);

    if (shouldAlert) {
      // Fire-and-forget — no bloquea la respuesta de log-error ni de la
      // ruta que llamó a esto por un mail que puede tardar.
      sendErrorAlertEmail({ message, stack: params.stack, route: params.route, source: params.source });
    }
  } catch (err) {
    // Best-effort, igual que logAdminAction(): que falle el logueo de un
    // error nunca debe tapar o interrumpir el error original.
    console.error("Failed to write platform error log:", err);
  }
}
