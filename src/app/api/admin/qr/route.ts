import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

  return NextResponse.json({ ok: true, codes: (data ?? []).map((r: any) => r.code) });
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
  const { error } = await admin.from("qr_codes").update({ asset_id: null }).eq("code", code);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
