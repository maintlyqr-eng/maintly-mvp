"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings, Bell, X, LogOut, Crown, Menu,
  Search, ExternalLink, ClipboardList, History
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import HoverAvatar from "@/components/HoverAvatar";
import { formatDateDMY } from "@/lib/date";

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/dashboard" },
  { icon: FileText, label: "My Services", href: "/dashboard/services" },
  { icon: Bell, label: "Scheduled Services", href: "/dashboard/scheduled" },
  { icon: Box, label: "Assets", href: "/dashboard/assets" },
  { icon: QrCode, label: "QR Codes", href: "/dashboard/assets" },
  { icon: Users, label: "Customers", href: "#" },
  { icon: BarChart3, label: "Reports", href: "/dashboard/reports" },
  { icon: CalendarIcon, label: "Calendar", href: "/dashboard/calendar" },
  { icon: Mail, label: "Messages", href: "#" },
  { icon: FolderOpen, label: "Document Library", href: "#" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

const assetTypeImg: Record<string, string> = {
  automotive: "/images/car.png",
  motorcycle: "/images/moto.png",
  generator: "/images/generador.png",
  machinery: "/images/excavator.png",
  marine: "/images/barco.png",
  aviation: "/images/avion.png",
};

const assetTypeLabel: Record<string, string> = {
  automotive: "Automotive",
  motorcycle: "Motorcycle",
  generator: "Generator",
  machinery: "Machinery",
  marine: "Marine",
  aviation: "Aviation",
};

type ReportAsset = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  asset_type: string;
  qrCode: string | null;
  totalServices: number;
  lastServiceDate: string | null;
};

