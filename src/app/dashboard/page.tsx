"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings, Search, Bell, ChevronDown, Plus, MoreVertical,
  CheckCircle2, Clock, TrendingUp, TrendingDown, Crown, ChevronLeft, ChevronRight, LogOut
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const navItems = [
  { icon: LayoutGrid,   label: "Dashboard",        href: "/dashboard",          active: true  },
  { icon: FileText,     label: "My Services",      href: "/dashboard/services", active: false },
  { icon: Box,          label: "Assets",           href: "/dashboard/assets",   active: false },
  { icon: QrCode,       label: "QR Codes",         href: "/dashboard/assets",   active: false },
  { icon: Users,        label: "Customers",        href: "#",                   active: false },
  { icon: BarChart3,    label: "Reports",          href: "#",                   active: false },
  { icon: CalendarIcon, label: "Calendar",         href: "#",                   active: false },
  { icon: Mail,         label: "Messages",         href: "#",                   active: false },
  { icon: FolderOpen,   label: "Document Library", href: "#",                   active: false },
  { icon: Settings,     label: "Settings",         href: "#",                   active: false },
];

const typeColors: Record<string, string> = {
  "Oil Change":    "bg-amber-100 text-amber-700",
  Service:         "bg-blue-100 text-blue-700",
  Repair:          "bg-red-100 text-red-700",
  Inspection:      "bg-purple-100 text-purple-700",
  "Filter Change": "bg-green-100 text-green-700",
  "Tire Change":   "bg-cyan-100 text-cyan-700",
  "Brake Service": "bg-orange-100 text-orange-700",
};

const assetTypeImg: Record<string, string> = {
  automotive: "/images/pickup.png",
  motorcycle:  "/images/moto.png",
  generator:   "/images/generador.png",
  machinery:   "/images/excavator.png",
  marine:      "/images/barco.png",
  aviation:    "/images/avion.png",
};

type AssetInfo = {
  brand: string | null;
  model: string | null;
  nickname: string | null;
  asset_type: string;
  vin_serial: string | null;
};

type RealService = {
  id: string;
  service_date: string;
  service_type: string;
  km_hours: number | null;
  notes: string | null;
  asset_id: string;
  assets: AssetInfo | AssetInfo[] | null;
};

