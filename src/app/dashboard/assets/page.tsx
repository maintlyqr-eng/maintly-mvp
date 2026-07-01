"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings, Bell, ChevronDown, Plus, X, Copy, Check, LogOut, Crown, Wrench
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/dashboard" },
  { icon: FileText, label: "My Services", href: "/dashboard/services" },
  { icon: Box, label: "Assets", href: "/dashboard/assets" },
  { icon: QrCode, label: "QR Codes", href: "/dashboard/assets" },
  { icon: Users, label: "Customers", href: "#" },
  { icon: BarChart3, label: "Reports", href: "#" },
  { icon: CalendarIcon, label: "Calendar", href: "#" },
  { icon: Mail, label: "Messages", href: "#" },
  { icon: FolderOpen, label: "Document Library", href: "#" },
  { icon: Settings, label: "Settings", href: "#" },
];

const serviceTypeOptions = ["Oil Change", "Service", "Repair", "Inspection", "Filter Change", "Tire Change", "Brake Service", "Other"];

const assetTypeImg: Record<string, string> = {
  automotive: "/images/pickup.png",
  motorcycle: "/images/moto.png",
  generator: "/images/generador.png",
  machinery: "/images/excavator.png",
  marine: "/images/barco.png",
  aviation: "/images/avion.png",
};

const assetTypeOptions = [
  { value: "automotive", label: "Automotive" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "generator", label: "Generator" },
  { value: "machinery", label: "Machinery" },
  { value: "marine", label: "Marine" },
  { value: "aviation", label: "Aviation" },
];

const fuelTypeOptions = ["Gasoline", "Diesel", "Electric", "Hybrid", "Other"];

type QrRow = { code: string };

type AssetRow = {
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
  created_at: string;
  qr_codes: QrRow[] | QrRow | null;
};

function getQrCode(row: AssetRow): string | null {
  if (!row.qr_codes) return null;
  const q = Array.isArray(row.qr_codes) ? row.qr_codes[0] : row.qr_codes;
  return q?.code ?? null;
}

function assetDisplayName(a: AssetRow) {
  return a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || "Unnamed asset";
}

function genCode() {
  const raw = (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36);
  return raw.replace(/-/g, "").slice(0, 10);
}

