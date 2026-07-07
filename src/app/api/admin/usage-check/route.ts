import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// GET: real usage numbers (DB size, Storage size) compared against Supabase's
// Free-plan hard limits, so we know ahead of time when it's time to upgrade
// to Pro instead of finding out the hard way (writes failing, project
// auto-pausing, etc).
//
// Two ways in, on purpose:
//   1. The Admin panel UI calls this with the normal admin session cookie
//      (isAdminRequest) so Facu can see the numbers any time in the panel.
//   2. The weekly automated check (a scheduled task, no browser/cookie
//      available) calls this with a bearer secret instead. The secret only
//      gates this one read-only, non-sensitive stats endpoint — it is NOT
//      the service role key and can't do anything else.
//
// Free plan limits (2026): 500MB database, 1GB Storage. If these ever
// change, or once the project is on Pro, update the two constants below.
const DB_LIMIT_MB = 500;
const STORAGE_LIMIT_MB = 1024;

type UsageMetricsRow = {
  db_size_bytes: number;
  storage_size_bytes: number;
  mechanics_count: number;
  service_records_count: number;
};

function isAuthorized(req: NextRequest): boolean {
  if (isAdminRequest(req)) return true;

  const authHeader = req.headers.get("authorization") ?? "";
  const secret = process.env.USAGE_CHECK_SECRET;
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("get_usage_metrics").single<UsageMetricsRow>();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "get_usage_metrics() returned no data." },
      { status: 500 }
    );
  }

  const dbSizeMB = data.db_size_bytes / (1024 * 1024);
  const storageSizeMB = data.storage_size_bytes / (1024 * 1024);

  return NextResponse.json({
    dbSizeMB: Math.round(dbSizeMB * 10) / 10,
    dbLimitMB: DB_LIMIT_MB,
    dbPercent: Math.round((dbSizeMB / DB_LIMIT_MB) * 1000) / 10,
    storageSizeMB: Math.round(storageSizeMB * 10) / 10,
    storageLimitMB: STORAGE_LIMIT_MB,
    storagePercent: Math.round((storageSizeMB / STORAGE_LIMIT_MB) * 1000) / 10,
    mechanicsCount: data.mechanics_count,
    serviceRecordsCount: data.service_records_count,
    checkedAt: new Date().toISOString(),
  });
}
