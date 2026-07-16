import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// POST: send an official message from the Control Center to a mechanic.
// Lands in that mechanic's existing "Messages" inbox, marked from_admin.
// Body: { mechanicId, body }
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
  const { error } = await admin.from("messages").insert({
    mechanic_id: mechanicId,
    asset_id: null,
    from_admin: true,
    sender_name: "MaintlyQR Team",
    sender_contact: "support@maintlyqr.com",
    body: body.trim(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
