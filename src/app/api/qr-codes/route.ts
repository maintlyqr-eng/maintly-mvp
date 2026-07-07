import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getMechanicIdFromRequest } from "@/lib/mechanicAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidQrTheme, DEFAULT_QR_THEME } from "@/lib/qrThemes";

function genCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

// A mechanic requesting blank codes for their own print run — smaller than
// the admin's platform-wide batch cap (/api/admin/qr allows up to 500).
const MAX_BLANK_PER_REQUEST = 60;

// GET: this mechanic's own QR codes — ones they generated, plus codes tied
// to any asset they currently manage (covers a code someone else created
// before the asset was shared into this mechanic's workshop). Includes scan
// stats and, for assigned codes, a summary of the linked asset.
export async function GET(req: NextRequest) {
  const mechanicId = await getMechanicIdFromRequest(req);
  if (!mechanicId) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const admin = getSupabaseAdmin();

  const { data: myAssetLinks } = await admin
    .from("mechanic_assets")
    .select("asset_id")
    .eq("mechanic_id", mechanicId);
  const myAssetIds = Array.from(new Set((myAssetLinks ?? []).map((r: any) => r.asset_id).filter(Boolean)));

  let query = admin
    .from("qr_codes")
    .select("code, asset_id, created_by, theme, label, created_at")
    .order("created_at", { ascending: false });

  query = myAssetIds.length > 0
    ? query.or(`created_by.eq.${mechanicId},asset_id.in.(${myAssetIds.join(",")})`)
    : query.eq("created_by", mechanicId);

  const { data: codes, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const codeList = (codes ?? []).map((c: any) => c.code);
  const assetIds = Array.from(new Set((codes ?? []).map((c: any) => c.asset_id).filter(Boolean)));

  const [scansRes, assetsRes] = await Promise.all([
    codeList.length > 0
      ? admin.from("qr_scans").select("code, scanned_at").in("code", codeList)
      : Promise.resolve({ data: [] as any[] }),
    assetIds.length > 0
      ? admin.from("assets").select("id, asset_type, brand, model, nickname").in("id", assetIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const scanStats = new Map<string, { count: number; lastScanned: string | null }>();
  for (const row of scansRes.data ?? []) {
    const prev = scanStats.get(row.code) ?? { count: 0, lastScanned: null as string | null };
    prev.count += 1;
    if (!prev.lastScanned || row.scanned_at > prev.lastScanned) prev.lastScanned = row.scanned_at;
    scanStats.set(row.code, prev);
  }

  const assetsById = new Map((assetsRes.data ?? []).map((a: any) => [a.id, a]));

  const result = (codes ?? []).map((c: any) => ({
    code: c.code,
    theme: c.theme || DEFAULT_QR_THEME,
    label: c.label as string | null,
    createdAt: c.created_at,
    asset: c.asset_id ? assetsById.get(c.asset_id) ?? null : null,
    scanCount: scanStats.get(c.code)?.count ?? 0,
    lastScanned: scanStats.get(c.code)?.lastScanned ?? null,
  }));

  return NextResponse.json({ codes: result });
}

// POST body shapes:
//   { action: "generate_blank", count, theme? }  → returns { codes: [...] }
//   { action: "personalize", code, theme?, label? }
//   { action: "reissue", assetId }                → returns { code: newCode }
export async function POST(req: NextRequest) {
  const mechanicId = await getMechanicIdFromRequest(req);
  if (!mechanicId) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const admin = getSupabaseAdmin();

  if (body.action === "generate_blank") {
    const count = Math.min(Math.max(Number(body.count) || 0, 1), MAX_BLANK_PER_REQUEST);
    const theme = typeof body.theme === "string" && isValidQrTheme(body.theme) ? body.theme : DEFAULT_QR_THEME;

    const rows = Array.from({ length: count }, () => ({
      code: genCode(),
      asset_id: null,
      created_by: mechanicId,
      theme,
    }));

    const { data, error } = await admin.from("qr_codes").insert(rows).select("code, theme, created_at");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, codes: data });
  }

  if (body.action === "personalize") {
    const code = body.code;
    if (!code || typeof code !== "string") return NextResponse.json({ error: "Missing code." }, { status: 400 });

    const { data: row } = await admin.from("qr_codes").select("code, asset_id, created_by").eq("code", code).single();
    if (!row) return NextResponse.json({ error: "QR code not found." }, { status: 404 });

    let manages = row.created_by === mechanicId;
    if (!manages && row.asset_id) {
      const { count } = await admin.from("mechanic_assets").select("*", { count: "exact", head: true })
        .eq("mechanic_id", mechanicId).eq("asset_id", row.asset_id);
      manages = (count ?? 0) > 0;
    }
    if (!manages) return NextResponse.json({ error: "You don't manage this QR code." }, { status: 403 });

    const updates: Record<string, unknown> = {};
    if (body.theme !== undefined) {
      if (typeof body.theme !== "string" || !isValidQrTheme(body.theme)) {
        return NextResponse.json({ error: "Invalid theme." }, { status: 400 });
      }
      updates.theme = body.theme;
    }
    if (body.label !== undefined) {
      updates.label = body.label ? String(body.label).slice(0, 60) : null;
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

    const { error } = await admin.from("qr_codes").update(updates).eq("code", code);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reissue") {
    const assetId = body.assetId;
    if (!assetId || typeof assetId !== "string") return NextResponse.json({ error: "Missing assetId." }, { status: 400 });

    const { count: manageCount } = await admin.from("mechanic_assets").select("*", { count: "exact", head: true })
      .eq("mechanic_id", mechanicId).eq("asset_id", assetId);
    if (!manageCount) return NextResponse.json({ error: "You don't manage this asset." }, { status: 403 });

    const newCode = genCode();
    const { error: insertError } = await admin.from("qr_codes").insert({
      code: newCode, asset_id: assetId, created_by: mechanicId, theme: DEFAULT_QR_THEME,
    });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    // Free whichever old code(s) pointed at this asset so a found lost
    // sticker doesn't keep working once a replacement has been issued.
    await admin.from("qr_codes").update({ asset_id: null }).eq("asset_id", assetId).neq("code", newCode);

    return NextResponse.json({ ok: true, code: newCode });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
