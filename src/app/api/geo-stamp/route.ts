import { NextRequest, NextResponse } from "next/server";
import { getMechanicIdFromRequest } from "@/lib/mechanicAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { geoFromRequest } from "@/lib/geo";

// Guarda en la fila del mecánico logueado desde dónde se conectó
// (migración 060). POST { kind: "signup" | "seen" }. Se llama con
// authedFetch desde el registro (signup) y al abrir el dashboard (seen).
// Best-effort: cualquier error devuelve ok:false y el cliente lo ignora.
export async function POST(req: NextRequest) {
  const mechanicId = await getMechanicIdFromRequest(req);
  if (!mechanicId) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const geo = geoFromRequest(req);
  if (!geo.country) return NextResponse.json({ ok: false, reason: "no_geo" });

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { last_seen_country: geo.country, last_seen_region: geo.region, last_seen_city: geo.city, last_seen_at: now };
  if (body.kind === "signup") {
    // Solo si todavía no tiene ubicación de registro (no pisar la original).
    const { data } = await admin.from("mechanics").select("signup_country").eq("id", mechanicId).maybeSingle();
    if (data && !data.signup_country) {
      updates.signup_country = geo.country; updates.signup_region = geo.region; updates.signup_city = geo.city;
    }
  }
  const { error } = await admin.from("mechanics").update(updates).eq("id", mechanicId);
  return NextResponse.json({ ok: !error });
}