function MiniSparkline({ color }: { color: string }) {
  const points = "0,28 10,24 20,26 30,20 40,22 50,15 60,17 70,10 80,12 90,5 100,8";
  return (
    <svg viewBox="0 0 100 32" className="w-full h-8 mt-1" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [totalServices, setTotalServices] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);
  const [realServices, setRealServices] = useState<RealService[]>([]);

  useEffect(() => {
    let active = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      if (!active) return;

      setMechanicEmail(session.user.email ?? "");

      const { data: mechanic } = await supabase
        .from("mechanics").select("name").eq("id", session.user.id).single();
      if (active && mechanic) setMechanicName(mechanic.name);

      const { count: assetCount } = await supabase
        .from("assets").select("*", { count: "exact", head: true })
        .eq("created_by", session.user.id);
      if (active) setTotalAssets(assetCount ?? 0);

      const { data: svcs } = await supabase
        .from("service_records")
        .select("id, service_date, service_type, km_hours, notes, asset_id, assets(brand, model, nickname, asset_type, vin_serial)")
        .eq("mechanic_id", session.user.id)
        .order("service_date", { ascending: false })
        .limit(6);
      if (active) setRealServices((svcs as unknown as RealService[]) ?? []);

      const { count: svcCount } = await supabase
        .from("service_records").select("*", { count: "exact", head: true })
        .eq("mechanic_id", session.user.id);
      if (active) setTotalServices(svcCount ?? 0);

      if (active) setAuthChecked(true);
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

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">Loading...</p>
      </div>
    );
  }

  const displayName = mechanicName || mechanicEmail;
  const initials = displayName.split(" ").filter(Boolean).map((p: string) => p[0]).join("").toUpperCase().slice(0, 2) || "ME";

  const statsCards = [
    { label: "TOTAL SERVICES", value: String(totalServices), up: true,  icon: CalendarIcon, color: "bg-red-50 text-red-500"   },
    { label: "TOTAL ASSETS",   value: String(totalAssets),   up: true,  icon: Box,          color: "bg-blue-50 text-blue-500"  },
    { label: "COMPLETED",      value: String(totalServices), up: true,  icon: CheckCircle2, color: "bg-green-50 text-green-500" },
    { label: "PENDING",        value: "0",                   up: true,  icon: Clock,        color: "bg-amber-50 text-amber-500" },
  ];

  const calendarMonth = "June 2026";
  const calendarDays = [
    [26,27,28,29,30,31,1],
    [2,3,4,5,6,7,8],
    [9,10,11,12,13,14,15],
    [16,17,18,19,20,21,22],
    [23,24,25,26,27,28,29],
    [30,1,2,3,4,5,6],
  ];

  const miniStats = [
    { label: "SERVICES",  value: String(totalServices), color: "#16a34a" },
    { label: "ASSETS",    value: String(totalAssets),   color: "#2563eb" },
    { label: "COMPLETED", value: String(totalServices), color: "#7c3aed" },
    { label: "PENDING",   value: "0",                   color: "#ea580c" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex">

      {/* ════ SIDEBAR ════ */}
      <aside className="w-[230px] bg-white border-r border-zinc-200 flex flex-col shrink-0">

        <Link href="/" className="flex items-center gap-1.5 px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/qr-gear.png" alt="" className="h-7 w-auto" />
          <span className="font-black text-zinc-900 tracking-wider text-[17px] leading-none">MAIN<span className="text-red-600">TLY</span></span>
        </Link>

        <nav className="flex-1 px-3">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-[9px] rounded-lg mb-1 text-[13px] font-medium transition-colors ${
                item.active
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
            <p className="text-[12px] font-bold text-zinc-800 leading-tight truncate">{displayName}</p>
            <p className="text-[10px] text-zinc-400 leading-tight">Log out</p>
          </div>
          <LogOut size={14} className="text-zinc-300" />
        </button>
      </aside>

      {/* ════ MAIN CONTENT ════ */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="flex items-center justify-between px-7 py-4 bg-white border-b border-zinc-200">
          <div>
            <h1 className="text-[20px] font-black text-zinc-900">Dashboard</h1>
            <p className="text-[12px] text-zinc-400">Welcome back, {mechanicName || "Mechanic"}! Here&apos;s what&apos;s happening with your maintenance work.</p>
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
                <p className="text-[12px] font-bold text-zinc-800 leading-tight">{displayName}</p>
                <p className="text-[10px] text-zinc-400 leading-tight">Mechanic</p>
              </div>
              <ChevronDown size={14} className="text-zinc-400" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-7">

          <div className="flex justify-end mb-5 -mt-2">
            <Link
              href="/dashboard/services"
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white text-[13px] font-bold px-4 py-[10px] rounded-xl shadow-sm"
            >
              <Plus size={15} /> Add Service
            </Link>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">

            {/* ── LEFT COLUMN ── */}
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                {statsCards.map(({ label, value, up, icon: Icon, color }) => (
                  <div key={label} className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                      <Icon size={16} />
                    </div>
                    <p className="text-[9px] font-bold text-zinc-400 tracking-wide">{label}</p>
                    <p className="text-[24px] font-black text-zinc-900 mt-1">{value}</p>
                    <div className={`flex items-center gap-1 text-[10px] font-semibold mt-1 ${up ? "text-green-600" : "text-red-500"}`}>
                      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      Your totals
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[15px] font-black text-zinc-900">Recent Services</h2>
                  <Link href="/dashboard/services" className="text-[12px] font-semibold text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-lg px-3 py-[6px] transition-colors">View all</Link>
                </div>

                {realServices.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-[13px] text-zinc-400 mb-3">No services recorded yet.</p>
                    <Link href="/dashboard/services" className="text-[12px] font-bold text-red-600 hover:text-red-700">Log your first service →</Link>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-[10px] text-zinc-400 font-bold uppercase">
                        <th className="pb-2 font-bold">Asset</th>
                        <th className="pb-2 font-bold">Service Type</th>
                        <th className="pb-2 font-bold">Date</th>
                        <th className="pb-2 font-bold">Km / Hrs</th>
                        <th className="pb-2 font-bold">Status</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {realServices.map((s) => {
                        const asset = Array.isArray(s.assets) ? s.assets[0] ?? null : (s.assets as AssetInfo | null);
                        const img = asset ? assetTypeImg[asset.asset_type] ?? "/images/pickup.png" : "/images/pickup.png";
                        const label = asset?.nickname || [asset?.brand, asset?.model].filter(Boolean).join(" ") || "Unknown asset";
                        return (
                          <tr key={s.id} className="border-t border-zinc-100">
                            <td className="py-3 pr-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                                  <Image src={img} alt={label} width={32} height={32} className="object-contain" />
                                </div>
                                <div>
                                  <p className="text-[12.5px] font-bold text-zinc-800 leading-tight">{label}</p>
                                  <p className="text-[10px] text-zinc-400 leading-tight font-mono">{asset?.vin_serial ?? "—"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pr-3">
                              <span className={`text-[10.5px] font-semibold px-2 py-[3px] rounded-full ${typeColors[s.service_type] ?? "bg-zinc-100 text-zinc-700"}`}>{s.service_type}</span>
                            </td>
                            <td className="py-3 pr-3 text-[12px] text-zinc-700">{s.service_date}</td>
                            <td className="py-3 pr-3 text-[12px] text-zinc-700 font-medium">{s.km_hours ?? "—"}</td>
                            <td className="py-3 pr-3">
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-green-600">
                                <CheckCircle2 size={12} /> Completed
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <button className="text-zinc-300 hover:text-zinc-600 transition-colors"><MoreVertical size={15} /></button>
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
                </div>
                <div className="flex items-center justify-between mb-3">
                  <button className="text-zinc-400 hover:text-zinc-700"><ChevronLeft size={16} /></button>
                  <span className="text-[12px] font-bold text-zinc-700">{calendarMonth}</span>
                  <button className="text-zinc-400 hover:text-zinc-700"><ChevronRight size={16} /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {["MON","TUE","WED","THU","FRI","SAT","SUN"].map(d => (
                    <span key={d} className="text-[8px] font-bold text-zinc-400 pb-1">{d}</span>
                  ))}
                  {calendarDays.flat().map((day, i) => {
                    const isOther = (i < 5 && day > 20) || (i > 35 && day < 10);
                    const isToday = day === 30 && !isOther && i < 35;
                    return (
                      <div key={i} className="flex flex-col items-center py-1">
                        <span className={`text-[11px] w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday ? "bg-red-600 text-white font-bold" : isOther ? "text-zinc-300" : "text-zinc-600"
                        }`}>{day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
                <h3 className="text-[13px] font-black text-zinc-900 mb-3">Quick Access</h3>
                <div className="space-y-2">
                  <Link href="/dashboard/services" className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                      <FileText size={14} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-zinc-800 leading-tight">My Services</p>
                      <p className="text-[10px] text-zinc-400">{totalServices} records</p>
                    </div>
                  </Link>
                  <Link href="/dashboard/assets" className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <Box size={14} className="text-blue-500" />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-zinc-800 leading-tight">Assets &amp; QR Codes</p>
                      <p className="text-[10px] text-zinc-400">{totalAssets} assets registered</p>
                    </div>
                  </Link>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
                <h3 className="text-[13px] font-black text-zinc-900 mb-3">Your Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                  {miniStats.map((s) => (
                    <div key={s.label}>
                      <p className="text-[8.5px] font-bold text-zinc-400 tracking-wide">{s.label}</p>
                      <p className="text-[18px] font-black text-zinc-900">{s.value}</p>
                      <MiniSparkline color={s.color} />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          <p className="text-center text-[11px] text-zinc-400 mt-8">© 2026 Maintly. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