export default function ReportsPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicPhoto, setMechanicPhoto] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [reportAssets, setReportAssets] = useState<ReportAsset[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    let active = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      if (!active) return;

      setMechanicEmail(session.user.email ?? "");

      const { data: mechanic } = await supabase
        .from("mechanics").select("name, photo_url").eq("id", session.user.id).single();
      if (active && mechanic) { setMechanicName(mechanic.name); setMechanicPhoto(mechanic.photo_url ?? ""); }

      setLoading(true);

      const { data: assetRows } = await supabase
        .from("mechanic_assets")
        .select("assets(id, nickname, brand, model, asset_type, qr_codes(code))")
        .eq("mechanic_id", session.user.id);

      const { data: svcRows } = await supabase
        .from("service_records")
        .select("asset_id, service_date")
        .eq("mechanic_id", session.user.id);

      const statsByAsset: Record<string, { count: number; lastDate: string | null }> = {};
      for (const s of (svcRows ?? []) as any[]) {
        const cur = statsByAsset[s.asset_id] ?? { count: 0, lastDate: null };
        cur.count += 1;
        if (!cur.lastDate || s.service_date > cur.lastDate) cur.lastDate = s.service_date;
        statsByAsset[s.asset_id] = cur;
      }

      const list: ReportAsset[] = ((assetRows ?? []) as any[])
        .map((r) => {
          const a = Array.isArray(r.assets) ? r.assets[0] : r.assets;
          if (!a) return null;
          const qr = Array.isArray(a.qr_codes) ? a.qr_codes[0]?.code : a.qr_codes?.code;
          const stats = statsByAsset[a.id] ?? { count: 0, lastDate: null };
          return {
            id: a.id,
            name: a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || "Unknown Asset",
            brand: a.brand ?? null,
            model: a.model ?? null,
            asset_type: a.asset_type,
            qrCode: qr ?? null,
            totalServices: stats.count,
            lastServiceDate: stats.lastDate,
          };
        })
        .filter(Boolean) as ReportAsset[];

      list.sort((x, y) => x.name.localeCompare(y.name));

      if (active) setReportAssets(list);
      if (active) setLoading(false);
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

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">Loading...</p>
      </div>
    );
  }

  const initials = mechanicName.split(" ").filter(Boolean).map(p => p[0]).join("").slice(0, 2).toUpperCase() || "ME";

  const availableTypes = Array.from(new Set(reportAssets.map((a) => a.asset_type)));

  const totalReports = reportAssets.length;
  const totalServicesLogged = reportAssets.reduce((sum, a) => sum + a.totalServices, 0);
  const withoutQr = reportAssets.filter((a) => !a.qrCode).length;

  const visibleReports = reportAssets.filter((a) => {
    if (typeFilter !== "all" && a.asset_type !== typeFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const haystack = [a.name, a.brand, a.model, a.qrCode].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q);
  });

  return (
    <div className="min-h-screen bg-zinc-50 flex relative">

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ════ SIDEBAR ════ */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-[230px] bg-white border-r border-zinc-200 flex flex-col shrink-0 transform transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-2">
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/qr-gear.png" alt="Maintly" style={{width: 72, height: 72, objectFit: "contain"}} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/Maintly.png" alt="" style={{width: 152, objectFit: "contain", marginLeft: -18}} />
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-400 hover:text-zinc-700 mr-2">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 -mt-4 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-[9px] rounded-lg mb-1 text-[13px] font-medium transition-colors ${
                item.label === "Reports"
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

        <div className="flex items-center gap-2.5 px-4 py-3 border-t border-zinc-200">
          <Link href="/dashboard/settings" className="shrink-0">
            {mechanicPhoto ? (
              <HoverAvatar src={mechanicPhoto} size={32} />
            ) : (
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[12px]">{initials}</div>
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-zinc-800 leading-tight truncate">{mechanicName || mechanicEmail}</p>
            <p className="text-[10px] text-zinc-400 leading-tight">Maintly Mechanic</p>
          </div>
        </div>
      </aside>

      {/* ════ MAIN ════ */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="flex items-center justify-between gap-3 px-4 md:px-7 py-4 bg-white border-b border-zinc-200">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden shrink-0 text-zinc-600 hover:text-zinc-900">
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="text-[17px] md:text-[20px] font-black text-zinc-900 truncate">Reports</h1>
              <p className="hidden sm:block text-[12px] text-zinc-400 truncate">Every service history report your workshop has generated, in one place.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <button className="relative text-zinc-500 hover:text-zinc-800 transition-colors"><Bell size={19} /></button>
            <div className="flex items-center gap-3 md:pl-3 md:border-l border-zinc-200">
              <div className="flex items-center gap-2.5">
                <Link href="/dashboard/settings" className="shrink-0">
                  {mechanicPhoto ? (
                    <HoverAvatar src={mechanicPhoto} size={36} />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[13px]">{initials}</div>
                  )}
                </Link>
                <div className="hidden sm:block text-left">
                  <p className="text-[12px] font-bold text-zinc-800 leading-tight">{mechanicName || mechanicEmail}</p>
                  <p className="text-[10px] text-zinc-400 leading-tight">Mechanic</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500 hover:text-red-600 hover:bg-red-50 border border-zinc-200 hover:border-red-200 px-3 py-2 rounded-xl transition-all"
              >
                <LogOut size={13} />
                <span className="hidden md:inline">Log out</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-7">

          {/* ── SUMMARY CARDS ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Total Reports</p>
              <p className="text-[26px] font-black text-zinc-900 mt-1">{totalReports}</p>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Services Logged</p>
              <p className="text-[26px] font-black text-zinc-900 mt-1">{totalServicesLogged}</p>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Missing QR Code</p>
              <p className="text-[26px] font-black text-zinc-900 mt-1">{withoutQr}</p>
            </div>
          </div>

          {/* ── SEARCH + FILTER ── */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by asset name, brand, model or QR code..."
                className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400 transition-colors"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              <button
                onClick={() => setTypeFilter("all")}
                className={`shrink-0 px-3 py-[7px] rounded-full text-[12px] font-bold transition-colors ${typeFilter === "all" ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}
              >
                All Types
              </button>
              {availableTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(typeFilter === t ? "all" : t)}
                  className={`shrink-0 px-3 py-[7px] rounded-full text-[12px] font-bold transition-colors ${typeFilter === t ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}
                >
                  {assetTypeLabel[t] ?? t}
                </button>
              ))}
            </div>
          </div>

          {/* ── LIST ── */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
            {loading ? (
              <p className="text-[13px] text-zinc-400 text-center py-12">Loading reports...</p>
            ) : visibleReports.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-zinc-100 bg-zinc-50 mb-3">
                  <ClipboardList size={20} className="text-zinc-300" />
                </div>
                <p className="text-[13px] text-zinc-400 mb-1">
                  {reportAssets.length === 0 ? "No reports yet." : "No reports match your search."}
                </p>
                {reportAssets.length === 0 && (
                  <p className="text-[12px] text-zinc-300">
                    Add an asset in <Link href="/dashboard/assets" className="font-bold text-red-500 hover:text-red-600">Assets</Link> to generate its first report.
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {/* header row (desktop) */}
                <div className="hidden md:flex items-center gap-3 px-5 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                  <div className="w-10 shrink-0" />
                  <div className="flex-1 min-w-0">Asset</div>
                  <div className="w-28 shrink-0">Type</div>
                  <div className="w-24 shrink-0 text-center">Services</div>
                  <div className="w-32 shrink-0">Last Service</div>
                  <div className="w-36 shrink-0 text-right">Report</div>
                </div>

                {visibleReports.map((a) => {
                  const img = assetTypeImg[a.asset_type] ?? "/images/car.png";
                  return (
                    <div key={a.id} className="flex flex-wrap md:flex-nowrap items-center gap-3 px-5 py-4">
                      <div className="w-10 h-10 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                        <Image src={img} alt={a.name} width={26} height={26} className="object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-zinc-800 leading-tight truncate">{a.name}</p>
                        <p className="text-[11px] text-zinc-400 truncate">{a.qrCode ? a.qrCode : "No QR code linked"}</p>
                      </div>
                      <div className="w-28 shrink-0 text-[12px] text-zinc-500">{assetTypeLabel[a.asset_type] ?? a.asset_type}</div>
                      <div className="w-24 shrink-0 text-center">
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-zinc-700">
                          <History size={11} className="text-zinc-400" /> {a.totalServices}
                        </span>
                      </div>
                      <div className="w-32 shrink-0 text-[12px] text-zinc-500">
                        {a.lastServiceDate ? formatDateDMY(a.lastServiceDate) : "—"}
                      </div>
                      <div className="w-36 shrink-0 flex justify-end">
                        {a.qrCode ? (
                          <a
                            href={`/asset/${a.qrCode}/report`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50 px-3 py-[7px] rounded-lg transition-colors"
                          >
                            View Report <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-[11px] text-zinc-300">No QR code</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-zinc-400 mt-8">© 2026 Maintly. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
