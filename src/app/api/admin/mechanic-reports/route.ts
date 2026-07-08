import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// GET: every report a Maintler has filed against another Maintler from
// Team Chat's "Report" button. Read-only for now — there's no resolve/
// dismiss workflow yet, just visibility, so Facu can see what's been
// flagged and go look at the actual conversation in the Team Chat
// oversight view (same admin section, different tab).
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  const { data: reports, error } = await admin
    .from("mechanic_reports")
    .select("id, reporter_id, reported_id, reason, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = reports ?? [];
  const ids = Array.from(new Set(rows.flatMap((r) => [r.reporter_id, r.reported_id])));

  let infoById: Record<string, { name: string; email: string }> = {};
  if (ids.length > 0) {
    const { data: mechanics } = await admin
      .from("mechanics")
      .select("id, name, email")
      .in("id", ids);
    infoById = Object.fromEntries((mechanics ?? []).map((m) => [m.id, { name: m.name, email: m.email }]));
  }

  const enriched = rows.map((r) => ({
    ...r,
    reporter: infoById[r.reporter_id] ?? null,
    reported: infoById[r.reported_id] ?? null,
  }));

  return NextResponse.json({ reports: enriched });
}
