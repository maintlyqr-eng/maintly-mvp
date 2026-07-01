"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings, Search, Bell, ChevronDown, Plus, MoreVertical,
  CheckCircle2, Clock, TrendingUp, Crown, ChevronLeft, ChevronRight, LogOut, X,
  Wrench
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

const upcomingTasks = [
  { asset: "Aggreko XAVB 1000", type: "50B Service", date: "25 May", urgency: "Tomorrow", urgent: true, color: "bg-red-50 text-red-500" },
  { asset: "Caterpillar 320D", type: "500 Hour Service", date: "28 May", urgency: "In 4 days", urgent: false, color: "bg-amber-50 text-amber-500" },
  { asset: "Ford Ranger XLT", type: "Customer Follow-up", date: "30 May", urgency: "In 6 days", urgent: false, color: "bg-blue-50 text-blue-500" },
];

const miniStats = [
  { label: "SERVICES COMPLETED", value: "38", change: "+12%", color: "#16a34a" },
  { label: "HOURS WORKED", value: "72.4 h", change: "+12%", color: "#2563eb" },
  { label: "NEW ASSETS", value: "16", change: "+8%", color: "#7c3aed" },
  { label: "CUSTOMERS", value: "24", change: "+5%", color: "#ea580c" },
];

const serviceTypeOptions = ["Oil Change", "Service", "Repair", "Inspection", "Filter Change", "Tire Change", "Brake Service", "Other"];

