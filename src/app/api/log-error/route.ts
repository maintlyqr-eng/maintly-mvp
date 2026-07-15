import { NextRequest, NextResponse } from "next/server";
import { logServerError } from "@/lib/errorLog";
import { getRequestIp } from "@/lib/auditLog";

// POST: recibe errores de JavaScript del navegador (Dashboard + Admin) para
// el panel técnico de errores y rendimiento (incremento 19 de Item 6, Fase
// 3). Ver src/components/ErrorLogger.tsx para quién llama a esta ruta.
//
// Deliberadamente SIN gate de capability/sesión de admin — tiene que poder
// llamarla cualquier Maintler logueado en el Dashboard, no solo un admin.
// Tampoco valida sesión de Maintler: un error de JS puede pasar en
// cualquier momento, incluso durante el login mismo, antes de que haya una
// sesión establecida. El riesgo de abuso es bajo (esto solo llena una
// tabla interna que nadie más puede leer, no expone ni modifica datos de
// nadie) así que se aceptó no construir rate-limiting real para este
// incremento — ver el comentario de la migración 038 y el gap documentado
// en el backlog.
//
// Body esperado: { message, stack?, route?, severity?, context? }.
// Todo lo demás (user agent, IP) se toma de los headers del pedido, no del
// body — no hay forma de que el cliente falsifique esos dos campos acá.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!message) {
    // No hay nada útil que guardar — no es un error de esta ruta, es que
    // el cliente mandó un body vacío/malformado.
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const severity = body?.severity === "warning" ? "warning" : "error";
  const stack = typeof body?.stack === "string" ? body.stack : null;
  const route = typeof body?.route === "string" ? body.route : null;
  const context = body?.context ?? null;

  await logServerError({
    source: "client",
    severity,
    message,
    stack,
    route,
    userAgent: req.headers.get("user-agent"),
    ipAddress: getRequestIp(req),
    context,
  });

  // Fire-and-forget desde el cliente — este 200 no necesita traer nada,
  // ErrorLogger.tsx no lee la respuesta.
  return NextResponse.json({ ok: true });
}
