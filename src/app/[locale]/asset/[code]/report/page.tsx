"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Droplets, Wrench, Hammer, Search, Filter, Disc3, Disc, Settings, MapPin, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDateDMY } from "@/lib/date";
import { getUnitShort, formatUnitValue } from "@/lib/units";
import { fetchMechanicPublicProfiles } from "@/lib/mechanicPublicProfile";

type AssetData = {
  id: string;
  asset_type: string;
  brand: string | null;
  model: string | null;
  nickname: string | null;
  vin_serial: string | null;
  year: number | null;
  plate: string | null;
  fuel_type: string | null;
  location: string | null;
  photo_url: string | null;
};

type MechanicInfo = { name: string; verified?: boolean | null; profession?: string | null };

type ServiceRecord = {
  id: string;
  service_date: string;
  service_type: string;
  km_hours: number | null;
  notes: string | null;
  mechanics: MechanicInfo | MechanicInfo[] | null;
};

function formatDate(dateStr: string) {
  return formatDateDMY(dateStr);
}

function formatToday() {
  return formatDateDMY(new Date().toISOString().slice(0, 10));
}

function generateReportId(code: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `MNT-${y}-${m}-${d}-${code.toUpperCase().slice(0, 4)}`;
}

const svcColors: Record<string, string> = {
  "Oil Change":    "#d97706",
  Service:         "#2563eb",
  Repair:          "#dc2626",
  Inspection:      "#7c3aed",
  "Filter Change": "#16a34a",
  "Tire Change":   "#0891b2",
  "Brake Service": "#ea580c",
};

// Mirrors SERVICE_TYPE_KEYS in src/app/[locale]/asset/[code]/page.tsx — maps
// the English value stored in the DB to a key in the ServiceTypes namespace.
const SERVICE_TYPE_KEYS: Record<string, string> = {
  "Oil Change": "oilChange", "Service": "service", "Repair": "repair",
  "Inspection": "inspection", "Filter Change": "filterChange",
  "Tire Change": "tireChange", "Brake Service": "brakeService", "Other": "other",
};

// Mirrors MAINTLER_ROLE_KEYS in src/app/[locale]/asset/[code]/page.tsx
const MAINTLER_ROLE_KEYS: Record<string, string> = {
  "Owner": "owner", "Mechanic": "mechanic", "Electrician": "electrician",
  "HVAC Technician": "hvacTechnician", "Fleet Manager": "fleetManager",
  "Business": "business", "Inspector": "inspector",
};

function SvcIcon({ type, color }: { type: string; color: string }) {
  const map: Record<string, React.ReactNode> = {
    "Oil Change":    <Droplets size={12} color={color} strokeWidth={2} />,
    Service:         <Wrench   size={12} color={color} strokeWidth={2} />,
    Repair:          <Hammer   size={12} color={color} strokeWidth={2} />,
    Inspection:      <Search   size={12} color={color} strokeWidth={2} />,
    "Filter Change": <Filter   size={12} color={color} strokeWidth={2} />,
    "Tire Change":   <Disc3    size={12} color={color} strokeWidth={2} />,
    "Brake Service": <Disc     size={12} color={color} strokeWidth={2} />,
    Other:           <Settings size={12} color={color} strokeWidth={2} />,
  };
  return <>{map[type] ?? <Settings size={12} color={color} strokeWidth={2} />}</>;
}

