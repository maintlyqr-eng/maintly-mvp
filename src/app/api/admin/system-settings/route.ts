import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

// Configuraciones globales del sistema (incremento 17 de Item 6, primer
// ítem de la Fase 3 — "Configuraciones globales avanzadas"). Fila única
// en `platform_settings` (migración 037). Gateado a "critical_actions"
// (hoy solo Super Admin) porque afecta a toda la plataforma, mismo
// criterio que la eliminación permanente y la gestión de admins.

const EDITABLE_FIELDS = [
  "maintenance_mode",
  "maintenance_message",
  "banner_enabled",
  "banner_text",
  "banner_severity",
  "banner_link_url",
  "max_asset_photo_mb",
  "max_document_mb",
  "max_certificate_mb",
] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

const VALID_SEVERITIES = ["info", "warning", "critical"];

export async function GET(req: NextRequest) {
  if (!adminHasCapability(req, "critical_actions")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("platform_settings").select("*").eq("id", true).single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}

// PATCH: edita uno o más campos de la fila única. Body: { updates: {...} }.
export async function PATCH(req: NextRequest) {
  if (!adminHasCapability(req, "critical_actions")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { updates } = body ?? {};
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      patch[key] = (updates as Record<EditableField, unknown>)[key];
    }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields in the request." }, { status: 400 });
  }

  if (typeof patch.banner_severity === "string" && !VALID_SEVERITIES.includes(patch.banner_severity)) {
    return NextResponse.json({ error: "Invalid banner severity." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // beforeRow viene de un .select() con un string dinámico
  // (EDITABLE_FIELDS.join(", ")) — mismo workaround de castear pasando
  // por `unknown` documentado desde el incremento 1 (accounts/route.ts),
  // porque Supabase no puede inferir el tipo real de esa fila.
  const { data: beforeRow } = await admin
    .from("platform_settings")
    .select(EDITABLE_FIELDS.join(", "))
    .eq("id", true)
    .single();

  const adminUsername = getAdminUsername(req);
  const finalPatch = {
    ...patch,
    updated_at: new Date().toISOString(),
    updated_by: adminUsername ?? null,
  };

  const { data, error } = await admin
    .from("platform_settings")
    .update(finalPatch)
    .eq("id", true)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (adminUsername) {
    await logAdminAction({
      adminUsername,
      action: "system.update_settings",
      entityType: "platform_settings",
      entityId: "singleton",
      oldValue: (beforeRow as unknown as Record<string, unknown>) ?? null,
      newValue: patch,
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true, settings: data });
}
