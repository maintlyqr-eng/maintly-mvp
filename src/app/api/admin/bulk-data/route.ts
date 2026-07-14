import { NextRequest, NextResponse } from "next/server";
import { adminHasAnyCapability } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// GET: the handful of platform-wide tables the Admin dashboard needs
// (mechanics, assets, qr_codes, service_records, mechanic_assets), read with
// the service-role key instead of the browser's anon key.
//
// Why this exists: these tables used to be read directly from the browser
// with the anon-key client, which only works if their RLS policies allow any
// authenticated (or even anonymous) reader to SELECT every row — i.e. the
// admin panel's own convenience was propping up an overly-broad RLS policy
// that any visitor could exploit directly against the Supabase REST API,
// bypassing this app entirely. Routing through here means RLS on these
// tables can be locked down to "read your own row" without breaking Admin.
//
// Each list is capped (most-recent-first where a date column exists) rather
// than fully unbounded, and the response says whether it was truncated so
// the UI can show that honestly instead of silently dropping older rows.
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

  const MECHANICS_CAP = 5000;
  const ASSETS_CAP = 10000;
  const QR_CODES_CAP = 10000;
  const SERVICE_RECORDS_CAP = 5000;
  const MECHANIC_ASSETS_CAP = 10000;

  const [
    mechanicsRes,
    mechanicsCountRes,
    assetsRes,
    assetsCountRes,
    qrCodesRes,
    qrCodesCountRes,
    serviceRecordsRes,
    serviceRecordsCountRes,
    mechanicAssetsRes,
    mechanicAssetsCountRes,
  ] = await Promise.all([
    // .is("deleted_at", null) on mechanics/assets/service_records excludes
    // soft-deleted rows (see migration 031) — those show up in the Papelera
    // section instead (/api/admin/trash), not in the regular admin lists.
    admin.from("mechanics")
      .select("id, name, email, workshop_name, is_mechanic, verified, suspended, created_at, last_active_at, photo_url, profession, certificate_path, verification_status, verification_requested_at, verification_reviewed_at, verification_note")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(MECHANICS_CAP),
    admin.from("mechanics").select("*", { count: "exact", head: true }).is("deleted_at", null),

    admin.from("assets")
      .select("id, asset_type, brand, model, nickname, vin_serial, plate, created_by, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(ASSETS_CAP),
    admin.from("assets").select("*", { count: "exact", head: true }).is("deleted_at", null),

    admin.from("qr_codes")
      .select("code, asset_id, created_by, created_at")
      .order("created_at", { ascending: false })
      .limit(QR_CODES_CAP),
    admin.from("qr_codes").select("*", { count: "exact", head: true }),

    admin.from("service_records")
      .select("id, service_date, service_type, mechanic_id, asset_id, customer_id, mechanics(name), assets(brand, model, nickname)")
      .is("deleted_at", null)
      .order("service_date", { ascending: false })
      .limit(SERVICE_RECORDS_CAP),
    admin.from("service_records").select("*", { count: "exact", head: true }).is("deleted_at", null),

    admin.from("mechanic_assets").select("mechanic_id").limit(MECHANIC_ASSETS_CAP),
    admin.from("mechanic_assets").select("*", { count: "exact", head: true }),
  ]);

  const firstError = [
    mechanicsRes.error, mechanicsCountRes.error,
    assetsRes.error, assetsCountRes.error,
    qrCodesRes.error, qrCodesCountRes.error,
    serviceRecordsRes.error, serviceRecordsCountRes.error,
    mechanicAssetsRes.error, mechanicAssetsCountRes.error,
  ].find(Boolean);

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  return NextResponse.json({
    mechanics: mechanicsRes.data ?? [],
    mechanicsTotal: mechanicsCountRes.count ?? 0,
    mechanicsTruncated: (mechanicsCountRes.count ?? 0) > MECHANICS_CAP,

    assets: assetsRes.data ?? [],
    assetsTotal: assetsCountRes.count ?? 0,
    assetsTruncated: (assetsCountRes.count ?? 0) > ASSETS_CAP,

    qrCodes: qrCodesRes.data ?? [],
    qrCodesTotal: qrCodesCountRes.count ?? 0,
    qrCodesTruncated: (qrCodesCountRes.count ?? 0) > QR_CODES_CAP,

    serviceRecords: serviceRecordsRes.data ?? [],
    serviceRecordsTotal: serviceRecordsCountRes.count ?? 0,
    serviceRecordsTruncated: (serviceRecordsCountRes.count ?? 0) > SERVICE_RECORDS_CAP,

    mechanicAssets: mechanicAssetsRes.data ?? [],
    mechanicAssetsTotal: mechanicAssetsCountRes.count ?? 0,
    mechanicAssetsTruncated: (mechanicAssetsCountRes.count ?? 0) > MECHANIC_ASSETS_CAP,
  });
}
