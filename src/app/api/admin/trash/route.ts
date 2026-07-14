import { NextRequest, NextResponse } from "next/server";
import { adminHasAnyCapability } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// GET: the current contents of the Papelera — every soft-deleted mechanic,
// asset, and service record (deleted_at is not null), most recently deleted
// first. Kept as one combined endpoint rather than three, since the
// Papelera UI shows all three lists on one screen and the counts are small
// (nobody expects thousands of items sitting in a trash at once — anything
// left there long enough should either get restored or permanently deleted).
//
// Capped at 500 rows per entity as a sanity limit, not real pagination —
// if the Papelera ever needs real pagination, follow the pattern in
// /api/admin/audit-logs/route.ts (.range() + count: "exact"), not the
// "fetch N and slice client-side" pattern used elsewhere in this panel.
export async function GET(req: NextRequest) {
  // Incremento 11: bulk-data / trash mezclan mechanics + assets +
  // service_records + qr_codes en una sola lectura — se permite si el rol
  // tiene "accounts" O "assets" (Support Admin, Content Moderator, Super
  // Admin). Analytics Viewer ("solo estadísticas/reportes" en el pedido
  // original) queda afuera a propósito: esta ruta no es "estadísticas", es
  // el dato crudo detrás de las tablas de gestión.
  if (!adminHasAnyCapability(req, ["accounts", "assets"])) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const CAP = 500;

  const [mechanicsRes, assetsRes, serviceRecordsRes] = await Promise.all([
    admin.from("mechanics")
      .select("id, name, email, workshop_name, is_mechanic, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(CAP),

    admin.from("assets")
      .select("id, asset_type, brand, model, nickname, vin_serial, plate, created_by, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(CAP),

    admin.from("service_records")
      .select("id, service_date, service_type, mechanic_id, asset_id, customer_id, deleted_at, mechanics(name), assets(brand, model, nickname)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(CAP),
  ]);

  const firstError = [mechanicsRes.error, assetsRes.error, serviceRecordsRes.error].find(Boolean);
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  return NextResponse.json({
    mechanics: mechanicsRes.data ?? [],
    assets: assetsRes.data ?? [],
    serviceRecords: serviceRecordsRes.data ?? [],
  });
}
