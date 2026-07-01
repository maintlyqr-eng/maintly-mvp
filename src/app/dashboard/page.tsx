"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings, Search, Bell, ChevronDown, Plus, MoreVertical,
  CheckCircle2, Crown, ChevronLeft, ChevronRight
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/dashboard", active: true },
  { icon: FileText, label: "My Services", href: "/dashboard/services" },
  { icon: Box, label: "Assets", href: "/dashboard/assets" },
  { icon: QrCode, label: "QR Codes", href: "#" },
  { icon: Users, label: "Customers", href: "#" },
  { icon: BarChart3, label: "Reports", href: "#" },
  { icon: CalendarIcon, label: "Calendar", href: "#" },
  { icon: Mail, label: "Messages", href: "#", badge: 2 },
  { icon: FolderOpen, label: "Document Library", href: "#" },
  { icon: Settings, label: "Settings", href: "#" },
];

const assetTypeImg: Record<string, string> = {
  automotive: "/images/pickup.png",
  motorcycle: "/images/moto.png",
  generator: "/images/generador.png",
  machinery: "/images/excavator.png",
  marine: "/images/barco.png",
  aviation: "/images/avion.png",
};

const typeColors: Record<string, string> = {
  "Oil Change":       "bg-amber-100 text-amber-700",
  "Service":          "bg-blue-100 text-blue-700",
  "General Service":  "bg-blue-100 text-blue-700",
  "Repair":           "bg-red-100 text-red-700",
  "Inspection":       "bg-purple-100 text-purple-700",
  "Filter Change":    "bg-green-100 text-green-700",
  "Tire Change":      "bg-cyan-100 text-cyan-700",
  "Brake Service":    "bg-orange-100 text-orange-700",
  "50A Service":      "bg-red-100 text-red-700",
  "50B Service":      "bg-orange-100 text-orange-700",
  "500 Hour Service": "bg-purple-100 text-purple-700",
  "Engine Check":     "bg-cyan-100 text-cyan-700",
};

