import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

// Mensajes internos entre admins (migración 053).
//
// GET  ?mine=1        → mensajes dirigidos al admin logueado (aviso arriba
//                       del panel). Cualquier admin.
// GET  ?toAdminId=…   → mensajes enviados a ese admin (vista del Super Admin
//                       en Administradores). admin_management.
// POST { toAdminId, body } → dejar un mensaje. admin_management.
// PATCH { id, read: true }  → marcar leído. Solo el destinatario.

async function myAdminRow(req: NextRequest) {
  const username = getAdminUsername(req);
  if (!username) return null;
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("admin_users").select("id, username").eq("active", true).ilike("username", username).maybeSingle();
  return data ?? null;
}

export async function GET(req: NextRequest) {
  const username = getAdminUsername(req);
  if (!username) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  const url = new URL(req.url);
  const admin = getSupabaseAdmin();

  if (url.searchParams.get("mine") === "1") {
    const me = await myAdminRow(req);
    // El login legado por env vars no tiene fila en admin_users: no recibe notas.
    if (!me) return NextResponse.json({ notes: [] });
    const { data, error } = await admin
      .from("admin_notes").select("id, created_at, from_username, body, read_at")
      .eq("to_admin_id", me.id).order("created_at", { ascending: false }).limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notes: data ?? [] });
  }

  const toAdminId = url.searchParams.get("toAdminId");
  if (!toAdminId) return NextResponse.json({ error: "Missing toAdminId." }, { status: 400 });
  if (!adminHasCapability(req, "admin_management")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const { data, error } = await admin
    .from("admin_notes").select("id, created_at, from_username, body, read_at")
    .eq("to_admin_id", toAdminId).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!adminHasCapability(req, "admin_management")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const from = getAdminUsername(req);
  const payload = await req.json().catch(() => ({}));
  const toAdminId = typeof payload.toAdminId === "string" ? payload.toAdminId : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!from || !toAdminId) return NextResponse.json({ error: "Missing toAdminId." }, { status: 400 });
  if (!body || body.length > 2000) return NextResponse.json({ error: "Message must be 1-2000 characters." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("admin_notes").insert({ from_username: from, to_admin_id: toAdminId, body })
    .select("id, created_at, from_username, body, read_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAdminAction({
    adminUsername: from, action: "admin_note.create", entityType: "admin_user", entityId: toAdminId,
    newValue: { length: body.length }, ipAddress: getRequestIp(req),
  });
  return NextResponse.json({ ok: true, note: data });
}

export async function PATCH(req: NextRequest) {
  const me = await myAdminRow(req);
  if (!me) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  const payload = await req.json().catch(() => ({}));
  const id = typeof payload.id === "string" ? payload.id : "";
  if (!id || payload.read !== true) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("admin_notes").update({ read_at: new Date().toISOString() })
    .eq("id", id).eq("to_admin_id", me.id).is("read_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
