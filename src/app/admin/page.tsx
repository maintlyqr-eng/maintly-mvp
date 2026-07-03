"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Users, Box, Wrench, QrCode, BarChart3, Shield,
  LogOut, RefreshCw, CheckCircle2, Clock, AlertCircle,
  Layers, ChevronRight, Eye, EyeOff, TrendingUp, ArrowUpRight, Menu, X
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const ADMIN_USER = "admin";
const ADMIN_PASS = "admin157157";
const SESSION_KEY = "mly_admin_ok";

type MechanicRow = {
  id: string; name: string; email: string;
  workshop_name: string | null; verified: boolean; created_at: string;
};
type ServiceRow = {
  id: string; service_date: string; service_type: string;
  mechanic_name?: string; asset_label?: string;
};
type AssetTypeCount = { type: string; count: number };

const TYPE_COLORS: Record<string, string> = {
  "Oil Change":    "bg-amber-100 text-amber-700 border border-amber-200",
  "Service":       "bg-blue-100 text-blue-700 border border-blue-200",
  "Repair":        "bg-red-100 text-red-700 border border-red-200",
  "Inspection":    "bg-violet-100 text-violet-700 border border-violet-200",
  "Filter Change": "bg-emerald-100 text-emerald-700 border border-emerald-200",
  "Tire Change":   "bg-cyan-100 text-cyan-700 border border-cyan-200",
  "Brake Service": "bg-orange-100 text-orange-700 border border-orange-200",
};
const ASSET_ICONS: Record<string, string> = {
  automotive: "🚗", motorcycle: "🏍️", generator: "⚡",
  machinery: "🚜", marine: "⛵", aviation: "✈️",
};
const ASSET_COLORS: Record<string, string> = {
  automotive: "bg-blue-500", motorcycle: "bg-orange-500",
  generator: "bg-yellow-500", machinery: "bg-green-600",
  marine: "bg-cyan-500", aviation: "bg-indigo-500",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function getInitials(name: string) {
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
}
function getAvatarColor(name: string) {
  const colors = [
    "bg-red-100 text-red-700", "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700", "bg-purple-100 text-purple-700",
    "bg-orange-100 text-orange-700", "bg-cyan-100 text-cyan-700",
  ];
  return colors[name.charCodeAt(0) % colors.length];
}

// ── STAT CARD ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, accent, sub, trend }: {
  label: string; value: string | number; icon: React.ElementType;
  accent: string; sub?: string; trend?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
      {/* Subtle top gradient accent */}
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accent} opacity-60`} />
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent} bg-opacity-10`}>
          <Icon size={18} className="opacity-80" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
            <TrendingUp size={10} />
            {trend}
          </div>
        )}
      </div>
      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[36px] font-black text-zinc-900 leading-none">{value}</p>
      {sub && <p className="text-[12px] text-zinc-400 mt-2 font-medium">{sub}</p>}
    </div>
  );
}

// ── SECTION HEADER ─────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] font-bold text-zinc-900 tracking-tight">{children}</h2>
  );
}

