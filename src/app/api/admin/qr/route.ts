import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

function genCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

// POST: generate a new batch of unassigned QR codes. Body: { count }
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const count = Math.min(Math.max(Number(body?.count) || 0, 1), 500);

  const rows = Array.from({ length: count }, () => ({ code: genCode(), asset_id: null }));

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("qr_codes").insert(rows).select("code");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const codes = (data ?? []).map((r: any) => r.code);

  const adminUsername = getAdminUsername(req);
  if (adminUsername) {
    // Logging every code would bloat the row for a 500-code batch — cap the
    // stored preview and keep the real total in `count`.
    await logAdminAction({
      adminUsername,
      action: "qr.generate_batch",
      entityType: "qr_batch",
      newValue: { count: codes.length, codesPreview: codes.slice(0, 20) },
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true, codes });
}

// PATCH: free up a QR code from whatever asset it's linked to. Body: { code }
export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { code } = body ?? {};
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Missing QR code." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: beforeRow } = await admin.from("qr_codes").select("asset_id").eq("code", code).single();

  const { error } = await admin.from("qr_codes").update({ asset_id: null }).eq("code", code);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const adminUsername = getAdminUsername(req);
  if (adminUsername) {
    await logAdminAction({
      adminUsername,
      action: "qr.unlink",
      entityType: "qr_code",
      entityId: code,
      oldValue: beforeRow ?? null,
      newValue: { asset_id: null },
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true });
}