export default function AssetsPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [mechanicId, setMechanicId] = useState("");
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  // New Asset modal
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [copiedCode, setCopiedCode] = useState("");

  const [assetType, setAssetType] = useState("automotive");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [nickname, setNickname] = useState("");
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [plate, setPlate] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [location, setLocation] = useState("");

  // Add Service modal
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [svcAssetId, setSvcAssetId] = useState("");
  const [svcType, setSvcType] = useState("Oil Change");
  const [svcDate, setSvcDate] = useState(new Date().toISOString().slice(0, 10));
  const [svcKmHours, setSvcKmHours] = useState("");
  const [svcNotes, setSvcNotes] = useState("");
  const [svcSaving, setSvcSaving] = useState(false);
  const [svcError, setSvcError] = useState("");

  async function loadAssets(uid: string) {
    setLoadingAssets(true);
    const { data } = await supabase
      .from("assets")
      .select(
        "id, asset_type, brand, model, nickname, vin_serial, year, plate, fuel_type, location, created_at, qr_codes(code)"
      )
      .eq("created_by", uid)
      .order("created_at", { ascending: false });
    setAssets((data as unknown as AssetRow[]) ?? []);
    setLoadingAssets(false);
  }

  useEffect(() => {
    let active = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      if (!active) return;

      setMechanicId(session.user.id);
      setMechanicEmail(session.user.email ?? "");

      const { data: mechanic } = await supabase
        .from("mechanics")
        .select("name")
        .eq("id", session.user.id)
        .single();
      if (active && mechanic) setMechanicName(mechanic.name);

      await loadAssets(session.user.id);
      if (active) setCheckingAuth(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  function resetForm() {
    setAssetType("automotive");
    setBrand("");
    setModel("");
    setNickname("");
    setVin("");
    setYear("");
    setPlate("");
    setFuelType("");
    setLocation("");
    setFormError("");
  }

  function openAddService(assetId: string) {
    setSvcAssetId(assetId);
    setSvcType("Oil Change");
    setSvcDate(new Date().toISOString().slice(0, 10));
    setSvcKmHours("");
    setSvcNotes("");
    setSvcError("");
    setShowServiceForm(true);
  }

  async function handleCreateAsset(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!brand.trim() || !model.trim()) {
      setFormError("Brand and model are required.");
      return;
    }

    setSaving(true);

    const { data: newAsset, error: assetError } = await supabase
      .from("assets")
      .insert({
        created_by: mechanicId,
        asset_type: assetType,
        brand: brand.trim(),
        model: model.trim(),
        nickname: nickname.trim() || null,
        vin_serial: vin.trim() || null,
        year: year ? parseInt(year, 10) : null,
        plate: plate.trim() || null,
        fuel_type: fuelType || null,
        location: location.trim() || null,
      })
      .select()
      .single();

    if (assetError || !newAsset) {
      setFormError(assetError?.message ?? "Could not create the asset.");
      setSaving(false);
      return;
    }

    const code = genCode();
    const { error: qrError } = await supabase
      .from("qr_codes")
      .insert({ code, asset_id: newAsset.id, created_by: mechanicId });

    setSaving(false);

    if (qrError) {
      setFormError("Asset created, but QR could not be generated: " + qrError.message);
      await loadAssets(mechanicId);
      return;
    }

    resetForm();
    setShowForm(false);
    await loadAssets(mechanicId);
  }

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    setSvcError("");

    if (!svcAssetId) {
      setSvcError("No asset selected.");
      return;
    }

    setSvcSaving(true);

    const { error } = await supabase.from("service_records").insert({
      mechanic_id: mechanicId,
      asset_id: svcAssetId,
      service_type: svcType,
      service_date: svcDate,
      km_hours: svcKmHours ? parseFloat(svcKmHours) : null,
      notes: svcNotes.trim() || null,
    });

    setSvcSaving(false);

    if (error) {
      setSvcError(error.message);
      return;
    }

    setShowServiceForm(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function publicUrl(code: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/asset/${code}`;
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(publicUrl(code));
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(""), 1500);
    } catch {
      // ignore
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">Loading...</p>
      </div>
    );
  }

  const initials =
    mechanicName
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ME";

  return (
    <div className="min-h-screen bg-zinc-50 flex">

      {/* ════ SIDEBAR ════ */}
      <aside className="w-[230px] bg-white border-r border-zinc-200 flex flex-col shrink-0">
        <Link href="/" className="flex flex-col items-center px-4 pt-2 pb-0">
          <Image src="/images/qr-gear.png" alt="Maintly logo" width={1080} height={1080} className="object-contain w-[92px] h-auto" />
          <Image src="/images/Maintly.png" alt="Maintly" width={1080} height={1080} className="object-contain w-[200px] h-auto -mt-10" />
        </Link>

        <nav className="flex-1 px-3 -mt-4">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-[9px] rounded-lg mb-1 text-[13px] font-medium transition-colors ${
                item.label === "Assets"
                  ? "bg-red-50 text-red-600 border-l-[3px] border-red-600 -ml-[1px]"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mx-3 mb-3 p-4 rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 border border-zinc-200">
          <div className="flex items-center gap-1.5 text-amber-500 mb-1">
            <Crown size={14} />
            <span className="text-[12px] font-bold text-zinc-800">Go Premium</span>
          </div>
          <p className="text-[10px] text-zinc-500 leading-relaxed mb-3">Unlock advanced reports, custom branding and more.</p>
          <button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-bold py-2 rounded-lg transition-colors">Upgrade Now</button>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-4 py-3 border-t border-zinc-200 hover:bg-zinc-50 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[12px] shrink-0">{initials}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-zinc-800 leading-tight truncate">{mechanicName || mechanicEmail}</p>
            <p className="text-[10px] text-zinc-400 leading-tight">Log out</p>
          </div>
          <LogOut size={14} className="text-zinc-300" />
        </button>
      </aside>

      {/* ════ MAIN ════ */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="flex items-center justify-between px-7 py-4 bg-white border-b border-zinc-200">
          <div>
            <h1 className="text-[20px] font-black text-zinc-900">Assets &amp; QR Codes</h1>
            <p className="text-[12px] text-zinc-400">Create assets, generate QR codes and log services.</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative text-zinc-500 hover:text-zinc-800 transition-colors">
              <Bell size={19} />
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-zinc-200">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[13px]">{initials}</div>
              <div>
                <p className="text-[12px] font-bold text-zinc-800 leading-tight">{mechanicName || mechanicEmail}</p>
                <p className="text-[10px] text-zinc-400 leading-tight">Mechanic</p>
              </div>
              <ChevronDown size={14} className="text-zinc-400" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-7">

          <div className="flex justify-end mb-5 -mt-2">
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white text-[13px] font-bold px-4 py-[10px] rounded-xl shadow-sm"
            >
              <Plus size={15} /> New Asset
            </button>
          </div>

          {loadingAssets ? (
            <p className="text-[13px] text-zinc-400 text-center py-12">Loading your assets...</p>
          ) : assets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-12 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-red-100 bg-red-50 mb-4">
                <Box size={24} className="text-red-600" />
              </div>
              <h2 className="text-[16px] font-black text-zinc-900 mb-1">No assets yet</h2>
              <p className="text-[13px] text-zinc-500 mb-5">Create your first asset to generate its QR code and start logging services.</p>
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 transition-all text-white text-[13px] font-bold px-5 py-[11px] rounded-xl"
              >
                <Plus size={15} /> New Asset
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {assets.map((a) => {
                const code = getQrCode(a);
                const label = assetDisplayName(a);
                const img = assetTypeImg[a.asset_type] ?? "/images/pickup.png";
                return (
                  <div key={a.id} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 flex flex-col">
                    {/* Asset header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                        <Image src={img} alt={label} width={36} height={36} className="object-contain" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-zinc-900 leading-tight truncate">{label}</p>
                        <p className="text-[11px] text-zinc-400 leading-tight">{a.year ? a.year + " · " : ""}{a.plate || a.vin_serial || "—"}</p>
                      </div>
                    </div>

                    {/* Add Service button */}
                    <button
                      onClick={() => openAddService(a.id)}
                      className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 active:scale-[0.98] transition-all text-[12px] font-bold py-[8px] rounded-xl mb-3"
                    >
                      <Wrench size={13} /> Add Service
                    </button>

                    {/* QR section */}
                    {code ? (
                      <div className="flex items-center gap-4 pt-3 border-t border-zinc-100">
                        <div className="w-20 h-20 rounded-lg border border-zinc-100 bg-white p-1 shrink-0">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(publicUrl(code))}`}
                            alt={`QR ${code}`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-zinc-400 mb-1">Public link</p>
                          <p className="text-[11px] font-mono text-zinc-600 truncate mb-2">/asset/{code}</p>
                          <button
                            onClick={() => copyLink(code)}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-red-600 hover:text-red-700"
                          >
                            {copiedCode === code ? <Check size={12} /> : <Copy size={12} />}
                            {copiedCode === code ? "Copied" : "Copy link"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-600 pt-3 border-t border-zinc-100">QR code not generated.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-center text-[11px] text-zinc-400 mt-8">© 2026 Maintly. All rights reserved.</p>
        </div>
      </div>

      {/* ════ NEW ASSET MODAL ════ */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <h2 className="text-[16px] font-black text-zinc-900">New Asset</h2>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateAsset} className="px-6 py-5">
              <div className="mb-4">
                <label className="text-[12px] font-bold text-zinc-700">Asset type</label>
                <select value={assetType} onChange={(e) => setAssetType(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500">
                  {assetTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">Brand *</label>
                  <input type="text" required value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Ford" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">Model *</label>
                  <input type="text" required value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Ranger XLT" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
              </div>

              <div className="mb-4">
                <label className="text-[12px] font-bold text-zinc-700">Nickname (optional)</label>
                <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Work Truck #2" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">VIN / Serial</label>
                  <input type="text" value={vin} onChange={(e) => setVin(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">Year</label>
                  <input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">Plate</label>
                  <input type="text" value={plate} onChange={(e) => setPlate(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">Fuel type</label>
                  <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500">
                    <option value="">—</option>
                    {fuelTypeOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div className="mb-5">
                <label className="text-[12px] font-bold text-zinc-700">Location (optional)</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Main shop" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
              </div>

              {formError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{formError}</div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                  {saving ? "Creating..." : "Create & Generate QR"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ ADD SERVICE MODAL ════ */}
      {showServiceForm && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                  <Wrench size={15} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-[16px] font-black text-zinc-900">Log New Service</h2>
                  <p className="text-[11px] text-zinc-400 leading-none">{assetDisplayName(assets.find(a => a.id === svcAssetId)!)}</p>
                </div>
              </div>
              <button onClick={() => setShowServiceForm(false)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>

            <form onSubmit={handleAddService} className="px-6 py-5 space-y-4">
              <div>
                <label className="text-[12px] font-bold text-zinc-700">Service type *</label>
                <select value={svcType} onChange={(e) => setSvcType(e.target.value)} required className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500">
                  {serviceTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">Date *</label>
                  <input type="date" required value={svcDate} onChange={(e) => setSvcDate(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">Km / Hours</label>
                  <input type="number" min="0" step="0.1" value={svcKmHours} onChange={(e) => setSvcKmHours(e.target.value)} placeholder="e.g. 45000" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold text-zinc-700">Notes (optional)</label>
                <textarea rows={3} value={svcNotes} onChange={(e) => setSvcNotes(e.target.value)} placeholder="Parts used, observations, next service..." className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 resize-none" />
              </div>

              {svcError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{svcError}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowServiceForm(false)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">Cancel</button>
                <button type="submit" disabled={svcSaving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                  {svcSaving ? "Saving..." : "Save Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