const upcomingTasks = [
  { asset: "Aggreko XAVB 1000", type: "50B Service", date: "25 May", urgency: "Tomorrow", urgent: true, color: "bg-red-50 text-red-500" },
  { asset: "Caterpillar 320D", type: "500 Hour Service", date: "28 May", urgency: "In 4 days", urgent: false, color: "bg-amber-50 text-amber-500" },
  { asset: "Ford Ranger XLT", type: "Customer Follow-up", date: "30 May", urgency: "In 6 days", urgent: false, color: "bg-blue-50 text-blue-500" },
];

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
  assets: AssetInfo[] | null;
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
  const [calendarMonth] = useState("May 2026");
  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [realServices, setRealServices] = useState<RealService[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalServices, setTotalServices] = useState(0);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
      } else {
        const name = session.user.user_metadata?.name || session.user.email || "User";
        setUserName(name);
        const parts = name.split(" ");
        setUserInitials(parts.map((p: string) => p[0]).join("").toUpperCase().slice(0, 2));
        setAuthChecked(true);

        (async () => {
          const { data: userAssets } = await supabase
            .from("assets")
            .select("id")
            .eq("user_id", session.user.id);

          const assetIds = (userAssets ?? []).map((a: { id: string }) => a.id);
          setTotalAssets(assetIds.length);

          if (assetIds.length > 0) {
            const { data: svcs } = await supabase
              .from("service_records")
              .select("id, service_date, service_type, km_hours, notes, asset_id, assets(brand, model, nickname, asset_type, vin_serial)")
              .in("asset_id", assetIds)
              .order("service_date", { ascending: false })
              .limit(6);

            setRealServices((svcs as unknown as RealService[]) ?? []);

            const { count } = await supabase
              .from("service_records")
              .select("*", { count: "exact", head: true })
              .in("asset_id", assetIds);

            setTotalServices(count ?? 0);
          }
        })();
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  if (!authChecked) return null;

  // calendario simple estático (días del mes)
  const calendarDays = [
    [28,29,30,1,2,3,4],
    [5,6,7,8,9,10,11],
    [12,13,14,15,16,17,18],
    [19,20,21,22,23,24,25],
    [26,27,28,29,30,31,1],
  ];
  const otherMonth = [28,29,30,31,1];

  return (
    <div className="min-h-screen bg-zinc-50 flex">

      {/* ════════════════════════════════
          SIDEBAR
      ════════════════════════════════ */}
      <aside className="w-[230px] bg-white border-r border-zinc-200 flex flex-col shrink-0">
        {/* Logo */}
        <div className="flex items-center px-3 py-3">
          <Image src="/images/qr-gear.png" alt="Maintly" width={72} height={72} className="object-contain drop-shadow-md shrink-0 mt-4" priority />
          <Image src="/images/Maintly.png" alt="Maintly" width={1080} height={1080} className="object-contain w-[155px] h-auto -ml-9 mt-5" priority />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 mt-2">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`flex items-center justify-between gap-3 px-3 py-[9px] rounded-lg mb-1 text-[13px] font-medium transition-colors ${
                item.active
                  ? "bg-red-50 text-red-600 border-l-[3px] border-red-600 -ml-[1px]"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon size={16} />
                {item.label}
              </div>
              {item.badge && (
                <span className="bg-red-600 text-white text-[10px] font-bold w-[18px] h-[18px] rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </a>
          ))}
        </nav>

        {/* Premium box */}
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

        {/* User */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-t border-zinc-200">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[12px] shrink-0">
            {userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-zinc-800 leading-tight truncate">{userName}</p>
            <p className="text-[10px] text-zinc-400 leading-tight">View Profile</p>
          </div>
          <ChevronRight size={14} className="text-zinc-300" />
        </div>
      </aside>

      {/* ════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="flex items-center justify-between px-7 py-4 bg-white border-b border-zinc-200">
          <div>
            <h1 className="text-[20px] font-black text-zinc-900">Dashboard</h1>
            <p className="text-[12px] text-zinc-400">Welcome back, {userName.split(" ")[0]}! Here&apos;s what&apos;s happening with your maintenance work.</p>
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
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold w-[15px] h-[15px] rounded-full flex items-center justify-center">3</span>
            </button>

            <div className="flex items-center gap-2 pl-3 border-l border-zinc-200">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[13px]">{userInitials}</div>
              <div className="max-w-[120px]">
                <p className="text-[12px] font-bold text-zinc-800 leading-tight truncate">{userName}</p>
                <p className="text-[10px] text-zinc-400 leading-tight">Mechanic</p>
              </div>
              <ChevronDown size={14} className="text-zinc-400" />
            </div>
          </div>
        </header>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-7">

          {/* Add service button row */}
          <div className="flex justify-end mb-5 -mt-2">
            <a href="/dashboard/services" className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white text-[13px] font-bold px-4 py-[10px] rounded-xl shadow-sm">
              <Plus size={15} /> Add Service
            </a>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">

            {/* ── LEFT COLUMN ── */}
            <div>
              {/* Stats cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                {[
                  { label: "TOTAL SERVICES", value: totalServices, icon: CalendarIcon, color: "bg-red-50 text-red-500" },
                  { label: "TOTAL ASSETS", value: totalAssets, icon: Box, color: "bg-blue-50 text-blue-500" },
                  { label: "LAST SERVICE", value: realServices[0] ? new Date(realServices[0].service_date + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short" }) : "—", icon: CheckCircle2, color: "bg-green-50 text-green-500" },
                  { label: "LAST KM / HRS", value: (realServices[0]?.km_hours ?? null) != null ? String(realServices[0].km_hours) : "—", icon: BarChart3, color: "bg-amber-50 text-amber-500" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                      <Icon size={16} />
                    </div>
                    <p className="text-[9px] font-bold text-zinc-400 tracking-wide">{label}</p>
                    <p className="text-[24px] font-black text-zinc-900 mt-1">{value}</p>
                  </div>
                ))}
              </div>

              {/* Recent Services table */}
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[15px] font-black text-zinc-900">Recent Services</h2>
                  <a href="#" className="text-[12px] font-semibold text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-lg px-3 py-[6px] transition-colors">View all</a>
                </div>

                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[10px] text-zinc-400 font-bold uppercase">
                      <th className="pb-2 font-bold">Asset</th>
                      <th className="pb-2 font-bold">Service Type</th>
                      <th className="pb-2 font-bold">Date</th>
                      <th className="pb-2 font-bold">Hours</th>
                      <th className="pb-2 font-bold">Status</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {realServices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-zinc-400 text-[13px]">
                          No services recorded yet.
                        </td>
                      </tr>
                    ) : (
                      realServices.map((s) => {
                        const asset = Array.isArray(s.assets) ? (s.assets[0] ?? null) : null;
                        const assetName = asset?.nickname || [asset?.brand, asset?.model].filter(Boolean).join(" ") || "Asset";
                        const assetSerial = asset?.vin_serial || s.asset_id.slice(0, 8).toUpperCase();
                        const assetImg = assetTypeImg[asset?.asset_type ?? ""] ?? "/images/pickup.png";
                        const typeColor = typeColors[s.service_type] ?? "bg-zinc-100 text-zinc-700";
                        const dateStr = new Date(s.service_date + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
                        return (
                          <tr key={s.id} className="border-t border-zinc-100">
                            <td className="py-3 pr-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                                  <Image src={assetImg} alt={assetName} width={32} height={32} className="object-contain" />
                                </div>
                                <div>
                                  <p className="text-[12.5px] font-bold text-zinc-800 leading-tight">{assetName}</p>
                                  <p className="text-[10px] text-zinc-400 leading-tight font-mono">{assetSerial}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pr-3">
                              <span className={`text-[10.5px] font-semibold px-2 py-[3px] rounded-full ${typeColor}`}>{s.service_type}</span>
                            </td>
                            <td className="py-3 pr-3">
                              <p className="text-[12px] text-zinc-700">{dateStr}</p>
                            </td>
                            <td className="py-3 pr-3 text-[12px] text-zinc-700 font-medium">
                              {s.km_hours != null ? s.km_hours.toLocaleString() : "—"}
                            </td>
                            <td className="py-3 pr-3">
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-green-600">
                                <CheckCircle2 size={12} /> Completed
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <button className="text-zinc-300 hover:text-zinc-600 transition-colors">
                                <MoreVertical size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-5">

              {/* Calendar */}
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-black text-zinc-900">Calendar</h3>
                  <a href="#" className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-lg px-2 py-[4px] transition-colors">View calendar</a>
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
                    const isOther = (i < 3) || (i > 32);
                    const isToday = day === 24 && !isOther;
                    const hasDot = [21,22,23].includes(day) && !isOther;
                    return (
                      <div key={i} className="flex flex-col items-center py-1">
                        <span className={`text-[11px] w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday ? "bg-red-600 text-white font-bold" : isOther ? "text-zinc-300" : "text-zinc-600"
                        }`}>
                          {day}
                        </span>
                        {hasDot && <span className="w-1 h-1 rounded-full bg-red-500 -mt-1" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Upcoming Tasks */}
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-black text-zinc-900">Upcoming Tasks</h3>
                  <a href="#" className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-lg px-2 py-[4px] transition-colors">View all</a>
                </div>
                <div className="space-y-3">
                  {upcomingTasks.map((t) => (
                    <div key={t.asset} className="flex items-center justify-between">
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
              </div>

              {/* Your Statistics */}
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-black text-zinc-900">Your Statistics</h3>
                  <button className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 border border-zinc-200 rounded-lg px-2 py-[4px]">
                    This Month <ChevronDown size={11} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "SERVICES COMPLETED", value: totalServices, color: "#16a34a" },
                    { label: "TOTAL ASSETS", value: totalAssets, color: "#2563eb" },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="text-[8.5px] font-bold text-zinc-400 tracking-wide">{s.label}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[18px] font-black text-zinc-900">{s.value}</p>
                      </div>
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
