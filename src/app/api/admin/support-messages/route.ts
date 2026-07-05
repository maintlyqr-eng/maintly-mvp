import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// GET: every message a mechanic has sent to the Control Center, newest first.
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("support_messages")
    .select("id, mechanic_id, body, read, created_at, mechanics(name, email)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [] });
}

// PATCH: mark a support message read/unread. Body: { id, read }
export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  const { id, read } = payload ?? {};

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("support_messages").update({ read: !!read }).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
