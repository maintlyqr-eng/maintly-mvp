import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp, pick } from "@/lib/auditLog";

// PATCH: update role/status flags or basic profile fields on a mechanic
// (= account) row. Body: { id, is_mechanic?, verified?, suspended?, name?,
// workshop_name?, verification_status?, verification_reviewed_at?, verification_note?, restore? }
//
// `restore: true` is a dedicated soft-delete-reversal path (clears
// deleted_at) rather than just another field in `updates` — it gets its own
// audit action (account.restore) instead of showing up as a generic
// account.update, so the audit log reads clearly ("restauró la cuenta X",
// not "actualizó deleted_at").
const VERIFICATION_STATUSES = ["none", "pending", "verified", "rejected"];

export async function PATCH(req: NextRequest) {
  // Incremento 11: "accounts" cubre tanto restore como los demás campos —
  // ninguno de los dos es una acción crítica/irreversible (a diferencia del
  // DELETE permanente de más abajo, que exige además "critical_actions").
  if (!adminHasCapability(req, "accounts")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    id, is_mechanic, verified, suspended, name, workshop_name,
    verification_status, verification_reviewed_at, verification_note, restore,
  } = body ?? {};

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing account id." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  if (restore === true) {
    const { data, error } = await admin
      .from("mechanics")
      .update({ deleted_at: null })
      .eq("id", id)
      .select("id")
      .single();

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
        action: "account.restore",
        entityType: "mechanic",
        entityId: id,
        ipAddress: getRequestIp(req),
      });
    }

    return NextResponse.json({ ok: true });
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

// DELETE: soft-delete an account by default (sets deleted_at, blocks login,
// keeps everything restorable — see migration 031). Body: { id, permanent? }
//
// permanent: true performs the OLD behavior (real removal: deletes the auth
// user, which cascades to the mechanics row) — only allowed once the account
// is already soft-deleted, so "eliminación permanente" is always a second,
// deliberate step taken from the Papelera view, never a single click from
// the main Accounts list. This matches Facu's own spec (item 14): "soft
// delete ... restaurable; eliminación permanente ... + confirmación especial."
export async function DELETE(req: NextRequest) {
  if (!adminHasCapability(req, "accounts")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, permanent } = body ?? {};

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing account id." }, { status: 400 });
  }

  // Incremento 11 / item 14 del pedido original ("eliminación permanente
  // limitada a Super Admin"): un rol con "accounts" (ej. Support Admin)
  // puede soft-delete y restaurar, pero solo "critical_actions"
  // (hoy: únicamente Super Admin) puede pasar por acá.
  if (permanent === true && !adminHasCapability(req, "critical_actions")) {
    return NextResponse.json({ error: "Only a Super Admin can permanently delete an account." }, { status: 403 });
  }

  const admin = getSupabaseAdmin();

  if (permanent === true) {
    const { data: existing } = await admin.from("mechanics").select("deleted_at, name, email, workshop_name, is_mechanic").eq("id", id).single();
    if (!existing?.deleted_at) {
      return NextResponse.json({ error: "Move this account to the trash before deleting it permanently." }, { status: 400 });
    }

    // Deleting the auth user is the source of truth for "delete this account
    // for real". If mechanics.id has an on-delete-cascade FK to auth.users.id
    // (the usual Supabase profile-table pattern), the mechanics row goes with it.
    const { error: authError } = await admin.auth.admin.deleteUser(id);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // Best-effort cleanup in case the mechanics row wasn't cascaded (no FK,
    // or a FK without ON DELETE CASCADE). Ignore errors here — the auth user
    // is already gone, which is what matters most.
    await admin.from("mechanics").delete().eq("id", id);

    const adminUsername = getAdminUsername(req);
    if (adminUsername) {
      await logAdminAction({
        adminUsername,
        action: "account.delete_permanent",
        entityType: "mechanic",
        entityId: id,
        oldValue: existing ? { name: existing.name, email: existing.email, workshop_name: existing.workshop_name, is_mechanic: existing.is_mechanic } : null,
        ipAddress: getRequestIp(req),
      });
    }

    return NextResponse.json({ ok: true });
  }

  // Soft delete: fetch a snapshot for the audit log, then just stamp deleted_at.
  const { data: beforeRow } = await admin
    .from("mechanics")
    .select("name, email, workshop_name, is_mechanic")
    .eq("id", id)
    .single();

  const { data, error } = await admin
    .from("mechanics")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .single();

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
      action: "account.delete",
      entityType: "mechanic",
      entityId: id,
      oldValue: beforeRow ?? null,
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true });
}
