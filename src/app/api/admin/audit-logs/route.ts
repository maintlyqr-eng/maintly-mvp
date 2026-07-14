import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { AdminAuditAction, AdminAuditEntityType } from "@/lib/auditLog";
import { toCsv, csvResponse } from "@/lib/csv";

export type AdminAuditLogRow = {
  id: string;
  created_at: string;
  admin_username: string;
  action: AdminAuditAction;
  entity_type: AdminAuditEntityType | null;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  ip_address: string | null;
};

// GET: paginated, filterable list of admin audit log entries, most recent
// first. Real server-side pagination (range()), not the "fetch up to N and
// slice client-side" pattern used elsewhere in this admin panel — this
// table is meant to grow indefinitely, so that pattern wouldn't hold up.
//
// Query params (all optional): page (default 1), pageSize (default 50, max
// 200), action, entityType, entityId, adminUsername, from (ISO date), to
// (ISO date), export ("csv" — see below).
//
// entityId is an exact match on entity_id — feeds the "Ver historial" links
// from Accounts/Assets (item 2/3 del pedido: "ver historial de acciones"),
// so an admin can jump straight to every audit entry for one specific
// Maintler or asset instead of scrolling the whole unfiltered log.
//
// export=csv (Fase 2 / punto 5 del pedido: "Exportación de reportes", y item
// 15: "tablas con ... exportación"): ignora page/pageSize y devuelve, en su
// lugar, hasta EXPORT_ROW_CAP filas que matcheen los mismos filtros, como
// texto CSV para descarga directa — no se puede exportar solo la página
// cargada en el cliente porque esta sección usa paginación real server-side
// (ver el comentario de arriba), así que el CSV se arma acá con la misma
// query filtrada, sin range().
const EXPORT_ROW_CAP = 5000;

export async function GET(req: NextRequest) {
  // Incremento 11: "audit_logs" (hoy: solo Super Admin) — expone acciones de TODOS los admins.
  if (!adminHasCapability(req, "audit_logs")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Math.trunc(Number(url.searchParams.get("page")) || 1));
  const pageSize = Math.min(200, Math.max(1, Math.trunc(Number(url.searchParams.get("pageSize")) || 50)));
  const action = url.searchParams.get("action");
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  const adminUsername = url.searchParams.get("adminUsername");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const wantsCsv = url.searchParams.get("export") === "csv";

  const admin = getSupabaseAdmin();
  let query = admin
    .from("admin_audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (action) query = query.eq("action", action);
  if (entityType) query = query.eq("entity_type", entityType);
  if (entityId) query = query.eq("entity_id", entityId);
  if (adminUsername) query = query.eq("admin_username", adminUsername);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  if (wantsCsv) {
    const { data, error } = await query.limit(EXPORT_ROW_CAP);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (data ?? []) as AdminAuditLogRow[];
    const csv = toCsv(
      ["created_at", "admin_username", "action", "entity_type", "entity_id", "reason", "ip_address", "old_value", "new_value"],
      rows.map((r) => [
        r.created_at, r.admin_username, r.action, r.entity_type ?? "", r.entity_id ?? "", r.reason ?? "", r.ip_address ?? "",
        r.old_value ? JSON.stringify(r.old_value) : "", r.new_value ? JSON.stringify(r.new_value) : "",
      ])
    );
    return csvResponse(`maintlyqr-audit-log-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  const { data, error, count } = await query.range(start, end);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    logs: (data ?? []) as AdminAuditLogRow[],
    total: count ?? 0,
    page,
    pageSize,
  });
}
