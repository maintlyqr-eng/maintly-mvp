import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Actividad del equipo (Facu, 21/10/2026): por admin, en un período,
// horas activas (sesiones, migración 054), cantidad de sesiones, acciones
// del log de auditoría por tipo, y última conexión. Base para liquidar
// tiempo de trabajo. ?from=ISO&to=ISO (&export=csv). Solo admin_management.

type Row = {
  username: string;
  role: string | null;
  active: boolean;
  sessions: number;
  activeMinutes: number;
  actions: number;
  actionsByType: Record<string, number>;
  lastSeen: string | null;
  days: Record<string, number>; // "YYYY-MM-DD" -> minutos
};

export async function GET(req: NextRequest) {
  if (!adminHasCapability(req, "admin_management")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const url = new URL(req.url);
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date();
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date(to.getTime() - 30 * 86400000);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return NextResponse.json({ error: "Invalid dates." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const [{ data: admins }, { data: sessions }, { data: logs }] = await Promise.all([
    admin.from("admin_users").select("username, role, active"),
    admin.from("admin_sessions").select("admin_username, started_at, last_seen_at")
      .gte("last_seen_at", from.toISOString()).lte("started_at", to.toISOString()).limit(10000),
    admin.from("admin_audit_logs").select("admin_username, action, created_at")
      .gte("created_at", from.toISOString()).lte("created_at", to.toISOString()).limit(20000),
  ]);

  const rows = new Map<string, Row>();
  function row(username: string): Row {
    const key = username.toLowerCase();
    let r = rows.get(key);
    if (!r) {
      const a = (admins ?? []).find((x) => x.username.toLowerCase() === key);
      r = { username: a?.username ?? username, role: a?.role ?? null, active: a?.active ?? true, sessions: 0, activeMinutes: 0, actions: 0, actionsByType: {}, lastSeen: null, days: {} };
      rows.set(key, r);
    }
    return r;
  }
  for (const a of admins ?? []) row(a.username);

  for (const s of sessions ?? []) {
    const r = row(s.admin_username);
    // Recorte al período pedido, por si una sesión lo cruza.
    const start = Math.max(new Date(s.started_at).getTime(), from.getTime());
    const end = Math.min(new Date(s.last_seen_at).getTime(), to.getTime());
    // Una sesión de un solo latido cuenta 2 min (el intervalo del latido).
    const minutes = Math.max(2, Math.round((end - start) / 60000));
    r.sessions += 1;
    r.activeMinutes += minutes;
    const day = new Date(start).toISOString().slice(0, 10);
    r.days[day] = (r.days[day] ?? 0) + minutes;
    if (!r.lastSeen || s.last_seen_at > r.lastSeen) r.lastSeen = s.last_seen_at;
  }
  for (const l of logs ?? []) {
    const r = row(l.admin_username);
    r.actions += 1;
    r.actionsByType[l.action] = (r.actionsByType[l.action] ?? 0) + 1;
  }

  const result = Array.from(rows.values()).sort((a, b) => b.activeMinutes - a.activeMinutes);

  if (url.searchParams.get("export") === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = ["usuario,rol,activo,sesiones,minutos_activos,horas_activas,acciones,ultima_conexion"];
    for (const r of result) {
      lines.push([r.username, r.role ?? "", r.active ? "si" : "no", r.sessions, r.activeMinutes, (r.activeMinutes / 60).toFixed(2), r.actions, r.lastSeen ?? ""].map(esc).join(","));
    }
    lines.push("", "usuario,dia,minutos");
    for (const r of result) for (const [day, m] of Object.entries(r.days).sort()) lines.push([r.username, day, m].map(esc).join(","));
    return new NextResponse(lines.join("\n"), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="maintlyqr-actividad-equipo.csv"` },
    });
  }

  return NextResponse.json({ from: from.toISOString(), to: to.toISOString(), rows: result });
}
