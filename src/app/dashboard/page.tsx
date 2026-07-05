"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings, Search, Bell, Plus, MoreVertical,
  CheckCircle2, Clock, TrendingUp, TrendingDown, Crown, ChevronLeft, ChevronRight, LogOut,
  ScanLine, Wrench, AlertCircle, Menu, X
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { formatDateDMY } from "@/lib/date";
import { computeReminderStatus, REMINDER_STATUS_LABEL, REMINDER_STATUS_COLOR, type ReminderStatus } from "@/lib/reminders";
import { getUnitLabel, getUnitShort, formatUnitValue } from "@/lib/units";
import HoverAvatar from "@/components/HoverAvatar";
import ContactSupportWidget from "@/components/ContactSupportWidget";
import CalendarDayCell, { type DayInfo } from "@/components/CalendarDayCell";
import { buildMonthGridMondayFirst } from "@/lib/calendarGrid";

const navItems = [
  { icon: LayoutGrid,   label: "Dashboard",        href: "/dashboard",          active: true  },
  { icon: FileText,     label: "My Services",      href: "/dashboard/services", active: false },
  { icon: Bell,         label: "Scheduled Services", href: "/dashboard/scheduled", active: false },
  { icon: Box,          label: "Assets",           href: "/dashboard/assets",   active: false },
  { icon: QrCode,       label: "QR Codes",         href: "/dashboard/assets",   active: false },
  { icon: Users,        label: "Customers",        href: "#",                   active: false },
  { icon: BarChart3,    label: "Reports",          href: "/dashboard/reports",  active: false },
  { icon: CalendarIcon, label: "Calendar",         href: "/dashboard/calendar", active: false },
  { icon: Mail,         label: "Messages",         href: "/dashboard/messages", active: false },
  { icon: FolderOpen,   label: "Document Library", href: "#",                   active: false },
  { icon: Settings,     label: "Settings",         href: "/dashboard/settings", active: false },
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
  automotive: "/images/car.png",
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

type FoundAsset = {
  name: string;
  id: string;      // display: QR code or serial
  assetId: string; // UUID real para insertar en BD
  type: string;
};

type ReminderItem = {
  id: string;
  assetLabel: string;
  assetType: string | null;
  status: ReminderStatus;
  next_due_date: string | null;
  next_due_km_hours: number | null;
  serviceType: string;
};

type SearchAsset = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  vin: string | null;
  type: string;
  qrCode: string | null;
};

