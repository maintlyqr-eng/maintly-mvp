import type { NextRequest } from "next/server";
import { adminHasCapability, getAdminRole, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Permisos del departamento de Marketing (migración 061), verificados en
// el servidor en cada ruta de /api/admin/marketing/*. El Super Admin tiene
// todos los permisos implícitos; cualquier otro admin necesita la
// capacidad "marketing" (rol) Y una fila activa en department_members con
// el permiso puntual en true.

export const MARKETING_PERMS = ["stats", "content", "approve", "publish", "connections", "vault"] as const;
export type MarketingPerm = (typeof MARKETING_PERMS)[number];

export type MarketingActor = {
  username: string;
  isSuper: boolean;
  isMember: boolean;
  isLead: boolean;
  perms: Record<MarketingPerm, boolean>;
};

const NONE: Record<MarketingPerm, boolean> = { stats: false, content: false, approve: false, publish: false, connections: false, vault: false };
const ALL: Record<MarketingPerm, boolean> = { stats: true, content: true, approve: true, publish: true, connections: true, vault: true };

export async function getMarketingActor(req: NextRequest): Promise<MarketingActor | null> {
  const username = getAdminUsername(req);
  if (!username) return null;
  const role = getAdminRole(req);
  if (role === "super_admin") return { username, isSuper: true, isMember: true, isLead: true, perms: { ...ALL } };
  if (!adminHasCapability(req, "marketing")) return null;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("department_members")
    .select("is_lead, permissions")
    .eq("department", "marketing")
    .ilike("username", username)
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return { username, isSuper: false, isMember: false, isLead: false, perms: { ...NONE } };
  const p = (data.permissions ?? {}) as Partial<Record<MarketingPerm, boolean>>;
  const perms = { ...NONE };
  for (const k of MARKETING_PERMS) perms[k] = !!p[k];
  return { username, isSuper: false, isMember: true, isLead: !!data.is_lead, perms };
}

export function can(actor: MarketingActor | null, perm: MarketingPerm): boolean {
  return !!actor && (actor.isSuper || actor.perms[perm]);
}
