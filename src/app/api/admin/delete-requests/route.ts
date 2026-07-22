import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

// Facu (21 jul 2026): "una vez pasado ese tiempo debería tener la opción
// de pedirle al administrador que borre ese service" — see migration 042
// for the full reasoning and service_delete_requests' schema. This route
// is the admin-side half: list pending requests, and approve/reject them.
// Same "assets" capability as /api/admin/services/route.ts, since a
// service_records soft-delete either way is the same underlying action —
// this route just adds a review step instead of the admin acting alone.

// GET: pending requests, most recently filed first, joined with enough
// context (asset, service details, requesting mechanic) for the admin to
// judge each one without a second lookup.
export async function GET(req: NextRequest) {
  if (!adminHasCapability(req, "assets")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("service_delete_requests")
    .select(`
      id, reason, status, requested_at, resolved_at, resolved_by,
      service_record_id,
      requested_by,
      mechanics!service_delete_requests_requested_by_fkey(name, email),
      service_records(id, service_date, service_type, km_hours, deleted_at, assets(brand, model, nickname))
    `)
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [] });
}

// PATCH: resolve a request. Body: { id, decision: "approve" | "reject", note? }
// "approve" soft-deletes the underlying service_records row (deleted_at =
// now(), same effect the admin Papelera's own DELETE already produces —
// still fully restorable/permanently-deletable from there afterward).
// "reject" just closes the request, the service record is untouched.
export async function PATCH(req: NextRequest) {
  if (!adminHasCapability(req, "assets")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, decision, note } = body ?? {};
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing request id." }, { status: 400 });
  }
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "decision must be 'approve' or 'reject'." }, { status: 400 });
  }
  const noteText = typeof note === "string" && note.trim() ? note.trim() : null;

  const admin = getSupabaseAdmin();
  const adminUsername = getAdminUsername(req);

  const { data: existing, error: fetchError } = await admin
    .from("service_delete_requests")
    .select("id, status, service_record_id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json({ error: "This request was already resolved." }, { status: 400 });
  }

  if (decision === "approve") {
    const { error: deleteError } = await admin
      .from("service_records")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", existing.service_record_id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  const { error: updateError } = await admin
    .from("service_delete_requests")
    .update({
      status: decision === "approve" ? "approved" : "rejected",
      resolved_at: new Date().toISOString(),
      resolved_by: adminUsername ?? null,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (adminUsername) {
    await logAdminAction({
      adminUsername,
      action: decision === "approve" ? "service.delete" : "service.delete_request_reject",
      entityType: "service_record",
      entityId: existing.service_record_id,
      reason: noteText,
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true });
}
