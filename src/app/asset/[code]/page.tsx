"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ShieldCheck, Calendar, Gauge, Wrench, CheckCircle2, MapPin,
  Hash, Fuel, AlertCircle, ChevronDown, ChevronUp, UserCircle2,
  Plus, BookMarked, LogIn, X, ChevronRight, MessageCircle, Send,
  QrCode, UserPlus, Flag
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDateDMY } from "@/lib/date";
import { getUnitLabel, getUnitShort, formatUnitValue } from "@/lib/units";
import { fetchMechanicPublicProfiles } from "@/lib/mechanicPublicProfile";
import NewAssetModal from "@/components/NewAssetModal";
import ReportIssueModal from "@/components/ReportIssueModal";

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

// Fixed code for the public homepage demo asset ("Demo Generator"). Its
// public page is read-only for everyone: no adding services, no joining a
// workshop, no contacting a mechanic — it's just a live example.
const DEMO_ASSET_CODE = "demogen001";

type AssetData = {
  id: string; asset_type: string; brand: string | null; model: string | null;
  nickname: string | null; vin_serial: string | null; year: number | null;
  plate: string | null; fuel_type: string | null; location: string | null;
  created_by: string | null;
};
type MechanicInfo = { name: string; verified?: boolean | null; profession?: string | null };
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
  const isDemo   = code === DEMO_ASSET_CODE;

  // Asset data
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  // A code that exists in qr_codes but has no asset_id yet — a blank code
  // printed ahead of time and stuck on equipment, or requested from
  // /dashboard/qr-codes but not assigned yet. Distinct from notFound
  // (which means the code doesn't exist in our system at all).
  const [isBlank, setIsBlank]   = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [asset, setAsset]       = useState<AssetData | null>(null);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Auth
  const [mechanicId, setMechanicId]     = useState<string | null>(null);
  const [mechanicName, setMechanicName] = useState("");
  const [isLoggedIn, setIsLoggedIn]     = useState(false);

  // Workshop
  const [inWorkshop, setInWorkshop]         = useState(false);
  const [addingWorkshop, setAddingWorkshop] = useState(false);
  const [workshopDone, setWorkshopDone]     = useState(false);

  // Contact the Maintler
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState("");
  const [contactSent, setContactSent] = useState(false);

  // Report an issue to Maintly (item 6 del pedido de Facu: "Reportes y
  // moderación") — separate concern from the "contact the Maintler" form
  // above: this goes to the admin panel's "Reportes y Moderación" section.
  const [showReportModal, setShowReportModal] = useState(false);

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
        const { data: m } = await supabase.from("mechanics").select("name").eq("id", session.user.id).single();
        if (m) { setMechanicName(m.name); }
      }

      // QR → asset
      const { data: qrRow } = await supabase.from("qr_codes").select("asset_id").eq("code", code).single();
      if (!qrRow) { setNotFound(true); setLoading(false); return; }
      if (!qrRow.asset_id) {
        // Valid code, part of the MaintlyQR World, just not assigned yet.
        setIsBlank(true);
        supabase.from("qr_scans").insert({ code, asset_id: null }).then(({ error }) => {
          if (error) console.error("qr_scans insert failed", error);
        });
        setLoading(false);
        return;
      }

      const { data: assetData } = await supabase
        .from("assets")
        .select("id, asset_type, brand, model, nickname, vin_serial, year, plate, fuel_type, location, created_by")
        .eq("id", qrRow.asset_id).is("deleted_at", null).single();
      if (!assetData) { setNotFound(true); setLoading(false); return; }

      setAsset(assetData as AssetData);

      // Log the scan for the admin Dashboard (fire-and-forget, never blocks the page).
      supabase.from("qr_scans").insert({ code, asset_id: qrRow.asset_id }).then(({ error }) => {
        if (error) console.error("qr_scans insert failed", error);
      });

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
      .select("id, service_date, service_type, km_hours, notes, created_at, mechanic_id")
      .eq("asset_id", assetId)
      .is("deleted_at", null)
      .order("service_date", { ascending: false });
    const rows = (data as (ServiceRecord & { mechanic_id: string | null })[]) ?? [];

    // `mechanics` itself is locked to "read your own row only" — the name/
    // verified/profession shown here for OTHER mechanics comes from the
    // public-safe `mechanic_public_profile` view instead (see lib/mechanicPublicProfile.ts).
    const profiles = await fetchMechanicPublicProfiles(supabase, rows.map((r) => r.mechanic_id));
    setServices(rows.map((r) => ({ ...r, mechanics: r.mechanic_id ? profiles.get(r.mechanic_id) ?? null : null })));
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
    setShowServiceForm(true);
  }

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoggedIn) { router.push(`/login?redirect=/asset/${code}`); return; }
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

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!asset || contactSaving) return;
    setContactError("");

    if (!contactName.trim() || !contactInfo.trim() || !contactMessage.trim()) {
      setContactError("Please fill in your name, contact info, and message.");
      return;
    }
    if (!asset.created_by) {
      setContactError("This asset doesn't have a Maintler to contact yet.");
      return;
    }

    setContactSaving(true);
    const { error } = await supabase.from("messages").insert({
      asset_id: asset.id,
      mechanic_id: asset.created_by,
      sender_name: contactName.trim(),
      sender_contact: contactInfo.trim(),
      body: contactMessage.trim(),
    });
    setContactSaving(false);

    if (error) { setContactError("Couldn't send your message. Please try again."); return; }
    setContactSent(true);
  }

  function closeContactForm() {
    setShowContactForm(false);
    setContactSent(false);
    setContactName(""); setContactInfo(""); setContactMessage(""); setContactError("");
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

  // ── BLANK / UNASSIGNED CODE ──────────────────────────────────────────────
  if (isBlank) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-4">
          <QrCode size={28} className="text-red-500" />
        </div>
        <h1 className="text-[20px] font-black text-zinc-900 mb-2">This QR is part of the MaintlyQR World</h1>
        <p className="text-[14px] text-zinc-500 max-w-xs mb-6">
          {isLoggedIn
            ? "No equipment has been assigned to this code yet. Assign it now to start its maintenance history."
            : "No equipment has been assigned to this code yet. Log in as a Maintler to assign it — it only takes a few seconds."}
        </p>

        {isLoggedIn ? (
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white font-bold px-5 py-3 rounded-xl text-[13px] shadow-lg shadow-red-900/20"
          >
            <Plus size={15} /> Assign Equipment to this QR
          </button>
        ) : (
          <div className="flex flex-col gap-2 w-full max-w-[280px]">
            <button
              onClick={() => router.push(`/login?redirect=/asset/${code}`)}
              className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white font-bold py-3 rounded-xl text-[13px] shadow-lg shadow-red-900/20"
            >
              <LogIn size={14} /> Login to Assign this QR
            </button>
            <button
              onClick={() => router.push("/register")}
              className="flex items-center justify-center gap-2 border border-zinc-200 hover:bg-zinc-50 transition-colors text-zinc-700 font-bold py-3 rounded-xl text-[13px] bg-white"
            >
              <UserPlus size={14} /> Create an Account
            </button>
          </div>
        )}

        <div className="mt-8 flex items-center gap-0">
          <Image src="/images/maintly-logo-full.png" alt="MaintlyQR" width={217} height={64} className="object-contain mt-2" />
        </div>

        {isLoggedIn && mechanicId && (
          <NewAssetModal
            open={showAssignModal}
            onClose={() => setShowAssignModal(false)}
            mechanicId={mechanicId}
            existingCode={code}
            onCreated={() => { setShowAssignModal(false); window.location.reload(); }}
          />
        )}
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
          <Image src="/images/maintly-logo-full.png" alt="MaintlyQR" width={217} height={64} className="object-contain mt-2" />
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
          <Image src="/images/maintly-logo-full.png" alt="MaintlyQR" width={217} height={64} className="object-contain mt-2" />
        </a>
        <div className="flex items-center gap-3">
          {isDemo && (
            <div className="flex items-center gap-1.5 text-[11px] text-blue-600 font-bold bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg">
              Live Example
            </div>
          )}
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
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" /> {mech.profession ? `${mech.profession} Maintler` : "Verified Maintler"}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-400">
                                    <span className="w-1.5 h-1.5 rounded-full border border-zinc-300 shrink-0" /> Maintler
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

        {/* ── CONTACT THE MECHANIC ── */}
        {!isDemo && asset.created_by && asset.created_by !== mechanicId && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <MessageCircle size={16} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-zinc-800">Have a question about this {asset.asset_type}?</p>
              <p className="text-[11px] text-zinc-400">Send a message to the Maintler who manages it.</p>
            </div>
            <button
              onClick={() => setShowContactForm(true)}
              className="shrink-0 text-[12px] font-bold text-blue-600 hover:text-blue-700 border border-blue-200 hover:bg-blue-50 px-3 py-2 rounded-xl transition-colors"
            >
              Message
            </button>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm px-5 py-4 flex items-center gap-3">
          <ShieldCheck size={18} className="text-red-500 shrink-0" />
          <div>
            <p className="text-[12px] font-bold text-zinc-800">Verified by Maintly</p>
            <p className="text-[11px] text-zinc-400">This maintenance record is immutable and tamper-proof.</p>
          </div>
        </div>

        <p className="text-center text-[10px] text-zinc-400 pb-2">
          Powered by <span className="font-bold text-zinc-600">Maintly</span> · Maintenance. Tracked.
        </p>

        {!isDemo && (
          <button
            onClick={() => setShowReportModal(true)}
            className="mx-auto flex items-center gap-1 text-[10px] text-zinc-300 hover:text-red-500 transition-colors pb-4"
          >
            <Flag size={11} /> Report an issue
          </button>
        )}
      </div>

      {/* ══ STICKY ACTION BAR ══════════════════════════════════════════════════ */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-zinc-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
        style={{paddingBottom: 'max(env(safe-area-inset-bottom), 12px)'}}>

        {isDemo ? (
          <div className="max-w-lg mx-auto px-4 pt-3 pb-1 text-center">
            <p className="text-[12px] text-zinc-500 mb-2">
              This is a live example of a Maintly report. Machines and services shown here are for demonstration only.
            </p>
            <a
              href="/register"
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[14px] bg-red-600 hover:bg-red-500 text-white shadow-sm transition-all active:scale-[0.97]"
            >
              Create Your Own — Free
            </a>
          </div>
        ) : isLoggedIn ? (
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
            <p className="text-[11px] text-zinc-400 text-center mb-2">Log in to add services or link this asset to your workshop.</p>
            <button
              onClick={() => router.push(`/login?redirect=/asset/${code}`)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[14px] bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm transition-all active:scale-[0.97]"
            >
              <LogIn size={16} /> Log in as Maintler
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

      {/* ══ CONTACT THE MAINTLER (bottom sheet) ═══════════════════════════════ */}
      {showContactForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeContactForm} />

          <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{paddingBottom: 'max(env(safe-area-inset-bottom), 24px)'}}>

            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-zinc-200 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
              <div>
                <h3 className="text-[16px] font-black text-zinc-900">Message the Maintler</h3>
                <p className="text-[12px] text-zinc-400">{assetName}</p>
              </div>
              <button onClick={closeContactForm}
                className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors">
                <X size={15} className="text-zinc-600" />
              </button>
            </div>

            {contactSent ? (
              <div className="px-5 py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={22} className="text-emerald-500" />
                </div>
                <h4 className="text-[15px] font-black text-zinc-900 mb-1">Message sent!</h4>
                <p className="text-[13px] text-zinc-500 mb-6">The Maintler will get back to you using the contact info you left.</p>
                <button onClick={closeContactForm}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-3 rounded-2xl text-[13px] transition-all">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="px-5 py-5 space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Your name</label>
                  <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. Jane Smith"
                    className="w-full bg-zinc-50 border border-zinc-200 focus:border-blue-400 focus:bg-white rounded-xl px-4 py-3 text-[14px] text-zinc-900 placeholder-zinc-400 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Email or phone</label>
                  <input value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} placeholder="So the Maintler can reply to you"
                    className="w-full bg-zinc-50 border border-zinc-200 focus:border-blue-400 focus:bg-white rounded-xl px-4 py-3 text-[14px] text-zinc-900 placeholder-zinc-400 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Message</label>
                  <textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} rows={4}
                    placeholder="What would you like to ask or request?"
                    className="w-full bg-zinc-50 border border-zinc-200 focus:border-blue-400 focus:bg-white rounded-xl px-4 py-3 text-[14px] text-zinc-900 placeholder-zinc-400 outline-none transition-all resize-none" />
                </div>

                {contactError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <AlertCircle size={14} className="text-red-500 shrink-0" />
                    <p className="text-[12px] text-red-600">{contactError}</p>
                  </div>
                )}

                <button type="submit" disabled={contactSaving}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black py-4 rounded-2xl text-[15px] transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2">
                  {contactSaving
                    ? <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Sending…</>
                    : <><Send size={15} /> Send Message</>
                  }
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <ReportIssueModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        assetId={asset?.id ?? null}
        mechanicId={asset?.created_by ?? null}
        qrCode={code}
      />
    </div>
  );
}
