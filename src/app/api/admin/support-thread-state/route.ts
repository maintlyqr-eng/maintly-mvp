import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

const STATUSES = ["open", "closed"] as const;
const PRIORITIES = ["low", "normal", "high"] as const;

export type SupportThreadStateRow = {
  mechanic_id: string;
  status: (typeof STATUSES)[number];
  priority: (typeof PRIORITIES)[number];
  internal_notes: string | null;
  closed_at: string | null;
  closed_by: string | null;
};

// PATCH: upsert the per-thread state (status/priority/internal notes) for a
// support case (incremento 9, item 7 del pedido: "cambiar estado, asignar
// prioridad, notas internas, ... cerrar caso"). Body: { mechanicId, status?,
// priority?, internal_notes? } — only the fields present get changed, the
// rest fall back to whatever the thread already has (or the default "open /
// normal / no notes" if this is the first time this thread is touched).
//
// Moving status to "closed" stamps closed_at/closed_by (same "stamp on
// resolve, clear on reopen" pattern already used for content_reports —
// /api/admin/reports — so these fields always reflect the most recent
// close, never a stale one from a prior close/reopen cycle).
export async function PATCH(req: NextRequest) {
  if (!adminHasCapability(req, "support")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { mechanicId, status, priority, internal_notes: internalNotes } = body ?? {};

  if (!mechanicId || typeof mechanicId !== "string") {
    return NextResponse.json({ error: "Missing mechanicId." }, { status: 400 });
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (priority !== undefined && !PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: "Invalid priority." }, { status: 400 });
  }
  if (internalNotes !== undefined && typeof internalNotes !== "string") {
    return NextResponse.json({ error: "Invalid internal_notes." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const adminUsername = getAdminUsername(req);

  const { data: existing } = await admin
    .from("support_thread_state")
    .select("*")
    .eq("mechanic_id", mechanicId)
    .maybeSingle();

  const before = (existing as SupportThreadStateRow | null) ?? {
    mechanic_id: mechanicId, status: "open", priority: "normal", internal_notes: null, closed_at: null, closed_by: null,
  };

  const updates: Record<string, unknown> = { mechanic_id: mechanicId };
  if (priority !== undefined) updates.priority = priority;
  if (internalNotes !== undefined) updates.internal_notes = internalNotes;
  if (status !== undefined) {
    updates.status = status;
    if (status === "closed") {
      updates.closed_at = new Date().toISOString();
      updates.closed_by = adminUsername ?? null;
    } else {
      updates.closed_at = null;
      updates.closed_by = null;
    }
  }

  const { data, error } = await admin
    .from("support_thread_state")
    .upsert(updates, { onConflict: "mechanic_id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (adminUsername) {
    await logAdminAction({
      adminUsername,
      action: "support_thread.update_state",
      entityType: "support_thread",
      entityId: mechanicId,
      oldValue: before,
      newValue: updates,
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true, state: data as SupportThreadStateRow });
}
