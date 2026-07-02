"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings, Bell, ChevronDown, Plus, X, Copy, Check, LogOut, Crown,
  Wrench, Pencil, History, CheckCircle2, UserCircle2, Camera, Gauge
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
  generator:  "/images/generador.png",
  machinery:  "/images/excavator.png",
  marine:     "/images/barco.png",
  aviation:   "/images/avion.png",
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

const typeColors: Record<string, { bg: string; text: string }> = {
  "Oil Change":    { bg: "bg-amber-100",  text: "text-amber-700" },
  Service:         { bg: "bg-blue-100",   text: "text-blue-700" },
  Repair:          { bg: "bg-red-100",    text: "text-red-700" },
  Inspection:      { bg: "bg-purple-100", text: "text-purple-700" },
  "Filter Change": { bg: "bg-green-100",  text: "text-green-700" },
  "Tire Change":   { bg: "bg-cyan-100",   text: "text-cyan-700" },
  "Brake Service": { bg: "bg-orange-100", text: "text-orange-700" },
};

type QrRow = { code: string };

type MechanicInfo = { name: string };

type ServiceRecord = {
  id: string;
  service_date: string;
  service_type: string;
  km_hours: number | null;
  notes: string | null;
  mechanics: MechanicInfo | MechanicInfo[] | null;
};

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
  photo_url: string | null;
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

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function AssetsPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [mechanicId, setMechanicId] = useState("");
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  // ── New Asset modal ──
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");

  // ── Add Service modal ──
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [svcAssetId, setSvcAssetId] = useState("");
  const [svcType, setSvcType] = useState("Oil Change");
  const [svcDate, setSvcDate] = useState(new Date().toISOString().slice(0, 10));
  const [svcKmHours, setSvcKmHours] = useState("");
  const [svcNotes, setSvcNotes] = useState("");
  const [svcSaving, setSvcSaving] = useState(false);
  const [svcError, setSvcError] = useState("");

  // ── History modal ──
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyAssetName, setHistoryAssetName] = useState("");
  const [historyRecords, setHistoryRecords] = useState<ServiceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Edit Asset modal ──
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [editVin, setEditVin] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editPlate, setEditPlate] = useState("");
  const [editFuelType, setEditFuelType] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string>("");

  async function loadAssets(uid: string) {
    setLoadingAssets(true);
    const { data } = await supabase
      .from("assets")
      .select(
        "id, asset_type, brand, model, nickname, vin_serial, year, plate, fuel_type, location, photo_url, created_at, qr_codes(code)"
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
    setPhotoFile(null);
    setPhotoPreview("");
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

  async function openHistory(a: AssetRow) {
    setHistoryAssetName(assetDisplayName(a));
    setHistoryRecords([]);
    setHistoryLoading(true);
    setShowHistoryModal(true);
    const { data } = await supabase
      .from("service_records")
      .select("id, service_date, service_type, km_hours, notes, mechanics(name)")
      .eq("asset_id", a.id)
      .order("service_date", { ascending: false });
    setHistoryRecords((data as unknown as ServiceRecord[]) ?? []);
    setHistoryLoading(false);
  }

  function openEdit(a: AssetRow) {
    setEditingAsset(a);
    setEditBrand(a.brand ?? "");
    setEditModel(a.model ?? "");
    setEditNickname(a.nickname ?? "");
    setEditVin(a.vin_serial ?? "");
    setEditYear(a.year ? String(a.year) : "");
    setEditPlate(a.plate ?? "");
    setEditFuelType(a.fuel_type ?? "");
    setEditLocation(a.location ?? "");
    setEditPhotoFile(null);
    setEditPhotoPreview(a.photo_url ?? "");
    setEditError("");
    setShowEditForm(true);
  }

  async function uploadPhoto(file: File, assetId: string): Promise<string | null> {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${assetId}.${ext}`;
    const { error } = await supabase.storage
      .from("asset-photos")
      .upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("asset-photos").getPublicUrl(path);
    return data.publicUrl;
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

    // Upload photo if provided
    if (photoFile) {
      const photoUrl = await uploadPhoto(photoFile, newAsset.id);
      if (photoUrl) {
        await supabase.from("assets").update({ photo_url: photoUrl }).eq("id", newAsset.id);
      }
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

  async function handleEditAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAsset) return;
    setEditError("");
    setEditSaving(true);

    let photoUrl = editingAsset.photo_url;
    if (editPhotoFile) {
      const url = await uploadPhoto(editPhotoFile, editingAsset.id);
      if (url) photoUrl = url;
    }

    const { error } = await supabase
      .from("assets")
      .update({
        brand: editBrand.trim() || null,
        model: editModel.trim() || null,
        nickname: editNickname.trim() || null,
        vin_serial: editVin.trim() || null,
        year: editYear ? parseInt(editYear, 10) : null,
        plate: editPlate.trim() || null,
        fuel_type: editFuelType || null,
        location: editLocation.trim() || null,
        photo_url: photoUrl,
      })
      .eq("id", editingAsset.id);

    setEditSaving(false);

    if (error) {
      setEditError(error.message);
      return;
    }

    setShowEditForm(false);
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
        <Link href="/" className="flex items-center px-4 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/qr-gear.png" alt="Maintly" style={{width: 52, height: 52, objectFit: "contain"}} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/Maintly.png" alt="" style={{width: 110, objectFit: "contain", marginLeft: -12}} />
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
                const imgSrc = assetTypeImg[a.asset_type] ?? "/images/pickup.png";
                return (
                  <div key={a.id} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 flex flex-col">
                    {/* Asset header */}
                    <div className="flex items-center gap-3 mb-3">
                      {/* Photo or icon */}
                      <div className="w-12 h-12 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {a.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.photo_url} alt={label} className="w-full h-full object-cover" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imgSrc} alt={label} className="w-9 h-9 object-contain" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-zinc-900 leading-tight truncate">{label}</p>
                        <p className="text-[11px] text-zinc-400 leading-tight">{a.year ? a.year + " · " : ""}{a.plate || a.vin_serial || "—"}</p>
                      </div>
                      {/* Edit button */}
                      <button
                        onClick={() => openEdit(a)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                        title="Edit asset"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button
                        onClick={() => openHistory(a)}
                        className="flex items-center justify-center gap-1.5 border border-zinc-200 text-zinc-600 hover:bg-zinc-50 active:scale-[0.98] transition-all text-[12px] font-bold py-[8px] rounded-xl"
                      >
                        <History size={13} /> History
                      </button>
                      <button
                        onClick={() => openAddService(a.id)}
                        className="flex items-center justify-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 active:scale-[0.98] transition-all text-[12px] font-bold py-[8px] rounded-xl"
                      >
                        <Wrench size={13} /> Add Service
                      </button>
                    </div>

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
                            className="flex items-center gap-1.5 text-[11px] font-bold text-red-600 hover:text-red-700 mb-2"
                          >
                            {copiedCode === code ? <Check size={12} /> : <Copy size={12} />}
                            {copiedCode === code ? "Copied" : "Copy link"}
                          </button>
                          <a
                            href={`/asset/${code}/report`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-800"
                          >
                            <FileText size={12} /> View Report
                          </a>
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

              <div className="mb-4">
                <label className="text-[12px] font-bold text-zinc-700">Location (optional)</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Main shop" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
              </div>

              {/* Photo upload */}
              <div className="mb-5">
                <label className="text-[12px] font-bold text-zinc-700">Photo (optional)</label>
                <div className="mt-1 flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer border border-zinc-200 hover:border-red-400 rounded-xl px-4 py-[10px] text-[12px] font-bold text-zinc-600 hover:text-red-600 transition-colors">
                    <Camera size={14} />
                    {photoFile ? "Change photo" : "Upload photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setPhotoFile(f);
                        if (f) setPhotoPreview(URL.createObjectURL(f));
                        else setPhotoPreview("");
                      }}
                    />
                  </label>
                  {photoPreview && (
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-zinc-200 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(""); }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-zinc-900/60 rounded-full flex items-center justify-center text-white"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  )}
                </div>
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

      {/* ════ EDIT ASSET MODAL ════ */}
      {showEditForm && editingAsset && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div>
                <h2 className="text-[16px] font-black text-zinc-900">Edit Asset</h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">{assetDisplayName(editingAsset)}</p>
              </div>
              <button onClick={() => setShowEditForm(false)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>

            <form onSubmit={handleEditAsset} className="px-6 py-5">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">Brand</label>
                  <input type="text" value={editBrand} onChange={(e) => setEditBrand(e.target.value)} placeholder="e.g. Ford" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">Model</label>
                  <input type="text" value={editModel} onChange={(e) => setEditModel(e.target.value)} placeholder="e.g. Ranger XLT" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
              </div>

              <div className="mb-4">
                <label className="text-[12px] font-bold text-zinc-700">Nickname</label>
                <input type="text" value={editNickname} onChange={(e) => setEditNickname(e.target.value)} placeholder="e.g. Work Truck #2" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">VIN / Serial</label>
                  <input type="text" value={editVin} onChange={(e) => setEditVin(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">Year</label>
                  <input type="number" value={editYear} onChange={(e) => setEditYear(e.target.value)} placeholder="2024" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">Plate</label>
                  <input type="text" value={editPlate} onChange={(e) => setEditPlate(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">Fuel type</label>
                  <select value={editFuelType} onChange={(e) => setEditFuelType(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500">
                    <option value="">—</option>
                    {fuelTypeOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-[12px] font-bold text-zinc-700">Location</label>
                <input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="e.g. Main shop" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
              </div>

              {/* Photo upload / preview */}
              <div className="mb-5">
                <label className="text-[12px] font-bold text-zinc-700">Photo</label>
                <div className="mt-1 flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer border border-zinc-200 hover:border-red-400 rounded-xl px-4 py-[10px] text-[12px] font-bold text-zinc-600 hover:text-red-600 transition-colors">
                    <Camera size={14} />
                    {editPhotoFile ? "Change photo" : editPhotoPreview ? "Replace photo" : "Upload photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setEditPhotoFile(f);
                        if (f) setEditPhotoPreview(URL.createObjectURL(f));
                      }}
                    />
                  </label>
                  {editPhotoPreview && (
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-zinc-200 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={editPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setEditPhotoFile(null); setEditPhotoPreview(""); }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-zinc-900/60 rounded-full flex items-center justify-center text-white"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {editError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{editError}</div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowEditForm(false)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">Cancel</button>
                <button type="submit" disabled={editSaving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                  {editSaving ? "Saving..." : "Save Changes"}
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

      {/* ════ HISTORY MODAL ════ */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center">
                  <History size={15} className="text-zinc-600" />
                </div>
                <div>
                  <h2 className="text-[16px] font-black text-zinc-900">Service History</h2>
                  <p className="text-[11px] text-zinc-400 leading-none">{historyAssetName}</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="text-center py-10">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-zinc-100 bg-zinc-50 mb-3">
                    <Wrench size={20} className="text-zinc-300" />
                  </div>
                  <p className="text-[13px] text-zinc-400">No service records yet for this asset.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyRecords.map((svc, idx) => {
                    const tc = typeColors[svc.service_type] ?? { bg: "bg-zinc-100", text: "text-zinc-700" };
                    const isLatest = idx === 0;
                    const mech = Array.isArray(svc.mechanics) ? svc.mechanics[0] : svc.mechanics;
                    return (
                      <div key={svc.id} className="flex gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                        {/* Timeline dot */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isLatest ? "bg-red-600" : "bg-zinc-200"}`}>
                          {isLatest
                            ? <CheckCircle2 size={14} className="text-white" />
                            : <Wrench size={12} className="text-zinc-500" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-[11px] font-bold px-2 py-[2px] rounded-full ${tc.bg} ${tc.text}`}>
                              {svc.service_type}
                            </span>
                            {isLatest && (
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-[2px] rounded-full">Latest</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[11px] text-zinc-500">{formatDate(svc.service_date)}</span>
                            {svc.km_hours != null && (
                              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                                <Gauge size={10} /> {svc.km_hours.toLocaleString()} km/hrs
                              </span>
                            )}
                          </div>
                          {mech?.name && (
                            <div className="flex items-center gap-1 mt-1">
                              <UserCircle2 size={11} className="text-zinc-400" />
                              <span className="text-[11px] text-zinc-500">{mech.name}</span>
                            </div>
                          )}
                          {svc.notes && (
                            <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed bg-white rounded-lg px-2.5 py-2 border border-zinc-100">{svc.notes}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