export default function AdminPage() {
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [loginUser, setLoginUser]     = useState("");
  const [loginPass, setLoginPass]     = useState("");
  const [loginError, setLoginError]   = useState("");
  const [showPass, setShowPass]       = useState(false);
  const [loginChecked, setLoginChecked] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  const [totalMechanics, setTotalMechanics] = useState(0);
  const [totalAssets, setTotalAssets]       = useState(0);
  const [totalServices, setTotalServices]   = useState(0);
  const [totalQR, setTotalQR]               = useState(0);
  const [assignedQR, setAssignedQR]         = useState(0);
  const [mechThisMonth, setMechThisMonth]   = useState(0);
  const [svcThisMonth, setSvcThisMonth]     = useState(0);
  const [mechanics, setMechanics]           = useState<MechanicRow[]>([]);
  const [services, setServices]             = useState<ServiceRow[]>([]);
  const [assetTypes, setAssetTypes]         = useState<AssetTypeCount[]>([]);
  const [section, setSection] = useState<"overview" | "mechanics" | "services" | "qr">("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function loadData() {
    setRefreshing(true);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [
      { count: mCount }, { count: aCount }, { count: sCount },
      { count: qCount }, { count: qAssigned }, { count: mMonth }, { count: sMonth },
      { data: mechRows }, { data: svcRows }, { data: assetRows },
    ] = await Promise.all([
      supabase.from("mechanics").select("*", { count: "exact", head: true }),
      supabase.from("assets").select("*", { count: "exact", head: true }),
      supabase.from("service_records").select("*", { count: "exact", head: true }),
      supabase.from("qr_codes").select("*", { count: "exact", head: true }),
      supabase.from("qr_codes").select("*", { count: "exact", head: true }).not("asset_id", "is", null),
      supabase.from("mechanics").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
      supabase.from("service_records").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
      supabase.from("mechanics").select("id, name, email, workshop_name, verified, created_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("service_records").select("id, service_date, service_type, mechanic_id, asset_id, mechanics(name), assets(brand, model, nickname)").order("service_date", { ascending: false }).limit(30),
      supabase.from("assets").select("asset_type"),
    ]);
    setTotalMechanics(mCount ?? 0); setTotalAssets(aCount ?? 0);
    setTotalServices(sCount ?? 0);  setTotalQR(qCount ?? 0);
    setAssignedQR(qAssigned ?? 0);  setMechThisMonth(mMonth ?? 0); setSvcThisMonth(sMonth ?? 0);
    setMechanics((mechRows ?? []) as MechanicRow[]);
    setServices(((svcRows ?? []) as any[]).map((s) => {
      const mech = Array.isArray(s.mechanics) ? s.mechanics[0] : s.mechanics;
      const asset = Array.isArray(s.assets) ? s.assets[0] : s.assets;
      return { id: s.id, service_date: s.service_date, service_type: s.service_type,
        mechanic_name: mech?.name ?? "—",
        asset_label: asset?.nickname || [asset?.brand, asset?.model].filter(Boolean).join(" ") || "Unknown" };
    }));
    const typeCounts: Record<string, number> = {};
    for (const row of (assetRows ?? [])) {
      const t = (row as any).asset_type ?? "other";
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
    setAssetTypes(Object.entries(typeCounts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count));
    setRefreshing(false);
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ok = sessionStorage.getItem(SESSION_KEY) === "1";
      setAdminAuthed(ok); setLoginChecked(true);
      if (ok) loadData().then(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loginUser.trim() === ADMIN_USER && loginPass === ADMIN_PASS) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setAdminAuthed(true); setLoginError("");
      loadData().then(() => setLoading(false));
    } else {
      setLoginError("Incorrect credentials. Please try again.");
    }
  }
  function handleAdminLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAdminAuthed(false);
  }

  if (!loginChecked) return null;

  // ── LOGIN ─────────────────────────────────────────────────────────────────────
  if (!adminAuthed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-red-50/30 flex items-center justify-center p-4">
        {/* Background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="w-full max-w-[380px] relative">

          {/* Brand */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-600 shadow-xl shadow-red-200 mb-5">
              <Shield size={28} className="text-white" />
            </div>
            <div className="flex justify-center mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/Maintly.png" alt="Maintly" style={{ height: 24, objectFit: "contain" }} />
            </div>
            <p className="text-[12px] text-zinc-400 font-semibold tracking-widest uppercase">Admin Dashboard</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-2xl shadow-zinc-200/60 p-8">
            <h1 className="text-[18px] font-black text-zinc-900 mb-1">Sign in</h1>
            <p className="text-[13px] text-zinc-400 mb-6">Restricted to authorized personnel only.</p>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-zinc-600 mb-1.5 block">Username</label>
                <input
                  type="text" autoComplete="off" value={loginUser}
                  onChange={e => { setLoginUser(e.target.value); setLoginError(""); }}
                  placeholder="admin"
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-red-400 focus:ring-4 focus:ring-red-50 focus:bg-white rounded-xl px-4 py-3 text-[14px] text-zinc-900 placeholder-zinc-300 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-zinc-600 mb-1.5 block">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"} autoComplete="current-password" value={loginPass}
                    onChange={e => { setLoginPass(e.target.value); setLoginError(""); }}
                    placeholder="••••••••••"
                    className="w-full bg-zinc-50 border border-zinc-200 focus:border-red-400 focus:ring-4 focus:ring-red-50 focus:bg-white rounded-xl px-4 py-3 pr-12 text-[14px] text-zinc-900 placeholder-zinc-300 outline-none transition-all"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors p-1 rounded-lg hover:bg-zinc-100">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3.5 py-3">
                  <AlertCircle size={14} className="text-red-500 shrink-0" />
                  <p className="text-[12px] text-red-600 font-medium">{loginError}</p>
                </div>
              )}

              <button type="submit"
                className="w-full bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-bold py-3.5 rounded-xl text-[14px] transition-all shadow-lg shadow-red-200 mt-1">
                Access Admin Panel
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-zinc-300 mt-6 font-medium">MaintlyQR · Internal use only</p>
        </div>
      </div>
    );
  }

  // ── LOADING ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <div className="w-10 h-10 rounded-full border-[3px] border-zinc-100 border-t-red-600 animate-spin" />
        <p className="text-[13px] text-zinc-400 font-medium">Loading dashboard…</p>
      </div>
    );
  }

  const maxAssetCount = Math.max(...assetTypes.map(a => a.count), 1);
  const qrPct = totalQR > 0 ? Math.round((assignedQR / totalQR) * 100) : 0;
  const navItems = [
    { id: "overview",  label: "Overview",  icon: BarChart3 },
    { id: "mechanics", label: "Mechanics", icon: Users     },
    { id: "services",  label: "Services",  icon: Wrench    },
    { id: "qr",        label: "QR Codes",  icon: QrCode    },
  ] as const;

  return (
    <div className="min-h-screen bg-zinc-50/60 flex text-zinc-900 relative">

      {/* ══ MOBILE SIDEBAR BACKDROP ══ */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════════ */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-[240px] bg-white border-r border-zinc-200/80 flex flex-col shrink-0 transform transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>

        {/* Logo */}
        <div className="px-5 pt-5 pb-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center shadow-sm shrink-0">
              <Shield size={15} className="text-white" />
            </div>
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/Maintly.png" alt="Maintly" style={{ height: 17, objectFit: "contain" }} />
              <p className="text-[9px] font-bold text-red-500 tracking-[0.12em] uppercase leading-none mt-0.5">Admin Panel</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-400 hover:text-zinc-700">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest px-3 pt-2 pb-1.5">Navigation</p>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setSection(id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all text-left ${
                section === id
                  ? "bg-red-600 text-white shadow-sm shadow-red-200"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              }`}>
              <Icon size={15} className={section === id ? "text-white" : ""} />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-100 space-y-0.5">
          <Link href="/dashboard"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-all">
            <Layers size={15} />
            Mechanic View
          </Link>
          <button onClick={handleAdminLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-all">
            <LogOut size={15} />
            Log out
          </button>
        </div>
      </aside>

      {/* ══ MAIN ═════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <header className="bg-white border-b border-zinc-200/80 px-4 md:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden shrink-0 text-zinc-600 hover:text-zinc-900">
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="text-[18px] md:text-[22px] font-black text-zinc-900 leading-tight truncate">
                {section === "overview" && "Overview"}
                {section === "mechanics" && "Mechanics"}
                {section === "services" && "Services"}
                {section === "qr" && "QR Codes"}
              </h1>
              <p className="hidden sm:block text-[12px] text-zinc-400 font-medium mt-0.5">MaintlyQR operations dashboard</p>
            </div>
          </div>
          <button onClick={loadData} disabled={refreshing}
            className="shrink-0 flex items-center gap-2 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 text-[12px] font-bold px-3 md:px-4 py-2.5 rounded-xl transition-all disabled:opacity-40 shadow-sm">
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">

          {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
          {section === "overview" && (
            <div className="space-y-7">

              {/* KPI row */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Mechanics"       value={totalMechanics} icon={Users}  accent="bg-blue-500"   sub={`+${mechThisMonth} this month`}  trend={mechThisMonth > 0 ? `+${mechThisMonth}` : undefined} />
                <StatCard label="Assets Tracked"  value={totalAssets}    icon={Box}    accent="bg-purple-500" />
                <StatCard label="Services Logged" value={totalServices}  icon={Wrench} accent="bg-emerald-500" sub={`+${svcThisMonth} this month`} trend={svcThisMonth > 0 ? `+${svcThisMonth}` : undefined} />
                <StatCard label="QR Codes Issued" value={totalQR}        icon={QrCode} accent="bg-red-500"    sub={`${assignedQR} linked to assets`} />
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

                {/* QR Status */}
                <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <SectionTitle>QR Code Utilization</SectionTitle>
                    <span className="text-[20px] font-black text-zinc-900">{qrPct}%</span>
                  </div>
                  <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-700"
                      style={{ width: `${qrPct}%` }} />
                  </div>
                  <div className="flex gap-5">
                    <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <div>
                        <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Linked</p>
                        <p className="text-[22px] font-black text-emerald-700 leading-none">{assignedQR}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 flex-1">
                      <div className="w-2 h-2 rounded-full bg-zinc-300 shrink-0" />
                      <div>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Free</p>
                        <p className="text-[22px] font-black text-zinc-500 leading-none">{totalQR - assignedQR}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Asset breakdown */}
                <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
                  <SectionTitle>Fleet Breakdown</SectionTitle>
                  {assetTypes.length === 0 ? (
                    <p className="text-[13px] text-zinc-300 mt-4">No assets registered yet.</p>
                  ) : (
                    <div className="space-y-3 mt-4">
                      {assetTypes.map(({ type, count }) => {
                        const pct = Math.round((count / maxAssetCount) * 100);
                        return (
                          <div key={type} className="flex items-center gap-3">
                            <span className="text-[17px] w-6 shrink-0">{ASSET_ICONS[type] ?? "🔧"}</span>
                            <div className="flex-1">
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[12px] font-semibold text-zinc-700 capitalize">{type}</span>
                                <span className="text-[12px] font-bold text-zinc-900">{count}</span>
                              </div>
                              <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                <div className={`h-full ${ASSET_COLORS[type] ?? "bg-zinc-500"} rounded-full`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Activity row */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

                <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                    <SectionTitle>Recent Mechanics</SectionTitle>
                    <button onClick={() => setSection("mechanics")}
                      className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-red-600 transition-colors">
                      View all <ArrowUpRight size={12} />
                    </button>
                  </div>
                  <div className="divide-y divide-zinc-50">
                    {mechanics.slice(0, 5).map((m) => (
                      <div key={m.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-zinc-50/80 transition-colors">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${getAvatarColor(m.name)}`}>
                          {getInitials(m.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-zinc-900 truncate leading-tight">{m.name}</p>
                          <p className="text-[11px] text-zinc-400 truncate">{m.email}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] text-zinc-400">{formatDate(m.created_at)}</p>
                          {m.verified && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full mt-0.5">
                              <CheckCircle2 size={8} />VERIFIED
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {mechanics.length === 0 && (
                      <p className="px-6 py-8 text-[13px] text-zinc-300 text-center">No mechanics yet.</p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                    <SectionTitle>Recent Services</SectionTitle>
                    <button onClick={() => setSection("services")}
                      className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-red-600 transition-colors">
                      View all <ArrowUpRight size={12} />
                    </button>
                  </div>
                  <div className="divide-y divide-zinc-50">
                    {services.slice(0, 5).map((s) => (
                      <div key={s.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-zinc-50/80 transition-colors">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${TYPE_COLORS[s.service_type] ?? "bg-zinc-100 text-zinc-500 border border-zinc-200"}`}>
                          {s.service_type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-zinc-900 truncate leading-tight">{s.asset_label}</p>
                          <p className="text-[11px] text-zinc-400 truncate">by {s.mechanic_name}</p>
                        </div>
                        <p className="text-[11px] text-zinc-400 shrink-0">{s.service_date}</p>
                      </div>
                    ))}
                    {services.length === 0 && (
                      <p className="px-6 py-8 text-[13px] text-zinc-300 text-center">No services yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── MECHANICS ────────────────────────────────────────────────────── */}
          {section === "mechanics" && (
            <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
              <div className="px-7 py-5 border-b border-zinc-100 flex items-center justify-between">
                <div>
                  <SectionTitle>{totalMechanics} Registered Mechanics</SectionTitle>
                  <p className="text-[12px] text-zinc-400 mt-0.5">+{mechThisMonth} joined this month</p>
                </div>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    {["Mechanic", "Email", "Workshop", "Status", "Joined"].map(h => (
                      <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {mechanics.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-7 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-black shrink-0 ${getAvatarColor(m.name)}`}>
                            {getInitials(m.name)}
                          </div>
                          <span className="text-[13px] font-bold text-zinc-900">{m.name}</span>
                        </div>
                      </td>
                      <td className="px-7 py-4 text-[12px] text-zinc-500">{m.email}</td>
                      <td className="px-7 py-4 text-[12px] text-zinc-500">{m.workshop_name ?? <span className="text-zinc-300">Not set</span>}</td>
                      <td className="px-7 py-4">
                        {m.verified
                          ? <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full"><CheckCircle2 size={11} />Verified</span>
                          : <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 bg-zinc-50 border border-zinc-200 px-2.5 py-1 rounded-full"><Clock size={11} />Pending</span>
                        }
                      </td>
                      <td className="px-7 py-4 text-[12px] text-zinc-400">{formatDate(m.created_at)}</td>
                    </tr>
                  ))}
                  {mechanics.length === 0 && (
                    <tr><td colSpan={5} className="px-7 py-16 text-center text-[13px] text-zinc-300">No mechanics registered yet.</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* ── SERVICES ─────────────────────────────────────────────────────── */}
          {section === "services" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Total Services", value: totalServices, color: "text-zinc-900" },
                  { label: "This Month", value: svcThisMonth, color: "text-emerald-600" },
                  { label: "Avg per Mechanic", value: totalMechanics > 0 ? (totalServices / totalMechanics).toFixed(1) : "—", color: "text-zinc-900" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{label}</p>
                    <p className={`text-[36px] font-black leading-none ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                <div className="px-7 py-5 border-b border-zinc-100">
                  <SectionTitle>Service History</SectionTitle>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-100">
                      {["Asset", "Service Type", "Mechanic", "Date"].map(h => (
                        <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {services.map((s) => (
                      <tr key={s.id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="px-7 py-4 text-[13px] font-bold text-zinc-900">{s.asset_label}</td>
                        <td className="px-7 py-4">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${TYPE_COLORS[s.service_type] ?? "bg-zinc-100 text-zinc-500 border border-zinc-200"}`}>
                            {s.service_type}
                          </span>
                        </td>
                        <td className="px-7 py-4 text-[12px] text-zinc-500">{s.mechanic_name}</td>
                        <td className="px-7 py-4 text-[12px] text-zinc-400">{s.service_date}</td>
                      </tr>
                    ))}
                    {services.length === 0 && (
                      <tr><td colSpan={4} className="px-7 py-16 text-center text-[13px] text-zinc-300">No services logged yet.</td></tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {/* ── QR CODES ─────────────────────────────────────────────────────── */}
          {section === "qr" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Total QR Codes", value: totalQR, color: "text-zinc-900" },
                  { label: "Linked to Assets", value: assignedQR, color: "text-emerald-600" },
                  { label: "Available", value: totalQR - assignedQR, color: "text-zinc-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{label}</p>
                    <p className={`text-[36px] font-black leading-none ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-zinc-200/80 rounded-2xl p-7 shadow-sm">
                <div className="flex items-end justify-between mb-5">
                  <div>
                    <SectionTitle>Utilization Rate</SectionTitle>
                    <p className="text-[12px] text-zinc-400 mt-1">{assignedQR} of {totalQR} QR codes are linked to an asset</p>
                  </div>
                  <p className="text-[40px] font-black text-zinc-900 leading-none">{qrPct}%</p>
                </div>
                <div className="w-full h-4 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-600 via-red-500 to-red-400 rounded-full transition-all duration-700"
                    style={{ width: `${qrPct}%` }} />
                </div>
                <div className="flex justify-between mt-3">
                  <span className="text-[11px] text-zinc-400 font-medium">0%</span>
                  <span className="text-[11px] text-zinc-400 font-medium">100%</span>
                </div>
                {totalQR === 0 && (
                  <div className="mt-5 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <AlertCircle size={16} className="text-amber-500 shrink-0" />
                    <p className="text-[12px] text-amber-700 font-medium">No QR codes created yet. Generate them from the mechanic dashboard.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-center text-[10px] text-zinc-300 mt-12 font-medium">MaintlyQR Admin · Internal use only</p>
        </div>
      </div>
    </div>
  );
}
