import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp, pick } from "@/lib/auditLog";

// PATCH: update role/status flags or basic profile fields on a mechanic
// (= account) row. Body: { id, is_mechanic?, verified?, suspended?, name?,
// workshop_name?, verification_status?, verification_reviewed_at?, verification_note? }
const VERIFICATION_STATUSES = ["none", "pending", "verified", "rejected"];

export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    id, is_mechanic, verified, suspended, name, workshop_name,
    verification_status, verification_reviewed_at, verification_note,
  } = body ?? {};

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing account id." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof is_mechanic === "boolean") updates.is_mechanic = is_mechanic;
  if (typeof verified === "boolean") updates.verified = verified;
  if (typeof suspended === "boolean") updates.suspended = suspended;
  if (typeof name === "string") updates.name = name.trim();
  if (typeof workshop_name === "string") updates.workshop_name = workshop_name.trim() || null;
  if (typeof verification_status === "string" && VERIFICATION_STATUSES.includes(verification_status)) {
    updates.verification_status = verification_status;
  }
  if (typeof verification_reviewed_at === "string") updates.verification_reviewed_at = verification_reviewed_at;
  if (typeof verification_note === "string" || verification_note === null) updates.verification_note = verification_note;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Fetch the current values of just the fields being changed, for the
  // audit log's old_value — cheap (single row, few columns) and lets the
  // log show a real before/after instead of just the after.
  const { data: beforeRow } = await admin
    .from("mechanics")
    .select(Object.keys(updates).join(","))
    .eq("id", id)
    .single();

  const { data, error } = await admin.from("mechanics").update(updates).eq("id", id).select("id").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const adminUsername = getAdminUsername(req);
  if (adminUsername) {
    await logAdminAction({
      adminUsername,
      action: "account.update",
      entityType: "mechanic",
      entityId: id,
      oldValue: beforeRow ? pick(beforeRow as unknown as Record<string, unknown>, Object.keys(updates)) : null,
      newValue: updates,
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true });
}

// DELETE: permanently remove an account (auth user + its mechanics row).
// Body: { id }
export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { id } = body ?? {};

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing account id." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Fetch identifying info before deleting — once the auth user is gone
  // there's nothing left to look up.
  const { data: beforeRow } = await admin
    .from("mechanics")
    .select("name, email, workshop_name, is_mechanic")
    .eq("id", id)
    .single();

  // Deleting the auth user is the source of truth for "delete this account".
  // If mechanics.id has an on-delete-cascade FK to auth.users.id (the usual
  // Supabase profile-table pattern), the mechanics row goes with it.
  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Best-effort cleanup in case the mechanics row wasn't cascaded (no FK, or
  // a FK without ON DELETE CASCADE). Ignore errors here — the auth user is
  // already gone, which is what matters most.
  await admin.from("mechanics").delete().eq("id", id);

  const adminUsername = getAdminUsername(req);
  if (adminUsername) {
    await logAdminAction({
      adminUsername,
      action: "account.delete",
      entityType: "mechanic",
      entityId: id,
      oldValue: beforeRow ?? null,
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true });
}
