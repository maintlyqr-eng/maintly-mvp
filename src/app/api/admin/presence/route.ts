import { NextRequest, NextResponse } from "next/server";
import { getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRequestIp } from "@/lib/auditLog";

// Latido de presencia del panel (migración 054). El frontend lo llama al
// entrar y cada 2 minutos mientras la pestaña está visible. Si la última
// sesión de este admin tuvo un latido hace menos de 10 min, se extiende;
// si no, se abre una nueva. Nunca falla el panel por esto.

const SESSION_GAP_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  const username = getAdminUsername(req);
  if (!username) return NextResponse.json({ ok: false }, { status: 401 });

  const admin = getSupabaseAdmin();
  const now = new Date();
  const { data: last } = await admin
    .from("admin_sessions").select("id, last_seen_at")
    .eq("admin_username", username).order("started_at", { ascending: false }).limit(1).maybeSingle();

  if (last && now.getTime() - new Date(last.last_seen_at).getTime() < SESSION_GAP_MS) {
    await admin.from("admin_sessions").update({ last_seen_at: now.toISOString() }).eq("id", last.id);
    return NextResponse.json({ ok: true, sessionId: last.id });
  }

  const { data: created } = await admin
    .from("admin_sessions")
    .insert({ admin_username: username, ip_address: getRequestIp(req), user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300) })
    .select("id").single();
  return NextResponse.json({ ok: true, sessionId: created?.id ?? null });
}
