import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

// GET: the full admin <-> mechanic conversation history, oldest first
// (the client groups rows into one thread per mechanic_id), plus the
// per-thread state (status/priority/internal notes — incremento 9,
// "herramientas de soporte") from support_thread_state (migración 034).
// Both come back in one request since the admin UI always needs both
// together to render the case list.
export async function GET(req: NextRequest) {
  // Incremento 11: "support" (Support Admin + Super Admin).
  if (!adminHasCapability(req, "support")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const [{ data, error }, { data: states, error: statesError }] = await Promise.all([
    admin
      .from("support_messages")
      .select("id, mechanic_id, body, read, created_at, from_admin, mechanics(name, email)")
      .eq("hidden_for_admin", false)
      .order("created_at", { ascending: true }),
    admin.from("support_thread_state").select("*"),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (statesError) {
    return NextResponse.json({ error: statesError.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [], states: states ?? [] });
}

// POST: send a message from the Control Center into a mechanic's support
// thread. Body: { mechanicId, body }
export async function POST(req: NextRequest) {
  // Incremento 11: "support" (Support Admin + Super Admin).
  if (!adminHasCapability(req, "support")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const payload = await req.json().catch(() => ({}));
  const { mechanicId, body } = payload ?? {};

  if (!mechanicId || typeof mechanicId !== "string") {
    return NextResponse.json({ error: "Missing mechanicId." }, { status: 400 });
  }
  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("support_messages").insert({
    mechanic_id: mechanicId,
    from_admin: true,
    body: body.trim(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// PATCH: mark every unread mechanic->admin message in a thread as read
// (called when the admin opens that mechanic's conversation).
// Body: { mechanicId }
export async function PATCH(req: NextRequest) {
  // Incremento 11: "support" (Support Admin + Super Admin).
  if (!adminHasCapability(req, "support")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const payload = await req.json().catch(() => ({}));
  const { mechanicId } = payload ?? {};

  if (!mechanicId || typeof mechanicId !== "string") {
    return NextResponse.json({ error: "Missing mechanicId." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("support_messages")
    .update({ read: true })
    .eq("mechanic_id", mechanicId)
    .eq("from_admin", false)
    .eq("read", false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE: clear a conversation from the Control Center's own view only.
// This never touches the mechanic's copy — it's a per-side hide, not a real
// delete, so one side clearing a thread can't hide anything from the other.
// Body: { mechanicId }
export async function DELETE(req: NextRequest) {
  // Incremento 11: "support" (Support Admin + Super Admin).
  if (!adminHasCapability(req, "support")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const payload = await req.json().catch(() => ({}));
  const { mechanicId } = payload ?? {};

  if (!mechanicId || typeof mechanicId !== "string") {
    return NextResponse.json({ error: "Missing mechanicId." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("support_messages")
    .update({ hidden_for_admin: true })
    .eq("mechanic_id", mechanicId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const adminUsername = getAdminUsername(req);
  if (adminUsername) {
    await logAdminAction({
      adminUsername,
      action: "support_thread.clear",
      entityType: "support_thread",
      entityId: mechanicId,
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true });
}
