// Server-only helper. Creates a Supabase client authenticated with the
// SERVICE ROLE key, which bypasses row-level security entirely. This is
// intentional and safe ONLY because every route that calls this first checks
// isAdminRequest() (see adminAuth.ts) — never import this from a "use
// client" component or an unauthenticated API route.

import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. " +
      "Get the service_role key from Supabase → Project Settings → API, and add it " +
      "as SUPABASE_SERVICE_ROLE_KEY (server-only, never NEXT_PUBLIC_)."
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
