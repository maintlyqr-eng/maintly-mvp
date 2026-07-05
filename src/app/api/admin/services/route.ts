import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// DELETE: permanently remove a service record. Body: { id }
export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { id } = body ?? {};
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing service id." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("service_records").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
