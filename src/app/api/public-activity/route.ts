import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Actividad reciente REAL para la portada (Facu, 30/10/2026): "solo eventos
// reales y sin mostrar datos privados". Devuelve tipo de evento, fecha y
// país (por IP, migración 060) — nunca nombres, códigos ni ids. Se cachea
// un minuto en el borde de Vercel.
export const dynamic = "force-dynamic";

type Ev = { type: "asset" | "service" | "scan" | "maintler"; at: string; country: string | null };

export async function GET() {
  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - 90 * 86400_000).toISOString();
  const [assets, services, scans, mechs] = await Promise.all([
    admin.from("assets").select("created_at, created_country").gte("created_at", since).is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
    admin.from("service_records").select("created_at, mechanics:mechanic_id(last_seen_country)").gte("created_at", since).is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
    admin.from("qr_scans").select("scanned_at, country").gte("scanned_at", since).not("asset_id", "is", null).order("scanned_at", { ascending: false }).limit(10),
    admin.from("mechanics").select("created_at, signup_country").gte("created_at", since).is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
  ]);
  const events: Ev[] = [];
  for (const r of (assets.data ?? []) as { created_at: string; created_country: string | null }[]) events.push({ type: "asset", at: r.created_at, country: r.created_country });
  for (const r of (services.data ?? []) as unknown as { created_at: string; mechanics: { last_seen_country: string | null } | { last_seen_country: string | null }[] | null }[]) {
    const m = Array.isArray(r.mechanics) ? r.mechanics[0] : r.mechanics;
    events.push({ type: "service", at: r.created_at, country: m?.last_seen_country ?? null });
  }
  for (const r of (scans.data ?? []) as { scanned_at: string; country: string | null }[]) events.push({ type: "scan", at: r.scanned_at, country: r.country });
  for (const r of (mechs.data ?? []) as { created_at: string; signup_country: string | null }[]) events.push({ type: "maintler", at: r.created_at, country: r.signup_country });
  events.sort((a, b) => b.at.localeCompare(a.at));
  return NextResponse.json({ events: events.slice(0, 8) }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