export default function AssetReportPage() {
  const params = useParams();
  const code = params?.code as string;

  const t = useTranslations("ReportPage");
  const tServiceTypes = useTranslations("ServiceTypes");
  const tAssetTypes = useTranslations("AssetTypes");
  const tMaintlerRoles = useTranslations("MaintlerRoles");

  function serviceTypeLabel(value: string) {
    const key = SERVICE_TYPE_KEYS[value];
    return key ? tServiceTypes(key) : value;
  }
  function maintlerRoleLabel(value: string) {
    const key = MAINTLER_ROLE_KEYS[value];
    return key ? tMaintlerRoles(key) : value;
  }

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [asset, setAsset] = useState<AssetData | null>(null);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    if (!code) { setNotFound(true); setLoading(false); return; }

    async function load() {
      const { data: qrRow } = await supabase
        .from("qr_codes").select("asset_id").eq("code", code).single();
      if (!qrRow?.asset_id) { setNotFound(true); setLoading(false); return; }

      const { data: assetData } = await supabase
        .from("assets")
        .select("id, asset_type, brand, model, nickname, vin_serial, year, plate, fuel_type, location, photo_url")
        .eq("id", qrRow.asset_id).is("deleted_at", null).single();
      if (!assetData) { setNotFound(true); setLoading(false); return; }

      setAsset(assetData as AssetData);
      setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(window.location.origin + "/asset/" + code)}`);

      const { data: svcRows } = await supabase
        .from("service_records")
        .select("id, service_date, service_type, km_hours, notes, mechanic_id")
        .eq("asset_id", qrRow.asset_id)
        .is("deleted_at", null)
        .order("service_date", { ascending: false });

      const rows = (svcRows as (ServiceRecord & { mechanic_id: string | null })[]) ?? [];
      // See lib/mechanicPublicProfile.ts — `mechanics` is owner-only now, so
      // other mechanics' name/verified/profession come from the public view.
      const profiles = await fetchMechanicPublicProfiles(supabase, rows.map((r) => r.mechanic_id));
      setServices(rows.map((r) => ({ ...r, mechanics: r.mechanic_id ? profiles.get(r.mechanic_id) ?? null : null })));
      setLoading(false);
    }

    load();
  }, [code]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "Arial, sans-serif" }}>
      <div>
        <div style={{ width: 36, height: 36, border: "4px solid #dc2626", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "#888", fontSize: 13 }}>{t("loading")}</p>
      </div>
    </div>
  );

  if (notFound || !asset) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "Arial, sans-serif" }}>
      <p style={{ color: "#dc2626" }}>{t("assetNotFound")}</p>
    </div>
  );

  const assetName = asset.nickname || [asset.brand, asset.model].filter(Boolean).join(" ") || t("defaultAssetName");
  const reportId = generateReportId(code);
  const maxKmHrs = services.reduce((max, s) => Math.max(max, s.km_hours ?? 0), 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', Arial, sans-serif; background: #f4f4f5; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @page { size: A4; margin: 0; }
        @media print {
          body { background: #fff; }
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* ── FLOATING PRINT BUTTON ── */}
      <div className="no-print" style={{ position: "fixed", top: 16, right: 16, zIndex: 999, display: "flex", gap: 8 }}>
        <button onClick={() => window.print()} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13, boxShadow: "0 2px 8px rgba(220,38,38,.35)" }}>
          🖨️ {t("printButton")}
        </button>
        <button onClick={() => window.close()} style={{ background: "#fff", color: "#52525b", border: "1px solid #e4e4e7", borderRadius: 8, padding: "10px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
          ← {t("backButton")}
        </button>
      </div>

      {/* ══════════════════════════════════════════
          REPORT — A4 container
      ══════════════════════════════════════════ */}
      <div style={{ width: "210mm", minHeight: "297mm", margin: "0 auto", background: "#fff", fontFamily: "'Inter', Arial, sans-serif", color: "#111", paddingBottom: 176 }}>

        {/* ── TOP HEADER BAR ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px 10px", borderBottom: "3px solid #dc2626" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/qr-gear-real.png" alt="Maintly" style={{ width: 44, height: 44, objectFit: "contain" }} />
            <div>
              <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: 2, lineHeight: 1 }}>
                <span style={{ color: "#111" }}>MAIN</span><span style={{ color: "#dc2626" }}>TLY</span>
              </div>
              <div style={{ fontSize: 7, color: "#999", letterSpacing: 2, fontWeight: 700, marginTop: 2, textTransform: "uppercase" }}>{t("headerTagline")}</div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 9, color: "#666", lineHeight: 1.6, textTransform: "uppercase" }}>
            <div style={{ fontWeight: 800, color: "#333" }}>{t("reportIdLine", { id: reportId })}</div>
            <div>{t("generatedLine", { date: formatToday() })}</div>
          </div>
        </div>

        {/* ── HERO TITLE ── */}
        <div style={{ padding: "18px 24px 14px", background: "linear-gradient(135deg, #fff 55%, #fef2f2 100%)", borderBottom: "1px solid #f4f4f5" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.1, color: "#111", margin: 0, textTransform: "uppercase" }}>
                {t("titleLine1")}<br />
                <span style={{ color: "#dc2626" }}>{t("titleLine2")}</span>
              </h1>
              <p style={{ fontSize: 10, color: "#888", marginTop: 6 }}>{t("subtitle")}</p>

              <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
                {[
                  { title: t("verifiedBadgeTitle"), sub: t("verifiedBadgeSub") },
                  { title: t("globalAccessTitle"), sub: t("globalAccessSub") },
                ].map(({ title, sub }) => (
                  <div key={title} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #dc2626", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>✓</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 9, letterSpacing: 1, color: "#333", textTransform: "uppercase" }}>{title}</div>
                      {sub.split("\n").map((l, i) => <div key={i} style={{ fontSize: 8.5, color: "#777", lineHeight: 1.4 }}>{l}</div>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Asset photo (if available) */}
            {asset.photo_url && (
              <div style={{ flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.photo_url}
                  alt={assetName}
                  style={{ width: 130, height: 100, objectFit: "cover", borderRadius: 10, border: "1.5px solid #e4e4e7", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── ASSET INFO CARD ── */}
        <div style={{ margin: "14px 24px", border: "1px solid #e4e4e7", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ height: 3, background: "#dc2626" }} />
          <div style={{ padding: "14px 16px", display: "flex", gap: 16, alignItems: "flex-start" }}>
            {/* QR */}
            {qrUrl && (
              <div style={{ border: "2px solid #dc2626", borderRadius: 8, padding: 5, flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="QR" style={{ width: 85, height: 85, display: "block" }} />
              </div>
            )}

            {/* Details */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, fontWeight: 800, color: "#dc2626", letterSpacing: 2, marginBottom: 4, textTransform: "uppercase" }}>{t("assetInfoSection")}</div>
              <div style={{ fontSize: 8, color: "#999", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{t("assetNameLabel")}</div>
              <div style={{ fontSize: 19, fontWeight: 900, color: "#111", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>{assetName}</div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px 12px" }}>
                {[
                  asset.vin_serial && { label: t("serialNumberLabel"), value: asset.vin_serial, mono: true },
                  asset.brand     && { label: t("brandLabel"),         value: asset.brand },
                  asset.model     && { label: t("modelLabel"),         value: asset.model },
                  { label: t("assetTypeFieldLabel"), value: tAssetTypes(asset.asset_type) },
                  asset.year      && { label: t("yearLabel"),          value: String(asset.year) },
                  asset.fuel_type && { label: t("fuelTypeLabel"),     value: asset.fuel_type },
                  asset.plate     && { label: t("plateLabel"),         value: asset.plate, mono: true },
                  asset.location  && { label: t("locationLabel"),      value: asset.location },
                  maxKmHrs > 0    && { label: t("lastReadingLabel"), value: maxKmHrs.toLocaleString() + " " + getUnitShort(asset.asset_type) },
                ].filter(Boolean).map((field: any) => (
                  <div key={field.label}>
                    <div style={{ fontSize: 7.5, color: "#aaa", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{field.label}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#222", fontFamily: field.mono ? "monospace" : "inherit" }}>{field.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── SERVICE HISTORY ── */}
        <div style={{ margin: "0 24px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#dc2626", letterSpacing: 1, textTransform: "uppercase" }}>{t("serviceHistorySection")}</span>
            <div style={{ flex: 1, height: 2, background: "#dc2626" }} />
          </div>

          {services.length === 0 ? (
            <p style={{ color: "#aaa", fontStyle: "italic", fontSize: 11 }}>{t("noServiceRecords")}</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e4e4e7" }}>
                  {[t("tableDate"), t("tableReading"), t("tableServiceType"), t("tableDescription"), t("tablePerformedBy")].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "5px 8px", fontSize: 8, color: "#aaa", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {services.map((s, idx) => {
                  const mech = Array.isArray(s.mechanics) ? s.mechanics[0] : s.mechanics;
                  const mechName = mech?.name ?? "—";
                  const col = svcColors[s.service_type] ?? "#6b7280";
                  const isLatest = idx === 0;
                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>
                      <td style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#dc2626", flexShrink: 0 }} />
                          <span style={{ fontWeight: 700, color: "#222", fontSize: 10 }}>{formatDate(s.service_date)}</span>
                        </div>
                      </td>
                      <td style={{ padding: "9px 8px", color: "#666", fontSize: 10 }}>
                        {formatUnitValue(s.km_hours, asset.asset_type)}
                      </td>
                      <td style={{ padding: "9px 8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: "50%",
                            background: col + "22",
                            border: `1.5px solid ${col}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0
                          }}>
                            <SvcIcon type={s.service_type} color={col} />
                          </div>
                          <span style={{ color: col, fontWeight: 700, fontSize: 9.5, whiteSpace: "nowrap" }}>
                            {serviceTypeLabel(s.service_type)}
                          </span>
                        </div>
                        {isLatest && (
                          <div style={{ fontSize: 8, color: "#dc2626", fontWeight: 700, marginTop: 3, textTransform: "uppercase" }}>● {t("latestBadge")}</div>
                        )}
                      </td>
                      <td style={{ padding: "9px 8px", color: "#555", fontSize: 9.5, maxWidth: 160, lineHeight: 1.5 }}>
                        {s.notes || <span style={{ color: "#ccc", fontStyle: "italic" }}>{t("noNotes")}</span>}
                      </td>
                      <td style={{ padding: "9px 8px" }}>
                        <div style={{ fontWeight: 700, color: "#222", fontSize: 10 }}>{mechName}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                          {mech?.verified ? (
                            <span style={{ color: "#dc2626", fontSize: 8, fontWeight: 700, textTransform: "uppercase" }}>
                              ✓ {mech.profession ? t("verifiedMaintlerBadge", { profession: maintlerRoleLabel(mech.profession) }) : t("verifiedMaintlerFallback")}
                            </span>
                          ) : (
                            <span style={{ color: "#aaa", fontSize: 8, fontWeight: 700, textTransform: "uppercase" }}>○ {t("unverifiedMaintlerBadge")}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ══ FIXED PAGE FOOTER — repeats on every printed page ══ */}
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "210mm", zIndex: 10 }}>

          {/* ── REPORT SUMMARY ── */}
          <div style={{ margin: "0 24px 10px", border: "1px solid #e4e4e7", borderRadius: 10, padding: "14px 20px", background: "#fff" }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: "#dc2626", letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>{t("reportSummarySection")}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 32 }}>
                {[
                  { value: String(services.length), label: t("totalServicesLabel") },
                  ...(maxKmHrs > 0 ? [{ value: maxKmHrs.toLocaleString(), label: t("lastReadingLabel") }] : []),
                  { value: "100%", label: t("verifiedRecordsLabel") },
                ].map(({ value, label }) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: "#111", lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: 8, color: "#aaa", fontWeight: 700, letterSpacing: 1, marginTop: 3, textTransform: "uppercase" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Maintly seal */}
              <div style={{
                width: 76, height: 76, borderRadius: "50%",
                border: "3px solid #dc2626",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                textAlign: "center", flexShrink: 0,
                background: "radial-gradient(circle, #fff5f5 0%, #fff 60%)",
              }}>
                <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>
                  <span style={{ color: "#111" }}>MAIN</span><span style={{ color: "#dc2626" }}>TLY</span>
                </div>
                <div style={{ width: 40, height: 1, background: "#dc2626", margin: "3px 0" }} />
                <div style={{ fontSize: 7, color: "#dc2626", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{t("sealVerified")}</div>
              </div>
            </div>
          </div>

          {/* ── FOOTER BAR ── */}
          <div style={{ background: "#fff", borderTop: "2px solid #dc2626", padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/maintly-logo-full.png" alt="MaintlyQR" style={{ height: 26, width: "auto", objectFit: "contain" }} />
            <div style={{ textAlign: "center", color: "#888", fontSize: 9, lineHeight: 1.6 }}>
              {t("footerTagline1")}<br />{t("footerTagline2")}
            </div>
            <div style={{ color: "#dc2626", fontSize: 10, fontWeight: 700 }}>maintlyqr.com</div>
          </div>
        </div>
      </div>
    </>
  );
}
