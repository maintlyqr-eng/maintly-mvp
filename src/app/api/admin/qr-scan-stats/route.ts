import { NextRequest, NextResponse } from "next/server";
import { adminHasAnyCapability } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Facu (26 jul 2026, revisión de seguridad): antes el Dashboard del admin
// leía qr_scans directo con el cliente de anon key, bajo el supuesto de que
// la RLS de esa tabla ya era "angosta" (ver el comentario viejo, ahora
// borrado, en admin/page.tsx). No lo era — la policy vigente (migración 006)
// era `for select using (true)`, pública sin login. Como la sesión de admin
// es un token propio, firmado, totalmente aparte de la autenticación de
// Supabase (ver src/lib/adminAuth.ts — Facu confirmó que entra a /admin con
// usuario/contraseña distintos, no con su cuenta de mecánico), el navegador
// del admin nunca tiene una sesión "authenticated" real de Supabase. Eso
// significa que angostar qr_scans a solo lectores "authenticated" (migración
// 044) le habría roto el feed de este panel.
//
// La solución, mismo patrón que /api/admin/bulk-data (ver el comentario de
// ese archivo): mover esta lectura al lado del servidor, con la clave de
// service-role, que ignora RLS por completo. Así qr_scans puede angostarse
// de verdad sin dejar sin datos al Dashboard del admin.
//
// GET /api/admin/qr-scan-stats            -> { scansToday, scanWeekRows, recentScans }
// GET /api/admin/qr-scan-stats?only=recent -> { recentScans }  (usado por el
//   polling de "Actividad reciente" cada 30s — no hace falta recalcular
//   scansToday/scanWeekRows en cada tick).
const RECENT_SCANS_LIMIT = 15;

export async function GET(req: NextRequest) {
  if (!adminHasAnyCapability(req, ["accounts", "assets"])) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const onlyRecent = req.nextUrl.searchParams.get("only") === "recent";

  if (onlyRecent) {
    const { data: recentScans, error } = await admin
      .from("qr_scans")
      .select("code, asset_id, scanned_at")
      .order("scanned_at", { ascending: false })
      .limit(RECENT_SCANS_LIMIT);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ recentScans: recentScans ?? [] });
  }

  const [todayRes, weekRes, recentRes] = await Promise.all([
    admin.from("qr_scans").select("*", { count: "exact", head: true })
      .gte("scanned_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    admin.from("qr_scans").select("scanned_at")
      .gte("scanned_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    admin.from("qr_scans").select("code, asset_id, scanned_at")
      .order("scanned_at", { ascending: false })
      .limit(RECENT_SCANS_LIMIT),
  ]);

  if (todayRes.error || weekRes.error || recentRes.error) {
    return NextResponse.json(
      { error: todayRes.error?.message || weekRes.error?.message || recentRes.error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    scansToday: todayRes.count ?? 0,
    scanWeekRows: weekRes.data ?? [],
    recentScans: recentRes.data ?? [],
  });
}
