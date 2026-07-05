import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// GET: all customers across every mechanic, service-role only. The
// `customers` table has strict owner-only RLS (auth.uid() = mechanic_id),
// and the admin panel's session isn't a real Supabase auth session (it's the
// HMAC `mly_admin_session` cookie), so a direct anon-key read from the
// browser would silently return nothing. This lets the admin Services table
// resolve a service's customer_id into a name.
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("customers")
    .select("id, mechanic_id, name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ customers: data ?? [] });
}
