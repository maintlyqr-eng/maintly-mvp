import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

// Admin management for the "assets" table — previously read-only from the
// Control Center (via /api/admin/bulk-data). Write paths: soft-delete +
// restore (same Papelera system as accounts and service records, see
// migration 031), plus general field editing (item 3 del pedido: "editar"),
// added in the "Completar gestión existente" increment.

// Fields an admin is allowed to edit directly. Deliberately excludes
// created_by (never reassign ownership from here — that's a much bigger,
// separate decision) and anything QR/id-related (QR linkage has its own
// dedicated management under item 5 del pedido).
const EDITABLE_FIELDS = ["asset_type", "brand", "model", "nickname", "vin_serial", "plate"] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

// PATCH: either restore a soft-deleted asset ({ id, restore: true }), or
// edit one or more of EDITABLE_FIELDS ({ id, updates: { ... } }).
export async function PATCH(req: NextRequest) {
  // Incremento 11: "assets" (Content Moderator + Super Admin).
  if (!adminHasCapability(req, "assets")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, restore, updates } = body ?? {};
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing asset id." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  if (restore === true) {
    const { data, error } = await admin
      .from("assets")
      .update({ deleted_at: null })
      .eq("id", id)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }

    const adminUsername = getAdminUsername(req);
    if (adminUsername) {
      await logAdminAction({
        adminUsername,
        action: "asset.restore",
        entityType: "asset",
        entityId: id,
        ipAddress: getRequestIp(req),
      });
    }

    return NextResponse.json({ ok: true });
  }

  if (updates && typeof updates === "object" && !Array.isArray(updates)) {
    const patch: Record<string, unknown> = {};
    for (const key of EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        patch[key] = (updates as Record<EditableField, unknown>)[key];
      }
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No editable fields in the request." }, { status: 400 });
    }

    const { data: beforeRow } = await admin
      .from("assets")
      .select(EDITABLE_FIELDS.join(", "))
      .eq("id", id)
      .single();

    const { data, error } = await admin
      .from("assets")
      .update(patch)
      .eq("id", id)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }

    const adminUsername = getAdminUsername(req);
    if (adminUsername) {
      await logAdminAction({
        adminUsername,
        action: "asset.update",
        entityType: "asset",
        entityId: id,
        // beforeRow comes from a .select() built from a dynamic field list
        // (EDITABLE_FIELDS.join(", ")), so it types as Supabase's generic
        // error-row shape — pass through `unknown` first, same workaround
        // documented in Item 6 / Logs de Auditoría for this exact pattern.
        oldValue: (beforeRow as unknown as Record<string, unknown>) ?? null,
        newValue: patch,
        ipAddress: getRequestIp(req),
      });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}

// DELETE: soft-delete an asset by default (restorable from the Papelera).
// Body: { id, permanent? } — permanent: true does the real removal, only
// once the asset is already soft-deleted (same "papelera first" gating as
// accounts and service records).
//
// Note: this does NOT cascade-delete the asset's service_records or
// qr_codes row. The asset simply disappears from public/dashboard view
// (see the [locale]/asset/[code] pages and dashboard queries, which all
// filter deleted_at is null) while soft-deleted; its history and QR link
// come back untouched on restore.
export async function DELETE(req: NextRequest) {
  if (!adminHasCapability(req, "assets")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, permanent } = body ?? {};
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing asset id." }, { status: 400 });
  }

  // Incremento 11 / item 14: eliminación permanente exige "critical_actions".
  if (permanent === true && !adminHasCapability(req, "critical_actions")) {
    return NextResponse.json({ error: "Only a Super Admin can permanently delete an asset." }, { status: 403 });
  }

  const admin = getSupabaseAdmin();

  if (permanent === true) {
    const { data: existing } = await admin
      .from("assets")
      .select("deleted_at, asset_type, brand, model, nickname, vin_serial, plate, created_by")
      .eq("id", id)
      .single();
    if (!existing?.deleted_at) {
      return NextResponse.json({ error: "Move this asset to the trash before deleting it permanently." }, { status: 400 });
    }

    // Note: this doesn't explicitly detach qr_codes/service_records rows
    // pointing at this asset first. If those foreign keys are RESTRICT/NO
    // ACTION (not verified — this table wasn't created by a migration in
    // this repo, see claude/MAINTLYQR_FEATURE_BACKLOG.md Item 6), this
    // delete fails cleanly with a Postgres FK-violation message surfaced to
    // the admin as a flash error, rather than silently corrupting anything.
    const { error } = await admin.from("assets").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const adminUsername = getAdminUsername(req);
    if (adminUsername) {
      await logAdminAction({
        adminUsername,
        action: "asset.delete_permanent",
        entityType: "asset",
        entityId: id,
        oldValue: existing ? { asset_type: existing.asset_type, brand: existing.brand, model: existing.model, nickname: existing.nickname, vin_serial: existing.vin_serial, plate: existing.plate, created_by: existing.created_by } : null,
        ipAddress: getRequestIp(req),
      });
    }

    return NextResponse.json({ ok: true });
  }

  const { data: beforeRow } = await admin
    .from("assets")
    .select("asset_type, brand, model, nickname, vin_serial, plate, created_by")
    .eq("id", id)
    .single();

  const { data, error } = await admin
    .from("assets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  const adminUsername = getAdminUsername(req);
  if (adminUsername) {
    await logAdminAction({
      adminUsername,
      action: "asset.delete",
      entityType: "asset",
      entityId: id,
      oldValue: beforeRow ?? null,
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true });
}
