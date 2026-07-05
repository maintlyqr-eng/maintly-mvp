import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// GET: the full admin <-> mechanic conversation history, oldest first
// (the client groups rows into one thread per mechanic_id).
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("support_messages")
    .select("id, mechanic_id, body, read, created_at, from_admin, mechanics(name, email)")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [] });
}

// POST: send a message from the Control Center into a mechanic's support
// thread. Body: { mechanicId, body }
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
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
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
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