type SearchServiceResult = {
  id: string;
  asset_id: string;
  service_type: string;
  service_date: string;
  assetName: string;
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mechanicId, setMechanicId] = useState("");
  const unreadMessages = useUnreadMessagesCount(mechanicId);
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicPhoto, setMechanicPhoto] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [totalServices, setTotalServices] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);
  const [realServices, setRealServices] = useState<RealService[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);

  // ── Mini calendar widget ──
  const [calViewDate, setCalViewDate] = useState(() => new Date());
  const [calServices, setCalServices] = useState<{ date: string; label: string; type: string }[]>([]);
  const [calReminders, setCalReminders] = useState<{ date: string; status: ReminderStatus; label: string; type: string }[]>([]);
  const [calTasks, setCalTasks] = useState<{ date: string; done: boolean; title: string }[]>([]);

  // ── Top search bar ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchAssetsList, setSearchAssetsList] = useState<SearchAsset[]>([]);
  const [searchServiceResults, setSearchServiceResults] = useState<SearchServiceResult[]>([]);
  const [searchingServices, setSearchingServices] = useState(false);

  // ── Add Equipment modal states ──
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [addAssetTab, setAddAssetTab] = useState<"choose" | "new" | "existing">("choose");
  const [qrInput, setQrInput] = useState("");
  const [foundAsset, setFoundAsset] = useState<FoundAsset | null>(null);
  const [searchError, setSearchError] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  // New asset form states
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newSerial, setNewSerial] = useState("");

  function closeAddAssetModal() {
    setShowAddAssetModal(false);
    setAddAssetTab("choose");
    setQrInput("");
    setFoundAsset(null);
    setSearchError("");
    setSearchLoading(false);
    setAddSuccess(false);
    setNewBrand(""); setNewModel(""); setNewYear(""); setNewSerial("");
  }

  async function handleSearchAsset() {
    if (!qrInput.trim()) return;
    setSearchError("");
    setFoundAsset(null);
    setSearchLoading(true);

    // 1. Buscar en qr_codes por el código (ej: MTLY-AB12-CD34)
    const { data: qrData } = await supabase
      .from("qr_codes")
      .select("asset_id, code")
      .ilike("code", qrInput.trim())
      .maybeSingle();

    if (qrData?.asset_id) {
      // QR encontrado → cargar el asset vinculado
      const { data: asset, error: assetErr } = await supabase
        .from("assets")
        .select("id, brand, model, nickname, asset_type, vin_serial")
        .eq("id", qrData.asset_id)
        .single();

      setSearchLoading(false);

      if (assetErr || !asset) {
        setSearchError("QR code found but the asset is not linked yet.");
        return;
      }

      setFoundAsset({
        name: asset.nickname || [asset.brand, asset.model].filter(Boolean).join(" ") || "Unknown Asset",
        id: qrData.code,
        assetId: asset.id,
        type: asset.asset_type,
      });
      return;
    }

    // 2. Fallback: buscar directamente por UUID del asset
    const { data: directAsset } = await supabase
      .from("assets")
      .select("id, brand, model, nickname, asset_type, vin_serial")
      .eq("id", qrInput.trim())
      .maybeSingle();

    setSearchLoading(false);

    if (!directAsset) {
      setSearchError("No asset found with that code. Make sure you entered the QR code exactly as it appears on the sticker (e.g. MTLY-AB12-CD34).");
      return;
    }

    setFoundAsset({
      name: directAsset.nickname || [directAsset.brand, directAsset.model].filter(Boolean).join(" ") || "Unknown Asset",
      id: directAsset.vin_serial || directAsset.id,
      assetId: directAsset.id,
      type: directAsset.asset_type,
    });
  }

  async function handleAddToWorkshop() {
    if (!foundAsset) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }

    const { error } = await supabase
      .from("mechanic_assets")
      .upsert(
        {
          mechanic_id: session.user.id,
          asset_id: foundAsset.assetId,
          qr_code: foundAsset.id,
        },
        { onConflict: "mechanic_id,asset_id", ignoreDuplicates: true }
      );

    if (error) {
      setSearchError("Error al guardar: " + error.message);
      return;
    }

    setAddSuccess(true);
    // Refrescar contador de assets
    const { count } = await supabase
      .from("mechanic_assets")
      .select("*", { count: "exact", head: true })
      .eq("mechanic_id", session.user.id);
    setTotalAssets(count ?? totalAssets);
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
        .from("mechanics").select("name, photo_url").eq("id", session.user.id).single();
      if (active && mechanic) { setMechanicName(mechanic.name); setMechanicPhoto(mechanic.photo_url ?? ""); }

      const { count: assetCount } = await supabase
        .from("mechanic_assets").select("*", { count: "exact", head: true })
        .eq("mechanic_id", session.user.id);
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

      // ── Upcoming reminders ──
      const { data: remRows } = await supabase
        .from("service_records")
        .select("id, asset_id, service_type, next_due_date, next_due_km_hours, assets(nickname, brand, model, asset_type)")
        .eq("mechanic_id", session.user.id)
        .or("next_due_date.not.is.null,next_due_km_hours.not.is.null");

      const { data: kmRows } = await supabase
        .from("service_records")
        .select("asset_id, km_hours")
        .eq("mechanic_id", session.user.id)
        .not("km_hours", "is", null);

      const maxKmByAsset: Record<string, number> = {};
      for (const r of (kmRows ?? []) as any[]) {
        if (r.km_hours != null && (maxKmByAsset[r.asset_id] == null || r.km_hours > maxKmByAsset[r.asset_id])) {
          maxKmByAsset[r.asset_id] = r.km_hours;
        }
      }

      const allReminderItems: ReminderItem[] = ((remRows ?? []) as any[]).map((r) => {
        const a = Array.isArray(r.assets) ? r.assets[0] : r.assets;
        const label = a?.nickname || [a?.brand, a?.model].filter(Boolean).join(" ") || "Unknown asset";
        const status = computeReminderStatus({
          nextDueDate: r.next_due_date,
          nextDueKmHours: r.next_due_km_hours,
          currentKmHours: maxKmByAsset[r.asset_id] ?? null,
        });
        return { id: r.id, assetLabel: label, assetType: a?.asset_type ?? null, status, next_due_date: r.next_due_date, next_due_km_hours: r.next_due_km_hours, serviceType: r.service_type };
      });

      const reminderItems = allReminderItems
        .filter((i) => i.status === "overdue" || i.status === "due_soon")
        .sort((a, b) => (a.status === "overdue" ? 0 : 1) - (b.status === "overdue" ? 0 : 1));

      if (active) setReminders(reminderItems);

      // ── Mini calendar widget: full detail for every date-based reminder
      // (any status), every service's date, and every planned task — so
      // hovering a day shows exactly what's going on, not just a count. ──
      if (active) {
        setCalReminders(
          allReminderItems
            .filter((i): i is ReminderItem & { next_due_date: string } => !!i.next_due_date)
            .map((i) => ({ date: i.next_due_date, status: i.status, label: i.assetLabel, type: i.serviceType }))
        );
      }

      const { data: allSvcRows } = await supabase
        .from("service_records")
        .select("service_date, service_type, assets(nickname, brand, model)")
        .eq("mechanic_id", session.user.id);
      if (active) {
        setCalServices(
          ((allSvcRows ?? []) as any[]).map((r) => {
            const a = Array.isArray(r.assets) ? r.assets[0] : r.assets;
            const label = a?.nickname || [a?.brand, a?.model].filter(Boolean).join(" ") || "Unknown asset";
            return { date: r.service_date, label, type: r.service_type };
          })
        );
      }

      const { data: taskRowsForCal } = await supabase
        .from("calendar_tasks")
        .select("task_date, done, title")
        .eq("mechanic_id", session.user.id);
      if (active) setCalTasks(((taskRowsForCal ?? []) as any[]).map((r) => ({ date: r.task_date, done: r.done, title: r.title })));

      // ── Full asset list, for the top search bar (assets + QR codes) ──
      const { data: assetRows } = await supabase
        .from("mechanic_assets")
        .select("assets(id, nickname, brand, model, vin_serial, asset_type, qr_codes(code))")
        .eq("mechanic_id", session.user.id);

      const searchList: SearchAsset[] = ((assetRows ?? []) as any[])
        .map((r) => {
          const a = Array.isArray(r.assets) ? r.assets[0] : r.assets;
          if (!a) return null;
          const qr = Array.isArray(a.qr_codes) ? a.qr_codes[0]?.code : a.qr_codes?.code;
          return {
            id: a.id,
            name: a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || "Unknown Asset",
            brand: a.brand ?? null,
            model: a.model ?? null,
            vin: a.vin_serial ?? null,
            type: a.asset_type,
            qrCode: qr ?? null,
          };
        })
        .filter(Boolean) as SearchAsset[];
      if (active) setSearchAssetsList(searchList);

      if (active) setAuthChecked(true);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [router]);

  // ── Live search: services (debounced, searches full history, not just the recent 6) ──
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchServiceResults([]); setSearchingServices(false); return; }

    const safeQ = q.replace(/[%,()]/g, "").trim();
    if (!safeQ) { setSearchServiceResults([]); setSearchingServices(false); return; }

    let cancelled = false;
    setSearchingServices(true);
    const t = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) { if (!cancelled) setSearchingServices(false); return; }

      const { data } = await supabase
        .from("service_records")
        .select("id, asset_id, service_type, service_date, notes, assets(nickname, brand, model)")
        .eq("mechanic_id", session.user.id)
        .or(`service_type.ilike.%${safeQ}%,notes.ilike.%${safeQ}%`)
        .order("service_date", { ascending: false })
        .limit(5);

      if (cancelled) return;
      const results: SearchServiceResult[] = ((data ?? []) as any[]).map((s) => {
        const a = Array.isArray(s.assets) ? s.assets[0] : s.assets;
        return {
          id: s.id,
          asset_id: s.asset_id,
          service_type: s.service_type,
          service_date: s.service_date,
          assetName: a?.nickname || [a?.brand, a?.model].filter(Boolean).join(" ") || "Unknown Asset",
        };
      });
      setSearchServiceResults(results);
      setSearchingServices(false);
    }, 300);

    return () => { cancelled = true; clearTimeout(t); };
  }, [searchQuery]);

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

  // ── Top search bar: matching assets (client-side, from the full workshop list) ──
  const searchQ = searchQuery.trim().toLowerCase();
  const matchedAssets = searchQ.length > 0
    ? searchAssetsList.filter((a) => {
        const hay = [a.name, a.brand, a.model, a.vin, a.qrCode].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(searchQ);
      }).slice(0, 5)
    : [];
  const hasSearchResults = matchedAssets.length > 0 || searchServiceResults.length > 0;

  function goToAsset(a: SearchAsset) {
    setSearchOpen(false);
    router.push(`/dashboard/assets?q=${encodeURIComponent(a.name)}`);
  }
  function goToService(s: SearchServiceResult) {
    setSearchOpen(false);
    router.push(`/dashboard/services?asset=${s.asset_id}`);
  }
  function handleSearchSubmit() {
    if (!searchQ) return;
    setSearchOpen(false);
    router.push(`/dashboard/assets?q=${encodeURIComponent(searchQuery.trim())}`);
  }

  const statsCards = [
    { label: "TOTAL SERVICES", value: String(totalServices), up: true,  icon: CalendarIcon, color: "bg-red-50 text-red-500"   },
    { label: "TOTAL ASSETS",   value: String(totalAssets),   up: true,  icon: Box,          color: "bg-blue-50 text-blue-500"  },
    { label: "COMPLETED",      value: String(totalServices), up: true,  icon: CheckCircle2, color: "bg-green-50 text-green-500" },
    { label: "PENDING",        value: "0",                   up: true,  icon: Clock,        color: "bg-amber-50 text-amber-500" },
  ];

  const CAL_MONTH_LABELS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const calendarMonth = `${CAL_MONTH_LABELS[calViewDate.getMonth()]} ${calViewDate.getFullYear()}`;
  const calendarGrid = buildMonthGridMondayFirst(calViewDate.getFullYear(), calViewDate.getMonth());

  const calActivityByDate: Record<string, DayInfo> = {};
  function ensureCalDay(k: string): DayInfo {
    return (calActivityByDate[k] ??= { services: [], tasks: [], reminders: [] });
  }
  for (const s of calServices) ensureCalDay(s.date).services.push({ label: s.label, type: s.type });
  for (const r of calReminders) ensureCalDay(r.date).reminders.push({ label: r.label, type: r.type, status: r.status });
  for (const t of calTasks) ensureCalDay(t.date).tasks.push({ title: t.title, done: t.done });

  function calDotColor(info?: DayInfo) {
    if (!info) return null;
    const overdue = info.reminders.some((r) => r.status === "overdue");
    const dueSoon = info.reminders.some((r) => r.status === "due_soon");
    const openTasks = info.tasks.some((t) => !t.done);
    if (overdue) return "bg-red-500";
    if (dueSoon) return "bg-amber-500";
    if (openTasks) return "bg-blue-500";
    if (info.services.length > 0) return "bg-emerald-500";
    if (info.reminders.length > 0) return "bg-zinc-300";
    return null;
  }

  const miniStats = [
    { label: "SERVICES",  value: String(totalServices), color: "#16a34a" },
    { label: "ASSETS",    value: String(totalAssets),   color: "#2563eb" },
    { label: "COMPLETED", value: String(totalServices), color: "#7c3aed" },
    { label: "PENDING",   value: "0",                   color: "#ea580c" },
  ];

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

        <nav className="flex-1 px-3 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-[9px] rounded-lg mb-1 text-[13px] font-medium transition-colors ${
                item.active
                  ? "bg-red-50 text-red-600 border-l-[3px] border-red-600 -ml-[1px]"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <item.icon size={16} />
              {item.label}
              {item.label === "Messages" && unreadMessages > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unreadMessages}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="border-t border-zinc-100 py-2">
          <ContactSupportWidget mechanicId={mechanicId} />
        </div>

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
            <p className="text-[12px] font-bold text-zinc-800 leading-tight truncate">{displayName}</p>
            <p className="text-[10px] text-zinc-400 leading-tight">Maintly Mechanic</p>
          </div>
        </div>
      </aside>

      {/* ════ MAIN CONTENT ════ */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="flex items-center justify-between gap-3 px-4 md:px-7 py-4 bg-white border-b border-zinc-200">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden shrink-0 text-zinc-600 hover:text-zinc-900">
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="text-[17px] md:text-[20px] font-black text-zinc-900 truncate">Dashboard</h1>
              <p className="hidden sm:block text-[12px] text-zinc-400 truncate">Welcome back, {mechanicName || "Mechanic"}! Here&apos;s what&apos;s happening with your maintenance work.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <div className="hidden lg:block relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => { if (searchQuery.trim()) setSearchOpen(true); }}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearchSubmit(); if (e.key === "Escape") setSearchOpen(false); }}
                placeholder="Search assets, QR codes, services..."
                className="w-[280px] rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400 transition-colors"
              />

              {searchOpen && searchQuery.trim().length > 0 && (
                <div className="absolute top-[calc(100%+6px)] left-0 w-[340px] bg-white rounded-xl border border-zinc-200 shadow-lg py-2 z-50 max-h-[360px] overflow-y-auto">
                  {matchedAssets.length > 0 && (
                    <div className="px-2">
                      <p className="px-2 pb-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Assets</p>
                      {matchedAssets.map((a) => (
                        <button
                          key={a.id}
                          onMouseDown={() => goToAsset(a)}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-zinc-50 text-left"
                        >
                          <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                            <Box size={13} className="text-red-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold text-zinc-800 truncate">{a.name}</p>
                            <p className="text-[10px] text-zinc-400 truncate">{a.qrCode || a.vin || a.type}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchServiceResults.length > 0 && (
                    <div className="px-2 mt-1">
                      <p className="px-2 pb-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Services</p>
                      {searchServiceResults.map((s) => (
                        <button
                          key={s.id}
                          onMouseDown={() => goToService(s)}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-zinc-50 text-left"
                        >
                          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <Wrench size={13} className="text-blue-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold text-zinc-800 truncate">{s.service_type} · {s.assetName}</p>
                            <p className="text-[10px] text-zinc-400 truncate">{formatDateDMY(s.service_date)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {!hasSearchResults && (
                    <p className="px-4 py-3 text-[12px] text-zinc-400">
                      {searchingServices ? "Searching…" : `No results for "${searchQuery.trim()}"`}
                    </p>
                  )}
                </div>
              )}
            </div>

            <button className="relative text-zinc-500 hover:text-zinc-800 transition-colors">
              <Bell size={19} />
            </button>

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
                  <p className="text-[12px] font-bold text-zinc-800 leading-tight">{displayName}</p>
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

          {/* ── Action buttons ── */}
          <div className="flex justify-end gap-3 mb-5 -mt-2">
            <button
              onClick={() => { setShowAddAssetModal(true); setAddAssetTab("choose"); }}
              className="flex items-center gap-2 border border-zinc-200 bg-white hover:bg-zinc-50 active:scale-[0.98] transition-all text-zinc-700 text-[13px] font-bold px-4 py-[10px] rounded-xl shadow-sm"
            >
              <Box size={15} /> Add Equipment
            </button>
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
                  <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full min-w-[560px]">
                    <thead>
                      <tr className="text-left text-[10px] text-zinc-400 font-bold uppercase">
                        <th className="pb-2 font-bold">Asset</th>
                        <th className="pb-2 font-bold">Service Type</th>
                        <th className="pb-2 font-bold">Date</th>
                        <th className="pb-2 font-bold">Reading</th>
                        <th className="pb-2 font-bold">Status</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {realServices.map((s) => {
                        const asset = Array.isArray(s.assets) ? s.assets[0] ?? null : (s.assets as AssetInfo | null);
                        const img = asset ? assetTypeImg[asset.asset_type] ?? "/images/car.png" : "/images/car.png";
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
                            <td className="py-3 pr-3 text-[12px] text-zinc-700">{formatDateDMY(s.service_date)}</td>
                            <td className="py-3 pr-3 text-[12px] text-zinc-700 font-medium">{formatUnitValue(s.km_hours, asset?.asset_type)}</td>
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
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-5">

              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-black text-zinc-900">Upcoming Reminders</h3>
                  <Link href="/dashboard/services" className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700">View all</Link>
                </div>
                {reminders.length === 0 ? (
                  <p className="text-[12px] text-zinc-400 text-center py-4">No reminders due soon.</p>
                ) : (
                  <div className="space-y-2">
                    {reminders.slice(0, 5).map((r) => {
                      const rc = REMINDER_STATUS_COLOR[r.status];
                      return (
                        <div key={r.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${rc.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold text-zinc-800 truncate">{r.assetLabel}</p>
                            <p className="text-[10px] text-zinc-400">
                              {r.next_due_date ? `Due ${formatDateDMY(r.next_due_date)}` : ""}
                              {r.next_due_date && r.next_due_km_hours != null ? " · " : ""}
                              {r.next_due_km_hours != null ? `${r.next_due_km_hours.toLocaleString()} ${getUnitShort(r.assetType)}` : ""}
                            </p>
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-[2px] rounded-full shrink-0 ${rc.bg} ${rc.text}`}>{REMINDER_STATUS_LABEL[r.status]}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-black text-zinc-900">Calendar</h3>
                  <Link href="/dashboard/calendar" className="text-[10px] font-bold text-red-600 hover:text-red-700">View all →</Link>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setCalViewDate(new Date(calViewDate.getFullYear(), calViewDate.getMonth() - 1, 1))}
                    className="text-zinc-400 hover:text-zinc-700"
                  ><ChevronLeft size={16} /></button>
                  <span className="text-[12px] font-bold text-zinc-700">{calendarMonth}</span>
                  <button
                    onClick={() => setCalViewDate(new Date(calViewDate.getFullYear(), calViewDate.getMonth() + 1, 1))}
                    className="text-zinc-400 hover:text-zinc-700"
                  ><ChevronRight size={16} /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {["MON","TUE","WED","THU","FRI","SAT","SUN"].map(d => (
                    <span key={d} className="text-[8px] font-bold text-zinc-400 pb-1">{d}</span>
                  ))}
                  {calendarGrid.map((cell) => (
                    <CalendarDayCell
                      key={cell.key}
                      dateKey={cell.key}
                      day={cell.day}
                      inMonth={cell.inMonth}
                      isToday={cell.isToday}
                      dateLabel={new Date(cell.key + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                      info={calActivityByDate[cell.key]}
                      dotColor={calDotColor(calActivityByDate[cell.key])}
                    />
                  ))}
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
                  <button
                    onClick={() => { setShowAddAssetModal(true); setAddAssetTab("existing"); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                      <QrCode size={14} className="text-purple-500" />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-zinc-800 leading-tight">Link Existing Asset</p>
                      <p className="text-[10px] text-zinc-400">Scan or enter a QR code</p>
                    </div>
                  </button>
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

      {/* ════ MODAL: ADD EQUIPMENT ════ */}
      {showAddAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                {addAssetTab !== "choose" && (
                  <button
                    onClick={() => { setAddAssetTab("choose"); setFoundAsset(null); setSearchError(""); setQrInput(""); }}
                    className="text-zinc-400 hover:text-zinc-700 transition-colors mr-1"
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                <h3 className="text-[16px] font-black text-zinc-900">
                  {addAssetTab === "choose" && "Add Equipment"}
                  {addAssetTab === "new" && "New Equipment"}
                  {addAssetTab === "existing" && "Link Existing Asset"}
                </h3>
              </div>
              <button
                onClick={closeAddAssetModal}
                className="text-zinc-400 hover:text-zinc-700 text-[22px] leading-none transition-colors"
              >×</button>
            </div>

            {/* ── STEP: CHOOSE ── */}
            {addAssetTab === "choose" && (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setAddAssetTab("new")}
                  className="flex flex-col items-center gap-3 p-5 border-2 border-zinc-200 hover:border-red-300 hover:bg-red-50 rounded-2xl transition-all text-center group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition-colors">
                    <Plus size={26} className="text-red-600" />
                  </div>
                  <div>
                    <p className="text-[14px] font-black text-zinc-900">New Equipment</p>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">Register a new machine and generate a unique QR code</p>
                  </div>
                </button>

                <button
                  onClick={() => setAddAssetTab("existing")}
                  className="flex flex-col items-center gap-3 p-5 border-2 border-zinc-200 hover:border-blue-300 hover:bg-blue-50 rounded-2xl transition-all text-center group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                    <QrCode size={26} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[14px] font-black text-zinc-900">Existing Equipment</p>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">Scan or enter a QR code to link an asset to your workshop</p>
                  </div>
                </button>
              </div>
            )}

            {/* ── STEP: NEW EQUIPMENT ── */}
            {addAssetTab === "new" && (
              <div className="p-6">
                <p className="text-[13px] text-zinc-500 mb-5">Fill in the details to register a new asset. A unique QR code will be generated automatically.</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1 block">Brand</label>
                      <input
                        type="text" placeholder="e.g. Ford"
                        value={newBrand} onChange={e => setNewBrand(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[13px] outline-none focus:border-red-400 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1 block">Model</label>
                      <input
                        type="text" placeholder="e.g. Ranger XLT"
                        value={newModel} onChange={e => setNewModel(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[13px] outline-none focus:border-red-400 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1 block">Year</label>
                      <input
                        type="number" placeholder="e.g. 2021" max={new Date().getFullYear()}
                        value={newYear} onChange={e => setNewYear(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[13px] outline-none focus:border-red-400 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1 block">Serial / VIN <span className="text-zinc-400 font-normal normal-case">(optional)</span></label>
                      <input
                        type="text" placeholder="e.g. 1FTFW1ET5..."
                        value={newSerial} onChange={e => setNewSerial(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[13px] font-mono outline-none focus:border-red-400 transition-colors"
                      />
                    </div>
                  </div>
                </div>
                <button className="w-full mt-5 bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-bold py-3 rounded-xl text-[13px] transition-all shadow-sm">
                  Create Asset &amp; Generate QR
                </button>
              </div>
            )}

            {/* ── STEP: EXISTING EQUIPMENT — SEARCH ── */}
            {addAssetTab === "existing" && !addSuccess && (
              <div className="p-6">
                <p className="text-[13px] text-zinc-500 mb-5">Enter the QR code ID of the asset to link it to your workshop account.</p>

                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <QrCode size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="MTLY-AB12-CD34"
                      value={qrInput}
                      onChange={e => { setQrInput(e.target.value.toUpperCase()); setSearchError(""); setFoundAsset(null); }}
                      onKeyDown={e => e.key === "Enter" && handleSearchAsset()}
                      className="w-full rounded-xl border border-zinc-200 pl-9 pr-4 py-2.5 text-[13px] font-mono outline-none focus:border-blue-400 transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleSearchAsset}
                    disabled={searchLoading || !qrInput.trim()}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-4 py-2.5 rounded-xl text-[13px] transition-colors shrink-0"
                  >
                    {searchLoading ? "..." : "Search"}
                  </button>
                </div>

                {searchError && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-4">
                    <AlertCircle size={14} className="shrink-0" />
                    <p className="text-[12px]">{searchError}</p>
                  </div>
                )}

                {foundAsset && (
                  <div className="mb-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white border border-green-100 flex items-center justify-center shrink-0">
                        <Image src={assetTypeImg[foundAsset.type] ?? "/images/car.png"} alt={foundAsset.name} width={36} height={36} className="object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-green-700 tracking-wide">ASSET FOUND</p>
                        <p className="text-[15px] font-black text-zinc-900 truncate">{foundAsset.name}</p>
                        <p className="text-[11px] text-zinc-400 font-mono">{foundAsset.id}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleAddToWorkshop}
                      className="w-full mt-3 bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-bold py-3 rounded-xl text-[13px] transition-all shadow-sm"
                    >
                      Add to My Workshop
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl p-3">
                  <ScanLine size={14} className="text-zinc-400 shrink-0" />
                  <p className="text-[11px] text-zinc-500">The code is printed on the sticker in the format <span className="font-mono font-semibold">MTLY-AB12-CD34</span>.</p>
                </div>
              </div>
            )}

            {/* ── STEP: SUCCESS ── */}
            {addAssetTab === "existing" && addSuccess && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <h4 className="text-[18px] font-black text-zinc-900 mb-1">Asset Added!</h4>
                <p className="text-[13px] text-zinc-500 mb-6">
                  <span className="font-semibold text-zinc-700">{foundAsset?.name}</span> is now in your workshop. You can log services for it from your dashboard.
                </p>
                <button
                  onClick={closeAddAssetModal}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-[13px] transition-colors"
                >
                  Done
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
