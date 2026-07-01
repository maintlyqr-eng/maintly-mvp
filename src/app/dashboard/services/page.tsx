"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings, Bell, ChevronDown, Plus, X, LogOut, Crown,
  Wrench, CheckCircle2, MoreVertical
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

const typeColors: Record<string, string> = {
  Service: "bg-blue-100 text-blue-700",
  Repair: "bg-red-100 text-red-700",
  Inspection: "bg-purple-100 text-purple-700",
  "Oil Change": "bg-amber-100 text-amber-700",
};

const assetTypeImg: Record<string, string> = {
  automotive: "/images/pickup.png",
  motorcycle: "/images/moto.png",
  generator: "/images/generador.png",
  machinery: "/images/excavator.png",
  marine: "/images/barco.png",
  aviation: "/images/avion.png",
};

type AssetInfo = {
  id: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  vin_serial: string | null;
  asset_type: string;
};

type AssetOption = {
  id: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  asset_type: string;
};

type ServiceRow = {
  id: string;
  service_date: string;
  service_type: string;
  km_hours: number | null;
  notes: string | null;
  created_at: string;
  assets: AssetInfo | AssetInfo[] | null;
};

function getAsset(row: ServiceRow): AssetInfo | null {
  if (!row.assets) return null;
  return Array.isArray(row.assets) ? row.assets[0] ?? null : row.assets;
}

function assetLabel(a: AssetOption | null) {
  if (!a) return "—";
  return a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || "Unnamed asset";
}