function MiniSparkline({ color }: { color: string }) {
  const points = "0,28 10,24 20,26 30,20 40,22 50,15 60,17 70,10 80,12 90,5 100,8";
  return (
    <svg viewBox="0 0 100 32" className="w-full h-8 mt-1" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const assetTypeImg: Record<string, string> = {
  automotive: "/images/pickup.png",
  motorcycle: "/images/moto.png",
  generator: "/images/generador.png",
  machinery: "/images/excavator.png",
  marine: "/images/barco.png",
  aviation: "/images/avion.png",
};

const typeColors: Record<string, string> = {
  Service: "bg-blue-100 text-blue-700",
  Repair: "bg-red-100 text-red-700",
  Inspection: "bg-purple-100 text-purple-700",
  "Oil Change": "bg-amber-100 text-amber-700",
};

type AssetOption = {
  id: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  asset_type: string;
};

type AssetInfo = {
  id: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  vin_serial: string | null;
  asset_type: string;
};

type ServiceRow = {
  id: string;
  service_date: string;
  service_type: string;
  km_hours: number | null;
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

export default function DashboardPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [mechanicId, setMechanicId] = useState("");
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [totalServices, setTotalServices] = useState(0);
  const [totalHours, setTotalHours] = useState(0);

  // Add Service modal
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [assetOptions, setAssetOptions] = useState<AssetOption[]>([]);
  const [svcAssetId, setSvcAssetId] = useState("");
  const [svcType, setSvcType] = useState("Oil Change");
  const [svcDate, setSvcDate] = useState(new Date().toISOString().slice(0, 10));
  const [svcKmHours, setSvcKmHours] = useState("");
  const [svcNotes, setSvcNotes] = useState("");
  const [svcSaving, setSvcSaving] = useState(false);
  const [svcError, setSvcError] = useState("");

  async function loadServices(uid: string) {
    const { data: serviceRows, count } = await supabase
      .from("service_records")
      .select(
        "id, service_date, service_type, km_hours, created_at, assets(id, nickname, brand, model, vin_serial, asset_type)",
        { count: "exact" }
      )
      .eq("mechanic_id", uid)
      .order("created_at", { ascending: false })
      .limit(6);

    const rows = (serviceRows as unknown as ServiceRow[]) ?? [];
    setServices(rows);
    setTotalServices(count ?? rows.length);
    setTotalHours(rows.reduce((sum, r) => sum + (r.km_hours ?? 0), 0));
  }

  async function loadAssetOptions(uid: string) {
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

      await Promise.all([
        loadServices(session.user.id),
        loadAssetOptions(session.user.id),
      ]);

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

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function resetServiceForm() {
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

    if (!svcAssetId) {
      setSvcError("Please select an asset.");
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

    resetServiceForm();
    setShowServiceForm(false);
    await loadServices(mechanicId);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">Loading your dashboard...</p>
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

  const firstName = mechanicName.split(" ")[0] || "Mechanic";

  return (
    <div className="min-h-screen bg-zinc-50 flex">

      {/* ════════════════════════════════
          SIDEBAR
      ════════════════════════════════ */}
      <aside className="w-[230px] bg-white border-r border-zinc-200 flex flex-col shrink-0">
        <div className="flex flex-col items-center px-4 pt-2 pb-0">
          <Image
            src="/images/qr-gear.png"
            alt="Maintly logo"
            width={1080}
            height={1080}
            className="object-contain w-[92px] h-auto"
          />
          <Image
            src="/images/Maintly.png"
            alt="Maintly"
            width={1080}
            height={1080}
            className="object-contain w-[200px] h-auto -mt-10"
          />
        </div>

        <nav className="flex-1 px-3 -mt-4">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center justify-between gap-3 px-3 py-[9px] rounded-lg mb-1 text-[13px] font-medium transition-colors ${
                item.label === "Dashboard"
                  ? "bg-red-50 text-red-600 border-l-[3px] border-red-600 -ml-[1px]"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon size={16} />
                {item.label}
              </div>
            </Link>
          ))}
        </nav>

        <div className="mx-3 mb-3 p-4 rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 border border-zinc-200">
          <div className="flex items-center gap-1.5 text-amber-500 mb-1">
            <Crown size={14} />
            <span className="text-[12px] font-bold text-zinc-800">Go Premium</span>
          </div>
          <p className="text-[10px] text-zinc-500 leading-relaxed mb-3">Unlock advanced reports, custom branding and more.</p>
          <button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-bold py-2 rounded-lg transition-colors">
            Upgrade Now
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-4 py-3 border-t border-zinc-200 hover:bg-zinc-50 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[12px] shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-zinc-800 leading-tight truncate">{mechanicName || mechanicEmail}</p>
            <p className="text-[10px] text-zinc-400 leading-tight">Log out</p>
          </div>
          <LogOut size={14} className="text-zinc-300" />
        </button>
      </aside>

      {/* ════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="flex items-center justify-between px-7 py-4 bg-white border-b border-zinc-200">
          <div>
            <h1 className="text-[20px] font-black text-zinc-900">Dashboard</h1>
            <p className="text-[12px] text-zinc-400">
              Welcome back, {firstName}! Here&apos;s what&apos;s happening with your maintenance work.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search assets, QR codes, services..."
                className="w-[280px] rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-12 py-[9px] text-[12px] outline-none focus:border-red-400 transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 border border-zinc-200 rounded px-1.5 py-[1px]">⌘K</span>
            </div>

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
              onClick={() => { resetServiceForm(); setShowServiceForm(true); }}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white text-[13px] font-bold px-4 py-[10px] rounded-xl shadow-sm"
            >
              <Plus size={15} /> Add Service
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">

            {/* ── LEFT COLUMN ── */}
            <div>
              {/* Stats cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-red-50 text-red-500">
                    <CalendarIcon size={16} />
                  </div>
                  <p className="text-[9px] font-bold text-zinc-400 tracking-wide">TOTAL SERVICES</p>
                  <p className="text-[24px] font-black text-zinc-900 mt-1">{totalServices}</p>
                </div>
                <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-green-50 text-green-500">
                    <CheckCircle2 size={16} />
                  </div>
                  <p className="text-[9px] font-bold text-zinc-400 tracking-wide">COMPLETED</p>
                  <p className="text-[24px] font-black text-zinc-900 mt-1">{totalServices}</p>
                </div>
                <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-amber-50 text-amber-500">
                    <Clock size={16} />
                  </div>
                  <p className="text-[9px] font-bold text-zinc-400 tracking-wide">PENDING</p>
                  <p className="text-[24px] font-black text-zinc-900 mt-1">0</p>
                </div>
                <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-blue-50 text-blue-500">
                    <BarChart3 size={16} />
                  </div>
                  <p className="text-[9px] font-bold text-zinc-400 tracking-wide">TOTAL KM / HOURS LOGGED</p>
                  <p className="text-[24px] font-black text-zinc-900 mt-1">{totalHours.toLocaleString()}</p>
                </div>
              </div>

              {/* Recent Services */}
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[15px] font-black text-zinc-900">Recent Services</h2>
                  <Link href="/dashboard/assets" className="text-[12px] font-semibold text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-lg px-3 py-[6px] transition-colors">View all</Link>
                </div>

                {services.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-red-100 bg-red-50 mb-3">
                      <Wrench size={20} className="text-red-500" />
                    </div>
                    <p className="text-[13px] text-zinc-400 mb-3">No services logged yet.</p>
                    <button
                      onClick={() => { resetServiceForm(); setShowServiceForm(true); }}
                      className="text-[12px] font-bold text-red-600 hover:text-red-700"
                    >
                      Log your first service →
                    </button>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-[10px] text-zinc-400 font-bold uppercase">
                        <th className="pb-2 font-bold">Asset</th>
                        <th className="pb-2 font-bold">Service Type</th>
                        <th className="pb-2 font-bold">Date</th>
                        <th className="pb-2 font-bold">Km / Hours</th>
                        <th className="pb-2 font-bold">Status</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((row) => {
                        const asset = getAsset(row);
                        const img = asset ? assetTypeImg[asset.asset_type] ?? "/images/pickup.png" : "/images/pickup.png";
                        const label = asset?.nickname || [asset?.brand, asset?.model].filter(Boolean).join(" ") || "Unknown asset";
                        return (
                          <tr key={row.id} className="border-t border-zinc-100">
                            <td className="py-3 pr-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                                  <Image src={img} alt={label} width={32} height={32} className="object-contain" />
                                </div>
                                <div>
                                  <p className="text-[12.5px] font-bold text-zinc-800 leading-tight">{label}</p>
                                  <p className="text-[10px] text-zinc-400 leading-tight font-mono">{asset?.vin_serial ?? ""}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pr-3">
                              <span className={`text-[10.5px] font-semibold px-2 py-[3px] rounded-full ${typeColors[row.service_type] ?? "bg-zinc-100 text-zinc-700"}`}>{row.service_type}</span>
                            </td>
                            <td className="py-3 pr-3">
                              <p className="text-[12px] text-zinc-700">{row.service_date}</p>
                            </td>
                            <td className="py-3 pr-3 text-[12px] text-zinc-700 font-medium">{row.km_hours ?? "—"}</td>
                            <td className="py-3 pr-3">
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-green-600">
                                <CheckCircle2 size={12} />
                                Completed
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <button className="text-zinc-300 hover:text-zinc-600 transition-colors">
                                <MoreVertical size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-5">

              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-black text-zinc-900">Calendar</h3>
                  <a href="#" className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-lg px-2 py-[4px] transition-colors">View calendar</a>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <button className="text-zinc-400 hover:text-zinc-700"><ChevronLeft size={16} /></button>
                  <span className="text-[12px] font-bold text-zinc-700">{new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                  <button className="text-zinc-400 hover:text-zinc-700"><ChevronRight size={16} /></button>
                </div>
                <p className="text-[11px] text-zinc-400 text-center py-4">Calendar view coming soon.</p>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-black text-zinc-900">Upcoming Tasks</h3>
                  <a href="#" className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-lg px-2 py-[4px] transition-colors">View all</a>
                </div>
                <div className="space-y-3">
                  {upcomingTasks.map((t) => (
                    <div key={t.asset} className="flex items-center justify-between opacity-60">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.color}`}>
                          <CalendarIcon size={14} />
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-zinc-800 leading-tight">{t.asset}</p>
                          <p className="text-[10px] text-zinc-400 leading-tight">{t.type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-[11px] font-bold ${t.urgent ? "text-red-600" : "text-zinc-600"}`}>{t.date}</p>
                        <p className={`text-[9px] ${t.urgent ? "text-red-400" : "text-zinc-400"}`}>{t.urgency}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-400 text-center mt-2">Sample data — task scheduling coming soon.</p>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-black text-zinc-900">Your Statistics</h3>
                  <button className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 border border-zinc-200 rounded-lg px-2 py-[4px]">
                    This Month <ChevronDown size={11} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 opacity-60">
                  {miniStats.map((s) => (
                    <div key={s.label}>
                      <p className="text-[8.5px] font-bold text-zinc-400 tracking-wide">{s.label}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[18px] font-black text-zinc-900">{s.value}</p>
                        <span className="text-[10px] font-semibold" style={{ color: s.color }}>{s.change}</span>
                      </div>
                      <MiniSparkline color={s.color} />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-400 text-center mt-2">Sample data — coming soon.</p>
              </div>

            </div>
          </div>

          <p className="text-center text-[11px] text-zinc-400 mt-8">© 2026 Maintly. All rights reserved.</p>
        </div>
      </div>

      {/* ════════════════════════════════
          ADD SERVICE MODAL
      ════════════════════════════════ */}
      {showServiceForm && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                  <Wrench size={15} className="text-red-600" />
                </div>
                <h2 className="text-[16px] font-black text-zinc-900">Log New Service</h2>
              </div>
              <button onClick={() => setShowServiceForm(false)} className="text-zinc-400 hover:text-zinc-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddService} className="px-6 py-5 space-y-4">

              {/* Asset selector */}
              <div>
                <label className="text-[12px] font-bold text-zinc-700">Asset *</label>
                {assetOptions.length === 0 ? (
                  <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] text-amber-700">
                    You have no assets yet.{" "}
                    <Link href="/dashboard/assets" className="font-bold underline">Create one first →</Link>
                  </div>
                ) : (
                  <select
                    value={svcAssetId}
                    onChange={(e) => setSvcAssetId(e.target.value)}
                    required
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                  >
                    {assetOptions.map((a) => (
                      <option key={a.id} value={a.id}>{assetLabel(a)}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Service type */}
              <div>
                <label className="text-[12px] font-bold text-zinc-700">Service type *</label>
                <select
                  value={svcType}
                  onChange={(e) => setSvcType(e.target.value)}
                  required
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                >
                  {serviceTypeOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Date + KM/Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">Date *</label>
                  <input
                    type="date"
                    required
                    value={svcDate}
                    onChange={(e) => setSvcDate(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">Km / Hours</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={svcKmHours}
                    onChange={(e) => setSvcKmHours(e.target.value)}
                    placeholder="e.g. 45000"
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[12px] font-bold text-zinc-700">Notes (optional)</label>
                <textarea
                  rows={3}
                  value={svcNotes}
                  onChange={(e) => setSvcNotes(e.target.value)}
                  placeholder="Parts used, observations, next service..."
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 resize-none"
                />
              </div>

              {svcError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
                  {svcError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowServiceForm(false)}
                  className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={svcSaving || assetOptions.length === 0}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]"
                >
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
