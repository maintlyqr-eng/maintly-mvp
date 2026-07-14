import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// POST: returns a short-lived signed URL for a mechanic's uploaded
// verification certificate, stored in the private "certificates" bucket.
// Body: { id } — the mechanic's id.
export async function POST(req: NextRequest) {
  // Incremento 11: "accounts" — certificado de verificación de un Maintler.
  if (!adminHasCapability(req, "accounts")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { id } = body ?? {};

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing account id." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: mechanic, error: fetchError } = await admin
    .from("mechanics")
    .select("certificate_path")
    .eq("id", id)
    .single();

  if (fetchError || !mechanic?.certificate_path) {
    return NextResponse.json({ error: "No certificate on file for this account." }, { status: 404 });
  }

  const { data, error } = await admin.storage
    .from("certificates")
    .createSignedUrl(mechanic.certificate_path, 300); // 5 minutes

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || "Couldn't generate a link for this certificate." }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
