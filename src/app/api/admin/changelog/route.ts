import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

// Changelog interno de versiones/novedades (item 10 del pedido de Facu,
// "versiones/novedades") — incremento 17 de Item 6. Solo visible desde
// el panel de Admin por ahora (tabla `platform_changelog`, migración
// 037, sin policy pública de lectura) — no hay un pedido explícito de
// mostrarlo a los Maintlers todavía. Gateado a "critical_actions".

export async function GET(req: NextRequest) {
  if (!adminHasCapability(req, "critical_actions")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("platform_changelog")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [] });
}

// POST: crea una entrada nueva. Body: { versionLabel, notes }.
export async function POST(req: NextRequest) {
  if (!adminHasCapability(req, "critical_actions")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { versionLabel, notes } = body ?? {};
  if (!versionLabel || typeof versionLabel !== "string" || !versionLabel.trim()) {
    return NextResponse.json({ error: "Missing versionLabel." }, { status: 400 });
  }
  if (!notes || typeof notes !== "string" || !notes.trim()) {
    return NextResponse.json({ error: "Missing notes." }, { status: 400 });
  }

  const adminUsername = getAdminUsername(req);
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("platform_changelog")
    .insert({ version_label: versionLabel.trim(), notes: notes.trim(), created_by: adminUsername ?? null })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (adminUsername) {
    await logAdminAction({
      adminUsername,
      action: "system.changelog_create",
      entityType: "platform_changelog",
      entityId: data?.id ?? null,
      newValue: { versionLabel: versionLabel.trim(), notes: notes.trim() },
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true });
}

// DELETE: borra una entrada. Body: { id }. No hay soft-delete acá — un
// changelog interno mal escrito se corrige borrando y creando de nuevo,
// no amerita el mismo patrón de Papelera que Maintlers/assets/servicios.
export async function DELETE(req: NextRequest) {
  if (!adminHasCapability(req, "critical_actions")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { id } = body ?? {};
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing changelog entry id." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("platform_changelog")
    .select("version_label, notes")
    .eq("id", id)
    .single();

  const { error } = await admin.from("platform_changelog").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const adminUsername = getAdminUsername(req);
  if (adminUsername) {
    await logAdminAction({
      adminUsername,
      action: "system.changelog_delete",
      entityType: "platform_changelog",
      entityId: id,
      oldValue: existing ?? null,
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true });
}
