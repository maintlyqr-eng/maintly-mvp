import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

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

  const { data: beforeRow } = await admin
    .from("service_records")
    .select("service_type, service_date, mechanic_id, asset_id, customer_id")
    .eq("id", id)
    .single();

  const { error } = await admin.from("service_records").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
