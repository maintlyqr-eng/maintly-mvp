"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ShieldCheck, Calendar, Gauge, Wrench, CheckCircle2, MapPin,
  Hash, Fuel, AlertCircle, ChevronDown, ChevronUp, UserCircle2,
  Plus, BookMarked, LogIn, X, ChevronRight
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDateDMY } from "@/lib/date";
import { getUnitLabel, getUnitShort, formatUnitValue } from "@/lib/units";

const assetTypeImg: Record<string, string> = {
  automotive: "/images/car.png",
  motorcycle: "/images/moto.png",
  generator:  "/images/generador.png",
  machinery:  "/images/excavator.png",
  marine:     "/images/barco.png",
  aviation:   "/images/avion.png",
};

const typeColors: Record<string, { bg: string; text: string }> = {
  "Oil Change":    { bg: "bg-amber-100",  text: "text-amber-700" },
  Service:         { bg: "bg-blue-100",   text: "text-blue-700" },
  Repair:          { bg: "bg-red-100",    text: "text-red-700" },
  Inspection:      { bg: "bg-purple-100", text: "text-purple-700" },
  "Filter Change": { bg: "bg-green-100",  text: "text-green-700" },
  "Tire Change":   { bg: "bg-cyan-100",   text: "text-cyan-700" },
  "Brake Service": { bg: "bg-orange-100", text: "text-orange-700" },
};

const SERVICE_TYPES = ["Oil Change", "Service", "Repair", "Inspection", "Filter Change", "Tire Change", "Brake Service", "Other"];

type AssetData = {
  id: string; asset_type: string; brand: string | null; model: string | null;
  nickname: string | null; vin_serial: string | null; year: number | null;
  plate: string | null; fuel_type: string | null; location: string | null;
};
type MechanicInfo = { name: string; verified?: boolean | null };
type ServiceRecord = {
  id: string; service_date: string; service_type: string;
  km_hours: number | null; notes: string | null; created_at: string;
  mechanics: MechanicInfo | MechanicInfo[] | null;
};

