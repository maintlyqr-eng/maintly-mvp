import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// GET: item 8 del pedido de Facu ("Analytics avanzados") + la parte de
// item 9 ("Estado y calidad de la plataforma") que es derivable de datos
// que ya existen, sin necesidad de instrumentación nueva de errores/forms
// abandonados (eso queda fuera de alcance — ver el comentario al final).
//
// Query params (opcionales): from, to (ISO dates) — acotan las métricas
// que tienen sentido acotadas por rango (escaneos, registros nuevos,
// rankings). Las métricas de "usuarios activos" son ventanas fijas
// (hoy/semana/mes) independientes del rango elegido, porque eso es lo que
// item 8 pide literalmente ("usuarios activos diarios/semanales/
// mensuales") — no tendría sentido que un selector de rango las cambiara.
//
// Los rankings (assets más escaneados, assets con más registros) y el
// promedio de días hasta el primer mantenimiento se calculan trayendo
// filas crudas y agrupando acá en vez de con SQL — no hay una función de
// Postgres para esto en el repo y crear una nueva sin poder probarla
// contra una base real es más riesgoso que este enfoque, que ya es el
// mismo patrón usado en todo el resto de este panel (bulk-data). Cada
// fetch crudo está capado (mismo criterio que MECHANICS_CAP en bulk-data)
// y el payload dice `Truncated: true` si se llegó al tope, para no
// esconder que el número es una aproximación sobre una muestra.
const SCAN_SAMPLE_CAP = 5000;
const SERVICE_SAMPLE_CAP = 5000;

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const url = new URL(req.url);
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const from = url.searchParams.get("from") || defaultFrom;
  const to = url.searchParams.get("to") || now.toISOString();

  const dayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const admin = getSupabaseAdmin();

  const [
    activeTodayRes, activeWeekRes, activeMonthRes,
    inactiveRes, totalMechanicsRes,
    returningRes,
    totalAssetsRes, totalServicesRes, totalQrCodesRes,
    scansInRangeRes,
    servicesInRangeRes,
    allServiceAssetIdsRes,
    allScannedCodesRes,
    locationsRes,
    firstServicePerAssetRes,
    assetsCreatedRes,
  ] = await Promise.all([
    admin.from("mechanics").select("*", { count: "exact", head: true }).is("deleted_at", null).gte("last_active_at", dayAgo),
    admin.from("mechanics").select("*", { count: "exact", head: true }).is("deleted_at", null).gte("last_active_at", weekAgo),
    admin.from("mechanics").select("*", { count: "exact", head: true }).is("deleted_at", null).gte("last_active_at", monthAgo),

    // "Sin actividad" = nunca activo, o su última actividad es más vieja
    // que el umbral (ver INACTIVE_DAYS_THRESHOLD en admin/page.tsx, mismo
    // valor de 30 días). is_mechanic=true porque una cuenta "owner" sin
    // rol de mecánico no necesariamente entra al Dashboard.
    admin.from("mechanics").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("is_mechanic", true).or(`last_active_at.is.null,last_active_at.lt.${monthAgo}`),
    admin.from("mechanics").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("is_mechanic", true),

    // Maintlers que "regresaron": activos dentro del rango elegido, pero
    // ya existían de antes de que el rango empezara (si no, sería
    // simplemente un Maintler nuevo usando la app por primera vez, no
    // alguien "volviendo").
    admin.from("mechanics").select("*", { count: "exact", head: true }).is("deleted_at", null).gte("last_active_at", from).lte("last_active_at", to).lt("created_at", from),

    admin.from("assets").select("*", { count: "exact", head: true }).is("deleted_at", null),
    admin.from("service_records").select("*", { count: "exact", head: true }).is("deleted_at", null),
    admin.from("qr_codes").select("*", { count: "exact", head: true }),

    admin.from("qr_scans").select("asset_id, scanned_at").gte("scanned_at", from).lte("scanned_at", to).order("scanned_at", { ascending: false }).limit(SCAN_SAMPLE_CAP),

    admin.from("service_records").select("asset_id").is("deleted_at", null).gte("service_date", from.slice(0, 10)).lte("service_date", to.slice(0, 10)).order("service_date", { ascending: false }).limit(SERVICE_SAMPLE_CAP),

    // Para "assets sin registros": el set de asset_id que SÍ tienen al
    // menos un registro, para restar contra el total de assets.
    admin.from("service_records").select("asset_id").is("deleted_at", null).limit(20000),

    // Para "QR nunca escaneados": el set de códigos que SÍ tienen al menos
    // un escaneo, para restar contra el total de QR.
    admin.from("qr_scans").select("code").limit(20000),

    admin.from("assets").select("location").is("deleted_at", null).not("location", "is", null),

    // Para el promedio de días hasta el primer mantenimiento: se necesita,
    // por asset, el service_record más viejo. Se trae ordenado ascendente
    // y se queda con la primera aparición de cada asset_id en JS (ver
    // computeAvgDaysToFirst más abajo) — capado igual que el resto.
    admin.from("service_records").select("asset_id, service_date").is("deleted_at", null).order("service_date", { ascending: true }).limit(SERVICE_SAMPLE_CAP),

    admin.from("assets").select("id, created_at").is("deleted_at", null).limit(20000),
  ]);

  const firstError = [
    activeTodayRes.error, activeWeekRes.error, activeMonthRes.error,
    inactiveRes.error, totalMechanicsRes.error,
    returningRes.error,
    totalAssetsRes.error, totalServicesRes.error, totalQrCodesRes.error,
    scansInRangeRes.error, servicesInRangeRes.error,
    allServiceAssetIdsRes.error, allScannedCodesRes.error,
    locationsRes.error, firstServicePerAssetRes.error, assetsCreatedRes.error,
  ].find(Boolean);

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  // ── Top escaneados / top con más registros (agrupado en JS) ──
  function topByCount(rows: { asset_id: string | null }[], limit: number) {
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (!r.asset_id) continue;
      counts.set(r.asset_id, (counts.get(r.asset_id) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([assetId, count]) => ({ assetId, count }));
  }

  const topScannedAssets = topByCount(scansInRangeRes.data ?? [], 10);
  const topAssetsByRecords = topByCount(servicesInRangeRes.data ?? [], 10);

  const scannedInRangeTruncated = (scansInRangeRes.data ?? []).length >= SCAN_SAMPLE_CAP;
  const servicesInRangeTruncated = (servicesInRangeRes.data ?? []).length >= SERVICE_SAMPLE_CAP;

  // Fetch just the labels (brand/model/nickname) for the asset ids that
  // made it into either top-10 list — small, targeted lookup rather than
  // pulling every asset's full row.
  const neededAssetIds = Array.from(new Set([
    ...topScannedAssets.map((r) => r.assetId),
    ...topAssetsByRecords.map((r) => r.assetId),
  ]));
  const { data: labelRows } = neededAssetIds.length > 0
    ? await admin.from("assets").select("id, asset_type, brand, model, nickname").in("id", neededAssetIds)
    : { data: [] as { id: string; asset_type: string; brand: string | null; model: string | null; nickname: string | null }[] };
  const labelById = Object.fromEntries((labelRows ?? []).map((a) => [a.id, a]));

  // ── Assets sin registros / QR nunca escaneados (set difference en JS) ──
  const assetIdsWithRecords = new Set((allServiceAssetIdsRes.data ?? []).map((r) => r.asset_id).filter(Boolean));
  const codesScanned = new Set((allScannedCodesRes.data ?? []).map((r) => r.code));
  const assetsWithoutRecords = Math.max(0, (totalAssetsRes.count ?? 0) - assetIdsWithRecords.size);
  const qrNeverScanned = Math.max(0, (totalQrCodesRes.count ?? 0) - codesScanned.size);

  // ── Top ubicaciones (texto libre, aproximado — ver nota en el backlog) ──
  const locationCounts = new Map<string, number>();
  for (const row of locationsRes.data ?? []) {
    const loc = (row.location ?? "").trim();
    if (!loc) continue;
    locationCounts.set(loc, (locationCounts.get(loc) ?? 0) + 1);
  }
  const topLocations = Array.from(locationCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([location, count]) => ({ location, count }));

  // ── Promedio de días hasta el primer mantenimiento ──
  const createdByAssetId = Object.fromEntries((assetsCreatedRes.data ?? []).map((a) => [a.id, a.created_at]));
  const firstServiceByAssetId = new Map<string, string>();
  for (const row of firstServicePerAssetRes.data ?? []) {
    if (!row.asset_id) continue;
    if (!firstServiceByAssetId.has(row.asset_id)) firstServiceByAssetId.set(row.asset_id, row.service_date);
  }
  let totalDays = 0;
  let countedAssets = 0;
  for (const [assetId, firstServiceDate] of firstServiceByAssetId.entries()) {
    const createdAt = createdByAssetId[assetId];
    if (!createdAt) continue;
    const days = (new Date(firstServiceDate).getTime() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000);
    if (days < 0) continue; // dato inconsistente (fecha de servicio cargada antes de la creación del asset) — se descarta en vez de ensuciar el promedio
    totalDays += days;
    countedAssets += 1;
  }
  const avgDaysToFirstMaintenance = countedAssets > 0 ? totalDays / countedAssets : null;

  return NextResponse.json({
    range: { from, to },
    activeToday: activeTodayRes.count ?? 0,
    activeThisWeek: activeWeekRes.count ?? 0,
    activeThisMonth: activeMonthRes.count ?? 0,
    inactiveMechanics: inactiveRes.count ?? 0,
    totalMechanics: totalMechanicsRes.count ?? 0,
    returningMechanics: returningRes.count ?? 0,

    totalAssets: totalAssetsRes.count ?? 0,
    totalServices: totalServicesRes.count ?? 0,
    totalQrCodes: totalQrCodesRes.count ?? 0,
    avgRecordsPerAsset: (totalAssetsRes.count ?? 0) > 0 ? (totalServicesRes.count ?? 0) / (totalAssetsRes.count ?? 1) : 0,
    avgDaysToFirstMaintenance,

    scansInRange: (scansInRangeRes.data ?? []).length,
    scansInRangeTruncated: scannedInRangeTruncated,
    servicesInRange: (servicesInRangeRes.data ?? []).length,
    servicesInRangeTruncated,

    topScannedAssets: topScannedAssets.map((r) => ({ ...r, asset: labelById[r.assetId] ?? null })),
    topAssetsByRecords: topAssetsByRecords.map((r) => ({ ...r, asset: labelById[r.assetId] ?? null })),
    topLocations,

    assetsWithoutRecords,
    qrNeverScanned,
  });
}