export default function ServicesPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [mechanicId, setMechanicId] = useState("");
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetOptions, setAssetOptions] = useState<AssetOption[]>([]);

  // Filters
  const [filterAsset, setFilterAsset] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Add Service modal
  const [showForm, setShowForm] = useState(false);
  const [svcAssetId, setSvcAssetId] = useState("");
  const [svcType, setSvcType] = useState("Oil Change");
  const [svcDate, setSvcDate] = useState(new Date().toISOString().slice(0, 10));
  const [svcKmHours, setSvcKmHours] = useState("");
  const [svcNotes, setSvcNotes] = useState("");
  const [svcSaving, setSvcSaving] = useState(false);
  const [svcError, setSvcError] = useState("");

  async function loadServices(uid: string) {
    setLoading(true);
    const { data } = await supabase
      .from("service_records")
      .select("id, service_date, service_type, km_hours, notes, created_at, assets(id, nickname, brand, model, vin_serial, asset_type)")
      .eq("mechanic_id", uid)
      .order("service_date", { ascending: false });
    setServices((data as unknown as ServiceRow[]) ?? []);
    setLoading(false);
  }

  async function loadAssets(uid: string) {
    const { data } = await supabase
      .from("assets")
      .select("id, nickname, brand, model, asset_type")
      .eq("created_by", uid)
      .order("created_at", { ascending: false });
    const opts = (data as AssetOption[]) ?? [];
    setAssetOptions(opts);
    if (opts.length > 0) setSvcAssetId(opts[0].id);
  }

  useEffect(() => {
    let active = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      if (!active) return;

      setMechanicId(session.user.id);
      setMechanicEmail(session.user.email ?? "");

      const { data: mechanic } = await supabase
        .from("mechanics").select("name").eq("id", session.user.id).single();
      if (active && mechanic) setMechanicName(mechanic.name);

      await Promise.all([loadServices(session.user.id), loadAssets(session.user.id)]);
      if (active) setCheckingAuth(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function resetForm() {
    setSvcAssetId(assetOptions[0]?.id ?? "");
    setSvcType("Oil Change");
    setSvcDate(new Date().toISOString().slice(0, 10));
    setSvcKmHours("");
    setSvcNotes("");
    setSvcError("");
  }

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    setSvcError("");
    if (!svcAssetId) { setSvcError("Please select an asset."); return; }
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
    if (error) { setSvcError(error.message); return; }
    resetForm();
    setShowForm(false);
    await loadServices(mechanicId);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">Loading...</p>
      </div>
    );
  }

  const initials = mechanicName.split(" ").filter(Boolean).map(p => p[0]).join("").slice(0, 2).toUpperCase() || "ME";

  // Filtered list
  const filtered = services.filter(row => {
    const asset = getAsset(row);
    if (filterAsset !== "all" && asset?.id !== filterAsset) return false;
    if (filterType !== "all" && row.service_type !== filterType) return false;
    return true;
  });

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
                item.label === "My Services"
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

        <button onClick={handleLogout} className="flex items-center gap-2.5 px-4 py-3 border-t border-zinc-200 hover:bg-zinc-50 transition-colors text-left">
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
            <h1 className="text-[20px] font-black text-zinc-900">My Services</h1>
            <p className="text-[12px] text-zinc-400">Full history of all maintenance records.</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative text-zinc-500 hover:text-zinc-800 transition-colors"><Bell size={19} /></button>
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

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-5 -mt-2 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <select
                value={filterAsset}
                onChange={(e) => setFilterAsset(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-[9px] text-[12px] outline-none focus:border-red-400"
              >
                <option value="all">All assets</option>
                {assetOptions.map(a => <option key={a.id} value={a.id}>{assetLabel(a)}</option>)}
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-[9px] text-[12px] outline-none focus:border-red-400"
              >
                <option value="all">All types</option>
                {serviceTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white text-[13px] font-bold px-4 py-[10px] rounded-xl shadow-sm"
            >
              <Plus size={15} /> Add Service
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
            {loading ? (
              <p className="text-[13px] text-zinc-400 text-center py-12">Loading services...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-red-100 bg-red-50 mb-3">
                  <Wrench size={20} className="text-red-500" />
                </div>
                <p className="text-[13px] text-zinc-400 mb-3">No services found.</p>
                <button
                  onClick={() => { resetForm(); setShowForm(true); }}
                  className="text-[12px] font-bold text-red-600 hover:text-red-700"
                >
                  Log your first service →
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[10px] text-zinc-400 font-bold uppercase border-b border-zinc-100">
                    <th className="px-5 py-3 font-bold">Asset</th>
                    <th className="px-3 py-3 font-bold">Service Type</th>
                    <th className="px-3 py-3 font-bold">Date</th>
                    <th className="px-3 py-3 font-bold">Km / Hours</th>
                    <th className="px-3 py-3 font-bold">Notes</th>
                    <th className="px-3 py-3 font-bold">Status</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const asset = getAsset(row);
                    const img = asset ? assetTypeImg[asset.asset_type] ?? "/images/pickup.png" : "/images/pickup.png";
                    const label = asset?.nickname || [asset?.brand, asset?.model].filter(Boolean).join(" ") || "Unknown asset";
                    return (
                      <tr key={row.id} className="border-t border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                              <Image src={img} alt={label} width={28} height={28} className="object-contain" />
                            </div>
                            <div>
                              <p className="text-[12.5px] font-bold text-zinc-800 leading-tight">{label}</p>
                              <p className="text-[10px] text-zinc-400 leading-tight font-mono">{asset?.vin_serial ?? ""}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`text-[10.5px] font-semibold px-2 py-[3px] rounded-full ${typeColors[row.service_type] ?? "bg-zinc-100 text-zinc-700"}`}>{row.service_type}</span>
                        </td>
                        <td className="px-3 py-3 text-[12px] text-zinc-700">{row.service_date}</td>
                        <td className="px-3 py-3 text-[12px] text-zinc-700 font-medium">{row.km_hours ?? "—"}</td>
                        <td className="px-3 py-3 text-[11px] text-zinc-500 max-w-[180px] truncate">{row.notes || "—"}</td>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-green-600">
                            <CheckCircle2 size={12} /> Completed
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button className="text-zinc-300 hover:text-zinc-600 transition-colors"><MoreVertical size={15} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <p className="text-center text-[11px] text-zinc-400 mt-8">© 2026 Maintly. All rights reserved.</p>
        </div>
      </div>

      {/* ════ ADD SERVICE MODAL ════ */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                  <Wrench size={15} className="text-red-600" />
                </div>
                <h2 className="text-[16px] font-black text-zinc-900">Log New Service</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>

            <form onSubmit={handleAddService} className="px-6 py-5 space-y-4">
              <div>
                <label className="text-[12px] font-bold text-zinc-700">Asset *</label>
                {assetOptions.length === 0 ? (
                  <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] text-amber-700">
                    No assets yet. <Link href="/dashboard/assets" className="font-bold underline">Create one first →</Link>
                  </div>
                ) : (
                  <select value={svcAssetId} onChange={(e) => setSvcAssetId(e.target.value)} required className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500">
                    {assetOptions.map(a => <option key={a.id} value={a.id}>{assetLabel(a)}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="text-[12px] font-bold text-zinc-700">Service type *</label>
                <select value={svcType} onChange={(e) => setSvcType(e.target.value)} required className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500">
                  {serviceTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
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
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">Cancel</button>
                <button type="submit" disabled={svcSaving || assetOptions.length === 0} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
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
