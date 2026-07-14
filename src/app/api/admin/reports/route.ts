import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";
import { toCsv, csvResponse } from "@/lib/csv";

const STATUSES = ["new", "in_review", "resolved", "closed"] as const;

export type ContentReportRow = {
  id: string;
  created_at: string;
  updated_at: string;
  report_type: string;
  status: string;
  asset_id: string | null;
  service_record_id: string | null;
  mechanic_id: string | null;
  qr_code: string | null;
  reporter_name: string | null;
  reporter_contact: string | null;
  message: string;
  internal_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  asset: { brand: string | null; model: string | null; nickname: string | null } | null;
  mechanic: { name: string; email: string } | null;
};

// GET: paginated, filterable list of public content reports (item 6 del
// pedido de Facu — "Reportes y moderación"), most recent first. Real
// server-side pagination, same reasoning and shape as /api/admin/audit-logs:
// this table is fed by an anonymous public form (see migration 032), so it
// can grow without bound and shouldn't use the "fetch up to N and slice
// client-side" pattern used elsewhere in this admin panel.
//
// Query params (all optional): page (default 1), pageSize (default 25, max
// 200), status, reportType, from (ISO date), to (ISO date), export ("csv").
//
// Also always returns `newCount` — the total count of status="new" reports
// regardless of the filters above — so the sidebar badge can show how many
// need a first look without a second request.
//
// export=csv (Fase 2 / punto 5 del pedido: "Exportación de reportes"): mismo
// criterio que /api/admin/audit-logs — ignora la paginación y devuelve hasta
// EXPORT_ROW_CAP filas que matcheen los filtros, como CSV. A diferencia del
// JSON normal, el CSV NO enriquece con el resumen de asset/mecánico (esa
// segunda consulta batched más abajo) — trae los IDs crudos (asset_id,
// service_record_id, mechanic_id, qr_code) para mantener el export simple;
// un admin que necesite el detalle legible puede seguir usando la vista
// paginada de la sección, que sí muestra el resumen enriquecido.
const EXPORT_ROW_CAP = 5000;

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Math.trunc(Number(url.searchParams.get("page")) || 1));
  const pageSize = Math.min(200, Math.max(1, Math.trunc(Number(url.searchParams.get("pageSize")) || 25)));
  const status = url.searchParams.get("status");
  const reportType = url.searchParams.get("reportType");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const wantsCsv = url.searchParams.get("export") === "csv";

  const admin = getSupabaseAdmin();

  let query = admin
    .from("content_reports")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (reportType) query = query.eq("report_type", reportType);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  if (wantsCsv) {
    const { data, error } = await query.limit(EXPORT_ROW_CAP);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (data ?? []) as ContentReportRow[];
    const csv = toCsv(
      ["created_at", "report_type", "status", "message", "reporter_name", "reporter_contact", "asset_id", "service_record_id", "mechanic_id", "qr_code", "internal_notes", "resolved_at", "resolved_by"],
      rows.map((r) => [
        r.created_at, r.report_type, r.status, r.message, r.reporter_name ?? "", r.reporter_contact ?? "",
        r.asset_id ?? "", r.service_record_id ?? "", r.mechanic_id ?? "", r.qr_code ?? "",
        r.internal_notes ?? "", r.resolved_at ?? "", r.resolved_by ?? "",
      ])
    );
    return csvResponse(`maintlyqr-reports-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  const [{ data, error, count }, { count: newCount }] = await Promise.all([
    query.range(start, end),
    admin.from("content_reports").select("*", { count: "exact", head: true }).eq("status", "new"),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];

  // Enrich with just enough asset/mechanic info to show a readable "related
  // to" column, same approach as /api/admin/mechanic-reports and
  // /api/admin/trash — a second small batched lookup rather than trying an
  // embedded-resource join (the FK here is nullable and on-delete-set-null,
  // so a plain !inner join could silently drop rows in ways that are
  // trickier to reason about than two flat queries).
  const assetIds = Array.from(new Set(rows.map((r) => r.asset_id).filter(Boolean))) as string[];
  const mechanicIds = Array.from(new Set(rows.map((r) => r.mechanic_id).filter(Boolean))) as string[];

  const [{ data: assets }, { data: mechanics }] = await Promise.all([
    assetIds.length > 0
      ? admin.from("assets").select("id, brand, model, nickname").in("id", assetIds)
      : Promise.resolve({ data: [] as { id: string; brand: string | null; model: string | null; nickname: string | null }[] }),
    mechanicIds.length > 0
      ? admin.from("mechanics").select("id, name, email").in("id", mechanicIds)
      : Promise.resolve({ data: [] as { id: string; name: string; email: string }[] }),
  ]);

  const assetById = Object.fromEntries((assets ?? []).map((a) => [a.id, a]));
  const mechanicById = Object.fromEntries((mechanics ?? []).map((m) => [m.id, m]));

  const enriched: ContentReportRow[] = rows.map((r) => ({
    ...r,
    asset: r.asset_id ? assetById[r.asset_id] ?? null : null,
    mechanic: r.mechanic_id ? mechanicById[r.mechanic_id] ?? null : null,
  }));

  return NextResponse.json({
    reports: enriched,
    total: count ?? 0,
    newCount: newCount ?? 0,
    page,
    pageSize,
  });
}

// PATCH: update a report's status and/or internal notes. Body: { id,
// status?, internal_notes? }
//
// Setting status to "resolved" stamps resolved_at/resolved_by; moving AWAY
// from "resolved" (e.g. reopening to "in_review") clears both, so those
// fields always reflect the most recent resolution rather than a stale one
// from a prior status change.
export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, status, internal_notes } = body ?? {};

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing report id." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  const adminUsername = getAdminUsername(req);

  if (typeof status === "string") {
    if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    updates.status = status;
    if (status === "resolved") {
      updates.resolved_at = new Date().toISOString();
      updates.resolved_by = adminUsername ?? null;
    } else {
      updates.resolved_at = null;
      updates.resolved_by = null;
    }
  }
  if (typeof internal_notes === "string" || internal_notes === null) {
    updates.internal_notes = internal_notes;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: beforeRow } = await admin
    .from("content_reports")
    .select("status, internal_notes")
    .eq("id", id)
    .single();

  const { data, error } = await admin
    .from("content_reports")
    .update(updates)
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  if (adminUsername) {
    await logAdminAction({
      adminUsername,
      action: "report.update_status",
      entityType: "content_report",
      entityId: id,
      oldValue: beforeRow ?? null,
      newValue: updates,
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true });
}
