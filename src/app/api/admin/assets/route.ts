import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

// Admin management for the "assets" table — previously read-only from the
// Control Center (via /api/admin/bulk-data). This is the first write path:
// soft-delete + restore, as part of the same Papelera system as accounts
// and service records (see migration 031). Editing asset fields directly
// from the admin isn't part of this increment — see the feature backlog.

// PATCH: restore a soft-deleted asset. Body: { id, restore: true }
export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, restore } = body ?? {};
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing asset id." }, { status: 400 });
  }
  if (restore !== true) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
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
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, permanent } = body ?? {};
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing asset id." }, { status: 400 });
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
