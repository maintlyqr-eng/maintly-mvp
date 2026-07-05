"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings, Bell, Plus, X, LogOut, Crown,
  Wrench, CheckCircle2, MoreVertical, Menu
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import HoverAvatar from "@/components/HoverAvatar";
import ContactSupportWidget from "@/components/ContactSupportWidget";
import CustomerPicker, { CustomerOption } from "@/components/CustomerPicker";
import { formatDateDMY } from "@/lib/date";
import { computeReminderStatus, REMINDER_STATUS_LABEL, REMINDER_STATUS_COLOR } from "@/lib/reminders";
import { getUnitLabel, formatUnitValue } from "@/lib/units";

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/dashboard" },
  { icon: FileText, label: "My Services", href: "/dashboard/services" },
  { icon: Bell, label: "Scheduled Services", href: "/dashboard/scheduled" },
  { icon: Box, label: "Assets", href: "/dashboard/assets" },
  { icon: QrCode, label: "QR Codes", href: "/dashboard/assets" },
  { icon: Users, label: "Customers", href: "/dashboard/customers" },
  { icon: BarChart3, label: "Reports", href: "/dashboard/reports" },
  { icon: CalendarIcon, label: "Calendar", href: "/dashboard/calendar" },
  { icon: Mail, label: "Messages", href: "/dashboard/messages" },
  { icon: FolderOpen, label: "Document Library", href: "#" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

const serviceTypeOptions = ["Oil Change", "Service", "Repair", "Inspection", "Filter Change", "Tire Change", "Brake Service", "Other"];

const typeColors: Record<string, string> = {
  Service: "bg-blue-100 text-blue-700",
  Repair: "bg-red-100 text-red-700",
  Inspection: "bg-purple-100 text-purple-700",
  "Oil Change": "bg-amber-100 text-amber-700",
};

const assetTypeImg: Record<string, string> = {
  automotive: "/images/car.png",
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
  customer_id: string | null;
};

type ServiceRow = {
  id: string;
  service_date: string;
  service_type: string;
  km_hours: number | null;
  notes: string | null;
  created_at: string;
  next_due_date: string | null;
  next_due_km_hours: number | null;
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mechanicId, setMechanicId] = useState("");
  const unreadMessages = useUnreadMessagesCount(mechanicId);
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicPhoto, setMechanicPhoto] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [isMechanicActive, setIsMechanicActive] = useState(false);
  const [showMechanicGate, setShowMechanicGate] = useState(false);
  const [activatingMechanic, setActivatingMechanic] = useState(false);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetOptions, setAssetOptions] = useState<AssetOption[]>([]);

  // Filters
  const [filterAsset, setFilterAsset] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Pre-fill the asset filter from a deep link (e.g. the dashboard's top search bar: /dashboard/services?asset=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const assetId = new URLSearchParams(window.location.search).get("asset");
    if (assetId) setFilterAsset(assetId);
  }, []);

  // Add Service modal
  const [showForm, setShowForm] = useState(false);
  const [svcAssetId, setSvcAssetId] = useState("");
  const [svcType, setSvcType] = useState("Oil Change");
  const [svcKmHours, setSvcKmHours] = useState("");
  const [svcNotes, setSvcNotes] = useState("");
  const [svcCustomerId, setSvcCustomerId] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [svcSaving, setSvcSaving] = useState(false);
  const [svcError, setSvcError] = useState("");
  const [minKmHours, setMinKmHours] = useState<number | null>(null);
  const [minKmHoursLoading, setMinKmHoursLoading] = useState(false);

  // Reminder menu / modal
  const [openMenuRowId, setOpenMenuRowId] = useState<string | null>(null);
  const [reminderRow, setReminderRow] = useState<ServiceRow | null>(null);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderKm, setReminderKm] = useState("");
  const [reminderMinKm, setReminderMinKm] = useState<number | null>(null);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderError, setReminderError] = useState("");

  async function loadServices(uid: string) {
    setLoading(true);
    const { data } = await supabase
      .from("service_records")
      .select("id, service_date, service_type, km_hours, notes, created_at, next_due_date, next_due_km_hours, assets(id, nickname, brand, model, vin_serial, asset_type)")
      .eq("mechanic_id", uid)
      .order("service_date", { ascending: false });
    setServices((data as unknown as ServiceRow[]) ?? []);
    setLoading(false);
  }

  async function loadAssets(uid: string) {
    const { data } = await supabase
      .from("assets")
      .select("id, nickname, brand, model, asset_type, customer_id")
      .eq("created_by", uid)
      .order("created_at", { ascending: false });
    const opts = (data as AssetOption[]) ?? [];
    setAssetOptions(opts);
    if (opts.length > 0) setSvcAssetId(opts[0].id);
  }

  async function loadCustomers(uid: string) {
    const { data } = await supabase
      .from("customers")
      .select("id, name, phone, email")
      .eq("mechanic_id", uid)
      .order("name", { ascending: true });
    setCustomers((data as CustomerOption[]) ?? []);
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
        .from("mechanics").select("name, is_mechanic, photo_url").eq("id", session.user.id).single();
      if (active && mechanic) { setMechanicName(mechanic.name); setIsMechanicActive(!!mechanic.is_mechanic); setMechanicPhoto(mechanic.photo_url ?? ""); }

      await Promise.all([loadServices(session.user.id), loadAssets(session.user.id), loadCustomers(session.user.id)]);
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
    const firstAsset = assetOptions[0];
    setSvcAssetId(firstAsset?.id ?? "");
    setSvcType("Oil Change");
    setSvcKmHours("");
    setSvcNotes("");
    setSvcCustomerId(firstAsset?.customer_id ?? "");
    setSvcError("");
    setMinKmHours(null);
  }

  function handleOpenAddService() {
    if (!isMechanicActive) { setShowMechanicGate(true); return; }
    resetForm();
    setShowForm(true);
  }

  async function handleBecomeMechanic() {
    if (!mechanicId || activatingMechanic) return;
    setActivatingMechanic(true);
    const { error } = await supabase.from("mechanics").update({ is_mechanic: true }).eq("id", mechanicId).select("id");
    setActivatingMechanic(false);
    if (error) return;
    setIsMechanicActive(true);
    setShowMechanicGate(false);
    resetForm();
    setShowForm(true);
  }

  async function fetchMinKmHours(assetId: string) {
    if (!assetId) { setMinKmHours(null); return; }
    setMinKmHoursLoading(true);
    const { data } = await supabase
      .from("service_records")
      .select("km_hours")
      .eq("asset_id", assetId)
      .not("km_hours", "is", null)
      .order("km_hours", { ascending: false })
      .limit(1)
      .maybeSingle();
    setMinKmHours(data?.km_hours ?? null);
    setMinKmHoursLoading(false);
  }

  useEffect(() => {
    if (showForm && svcAssetId) fetchMinKmHours(svcAssetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, svcAssetId]);

  // Default the customer field to whoever was on this asset's last service —
  // the mechanic can still change it per service, this is just a starting point.
  useEffect(() => {
    if (!showForm || !svcAssetId) return;
    const asset = assetOptions.find((a) => a.id === svcAssetId);
    setSvcCustomerId(asset?.customer_id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, svcAssetId]);

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    setSvcError("");
    if (!isMechanicActive) { setShowForm(false); setShowMechanicGate(true); return; }
    if (!svcAssetId) { setSvcError("Please select an asset."); return; }

    if (svcKmHours && minKmHours != null && parseFloat(svcKmHours) < minKmHours) {
      const svcUnit = getUnitLabel(assetOptions.find((a) => a.id === svcAssetId)?.asset_type);
      setSvcError(`${svcUnit} can't be lower than the last recorded value (${minKmHours.toLocaleString()}).`);
      return;
    }

    setSvcSaving(true);

    const { error } = await supabase.from("service_records").insert({
      mechanic_id: mechanicId,
      asset_id: svcAssetId,
      service_type: svcType,
      service_date: new Date().toISOString().slice(0, 10),
      km_hours: svcKmHours ? parseFloat(svcKmHours) : null,
      notes: svcNotes.trim() || null,
      customer_id: svcCustomerId || null,
    });

    if (error) { setSvcSaving(false); setSvcError(error.message); return; }

    // Keep the asset's "last known customer" cache in sync — no manual
    // transfer step, it just follows whatever customer was on this service.
    const asset = assetOptions.find((a) => a.id === svcAssetId);
    const newCustomerId = svcCustomerId || null;
    if (asset && asset.customer_id !== newCustomerId) {
      await supabase.from("assets").update({ customer_id: newCustomerId }).eq("id", svcAssetId);
      setAssetOptions((prev) => prev.map((a) => (a.id === svcAssetId ? { ...a, customer_id: newCustomerId } : a)));
    }

    setSvcSaving(false);
    resetForm();
    setShowForm(false);
    await loadServices(mechanicId);
  }

  function currentKmHoursForAsset(assetId: string | undefined | null): number | null {
    if (!assetId) return null;
    let max: number | null = null;
    for (const s of services) {
      const a = getAsset(s);
      if (a?.id === assetId && s.km_hours != null && (max == null || s.km_hours > max)) max = s.km_hours;
    }
    return max;
  }

  function openReminderModal(row: ServiceRow) {
    setReminderRow(row);
    setReminderDate(row.next_due_date ?? "");
    setReminderKm(row.next_due_km_hours != null ? String(row.next_due_km_hours) : "");
    setReminderMinKm(currentKmHoursForAsset(getAsset(row)?.id));
    setReminderError("");
    setOpenMenuRowId(null);
  }

  async function handleSaveReminder(e: React.FormEvent) {
    e.preventDefault();
    if (!reminderRow) return;
    setReminderError("");

    const todayStr = new Date().toISOString().slice(0, 10);
    if (reminderDate && reminderDate < todayStr) {
      setReminderError("The reminder date can't be in the past.");
      return;
    }

    if (reminderKm && reminderMinKm != null && parseFloat(reminderKm) < reminderMinKm) {
      const remUnit = getUnitLabel(getAsset(reminderRow)?.asset_type);
      setReminderError(`${remUnit} can't be lower than the asset's last recorded value (${reminderMinKm.toLocaleString()}).`);
      return;
    }

    setReminderSaving(true);
    const { data, error } = await supabase
      .from("service_records")
      .update({
        next_due_date: reminderDate || null,
        next_due_km_hours: reminderKm ? parseFloat(reminderKm) : null,
      })
      .eq("id", reminderRow.id)
      .select("id");
    setReminderSaving(false);

    if (error) { setReminderError(error.message); return; }
    if (!data || data.length === 0) {
      setReminderError("Couldn't save — the record wasn't updated. This usually means the database is missing the reminder columns (run the migration) or a permissions (RLS) rule is blocking the update.");
      return;
    }

    setReminderRow(null);
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

  const svcAssetType = assetOptions.find((a) => a.id === svcAssetId)?.asset_type;

  // Filtered list
  const filtered = services.filter(row => {
    const asset = getAsset(row);
    if (filterAsset !== "all" && asset?.id !== filterAsset) return false;
    if (filterType !== "all" && row.service_type !== filterType) return false;
    return true;
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
                item.label === "My Services"
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

        <ContactSupportWidget mechanicId={mechanicId} />

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
              <h1 className="text-[17px] md:text-[20px] font-black text-zinc-900 truncate">My Services</h1>
              <p className="hidden sm:block text-[12px] text-zinc-400 truncate">Full history of all maintenance records.</p>
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
              onClick={handleOpenAddService}
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
                  onClick={handleOpenAddService}
                  className="text-[12px] font-bold text-red-600 hover:text-red-700"
                >
                  Log your first service →
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto relative">
              {openMenuRowId && (
                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuRowId(null)} />
              )}
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="text-left text-[10px] text-zinc-400 font-bold uppercase border-b border-zinc-100">
                    <th className="px-5 py-3 font-bold">Asset</th>
                    <th className="px-3 py-3 font-bold">Service Type</th>
                    <th className="px-3 py-3 font-bold">Date</th>
                    <th className="px-3 py-3 font-bold">Reading</th>
                    <th className="px-3 py-3 font-bold">Notes</th>
                    <th className="px-3 py-3 font-bold">Status</th>
                    <th className="px-3 py-3 font-bold">Reminder</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const asset = getAsset(row);
                    const img = asset ? assetTypeImg[asset.asset_type] ?? "/images/car.png" : "/images/car.png";
                    const label = asset?.nickname || [asset?.brand, asset?.model].filter(Boolean).join(" ") || "Unknown asset";
                    const hasReminder = row.next_due_date != null || row.next_due_km_hours != null;
                    const reminderStatus = computeReminderStatus({
                      nextDueDate: row.next_due_date,
                      nextDueKmHours: row.next_due_km_hours,
                      currentKmHours: currentKmHoursForAsset(asset?.id),
                    });
                    const rc = REMINDER_STATUS_COLOR[reminderStatus];
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
                        <td className="px-3 py-3 text-[12px] text-zinc-700">{formatDateDMY(row.service_date)}</td>
                        <td className="px-3 py-3 text-[12px] text-zinc-700 font-medium">{formatUnitValue(row.km_hours, asset?.asset_type)}</td>
                        <td className="px-3 py-3 text-[11px] text-zinc-500 max-w-[180px] truncate">{row.notes || "—"}</td>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-green-600">
                            <CheckCircle2 size={12} /> Completed
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {hasReminder ? (
                            <button
                              onClick={() => openReminderModal(row)}
                              title="View / edit reminder"
                              className={`inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-2 py-[3px] rounded-full transition-opacity hover:opacity-75 ${rc.bg} ${rc.text}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                              {REMINDER_STATUS_LABEL[reminderStatus]}
                            </button>
                          ) : (
                            <button
                              onClick={() => openReminderModal(row)}
                              title="Set reminder"
                              className="text-[11px] text-zinc-300 hover:text-zinc-500 transition-colors"
                            >
                              — Set
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right relative">
                          <button
                            onClick={() => setOpenMenuRowId(openMenuRowId === row.id ? null : row.id)}
                            className="text-zinc-300 hover:text-zinc-600 transition-colors relative z-20"
                          >
                            <MoreVertical size={15} />
                          </button>
                          {openMenuRowId === row.id && (
                            <div className="absolute right-3 top-9 z-20 w-48 bg-white border border-zinc-200 rounded-xl shadow-lg py-1 text-left">
                              <button
                                onClick={() => openReminderModal(row)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
                              >
                                <Bell size={13} className="text-zinc-400" />
                                {hasReminder ? "Edit Reminder" : "Set Reminder"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
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

              <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-3 py-2.5 text-[12px] text-zinc-500">
                Service date will be recorded automatically as today, {formatDateDMY(new Date().toISOString().slice(0, 10))}.
              </div>

              <div>
                <label className="text-[12px] font-bold text-zinc-700">{getUnitLabel(svcAssetType)}</label>
                <input
                  type="number" min={minKmHours ?? 0} step="0.1"
                  value={svcKmHours} onChange={(e) => setSvcKmHours(e.target.value)}
                  placeholder="e.g. 45000"
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
                {minKmHoursLoading ? (
                  <p className="text-[11px] text-zinc-400 mt-1">Checking last recorded value…</p>
                ) : minKmHours != null ? (
                  <p className="text-[11px] text-zinc-400 mt-1">Last recorded: {formatUnitValue(minKmHours, svcAssetType)}. Can&apos;t be lower than that.</p>
                ) : null}
              </div>

              <div>
                <label className="text-[12px] font-bold text-zinc-700">Notes (optional)</label>
                <textarea rows={3} value={svcNotes} onChange={(e) => setSvcNotes(e.target.value)} placeholder="Parts used, observations, next service..." className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 resize-none" />
              </div>

              <CustomerPicker
                mechanicId={mechanicId}
                customers={customers}
                value={svcCustomerId}
                onChange={setSvcCustomerId}
                onCreated={(c) => setCustomers((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))}
              />

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

      {/* ════ REMINDER MODAL ════ */}
      {reminderRow && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <Bell size={15} className="text-amber-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[16px] font-black text-zinc-900 leading-tight">Maintenance Reminder</h2>
                  {reminderRow && (() => {
                    const a = getAsset(reminderRow);
                    const label = a?.nickname || [a?.brand, a?.model].filter(Boolean).join(" ") || "Unknown asset";
                    return (
                      <p className="text-[11px] text-zinc-400 truncate">
                        {label} · {reminderRow.service_type} on {formatDateDMY(reminderRow.service_date)}
                      </p>
                    );
                  })()}
                </div>
              </div>
              <button onClick={() => setReminderRow(null)} className="text-zinc-400 hover:text-zinc-700 shrink-0"><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveReminder} className="px-6 py-5 space-y-4">
              <p className="text-[12px] text-zinc-500 -mt-1">
                Set when this asset&apos;s next service is expected. Leave blank to clear.
              </p>

              <div>
                <label className="text-[12px] font-bold text-zinc-700">Next service due date</label>
                <input
                  type="date" min={new Date().toISOString().slice(0, 10)} value={reminderDate} onChange={(e) => setReminderDate(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="text-[12px] font-bold text-zinc-700">Next service due at ({getUnitLabel(getAsset(reminderRow)?.asset_type)})</label>
                <input
                  type="number" min={reminderMinKm ?? 0} step="0.1" value={reminderKm} onChange={(e) => setReminderKm(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
                {reminderMinKm != null ? (
                  <p className="text-[11px] text-zinc-400 mt-1">This asset&apos;s last recorded reading: {formatUnitValue(reminderMinKm, getAsset(reminderRow)?.asset_type)}. Can&apos;t be lower than that.</p>
                ) : (
                  <p className="text-[11px] text-zinc-400 mt-1">No {getUnitLabel(getAsset(reminderRow)?.asset_type).toLowerCase()} recorded yet for this asset.</p>
                )}
              </div>

              {reminderError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{reminderError}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setReminderRow(null)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">Cancel</button>
                <button type="submit" disabled={reminderSaving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                  {reminderSaving ? "Saving..." : "Save Reminder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ BECOME A MECHANIC GATE ════ */}
      {showMechanicGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <Wrench size={20} className="text-red-500" />
            </div>
            <h3 className="text-[16px] font-black text-zinc-900 mb-2">Become a Mechanic</h3>
            <p className="text-[13px] text-zinc-500 mb-5">To add maintenance records, your account needs to be activated as a mechanic.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowMechanicGate(false)}
                className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-3 rounded-xl text-[13px] hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBecomeMechanic}
                disabled={activatingMechanic}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-[13px] transition-all"
              >
                {activatingMechanic ? "Activating…" : "Become a Mechanic"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
