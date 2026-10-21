import { NextRequest, NextResponse } from "next/server";
import { adminHasCapability, isAdminReadOnly, getAdminUsername } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, getRequestIp } from "@/lib/auditLog";

// Fusión de historiales (21/10/2026, migración 046). Pedido explícito de
// Facu: "deberíamos poder ver quién fusionó qué cosa desde el panel del
// administrador. En caso de que alguien haga cagadas le podemos dar
// soporte y acomodar las cosas".
//
// GET: lista de fusiones (más reciente primero) con los nombres resueltos
//      de los dos activos y del Maintler que fusionó. Paginación real.
// POST: deshace una fusión llamando a unmerge_assets() (solo service
//       role puede ejecutarla, ver la migración). Gateada critical_actions:
//       mueve historial entre activos de usuarios, mismo nivel que un
//       borrado permanente.

export type AssetMergeRow = {
  id: string;
  created_at: string;
  primary_asset_id: string;
  duplicate_asset_id: string;
  merged_by: string | null;
  vin: string | null;
  services_moved: number;
  qr_codes_moved: number;
  undone_at: string | null;
  undone_by: string | null;
  snapshot: unknown;
  primary_label: string;
  duplicate_label: string;
  merged_by_name: string | null;
};

type AssetLite = { id: string; nickname: string | null; brand: string | null; model: string | null; asset_type: string };

function assetLabel(a: AssetLite | undefined, fallbackId: string): string {
  if (!a) return fallbackId.slice(0, 8) + "…";
  return a.nickname?.trim() || [a.brand, a.model].filter(Boolean).join(" ").trim() || a.asset_type;
}

export async function GET(req: NextRequest) {
  if (!adminHasCapability(req, "assets")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Math.trunc(Number(url.searchParams.get("page")) || 1));
  const pageSize = Math.min(200, Math.max(1, Math.trunc(Number(url.searchParams.get("pageSize")) || 50)));
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  const admin = getSupabaseAdmin();
  const { data, error, count } = await admin
    .from("asset_merges")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Omit<AssetMergeRow, "primary_label" | "duplicate_label" | "merged_by_name">[];
  const assetIds = Array.from(new Set(rows.flatMap((r) => [r.primary_asset_id, r.duplicate_asset_id])));
  const mechanicIds = Array.from(new Set(rows.map((r) => r.merged_by).filter((x): x is string => !!x)));

  const [assetsRes, mechanicsRes] = await Promise.all([
    assetIds.length
      ? admin.from("assets").select("id, nickname, brand, model, asset_type").in("id", assetIds)
      : Promise.resolve({ data: [] as AssetLite[] }),
    mechanicIds.length
      ? admin.from("mechanics").select("id, name").in("id", mechanicIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
  ]);

  const assetMap = new Map<string, AssetLite>(((assetsRes.data ?? []) as AssetLite[]).map((a) => [a.id, a]));
  const mechMap = new Map<string, string | null>(((mechanicsRes.data ?? []) as { id: string; name: string | null }[]).map((m) => [m.id, m.name]));

  const merges: AssetMergeRow[] = rows.map((r) => ({
    ...r,
    primary_label: assetLabel(assetMap.get(r.primary_asset_id), r.primary_asset_id),
    duplicate_label: assetLabel(assetMap.get(r.duplicate_asset_id), r.duplicate_asset_id),
    merged_by_name: r.merged_by ? mechMap.get(r.merged_by) ?? null : null,
  }));

  return NextResponse.json({ merges, total: count ?? 0, page, pageSize });
}

// POST { id } -> deshace la fusión.
export async function POST(req: NextRequest) {
  if (!adminHasCapability(req, "critical_actions") || isAdminReadOnly(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { id } = body ?? {};
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing merge id." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const adminUsername = getAdminUsername(req);

  const { data: before } = await admin
    .from("asset_merges")
    .select("id, primary_asset_id, duplicate_asset_id, vin, undone_at")
    .eq("id", id)
    .maybeSingle();
  if (!before) {
    return NextResponse.json({ error: "Merge not found." }, { status: 404 });
  }
  if (before.undone_at) {
    return NextResponse.json({ error: "Merge already undone." }, { status: 409 });
  }

  const { error } = await admin.rpc("unmerge_assets", {
    p_merge_id: id,
    p_undone_by: adminUsername ?? "admin",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (adminUsername) {
    await logAdminAction({
      adminUsername,
      action: "asset.unmerge",
      entityType: "asset",
      entityId: before.primary_asset_id,
      oldValue: { merge_id: id, duplicate_asset_id: before.duplicate_asset_id, vin: before.vin },
      newValue: { undone: true },
      ipAddress: getRequestIp(req),
    });
  }

  return NextResponse.json({ ok: true });
}
