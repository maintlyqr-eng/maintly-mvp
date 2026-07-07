// The `mechanics` table itself is locked down to "read your own row only"
// (see the RLS migration). Anywhere the app needs to show *someone else's*
// name/verified/profession next to a service they logged — the public asset
// page, the printable report, the in-dashboard service history modal — it
// can't rely on Supabase's automatic `mechanics(...)` embed anymore, because
// that embed is subject to the same RLS as a direct query.
//
// Instead, those places query the `mechanic_public_profile` VIEW, which only
// exposes the four columns that are safe to show to a stranger (id, name,
// verified, profession) and is intentionally readable by anyone. This helper
// does that lookup in one batch call and returns a Map for easy merging.

import type { SupabaseClient } from "@supabase/supabase-js";

export type MechanicPublicProfile = {
  id: string;
  name: string;
  verified: boolean | null;
  profession: string | null;
};

export async function fetchMechanicPublicProfiles(
  supabase: SupabaseClient,
  mechanicIds: (string | null | undefined)[]
): Promise<Map<string, MechanicPublicProfile>> {
  const ids = Array.from(new Set(mechanicIds.filter((id): id is string => !!id)));
  const map = new Map<string, MechanicPublicProfile>();
  if (ids.length === 0) return map;

  const { data } = await supabase
    .from("mechanic_public_profile")
    .select("id, name, verified, profession")
    .in("id", ids);

  for (const row of (data as MechanicPublicProfile[] | null) ?? []) {
    map.set(row.id, row);
  }
  return map;
}
