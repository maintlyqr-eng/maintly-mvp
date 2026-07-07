import { supabase } from "@/lib/supabase";

// Calls one of our own API routes with the logged-in mechanic's Supabase
// access token attached, for the mechanic-facing routes that need to know
// "who is calling" server-side (see src/lib/mechanicAuth.ts). Admin routes
// don't use this — they rely on the isAdminRequest cookie instead.
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(path, { ...init, headers });
}
