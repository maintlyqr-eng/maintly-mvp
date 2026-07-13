import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

// PATCH: restore a soft-deleted service record. Body: { id, restore: true }
export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, restore } = body ?? {};
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing service id." }, { status: 400 });
  }
  if (restore !== true) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("service_records")
    .update({ deleted_at: null })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Service record not found." }, { status: 404 });
  }

  const adminUsername = getAdminUsername(req);
  if (adminUsername) {
    await logAdminAction({
      adminUsername,
      action: "service.restore",
      entityType: "service_record",
      entityId: id,
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true });
}

// DELETE: soft-delete a service record by default (restorable from the
// Papelera). Body: { id, permanent? } — permanent: true does the real
// removal, only once the record is already soft-deleted (see accounts/
// route.ts for the same "papelera first, then permanent" gating and why).
export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, permanent } = body ?? {};
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing service id." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  if (permanent === true) {
    const { data: existing } = await admin
      .from("service_records")
      .select("deleted_at, service_type, service_date, mechanic_id, asset_id, customer_id")
      .eq("id", id)
      .single();
    if (!existing?.deleted_at) {
      return NextResponse.json({ error: "Move this service record to the trash before deleting it permanently." }, { status: 400 });
    }

    const { error } = await admin.from("service_records").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const adminUsername = getAdminUsername(req);
    if (adminUsername) {
      await logAdminAction({
        adminUsername,
        action: "service.delete_permanent",
        entityType: "service_record",
        entityId: id,
        oldValue: existing ? { service_type: existing.service_type, service_date: existing.service_date, mechanic_id: existing.mechanic_id, asset_id: existing.asset_id, customer_id: existing.customer_id } : null,
        ipAddress: getRequestIp(req),
      });
    }

    return NextResponse.json({ ok: true });
  }

  const { data: beforeRow } = await admin
    .from("service_records")
    .select("service_type, service_date, mechanic_id, asset_id, customer_id")
    .eq("id", id)
    .single();

  const { data, error } = await admin
    .from("service_records")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Service record not found." }, { status: 404 });
  }

  const adminUsername = getAdminUsername(req);
  if (adminUsername) {
    await logAdminAction({
      adminUsername,
      action: "service.delete",
      entityType: "service_record",
      entityId: id,
      oldValue: beforeRow ?? null,
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true });
}
