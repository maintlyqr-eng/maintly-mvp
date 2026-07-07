import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Verifies the bearer token a logged-in mechanic's browser sends (their
// real Supabase Auth access token, grabbed client-side via
// supabase.auth.getSession() — see src/lib/apiAuth.ts) and returns their
// mechanic id, or null if it's missing/invalid/expired.
//
// This is the first "mechanic-facing" API route auth path in the codebase
// — every existing route so far is either admin-only (isAdminRequest, an
// HMAC cookie) or fully open and secured purely by RLS on direct
// client-to-Supabase calls. This one exists because the QR Codes
// "personalize" action needs a server-side cross-table check — "does this
// mechanic actually manage this code's asset?" — that isn't safe to trust
// from the client alone.
export async function getMechanicIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}