function formatDate(dateStr: string) {
  return formatDateDMY(dateStr);
}
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function AssetPublicPage() {
  const params   = useParams();
  const router   = useRouter();
  const code     = params?.code as string;

  // Asset data
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [asset, setAsset]       = useState<AssetData | null>(null);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Auth
  const [mechanicId, setMechanicId]     = useState<string | null>(null);
  const [mechanicName, setMechanicName] = useState("");
  const [isLoggedIn, setIsLoggedIn]     = useState(false);
  const [isMechanicActive, setIsMechanicActive] = useState(false);

  // Workshop
  const [inWorkshop, setInWorkshop]         = useState(false);
  const [addingWorkshop, setAddingWorkshop] = useState(false);
  const [workshopDone, setWorkshopDone]     = useState(false);

  // "Become a Mechanic" gate
  const [showMechanicGate, setShowMechanicGate] = useState(false);
  const [activatingMechanic, setActivatingMechanic] = useState(false);

  // Add Service form
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [svcType, setSvcType]   = useState("Service");
  const [svcKm, setSvcKm]       = useState("");
  const [svcNotes, setSvcNotes] = useState("");
  const [savingSvc, setSavingSvc]   = useState(false);
  const [svcError, setSvcError]     = useState("");
  const minKmHours = services.length > 0
    ? services.reduce((max, s) => (s.km_hours != null && s.km_hours > max ? s.km_hours : max), 0)
    : null;

  // Load auth + asset
  useEffect(() => {
    if (!code) { setNotFound(true); setLoading(false); return; }

    async function init() {
      // Auth check (non-blocking)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsLoggedIn(true);
        setMechanicId(session.user.id);
        const { data: m } = await supabase.from("mechanics").select("name, is_mechanic").eq("id", session.user.id).single();
        if (m) { setMechanicName(m.name); setIsMechanicActive(!!m.is_mechanic); }
      }

      // QR → asset
      const { data: qrRow } = await supabase.from("qr_codes").select("asset_id").eq("code", code).single();
      if (!qrRow?.asset_id) { setNotFound(true); setLoading(false); return; }

      const { data: assetData } = await supabase
        .from("assets")
        .select("id, asset_type, brand, model, nickname, vin_serial, year, plate, fuel_type, location")
        .eq("id", qrRow.asset_id).single();
      if (!assetData) { setNotFound(true); setLoading(false); return; }

      setAsset(assetData as AssetData);

      // Log the scan for the admin Dashboard (fire-and-forget, never blocks the page).
      supabase.from("qr_scans").insert({ code, asset_id: qrRow.asset_id }).then(() => {});

      // Load services
      await loadServices(qrRow.asset_id);

      // Check if already in workshop
      if (session) {
        const { count } = await supabase.from("mechanic_assets")
          .select("*", { count: "exact", head: true })
          .eq("mechanic_id", session.user.id).eq("asset_id", qrRow.asset_id);
        if ((count ?? 0) > 0) { setInWorkshop(true); setWorkshopDone(true); }
      }

      setLoading(false);
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function loadServices(assetId: string) {
    const { data } = await supabase
      .from("service_records")
      .select("id, service_date, service_type, km_hours, notes, created_at, mechanics(name, verified)")
      .eq("asset_id", assetId)
      .order("service_date", { ascending: false });
    setServices((data as ServiceRecord[]) ?? []);
  }

  async function handleAddToWorkshop() {
    if (!isLoggedIn) { router.push(`/login?redirect=/asset/${code}`); return; }
    if (!asset || inWorkshop || addingWorkshop) return;
    setAddingWorkshop(true);
    const { error } = await supabase.from("mechanic_assets").upsert(
      { mechanic_id: mechanicId, asset_id: asset.id, qr_code: code },
      { onConflict: "mechanic_id,asset_id", ignoreDuplicates: true }
    );
    setAddingWorkshop(false);
    if (!error) { setInWorkshop(true); setWorkshopDone(true); }
  }

  function handleAddServiceClick() {
    if (!isLoggedIn) { router.push(`/login?redirect=/asset/${code}`); return; }
    if (!isMechanicActive) { setShowMechanicGate(true); return; }
    setShowServiceForm(true);
  }

  async function handleBecomeMechanic() {
    if (!mechanicId || activatingMechanic) return;
    setActivatingMechanic(true);
    const { error } = await supabase.from("mechanics").update({ is_mechanic: true }).eq("id", mechanicId).select("id");
    setActivatingMechanic(false);
    if (error) return;
    setIsMechanicActive(true);
    setShowMechanicGate(false);
    setShowServiceForm(true);
  }

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoggedIn) { router.push(`/login?redirect=/asset/${code}`); return; }
    if (!isMechanicActive) { setShowServiceForm(false); setShowMechanicGate(true); return; }
    if (!asset || savingSvc) return;
    setSvcError("");

    if (svcKm && minKmHours != null && parseFloat(svcKm) < minKmHours) {
      setSvcError(`${getUnitLabel(asset.asset_type)} can't be lower than the last recorded value (${minKmHours.toLocaleString()}).`);
      return;
    }

    setSavingSvc(true);
    const { error } = await supabase.from("service_records").insert({
      asset_id: asset.id,
      mechanic_id: mechanicId,
      service_date: todayStr(),
      service_type: svcType,
      km_hours: svcKm ? parseFloat(svcKm) : null,
      notes: svcNotes.trim() || null,
    });
    setSavingSvc(false);
    if (error) { setSvcError("Error saving. Please try again."); return; }

    // Also add to workshop if not already there
    if (!inWorkshop) {
      await supabase.from("mechanic_assets").upsert(
        { mechanic_id: mechanicId, asset_id: asset.id, qr_code: code },
        { onConflict: "mechanic_id,asset_id", ignoreDuplicates: true }
      );
      setInWorkshop(true); setWorkshopDone(true);
    }

    // Refresh services
    await loadServices(asset.id);
    setShowServiceForm(false);
    setSvcType("Service"); setSvcKm(""); setSvcNotes("");
  }

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 text-[14px]">Loading maintenance history...</p>
      </div>
    );
  }

  // ── NOT FOUND ──────────────────────────────────────────────────────────────
  if (notFound || !asset) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-4">
          <AlertCircle size={28} className="text-red-500" />
        </div>
        <h1 className="text-[20px] font-black text-zinc-900 mb-2">QR Code Not Found</h1>
        <p className="text-[14px] text-zinc-500 max-w-xs">This QR code doesn&apos;t match any asset in our system.</p>
        <div className="mt-8 flex items-center gap-0">
          <Image src="/images/qr-gear.png" alt="Maintly" width={64} height={64} className="object-contain mt-2" />
          <Image src="/images/Maintly.png" alt="Maintly" width={140} height={140} className="object-contain w-[140px] h-auto -ml-4 mt-2" />
        </div>
      </div>
    );
  }

  const assetName = asset.nickname || [asset.brand, asset.model].filter(Boolean).join(" ") || "Asset";
  const assetImg  = assetTypeImg[asset.asset_type] ?? "/images/car.png";

  return (
    <div className="min-h-screen bg-zinc-50 pb-32">

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <a href="/" className="flex items-center">
          <Image src="/images/qr-gear.png" alt="Maintly" width={64} height={64} className="object-contain mt-2" />
          <Image src="/images/Maintly.png" alt="Maintly" width={140} height={140} className="object-contain w-[140px] h-auto -ml-4 mt-2" />
        </a>
        <div className="flex items-center gap-3">
          <a href={`/asset/${code}/report`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors">
            📄 Report
          </a>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
            <ShieldCheck size={13} className="text-red-500" />
            Verified
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* ── ASSET CARD ── */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 px-5 py-5 flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 overflow-hidden">
              <Image src={assetImg} alt={assetName} width={44} height={44} className="object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-zinc-400 tracking-[0.15em] uppercase mb-0.5">
                {asset.asset_type.charAt(0).toUpperCase() + asset.asset_type.slice(1)}
              </p>
              <h1 className="text-[20px] font-black text-white leading-tight truncate">{assetName}</h1>
              {asset.year && <p className="text-[12px] text-zinc-400 mt-0.5">{asset.year}</p>}
            </div>
          </div>

          <div className="px-5 py-4 grid grid-cols-2 gap-3">
            {asset.vin_serial && (
              <div className="flex items-start gap-2">
                <Hash size={13} className="text-zinc-400 mt-0.5 shrink-0" />
                <div><p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">VIN / Serial</p>
                  <p className="text-[12px] font-mono text-zinc-700 font-semibold">{asset.vin_serial}</p></div>
              </div>
            )}
            {asset.plate && (
              <div className="flex items-start gap-2">
                <Hash size={13} className="text-zinc-400 mt-0.5 shrink-0" />
                <div><p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">Plate</p>
                  <p className="text-[12px] font-mono text-zinc-700 font-semibold">{asset.plate}</p></div>
              </div>
            )}
            {asset.fuel_type && (
              <div className="flex items-start gap-2">
                <Fuel size={13} className="text-zinc-400 mt-0.5 shrink-0" />
                <div><p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">Fuel</p>
                  <p className="text-[12px] text-zinc-700 font-semibold">{asset.fuel_type}</p></div>
              </div>
            )}
            {asset.location && (
              <div className="flex items-start gap-2">
                <MapPin size={13} className="text-zinc-400 mt-0.5 shrink-0" />
                <div><p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">Location</p>
                  <p className="text-[12px] text-zinc-700 font-semibold">{asset.location}</p></div>
              </div>
            )}
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-3 text-center">
            <p className="text-[22px] font-black text-zinc-900">{services.length}</p>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide mt-0.5">Services</p>
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-3 text-center">
            <p className="text-[22px] font-black text-zinc-900">
              {services.length > 0 ? new Date(services[services.length - 1].service_date + "T00:00:00").getFullYear() : "—"}
            </p>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide mt-0.5">Since</p>
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-3 text-center">
            <p className="text-[22px] font-black text-zinc-900">
              {services[0]?.km_hours != null ? services[0].km_hours.toLocaleString() : "—"}
            </p>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide mt-0.5">Last Reading</p>
          </div>
        </div>

        {/* ── SERVICE HISTORY ── */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-[15px] font-black text-zinc-900">Maintenance History</h2>
            <span className="text-[11px] font-bold text-zinc-400">{services.length} records</span>
          </div>

          {services.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-zinc-100 bg-zinc-50 mb-3">
                <Wrench size={20} className="text-zinc-300" />
              </div>
              <p className="text-[13px] text-zinc-400">No service records yet.</p>
              <p className="text-[12px] text-zinc-300 mt-1">Be the first to log a service.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {services.map((svc, idx) => {
                const tc = typeColors[svc.service_type] ?? { bg: "bg-zinc-100", text: "text-zinc-700" };
                const isExpanded = expandedId === svc.id;
                const isLatest   = idx === 0;
                return (
                  <div key={svc.id} className="px-5 py-4">
                    <button className="w-full text-left" onClick={() => setExpandedId(isExpanded ? null : svc.id)}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isLatest ? "bg-red-600" : "bg-zinc-100"}`}>
                          {isLatest ? <CheckCircle2 size={15} className="text-white" /> : <Wrench size={13} className="text-zinc-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[11px] font-bold px-2 py-[2px] rounded-full ${tc.bg} ${tc.text}`}>{svc.service_type}</span>
                            {isLatest && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-[2px] rounded-full">Latest</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Calendar size={11} /> {formatDate(svc.service_date)}</span>
                            {svc.km_hours != null && <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Gauge size={11} /> {svc.km_hours.toLocaleString()} {getUnitShort(asset.asset_type)}</span>}
                          </div>
                          {(() => {
                            const mech = Array.isArray(svc.mechanics) ? svc.mechanics[0] : svc.mechanics;
                            return mech?.name ? (
                              <div className="flex items-center gap-1.5 mt-1">
                                <UserCircle2 size={11} className="text-zinc-400 shrink-0" />
                                <span className="text-[11px] text-zinc-400">{mech.name}</span>
                                {mech.verified ? (
                                  <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" /> Verified Mechanic
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-400">
                                    <span className="w-1.5 h-1.5 rounded-full border border-zinc-300 shrink-0" /> Community Mechanic
                                  </span>
                                )}
                              </div>
                            ) : null;
                          })()}
                        </div>
                        <div className="text-zinc-300 shrink-0">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="mt-3 ml-11 bg-zinc-50 rounded-xl px-4 py-3 border border-zinc-100">
                        {svc.notes
                          ? <><p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide mb-1">Notes</p><p className="text-[13px] text-zinc-700 leading-relaxed">{svc.notes}</p></>
                          : <p className="text-[12px] text-zinc-400 italic">No notes for this service.</p>
                        }
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm px-5 py-4 flex items-center gap-3">
          <ShieldCheck size={18} className="text-red-500 shrink-0" />
          <div>
            <p className="text-[12px] font-bold text-zinc-800">Verified by Maintly</p>
            <p className="text-[11px] text-zinc-400">This maintenance record is immutable and tamper-proof.</p>
          </div>
        </div>

        <p className="text-center text-[10px] text-zinc-400 pb-4">
          Powered by <span className="font-bold text-zinc-600">Maintly</span> · Maintenance. Tracked.
        </p>
      </div>

      {/* ══ STICKY ACTION BAR ══════════════════════════════════════════════════ */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-zinc-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
        style={{paddingBottom: 'max(env(safe-area-inset-bottom), 12px)'}}>

        {isLoggedIn ? (
          <div className="max-w-lg mx-auto px-4 pt-3 pb-1 space-y-2">

            {/* Mechanic greeting */}
            <p className="text-[11px] text-zinc-400 font-medium text-center">
              Logged in as <span className="font-bold text-zinc-700">{mechanicName}</span>
            </p>

            <div className="flex gap-3">
              {/* Add to Workshop */}
              <button
                onClick={handleAddToWorkshop}
                disabled={workshopDone || addingWorkshop}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[13px] transition-all active:scale-[0.97] ${
                  workshopDone
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                    : "bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm"
                }`}
              >
                {addingWorkshop
                  ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  : workshopDone
                    ? <><CheckCircle2 size={15} /> In Workshop</>
                    : <><BookMarked size={15} /> Add to Workshop</>
                }
              </button>

              {/* Add Service */}
              <button
                onClick={handleAddServiceClick}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[13px] bg-red-600 hover:bg-red-500 text-white shadow-sm transition-all active:scale-[0.97]"
              >
                <Plus size={15} /> Add Service
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-lg mx-auto px-4 pt-3 pb-1">
            <p className="text-[11px] text-zinc-400 text-center mb-2">Are you a mechanic? Log in to add services or link this asset to your workshop.</p>
            <button
              onClick={() => router.push(`/login?redirect=/asset/${code}`)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[14px] bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm transition-all active:scale-[0.97]"
            >
              <LogIn size={16} /> Log in as Mechanic
              <ChevronRight size={15} className="opacity-60" />
            </button>
          </div>
        )}
      </div>

      {/* ══ ADD SERVICE FORM (bottom sheet) ════════════════════════════════════ */}
      {showServiceForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowServiceForm(false)} />

          {/* Sheet */}
          <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{paddingBottom: 'max(env(safe-area-inset-bottom), 24px)'}}>

            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-zinc-200 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
              <div>
                <h3 className="text-[16px] font-black text-zinc-900">Log a Service</h3>
                <p className="text-[12px] text-zinc-400">{assetName}</p>
              </div>
              <button onClick={() => setShowServiceForm(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors">
                <X size={15} className="text-zinc-600" />
              </button>
            </div>

            <form onSubmit={handleAddService} className="px-5 py-5 space-y-4">

              {/* Service Type */}
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Service Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {SERVICE_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => setSvcType(t)}
                      className={`py-2.5 px-3 rounded-xl text-[12px] font-bold border transition-all text-left ${
                        svcType === t
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:border-zinc-300"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date (auto) */}
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 text-[12px] text-zinc-500">
                Service date will be recorded automatically as today, {formatDateDMY(todayStr())}.
              </div>

              {/* KM / Hours */}
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">{getUnitLabel(asset.asset_type)} <span className="text-zinc-300 normal-case font-normal">(optional)</span></label>
                <input type="number" min={minKmHours ?? 0} value={svcKm} onChange={e => setSvcKm(e.target.value)}
                  placeholder="e.g. 85000"
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-red-400 focus:bg-white rounded-xl px-4 py-3 text-[14px] text-zinc-900 placeholder-zinc-400 outline-none transition-all" />
                {minKmHours != null && (
                  <p className="text-[11px] text-zinc-400 mt-1.5">Last recorded: {formatUnitValue(minKmHours, asset.asset_type)}. Can&apos;t be lower than that.</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Notes <span className="text-zinc-300 normal-case font-normal">(optional)</span></label>
                <textarea value={svcNotes} onChange={e => setSvcNotes(e.target.value)} rows={3}
                  placeholder="Parts replaced, observations, recommendations..."
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-red-400 focus:bg-white rounded-xl px-4 py-3 text-[14px] text-zinc-900 placeholder-zinc-400 outline-none transition-all resize-none" />
              </div>

              {svcError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <AlertCircle size={14} className="text-red-500 shrink-0" />
                  <p className="text-[12px] text-red-600">{svcError}</p>
                </div>
              )}

              <button type="submit" disabled={savingSvc}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-black py-4 rounded-2xl text-[15px] transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2">
                {savingSvc
                  ? <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Saving…</>
                  : <><Plus size={16} /> Save Service Record</>
                }
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══ BECOME A MECHANIC GATE ═══════════════════════════════════════════════ */}
      {showMechanicGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <Wrench size={20} className="text-red-500" />
            </div>
            <h3 className="text-[16px] font-black text-zinc-900 mb-2">Become a Mechanic</h3>
            <p className="text-[13px] text-zinc-500 mb-5">To add maintenance records, your account needs to be activated as a mechanic.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowMechanicGate(false)}
                className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-3 rounded-xl text-[13px] hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBecomeMechanic}
                disabled={activatingMechanic}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-[13px] transition-all"
              >
                {activatingMechanic ? "Activating…" : "Become a Mechanic"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
