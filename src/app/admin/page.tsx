"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Box, Wrench, QrCode, BarChart3, Shield,
  LogOut, RefreshCw, CheckCircle2,
  Clock, AlertCircle, Layers,
  ChevronRight, Eye, EyeOff
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const ADMIN_USER = "admin";
const ADMIN_PASS = "admin157157";
const SESSION_KEY = "mly_admin_ok";

type MechanicRow = {
  id: string;
  name: string;
  email: string;
  workshop_name: string | null;
  verified: boolean;
  created_at: string;
};

type ServiceRow = {
  id: string;
  service_date: string;
  service_type: string;
  service_type_color?: string;
  mechanic_name?: string;
  asset_label?: string;
};

type AssetTypeCount = { type: string; count: number };

const TYPE_COLORS: Record<string, string> = {
  "Oil Change":    "bg-amber-100 text-amber-700",
  "Service":       "bg-blue-100 text-blue-700",
  "Repair":        "bg-red-100 text-red-700",
  "Inspection":    "bg-purple-100 text-purple-700",
  "Filter Change": "bg-green-100 text-green-700",
  "Tire Change":   "bg-cyan-100 text-cyan-700",
  "Brake Service": "bg-orange-100 text-orange-700",
};

const ASSET_ICONS: Record<string, string> = {
  automotive: "🚗",
  motorcycle:  "🏍️",
  generator:   "⚡",
  machinery:   "🚜",
  marine:      "⛵",
  aviation:    "✈️",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{label}</p>
        <p className="text-[28px] font-black text-zinc-900 leading-none mt-1">{value}</p>
        {sub && <p className="text-[11px] text-zinc-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();

  // ── Admin login ──
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loginChecked, setLoginChecked] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // KPIs
  const [totalMechanics, setTotalMechanics]   = useState(0);
  const [totalAssets, setTotalAssets]         = useState(0);
  const [totalServices, setTotalServices]     = useState(0);
  const [totalQR, setTotalQR]                 = useState(0);
  const [assignedQR, setAssignedQR]           = useState(0);
  const [mechThisMonth, setMechThisMonth]     = useState(0);
  const [svcThisMonth, setSvcThisMonth]       = useState(0);

  // Tables
  const [mechanics, setMechanics]   = useState<MechanicRow[]>([]);
  const [services, setServices]     = useState<ServiceRow[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetTypeCount[]>([]);

  // Active nav
  const [section, setSection] = useState<"overview" | "mechanics" | "services" | "qr">("overview");

  async function loadData() {
    setRefreshing(true);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      { count: mCount },
      { count: aCount },
      { count: sCount },
      { count: qCount },
      { count: qAssigned },
      { count: mMonth },
      { count: sMonth },
      { data: mechRows },
      { data: svcRows },
      { data: assetRows },
    ] = await Promise.all([
      supabase.from("mechanics").select("*", { count: "exact", head: true }),
      supabase.from("assets").select("*", { count: "exact", head: true }),
      supabase.from("service_records").select("*", { count: "exact", head: true }),
      supabase.from("qr_codes").select("*", { count: "exact", head: true }),
      supabase.from("qr_codes").select("*", { count: "exact", head: true }).not("asset_id", "is", null),
      supabase.from("mechanics").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
      supabase.from("service_records").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
      supabase.from("mechanics").select("id, name, email, workshop_name, verified, created_at")
        .order("created_at", { ascending: false }).limit(20),
      supabase.from("service_records")
        .select("id, service_date, service_type, mechanic_id, asset_id, mechanics(name), assets(brand, model, nickname)")
        .order("service_date", { ascending: false }).limit(20),
      supabase.from("assets").select("asset_type"),
    ]);

    setTotalMechanics(mCount ?? 0);
    setTotalAssets(aCount ?? 0);
    setTotalServices(sCount ?? 0);
    setTotalQR(qCount ?? 0);
    setAssignedQR(qAssigned ?? 0);
    setMechThisMonth(mMonth ?? 0);
    setSvcThisMonth(sMonth ?? 0);
    setMechanics((mechRows ?? []) as MechanicRow[]);

    // Parse services with joined data
    const parsedSvcs: ServiceRow[] = ((svcRows ?? []) as any[]).map((s) => {
      const mech = Array.isArray(s.mechanics) ? s.mechanics[0] : s.mechanics;
      const asset = Array.isArray(s.assets) ? s.assets[0] : s.assets;
      return {
        id: s.id,
        service_date: s.service_date,
        service_type: s.service_type,
        mechanic_name: mech?.name ?? "—",
        asset_label: asset?.nickname || [asset?.brand, asset?.model].filter(Boolean).join(" ") || "Unknown asset",
      };
    });
    setServices(parsedSvcs);

    // Count by asset type
    const typeCounts: Record<string, number> = {};
    for (const row of (assetRows ?? [])) {
      const t = (row as any).asset_type ?? "other";
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
    const sorted = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    setAssetTypes(sorted);

    setRefreshing(false);
  }

  // Check sessionStorage for existing admin session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ok = sessionStorage.getItem(SESSION_KEY) === "1";
      setAdminAuthed(ok);
      setLoginChecked(true);
      if (ok) {
        loadData().then(() => setLoading(false));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loginUser.trim() === ADMIN_USER && loginPass === ADMIN_PASS) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setAdminAuthed(true);
      setLoginError("");
      loadData().then(() => setLoading(false));
    } else {
      setLoginError("Incorrect username or password.");
    }
  }

  function handleAdminLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAdminAuthed(false);
  }


  // Not yet checked sessionStorage
  if (!loginChecked) return null;

  // Show login screen
  if (!adminAuthed) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center mb-4 shadow-lg shadow-red-900/40">
              <Shield size={26} className="text-white" />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/Maintly.png" alt="Maintly" style={{ height: 22, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
            <p className="text-[12px] text-zinc-500 mt-2 tracking-widest uppercase font-semibold">Admin Access</p>
          </div>

          {/* Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7 shadow-2xl">
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Username</label>
                <input
                  type="text"
                  autoComplete="off"
                  value={loginUser}
                  onChange={e => { setLoginUser(e.target.value); setLoginError(""); }}
                  placeholder="admin"
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-red-500 rounded-xl px-4 py-3 text-[14px] text-white placeholder-zinc-600 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    value={loginPass}
                    onChange={e => { setLoginPass(e.target.value); setLoginError(""); }}
                    placeholder="••••••••••"
                    className="w-full bg-zinc-800 border border-zinc-700 focus:border-red-500 rounded-xl px-4 py-3 pr-11 text-[14px] text-white placeholder-zinc-600 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="flex items-center gap-2 bg-red-950 border border-red-800 rounded-xl px-3 py-2.5">
                  <AlertCircle size={14} className="text-red-400 shrink-0" />
                  <p className="text-[12px] text-red-400">{loginError}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-bold py-3 rounded-xl text-[14px] transition-all mt-2 shadow-lg shadow-red-900/30"
              >
                Access Admin Panel
              </button>
            </form>
          </div>

          <p className="text-center text-[10px] text-zinc-700 mt-6">MaintlyQR · Restricted access</p>
        </div>
      </div>
    );
  }

  // Loading dashboard data
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
          <p className="text-zinc-500 text-[13px]">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  const maxAssetCount = Math.max(...assetTypes.map(a => a.count), 1);
  const qrPct = totalQR > 0 ? Math.round((assignedQR / totalQR) * 100) : 0;

  const navItems = [
    { id: "overview",  label: "Overview",   icon: BarChart3 },
    { id: "mechanics", label: "Mechanics",   icon: Users     },
    { id: "services",  label: "Services",    icon: Wrench    },
    { id: "qr",        label: "QR Codes",    icon: QrCode    },
  ] as const;

  return (
    <div className="min-h-screen bg-zinc-950 flex text-white">

      {/* ══ SIDEBAR ══ */}
      <aside className="w-[220px] bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">

        <div className="px-5 py-5 border-b border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center">
              <Shield size={14} className="text-white" />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/Maintly.png" alt="Maintly" style={{ height: 18, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          </div>
          <span className="text-[9px] font-bold text-red-500 tracking-[0.15em] uppercase ml-9">Admin Panel</span>
        </div>

        <nav className="flex-1 p-3">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`w-full flex items-center gap-3 px-3 py-[9px] rounded-xl mb-1 text-[13px] font-semibold transition-all text-left ${
                section === id
                  ? "bg-red-600 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-zinc-800 space-y-1">
          <Link
            href="/dashboard"
            className="w-full flex items-center gap-3 px-3 py-[9px] rounded-xl text-[13px] font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all"
          >
            <Layers size={15} />
            Mechanic View
          </Link>
          <button
            onClick={handleAdminLogout}
            className="w-full flex items-center gap-3 px-3 py-[9px] rounded-xl text-[13px] font-semibold text-zinc-500 hover:bg-zinc-800 hover:text-red-400 transition-all"
          >
            <LogOut size={15} />
            Log out
          </button>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="flex items-center justify-between px-8 py-4 bg-zinc-900 border-b border-zinc-800">
          <div>
            <h1 className="text-[20px] font-black text-white">
              {section === "overview"  && "Overview"}
              {section === "mechanics" && "Mechanics"}
              {section === "services"  && "Services"}
              {section === "qr"        && "QR Codes"}
            </h1>
            <p className="text-[12px] text-zinc-500">MaintlyQR operations dashboard</p>
          </div>
          <button
            onClick={loadData}
            disabled={refreshing}
            className="flex items-center gap-2 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-[12px] font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-40"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8">

          {/* ══ OVERVIEW ══ */}
          {section === "overview" && (
            <div className="space-y-6">

              {/* KPI grid */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Total Mechanics"  value={totalMechanics}  icon={Users}    color="bg-blue-950 text-blue-400"   sub={`+${mechThisMonth} this month`} />
                <StatCard label="Total Assets"     value={totalAssets}     icon={Box}      color="bg-purple-950 text-purple-400" />
                <StatCard label="Total Services"   value={totalServices}   icon={Wrench}   color="bg-green-950 text-green-400"  sub={`+${svcThisMonth} this month`} />
                <StatCard label="QR Codes Issued"  value={totalQR}         icon={QrCode}   color="bg-red-950 text-red-400"      sub={`${assignedQR} assigned`} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* QR Assignment */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-[14px] font-black text-white mb-4">QR Code Status</h2>
                  <div className="flex items-end gap-6 mb-4">
                    <div>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Assigned</p>
                      <p className="text-[32px] font-black text-green-400">{assignedQR}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Unassigned</p>
                      <p className="text-[32px] font-black text-zinc-400">{totalQR - assignedQR}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Utilization</p>
                      <p className="text-[32px] font-black text-white">{qrPct}%</p>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all"
                      style={{ width: `${qrPct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-2">{assignedQR} of {totalQR} QR codes are linked to an asset</p>
                </div>

                {/* Asset breakdown */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-[14px] font-black text-white mb-4">Assets by Type</h2>
                  {assetTypes.length === 0 ? (
                    <p className="text-[13px] text-zinc-600">No assets yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {assetTypes.map(({ type, count }) => (
                        <div key={type} className="flex items-center gap-3">
                          <span className="text-[18px] w-7 shrink-0">{ASSET_ICONS[type] ?? "🔧"}</span>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <span className="text-[12px] font-semibold text-zinc-300 capitalize">{type}</span>
                              <span className="text-[12px] font-bold text-white">{count}</span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-red-600 rounded-full"
                                style={{ width: `${(count / maxAssetCount) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent activity */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[14px] font-black text-white">Recent Mechanics</h2>
                    <button onClick={() => setSection("mechanics")} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white transition-colors">
                      View all <ChevronRight size={12} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {mechanics.slice(0, 5).map((m) => (
                      <div key={m.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[12px] font-bold text-zinc-400 shrink-0">
                          {m.name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0,2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-white truncate">{m.name}</p>
                          <p className="text-[10px] text-zinc-500 truncate">{m.email}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-zinc-600">{formatDate(m.created_at)}</p>
                          {m.verified && <span className="text-[9px] text-green-400 font-bold">✓ VERIFIED</span>}
                        </div>
                      </div>
                    ))}
                    {mechanics.length === 0 && <p className="text-[13px] text-zinc-600">No mechanics yet.</p>}
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[14px] font-black text-white">Recent Services</h2>
                    <button onClick={() => setSection("services")} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white transition-colors">
                      View all <ChevronRight size={12} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {services.slice(0, 5).map((s) => (
                      <div key={s.id} className="flex items-center gap-3">
                        <div className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 ${TYPE_COLORS[s.service_type] ?? "bg-zinc-800 text-zinc-400"}`}>
                          {s.service_type}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-white truncate">{s.asset_label}</p>
                          <p className="text-[10px] text-zinc-500 truncate">by {s.mechanic_name}</p>
                        </div>
                        <p className="text-[10px] text-zinc-600 shrink-0">{s.service_date}</p>
                      </div>
                    ))}
                    {services.length === 0 && <p className="text-[13px] text-zinc-600">No services yet.</p>}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ══ MECHANICS ══ */}
          {section === "mechanics" && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-[15px] font-black text-white">{totalMechanics} Mechanics registered</h2>
                <span className="text-[11px] text-zinc-500">+{mechThisMonth} this month</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-zinc-800">
                      {["Name", "Email", "Workshop", "Verified", "Joined"].map(h => (
                        <th key={h} className="px-6 py-3 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mechanics.map((m) => (
                      <tr key={m.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[11px] font-bold text-zinc-400 shrink-0">
                              {m.name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0,2)}
                            </div>
                            <span className="text-[13px] font-semibold text-white">{m.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-[12px] text-zinc-400">{m.email}</td>
                        <td className="px-6 py-3 text-[12px] text-zinc-400">{m.workshop_name ?? <span className="text-zinc-600">—</span>}</td>
                        <td className="px-6 py-3">
                          {m.verified
                            ? <span className="flex items-center gap-1 text-[11px] font-bold text-green-400"><CheckCircle2 size={12} />Yes</span>
                            : <span className="flex items-center gap-1 text-[11px] text-zinc-600"><Clock size={12} />Pending</span>
                          }
                        </td>
                        <td className="px-6 py-3 text-[12px] text-zinc-500">{formatDate(m.created_at)}</td>
                      </tr>
                    ))}
                    {mechanics.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-[13px] text-zinc-600">No mechanics yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ SERVICES ══ */}
          {section === "services" && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Total Services</p>
                  <p className="text-[32px] font-black text-white mt-1">{totalServices}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">This Month</p>
                  <p className="text-[32px] font-black text-green-400 mt-1">{svcThisMonth}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Avg per Mechanic</p>
                  <p className="text-[32px] font-black text-white mt-1">
                    {totalMechanics > 0 ? (totalServices / totalMechanics).toFixed(1) : "—"}
                  </p>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800">
                  <h2 className="text-[15px] font-black text-white">Recent Services</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b border-zinc-800">
                        {["Asset", "Type", "Mechanic", "Date"].map(h => (
                          <th key={h} className="px-6 py-3 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((s) => (
                        <tr key={s.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                          <td className="px-6 py-3 text-[13px] font-semibold text-white">{s.asset_label}</td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${TYPE_COLORS[s.service_type] ?? "bg-zinc-800 text-zinc-400"}`}>
                              {s.service_type}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-[12px] text-zinc-400">{s.mechanic_name}</td>
                          <td className="px-6 py-3 text-[12px] text-zinc-500">{s.service_date}</td>
                        </tr>
                      ))}
                      {services.length === 0 && (
                        <tr><td colSpan={4} className="px-6 py-12 text-center text-[13px] text-zinc-600">No services yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ QR CODES ══ */}
          {section === "qr" && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Total QR Codes</p>
                  <p className="text-[32px] font-black text-white mt-1">{totalQR}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Assigned</p>
                  <p className="text-[32px] font-black text-green-400 mt-1">{assignedQR}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Available</p>
                  <p className="text-[32px] font-black text-zinc-400 mt-1">{totalQR - assignedQR}</p>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-[14px] font-black text-white mb-4">Utilization</h2>
                <div className="w-full h-4 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-700 to-red-400 rounded-full transition-all"
                    style={{ width: `${qrPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[11px] text-zinc-500">{assignedQR} assigned</span>
                  <span className="text-[11px] font-bold text-white">{qrPct}% utilized</span>
                  <span className="text-[11px] text-zinc-500">{totalQR} total</span>
                </div>

                {totalQR === 0 && (
                  <div className="mt-6 flex items-center gap-3 bg-zinc-800 rounded-xl p-4">
                    <AlertCircle size={16} className="text-amber-400 shrink-0" />
                    <p className="text-[12px] text-zinc-400">No QR codes have been created yet. Generate QR codes from the mechanic dashboard.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-center text-[10px] text-zinc-700 mt-10">MaintlyQR Admin · Internal use only</p>
        </div>
      </div>
    </div>
  );
}
