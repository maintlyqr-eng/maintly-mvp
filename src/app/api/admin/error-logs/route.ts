import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability, isAdminReadOnly, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

export type PlatformErrorLogRow = {
  id: string;
  created_at: string;
  source: "client" | "server";
  severity: "error" | "warning";
  message: string;
  stack: string | null;
  route: string | null;
  user_agent: string | null;
  ip_address: string | null;
  context: unknown;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
};

// GET: panel técnico de errores y rendimiento (incremento 19 de Item 6,
// Fase 3). Mismo patrón de paginación real server-side + filtros que
// /api/admin/audit-logs — esta tabla también puede crecer sin límite si la
// app tiene un bug real en producción.
//
// Gateada con "audit_logs" (hoy: solo Super Admin) — ver este mismo
// capability en /api/admin/audit-logs. Encaja semánticamente (es otro tipo
// de log de plataforma) y evita tener que tocar src/lib/adminRoles.ts para
// sumar un capability nuevo solo para esta pestaña.
//
// Query params (todos opcionales): page (default 1), pageSize (default 50,
// max 200), source, severity, resolved ("true"/"false"), from, to.
//
// También siempre devuelve unresolvedCount (total sin resolver,
// ignorando los filtros) para el resumen "de un vistazo" arriba de la
// tabla.
export async function GET(req: NextRequest) {
  if (!adminHasCapability(req, "audit_logs")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Math.trunc(Number(url.searchParams.get("page")) || 1));
  const pageSize = Math.min(200, Math.max(1, Math.trunc(Number(url.searchParams.get("pageSize")) || 50)));
  const source = url.searchParams.get("source");
  const severity = url.searchParams.get("severity");
  const resolvedParam = url.searchParams.get("resolved");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const admin = getSupabaseAdmin();
  let query = admin
    .from("platform_error_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (source) query = query.eq("source", source);
  if (severity) query = query.eq("severity", severity);
  if (resolvedParam === "true") query = query.eq("resolved", true);
  if (resolvedParam === "false") query = query.eq("resolved", false);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  const [{ data, error, count }, { count: unresolvedCount }] = await Promise.all([
    query.range(start, end),
    admin.from("platform_error_logs").select("*", { count: "exact", head: true }).eq("resolved", false),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    logs: (data ?? []) as PlatformErrorLogRow[],
    total: count ?? 0,
    unresolvedCount: unresolvedCount ?? 0,
    page,
    pageSize,
  });
}

// PATCH: marca/desmarca una entrada como resuelta. Body: { id, resolved }.
// Analytics Viewer tiene "reports" pero no "audit_logs", así que esta ruta
// (gateada audit_logs) ya excluye ese rol de solo-lectura del alcance
// típico de isAdminReadOnly() — igual se chequea explícito por consistencia
// con el resto del panel.
export async function PATCH(req: NextRequest) {
  if (!adminHasCapability(req, "audit_logs") || isAdminReadOnly(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, resolved } = body ?? {};

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing error log id." }, { status: 400 });
  }
  if (typeof resolved !== "boolean") {
    return NextResponse.json({ error: "Missing resolved flag." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const adminUsername = getAdminUsername(req);

  const updates: Record<string, unknown> = {
    resolved,
    resolved_at: resolved ? new Date().toISOString() : null,
    resolved_by: resolved ? adminUsername ?? null : null,
  };

  const { data, error } = await admin
    .from("platform_error_logs")
    .update(updates)
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Error log not found." }, { status: 404 });
  }

  if (adminUsername) {
    await logAdminAction({
      adminUsername,
      action: "error_log.resolve",
      entityType: "platform_error_log",
      entityId: id,
      newValue: { resolved },
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true });
}
