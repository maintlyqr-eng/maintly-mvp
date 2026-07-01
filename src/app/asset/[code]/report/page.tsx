"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

type MechanicInfo = { name: string };

type ServiceRecord = {
  id: string;
  service_date: string;
  service_type: string;
  km_hours: number | null;
  notes: string | null;
  mechanics: MechanicInfo | MechanicInfo[] | null;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatToday() {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function generateReportId(code: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `MNT-${y}-${m}-${d}-${code.toUpperCase().slice(0, 4)}`;
}

const assetTypeLabel: Record<string, string> = {
  automotive: "Automotive",
  motorcycle: "Motorcycle",
  generator:  "Generator",
  machinery:  "Machinery",
  marine:     "Marine",
  aviation:   "Aviation",
};

// Icon + color per service type
const svcStyle: Record<string, { color: string; bg: string; icon: string; sub: string }> = {
  "Oil Change":    { color: "#d97706", bg: "#fef3c7", icon: "🛢", sub: "Lubrication Service" },
  "Service":       { color: "#dc2626", bg: "#fee2e2", icon: "🔧", sub: "Scheduled Maintenance" },
  "Repair":        { color: "#b91c1c", bg: "#fecaca", icon: "🔨", sub: "Corrective Action" },
  "Inspection":    { color: "#7c3aed", bg: "#ede9fe", icon: "🔍", sub: "Technical Check" },
  "Filter Change": { color: "#16a34a", bg: "#dcfce7", icon: "🗂", sub: "Filter Maintenance" },
  "Tire Change":   { color: "#0891b2", bg: "#cffafe", icon: "⭕", sub: "Tire Service" },
  "Brake Service": { color: "#ea580c", bg: "#ffedd5", icon: "🛑", sub: "Brake Maintenance" },
  "Other":         { color: "#6b7280", bg: "#f3f4f6", icon: "⚙", sub: "General Service" },
};

function getSvcStyle(type: string) {
  return svcStyle[type] ?? { color: "#6b7280", bg: "#f3f4f6", icon: "⚙", sub: "General Service" };
}

export default function AssetReportPage() {
  const params = useParams();
  const code = params?.code as string;

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
        .eq("id", qrRow.asset_id).single();
      if (!assetData) { setNotFound(true); setLoading(false); return; }

      setAsset(assetData as AssetData);
      setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(window.location.origin + "/asset/" + code)}`);

      const { data: svcRows } = await supabase
        .from("service_records")
        .select("id, service_date, service_type, km_hours, notes, mechanics(name)")
        .eq("asset_id", qrRow.asset_id)
        .order("service_date", { ascending: false });

      setServices((svcRows as unknown as ServiceRecord[]) ?? []);
      setLoading(false);
    }

    load();
  }, [code]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "Arial, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: "4px solid #dc2626", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "#888", fontSize: 13 }}>Generating report...</p>
      </div>
    </div>
  );

  if (notFound || !asset) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "Arial, sans-serif" }}>
      <p style={{ color: "#dc2626" }}>Asset not found.</p>
    </div>
  );

  const assetName = asset.nickname || [asset.brand, asset.model].filter(Boolean).join(" ") || "Asset";
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

      {/* ── FLOATING BUTTONS ── */}
      <div className="no-print" style={{ position: "fixed", top: 16, right: 16, zIndex: 999, display: "flex", gap: 8 }}>
        <button onClick={() => window.print()} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13, boxShadow: "0 2px 8px rgba(220,38,38,.35)" }}>
          🖨️ Print / Save PDF
        </button>
        <button onClick={() => history.back()} style={{ background: "#fff", color: "#52525b", border: "1px solid #e4e4e7", borderRadius: 8, padding: "10px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
          ← Back
        </button>
      </div>

      {/* ══════════════════════════════
          A4 PAGE
      ══════════════════════════════ */}
      <div style={{ width: "210mm", minHeight: "297mm", margin: "0 auto", background: "#fff", fontFamily: "'Inter', Arial, sans-serif", color: "#111", overflow: "hidden" }}>

        {/* ── TOP HEADER BAR ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px 10px", borderBottom: "3px solid #dc2626" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/qr-gear.png" alt="Maintly" style={{ width: 42, height: 42, objectFit: "contain" }} />
            <div>
              <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: 1.5, lineHeight: 1 }}>
                <span style={{ color: "#111" }}>MAIN</span><span style={{ color: "#dc2626" }}>TLY</span>
              </div>
              <div style={{ fontSize: 7, color: "#999", letterSpacing: 2, fontWeight: 700, marginTop: 2 }}>MAINTENANCE. TRACKED.</div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 9, color: "#666", lineHeight: 1.8 }}>
            <div style={{ fontWeight: 800, color: "#333", fontSize: 9.5 }}>REPORT ID: {reportId}</div>
            <div>GENERATED: {formatToday()}</div>
            <div>🌐 maintly.com</div>
          </div>
        </div>

        {/* ── HERO ── */}
        <div style={{ padding: "18px 24px 14px", background: "linear-gradient(135deg, #fff 50%, #fef2f2 100%)", borderBottom: "1px solid #f0f0f0", display: "flex", gap: 20, alignItems: "flex-start" }}>
          {/* Left: Title + badges */}
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.05, margin: 0 }}>
              MAINTENANCE<br />
              <span style={{ color: "#dc2626" }}>HISTORY REPORT</span>
            </h1>
            <p style={{ fontSize: 10, color: "#888", marginTop: 5 }}>Complete service history for this asset.</p>

            <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
              {[
                { icon: "✓", title: "100% VERIFIED", lines: ["All records verified", "by registered mechanics"] },
                { icon: "🌐", title: "GLOBAL ACCESS", lines: ["Trusted by professionals", "worldwide"] },
              ].map(({ icon, title, lines }) => (
                <div key={title} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #dc2626", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626", fontWeight: 900, fontSize: 12, flexShrink: 0 }}>{icon}</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 8.5, letterSpacing: 0.8, color: "#222", marginBottom: 2 }}>{title}</div>
                    {lines.map((l, i) => <div key={i} style={{ fontSize: 8, color: "#888", lineHeight: 1.5 }}>{l}</div>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Asset photo */}
          {asset.photo_url && (
            <div style={{ flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.photo_url}
                alt={assetName}
                style={{ width: 160, height: 120, objectFit: "cover", borderRadius: 10, border: "1.5px solid #e4e4e7", boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}
              />
            </div>
          )}
        </div>

        {/* ── ASSET INFO CARD ── */}
        <div style={{ margin: "14px 24px", border: "1px solid #e4e4e7", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ height: 3, background: "#dc2626" }} />
          <div style={{ padding: "14px 18px", display: "flex", gap: 18, alignItems: "flex-start" }}>
            {/* QR code */}
            {qrUrl && (
              <div style={{ border: "2px solid #dc2626", borderRadius: 8, padding: 5, flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="QR" style={{ width: 80, height: 80, display: "block" }} />
              </div>
            )}
            {/* Asset details */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, fontWeight: 800, color: "#dc2626", letterSpacing: 2, marginBottom: 5 }}>ASSET INFORMATION</div>
              <div style={{ fontSize: 7.5, color: "#aaa", fontWeight: 700, letterSpacing: 1 }}>ASSET NAME</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#111", marginBottom: 10, textTransform: "uppercase" }}>{assetName}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "7px 14px" }}>
                {[
                  asset.vin_serial && { label: "SERIAL NUMBER",  value: asset.vin_serial, mono: true },
                  asset.brand     && { label: "BRAND",           value: asset.brand },
                  asset.model     && { label: "MODEL",           value: asset.model },
                  {                   label: "ASSET TYPE",       value: assetTypeLabel[asset.asset_type] ?? asset.asset_type },
                  asset.year      && { label: "YEAR",            value: String(asset.year) },
                  asset.fuel_type && { label: "FUEL TYPE",       value: asset.fuel_type },
                  asset.plate     && { label: "PLATE",           value: asset.plate, mono: true },
                  asset.location  && { label: "LOCATION",        value: "📍 " + asset.location },
                  maxKmHrs > 0    && { label: "HOURS METER",     value: "⏱ " + maxKmHrs.toLocaleString() + " hrs" },
                ].filter(Boolean).map((f: any) => (
                  <div key={f.label}>
                    <div style={{ fontSize: 7, color: "#bbb", fontWeight: 700, letterSpacing: 1 }}>{f.label}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#222", fontFamily: f.mono ? "monospace" : "inherit" }}>{f.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── SERVICE HISTORY ── */}
        <div style={{ margin: "0 24px 14px" }}>
          {/* Section title */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: "#dc2626", letterSpacing: 1.5 }}>SERVICE HISTORY</span>
            <div style={{ flex: 1, height: 2, background: "#dc2626" }} />
          </div>

          {/* Column headers */}
          <div style={{ display: "flex", gap: 0, paddingLeft: 28, paddingBottom: 4, borderBottom: "1.5px solid #e4e4e7", marginBottom: 0 }}>
            {[
              { label: "DATE",         w: 80 },
              { label: "HOURS",        w: 72 },
              { label: "SERVICE TYPE", w: 130 },
              { label: "DESCRIPTION",  w: "auto" },
              { label: "PERFORMED BY", w: 110 },
            ].map(({ label, w }) => (
              <div key={label} style={{ width: w === "auto" ? undefined : w, flex: w === "auto" ? 1 : undefined, fontSize: 7.5, fontWeight: 700, color: "#aaa", letterSpacing: 1 }}>
                {label}
              </div>
            ))}
          </div>

          {services.length === 0 ? (
            <p style={{ color: "#aaa", fontStyle: "italic", fontSize: 11, padding: "12px 0" }}>No service records found.</p>
          ) : (
            <div>
              {services.map((s, idx) => {
                const mech = Array.isArray(s.mechanics) ? s.mechanics[0] : s.mechanics;
                const mechName = mech?.name ?? "—";
                const st = getSvcStyle(s.service_type);
                const isLast = idx === services.length - 1;

                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "stretch" }}>
                    {/* Timeline column */}
                    <div style={{ width: 20, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#dc2626", flexShrink: 0, marginTop: 14 }} />
                      {!isLast && (
                        <div style={{ width: 0, flex: 1, borderLeft: "2px dashed #dc2626", minHeight: 20, marginTop: 3 }} />
                      )}
                    </div>

                    {/* Row content */}
                    <div style={{ flex: 1, display: "flex", gap: 0, padding: "10px 0", borderBottom: isLast ? "none" : "1px solid #f4f4f5", alignItems: "flex-start" }}>
                      {/* DATE */}
                      <div style={{ width: 80, flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, color: "#111", fontSize: 9.5 }}>{formatDate(s.service_date)}</div>
                      </div>

                      {/* HOURS */}
                      <div style={{ width: 72, flexShrink: 0 }}>
                        {s.km_hours != null
                          ? <div style={{ fontSize: 9.5, color: "#555" }}>⏱ {s.km_hours.toLocaleString()} hrs</div>
                          : <div style={{ fontSize: 9.5, color: "#ccc" }}>—</div>
                        }
                      </div>

                      {/* SERVICE TYPE */}
                      <div style={{ width: 130, flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: "50%",
                            background: st.bg,
                            border: `1.5px solid ${st.color}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 13, flexShrink: 0, lineHeight: 1
                          }}>
                            {st.icon}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: st.color, fontSize: 9.5, lineHeight: 1.2 }}>{s.service_type}</div>
                            <div style={{ fontSize: 8, color: "#999", lineHeight: 1.2 }}>{st.sub}</div>
                          </div>
                        </div>
                      </div>

                      {/* DESCRIPTION */}
                      <div style={{ flex: 1, paddingRight: 12 }}>
                        {s.notes ? (
                          s.notes.split("\n").map((line, i) => (
                            <div key={i} style={{ fontSize: 9, color: "#555", lineHeight: 1.6, display: "flex", gap: 5 }}>
                              <span style={{ color: "#dc2626", flexShrink: 0 }}>•</span>
                              <span>{line}</span>
                            </div>
                          ))
                        ) : (
                          <span style={{ fontSize: 9, color: "#ccc", fontStyle: "italic" }}>No notes</span>
                        )}
                      </div>

                      {/* PERFORMED BY */}
                      <div style={{ width: 110, flexShrink: 0 }}>
                        <div style={{ fontSize: 8, color: "#999", fontWeight: 700, marginBottom: 2 }}>Maintly Mechanic</div>
                        <div style={{ fontWeight: 700, color: "#111", fontSize: 9.5 }}>{mechName}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 3 }}>
                          <span style={{ color: "#dc2626", fontSize: 8, fontWeight: 800 }}>✓</span>
                          <span style={{ color: "#dc2626", fontSize: 8, fontWeight: 700 }}>VERIFIED</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── REPORT SUMMARY ── */}
        <div style={{ margin: "0 24px 14px", border: "1px solid #e4e4e7", borderRadius: 10, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 900, color: "#dc2626", letterSpacing: 2, marginBottom: 12 }}>REPORT SUMMARY</div>
            <div style={{ display: "flex", gap: 28 }}>
              {[
                { icon: "📅", value: String(services.length), label: "TOTAL SERVICES" },
                ...(maxKmHrs > 0 ? [{ icon: "⏱", value: maxKmHrs.toLocaleString() + " hrs", label: "TOTAL RUN TIME" }] : []),
                { icon: "🛡", value: "100%", label: "VERIFIED RECORDS" },
              ].map(({ icon, value, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #e4e4e7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#111", lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: 7.5, color: "#aaa", fontWeight: 700, letterSpacing: 1 }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MAINTLY VERIFIED seal */}
          <div style={{
            width: 82, height: 82, borderRadius: "50%",
            border: "3px solid #dc2626",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            textAlign: "center", flexShrink: 0,
            background: "radial-gradient(circle, #fff5f5 0%, #fff 60%)",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/qr-gear.png" alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
            <div style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: 1, marginTop: 2 }}>
              <span style={{ color: "#111" }}>MAIN</span><span style={{ color: "#dc2626" }}>TLY</span>
            </div>
            <div style={{ width: 44, height: 1, background: "#dc2626", margin: "3px 0" }} />
            <div style={{ fontSize: 7, color: "#dc2626", fontWeight: 800, letterSpacing: 1.5 }}>VERIFIED</div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ background: "#111", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/qr-gear.png" alt="Maintly" style={{ width: 28, height: 28, objectFit: "contain", filter: "brightness(10)" }} />
            <div>
              <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: 1.5, color: "#fff" }}>
                MAIN<span style={{ color: "#dc2626" }}>TLY</span>
              </div>
              <div style={{ fontSize: 7, color: "#888", letterSpacing: 1.5 }}>MAINTENANCE. TRACKED.</div>
            </div>
          </div>
          <div style={{ textAlign: "center", color: "#888", fontSize: 8.5, lineHeight: 1.8 }}>
            Trusted by professionals worldwide.<br />One QR. Lifetime Maintenance History.
          </div>
          <div style={{ color: "#dc2626", fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>maintly.com</div>
        </div>

      </div>
    </>
  );
}
