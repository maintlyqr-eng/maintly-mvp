"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings, Bell, Plus, X, LogOut, Crown, Menu,
  Search, Download, Printer, Sparkles, ScanLine, Tag, Wrench,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import NotificationBell from "@/components/NotificationBell";
import { authedFetch } from "@/lib/apiAuth";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { useUnreadMechanicMessages } from "@/lib/useUnreadMechanicMessages";
import HoverAvatar from "@/components/HoverAvatar";
import ContactSupportWidget from "@/components/ContactSupportWidget";
import QrCodeCanvas, { type QrCodeCanvasHandle } from "@/components/QrCodeCanvas";
import QrThemePicker from "@/components/QrThemePicker";
import NewAssetModal from "@/components/NewAssetModal";
import { DEFAULT_QR_THEME } from "@/lib/qrThemes";
import { formatDateDMY } from "@/lib/date";

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/dashboard" },
  { icon: FileText, label: "My Services", href: "/dashboard/services" },
  { icon: Bell, label: "Scheduled Services", href: "/dashboard/scheduled" },
  { icon: Box, label: "Assets", href: "/dashboard/assets" },
  { icon: QrCode, label: "QR Codes", href: "/dashboard/qr-codes" },
  { icon: Users, label: "Customers", href: "/dashboard/customers" },
  { icon: BarChart3, label: "Reports", href: "/dashboard/reports" },
  { icon: CalendarIcon, label: "Calendar", href: "/dashboard/calendar" },
  { icon: Mail, label: "Messages", href: "/dashboard/messages" },
  { icon: MessageCircle, label: "Team Chat", href: "/dashboard/team-chat" },
  { icon: FolderOpen, label: "Document Library", href: "/dashboard/documents" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

type QrAsset = { id: string; asset_type: string; brand: string | null; model: string | null; nickname: string | null };
type QrCodeRow = {
  code: string;
  theme: string;
  label: string | null;
  createdAt: string;
  asset: QrAsset | null;
  scanCount: number;
  lastScanned: string | null;
};

const BATCH_PRESETS = [6, 12, 24];

function assetLabel(a: QrAsset) {
  return a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || "Unnamed equipment";
}

export default function QrCodesPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mechanicId, setMechanicId] = useState("");
  const unreadMessages = useUnreadMessagesCount(mechanicId);
  const unreadMechanicMessages = useUnreadMechanicMessages(mechanicId);
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicPhoto, setMechanicPhoto] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [maintlerCode, setMaintlerCode] = useState("");

  const [codes, setCodes] = useState<QrCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageMsg, setPageMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const canvasRefs = useRef<Record<string, QrCodeCanvasHandle | null>>({});

  // Generate blank codes modal
  const [showGenerate, setShowGenerate] = useState(false);
  const [genCount, setGenCount] = useState(12);
  const [genTheme, setGenTheme] = useState(DEFAULT_QR_THEME);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  // Personalize modal
  const [personalizeCode, setPersonalizeCode] = useState<QrCodeRow | null>(null);
  const [pTheme, setPTheme] = useState(DEFAULT_QR_THEME);
  const [pLabel, setPLabel] = useState("");
  const [personalizing, setPersonalizing] = useState(false);
  const [pError, setPError] = useState("");

  // Assign-to-new-equipment (for a blank code, from this page)
  const [assignCode, setAssignCode] = useState<string | null>(null);

  // Codes currently shown in the print-sheet overlay — set either by the
  // bulk "Print Sheet (N)" toolbar button (from the checkbox selection) or
  // by a single card's own "Print" button, kept deliberately independent of
  // `selected` so printing one code doesn't disturb a bulk selection.
  const [printCodes, setPrintCodes] = useState<string[] | null>(null);
  // How big each code+frame prints, in CSS px (frame width, not just the
  // QR — see QrCodeCanvas's `size` semantics). Adjustable before printing
  // since a sticker meant for a small part and one meant for a truck door
  // want very different sizes, and there was no way to change it before.
  const [printSize, setPrintSize] = useState(180);
  const PRINT_SIZE_PRESETS: { label: string; value: number }[] = [
    { label: "S", value: 120 },
    { label: "M", value: 180 },
    { label: "L", value: 260 },
    { label: "XL", value: 340 },
  ];
  const PRINT_SIZE_MIN = 80;
  const PRINT_SIZE_MAX = 400;
  // Per-code overrides on top of `printSize` — so a sheet can mix sizes
  // (e.g. most codes small for parts, one big one for a truck door) instead
  // of every code on the sheet being forced to the same size. Codes not in
  // here just use the global `printSize`. Changing the global size/preset
  // clears these, since "set them all to X" is the more common intent when
  // touching the global control — per-code tweaks are for the exceptions.
  const [printSizeOverrides, setPrintSizeOverrides] = useState<Record<string, number>>({});

  function sizeForPrint(code: string) {
    return printSizeOverrides[code] ?? printSize;
  }

  function nudgeCodeSize(code: string, delta: number) {
    setPrintSizeOverrides((prev) => {
      const current = prev[code] ?? printSize;
      const next = Math.min(PRINT_SIZE_MAX, Math.max(PRINT_SIZE_MIN, current + delta));
      return { ...prev, [code]: next };
    });
  }

  function applyGlobalPrintSize(value: number) {
    setPrintSize(value);
    setPrintSizeOverrides({});
  }

  async function loadCodes() {
    setLoading(true);
    setLoadError("");
    const res = await authedFetch("/api/qr-codes");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoadError(json.error || "Couldn't load your QR codes.");
      setLoading(false);
      return;
    }
    setCodes(json.codes ?? []);
    setLoading(false);
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
        .from("mechanics").select("name, photo_url, maintler_code").eq("id", session.user.id).single();
      if (active && mechanic) { setMechanicName(mechanic.name); setMechanicPhoto(mechanic.photo_url ?? ""); setMaintlerCode(mechanic.maintler_code ?? ""); }

      await loadCodes();
      if (active) setCheckingAuth(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => { active = false; listener.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return codes.filter((c) => {
      if (filter === "assigned" && !c.asset) return false;
      if (filter === "unassigned" && c.asset) return false;
      if (!q) return true;
      const haystack = [c.code, c.label, c.asset ? assetLabel(c.asset) : ""].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [codes, search, filter]);

  const stats = useMemo(() => ({
    total: codes.length,
    assigned: codes.filter((c) => c.asset).length,
    unassigned: codes.filter((c) => !c.asset).length,
    scans: codes.reduce((sum, c) => sum + c.scanCount, 0),
  }), [codes]);

  function toggleSelect(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenError("");
    const res = await authedFetch("/api/qr-codes", {
      method: "POST",
      body: JSON.stringify({ action: "generate_blank", count: genCount, theme: genTheme }),
    });
    const json = await res.json().catch(() => ({}));
    setGenerating(false);
    if (!res.ok) { setGenError(json.error || "Couldn't generate codes."); return; }

    const newRows: QrCodeRow[] = (json.codes ?? []).map((c: any) => ({
      code: c.code, theme: c.theme, label: null, createdAt: c.created_at, asset: null, scanCount: 0, lastScanned: null,
    }));
    setCodes((prev) => [...newRows, ...prev]);
    setSelected(new Set(newRows.map((r) => r.code)));
    setShowGenerate(false);
    setPageMsg({ text: `${newRows.length} blank QR code${newRows.length === 1 ? "" : "s"} ready — select more or head to Print Sheet.`, ok: true });
  }

  function openPersonalize(row: QrCodeRow) {
    setPersonalizeCode(row);
    setPTheme(row.theme || DEFAULT_QR_THEME);
    setPLabel(row.label || "");
    setPError("");
  }

  async function handleSavePersonalize() {
    if (!personalizeCode) return;
    setPersonalizing(true);
    setPError("");
    const res = await authedFetch("/api/qr-codes", {
      method: "POST",
      body: JSON.stringify({ action: "personalize", code: personalizeCode.code, theme: pTheme, label: pLabel.trim() || null }),
    });
    const json = await res.json().catch(() => ({}));
    setPersonalizing(false);
    if (!res.ok) { setPError(json.error || "Couldn't save changes."); return; }

    setCodes((prev) => prev.map((c) => c.code === personalizeCode.code ? { ...c, theme: pTheme, label: pLabel.trim() || null } : c));
    setPersonalizeCode(null);
  }

  function handleDownload(row: QrCodeRow) {
    canvasRefs.current[row.code]?.download(row.label || row.code);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">Loading...</p>
      </div>
    );
  }

  const initials = mechanicName.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "ME";
  const printRows = printCodes ? codes.filter((c) => printCodes.includes(c.code)) : [];

  return (
    <div className="min-h-screen bg-zinc-50 flex relative">

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ════ SIDEBAR ════ */}
      <aside className={`no-print fixed md:static inset-y-0 left-0 z-40 w-[230px] bg-white border-r border-zinc-200 flex flex-col shrink-0 transform transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-2">
          <Link href="/" className="flex items-center">
            <Image src="/images/maintly-logo-full.png" alt="MaintlyQR" width={244} height={72} priority style={{ objectFit: "contain" }} />
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
                item.label === "QR Codes"
                  ? "bg-red-50 text-red-600 border-l-[3px] border-red-600 -ml-[1px]"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <item.icon size={16} />
              {item.label}
              {item.label === "Messages" && unreadMessages > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unreadMessages}</span>
              )}
              {item.label === "Team Chat" && unreadMechanicMessages > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unreadMechanicMessages}</span>
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
            <p className="text-[10px] text-zinc-400 leading-tight">Maintly Maintler</p>
          </div>
        </div>
      </aside>

      {/* ════ MAIN ════ */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="no-print flex items-center justify-between gap-3 px-4 md:px-7 py-4 bg-white border-b border-zinc-200">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden shrink-0 text-zinc-600 hover:text-zinc-900">
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="text-[17px] md:text-[20px] font-black text-zinc-900 truncate">QR Codes</h1>
              <p className="hidden sm:block text-[12px] text-zinc-400 truncate">Generate blank codes to print, personalize their look, and track every scan.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <NotificationBell mechanicId={mechanicId} unreadMessagesCount={unreadMessages} unreadMechanicCount={unreadMechanicMessages} />
            <div className="flex items-center gap-3 md:pl-3 md:border-l border-zinc-200">
              {/* Links to this Maintler's own public card (/maintler/<code>)
                  instead of Settings — Facu's own ask: Settings is already
                  one click away via the sidebar nav, so this top-right
                  identity spot is freed up to jump straight to "how the
                  world sees me" instead of duplicating that sidebar link.
                  Falls back to Settings if maintlerCode hasn't loaded yet
                  (e.g. migration 024 not run yet on this database). */}
              <Link href={maintlerCode ? `/maintler/${maintlerCode}` : "/dashboard/settings"} className="flex items-center gap-2.5 group">
                {mechanicPhoto ? (
                  <HoverAvatar src={mechanicPhoto} size={36} />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[13px]">{initials}</div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-[12px] font-bold text-zinc-800 leading-tight group-hover:text-red-600 transition-colors">{mechanicName || mechanicEmail}</p>
                  <p className="text-[10px] text-zinc-400 leading-tight">Maintler</p>
                </div>
              </Link>
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

        <div className="no-print flex-1 overflow-y-auto p-4 md:p-7">

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: "TOTAL CODES", value: stats.total, color: "#18181b" },
              { label: "ASSIGNED", value: stats.assigned, color: "#16a34a" },
              { label: "UNASSIGNED", value: stats.unassigned, color: "#dc2626" },
              { label: "TOTAL SCANS", value: stats.scans, color: "#2563eb" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-zinc-200 p-4">
                <p className="text-[10px] font-bold text-zinc-400 tracking-wide mb-1">{s.label}</p>
                <p className="text-[22px] font-black" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by code, label or equipment..."
                  className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400"
                />
              </div>
              <select
                value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-[9px] text-[12px] outline-none focus:border-red-400"
              >
                <option value="all">All codes</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned / blank</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <button
                  onClick={() => setPrintCodes(Array.from(selected))}
                  className="flex items-center gap-2 border border-zinc-200 hover:border-zinc-300 bg-white text-zinc-700 text-[13px] font-bold px-4 py-[10px] rounded-xl transition-all"
                >
                  <Printer size={15} /> Print Sheet ({selected.size})
                </button>
              )}
              <button
                onClick={() => { setGenError(""); setShowGenerate(true); }}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white text-[13px] font-bold px-4 py-[10px] rounded-xl shadow-sm"
              >
                <Plus size={15} /> Generate Blank Codes
              </button>
            </div>
          </div>

          {pageMsg && (
            <div className={`mb-4 rounded-xl border px-3.5 py-2.5 text-[12px] ${pageMsg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
              {pageMsg.text}
            </div>
          )}
          {loadError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-700">{loadError}</div>
          )}

          {/* Grid */}
          {loading ? (
            <p className="text-[13px] text-zinc-400 text-center py-12">Loading your QR codes...</p>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 text-center py-16">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-red-100 bg-red-50 mb-3">
                <QrCode size={20} className="text-red-500" />
              </div>
              <p className="text-[13px] text-zinc-400 mb-3">
                {codes.length === 0 ? "No QR codes yet." : "No codes match this search/filter."}
              </p>
              {codes.length === 0 && (
                <button onClick={() => setShowGenerate(true)} className="text-[12px] font-bold text-red-600 hover:text-red-700">
                  Generate your first batch →
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((row) => (
                <div key={row.code} className="bg-white rounded-2xl border border-zinc-200 p-4 flex flex-col items-center text-center relative">
                  <input
                    type="checkbox"
                    checked={selected.has(row.code)}
                    onChange={() => toggleSelect(row.code)}
                    className="absolute top-3 left-3 w-4 h-4 accent-red-600"
                  />
                  <div className="mt-2 mb-2">
                    <QrCodeCanvas ref={(el) => { canvasRefs.current[row.code] = el; }} code={row.code} theme={row.theme} size={110} />
                  </div>
                  <p className="text-[12px] font-mono font-bold text-zinc-800">{row.code}</p>
                  {row.label && <p className="text-[11px] text-zinc-500 mt-0.5">{row.label}</p>}

                  <div className="mt-2">
                    {row.asset ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <Wrench size={10} /> {assetLabel(row.asset)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                        Unassigned — ready to print
                      </span>
                    )}
                  </div>

                  <p className="text-[10.5px] text-zinc-400 mt-2 flex items-center gap-1">
                    <ScanLine size={11} /> {row.scanCount} scan{row.scanCount === 1 ? "" : "s"}
                    {row.lastScanned && ` · last ${formatDateDMY(row.lastScanned)}`}
                  </p>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-100 w-full justify-center flex-wrap">
                    <button onClick={() => openPersonalize(row)} className="flex items-center gap-1 text-[11px] font-bold text-zinc-600 hover:text-red-600 transition-colors" title="Personalize">
                      <Sparkles size={12} /> Personalize
                    </button>
                    <button onClick={() => handleDownload(row)} className="flex items-center gap-1 text-[11px] font-bold text-zinc-600 hover:text-red-600 transition-colors" title="Download PNG">
                      <Download size={12} /> Download
                    </button>
                    <button onClick={() => setPrintCodes([row.code])} className="flex items-center gap-1 text-[11px] font-bold text-zinc-600 hover:text-red-600 transition-colors" title="Print just this code">
                      <Printer size={12} /> Print
                    </button>
                    {!row.asset && (
                      <button onClick={() => setAssignCode(row.code)} className="flex items-center gap-1 text-[11px] font-bold text-zinc-600 hover:text-red-600 transition-colors" title="Assign to a new asset">
                        <Tag size={12} /> Assign
                      </button>
                    )}
                  </div>
                  {row.asset && (
                    <p className="text-[9.5px] text-zinc-300 mt-1.5">Sticker lost or damaged? Just download/print this same code again — it never stops belonging to this equipment.</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-center text-[11px] text-zinc-400 mt-8">© 2026 Maintly. All rights reserved.</p>
        </div>
      </div>

      {/* ════ GENERATE BLANK CODES MODAL ════ */}
      {showGenerate && (
        <div className="no-print fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4" onClick={() => setShowGenerate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <h2 className="text-[16px] font-black text-zinc-900">Generate Blank QR Codes</h2>
              <button onClick={() => setShowGenerate(false)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>
            <div className="px-6 py-5">
              <label className="text-[12px] font-bold text-zinc-700">How many?</label>
              <div className="flex items-center gap-2 mt-1.5 mb-4 flex-wrap">
                {BATCH_PRESETS.map((n) => (
                  <button
                    key={n} type="button" onClick={() => setGenCount(n)}
                    className={`px-4 py-2 rounded-xl text-[13px] font-bold border-2 transition-all ${genCount === n ? "border-red-500 bg-red-50 text-red-600" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number" min={1} max={60} value={genCount}
                  onChange={(e) => setGenCount(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-20 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-500"
                />
              </div>

              <label className="text-[12px] font-bold text-zinc-700 mb-1.5 block">Default look (you can personalize each one later)</label>
              <QrThemePicker value={genTheme} onChange={setGenTheme} />

              {genError && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{genError}</div>}

              <div className="flex gap-3 pt-5">
                <button type="button" onClick={() => setShowGenerate(false)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">Cancel</button>
                <button type="button" disabled={generating} onClick={handleGenerate} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                  {generating ? "Generating..." : `Generate ${genCount} Code${genCount === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ PERSONALIZE MODAL ════ */}
      {personalizeCode && (
        <div className="no-print fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4" onClick={() => setPersonalizeCode(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <h2 className="text-[16px] font-black text-zinc-900">Personalize QR</h2>
              <button onClick={() => setPersonalizeCode(null)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>
            <div className="px-6 py-5">
              <div className="flex justify-center mb-4">
                <QrCodeCanvas code={personalizeCode.code} theme={pTheme} size={140} />
              </div>

              <label className="text-[12px] font-bold text-zinc-700">Label (optional, just for you)</label>
              <input
                value={pLabel} onChange={(e) => setPLabel(e.target.value)}
                placeholder="e.g. Reserved for Truck #3"
                className="w-full mt-1 mb-4 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
              />

              <label className="text-[12px] font-bold text-zinc-700 mb-1.5 block">Look</label>
              <QrThemePicker value={pTheme} onChange={setPTheme} previewCode={personalizeCode.code} />

              {pError && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{pError}</div>}

              <div className="flex gap-3 pt-5">
                <button type="button" onClick={() => setPersonalizeCode(null)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">Cancel</button>
                <button type="button" disabled={personalizing} onClick={handleSavePersonalize} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                  {personalizing ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ ASSIGN TO NEW EQUIPMENT ════ */}
      <NewAssetModal
        open={!!assignCode}
        onClose={() => setAssignCode(null)}
        mechanicId={mechanicId}
        existingCode={assignCode || undefined}
        onCreated={() => { setAssignCode(null); loadCodes(); }}
      />

      {/* ════ PRINT SHEET ════ */}
      {printCodes && (
        <div id="qr-print-sheet" className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="no-print sticky top-0 bg-white z-10 border-b border-zinc-200">
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="text-[16px] font-black text-zinc-900">Print Sheet — {printRows.length} code{printRows.length === 1 ? "" : "s"}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-[13px] font-bold px-4 py-2 rounded-xl">
                  <Printer size={14} /> Print
                </button>
                <button onClick={() => setPrintCodes(null)} className="text-zinc-400 hover:text-zinc-700 px-2"><X size={20} /></button>
              </div>
            </div>
            <div className="flex items-center gap-3 px-6 pb-2 flex-wrap">
              <span className="text-[11px] font-bold text-zinc-500">Size (all):</span>
              {PRINT_SIZE_PRESETS.map((p) => (
                <button
                  key={p.label} type="button" onClick={() => applyGlobalPrintSize(p.value)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold border-2 transition-all ${printSize === p.value ? "border-red-500 bg-red-50 text-red-600" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
                >
                  {p.label}
                </button>
              ))}
              <input
                type="range" min={PRINT_SIZE_MIN} max={PRINT_SIZE_MAX} step={10} value={printSize}
                onChange={(e) => applyGlobalPrintSize(Number(e.target.value))}
                className="w-40 accent-red-600"
              />
              <span className="text-[11px] text-zinc-400 tabular-nums">{printSize}px</span>
            </div>
            <p className="px-6 pb-3 text-[10.5px] text-zinc-400">
              Need one code bigger or smaller than the rest? Use the −/+ under its own preview below — the size above sets the baseline for everyone.
            </p>
          </div>
          {/* flex-wrap + justify-center instead of a CSS grid: with a grid,
              a single code (or a partial last row) sits pinned to the first
              cell — left-aligned inside the centered container — instead of
              centered on the page, which read as "off to the side / cut
              off" when printing just one code. Flex centers every row
              (including a lone item or a short last row) regardless of
              count. */}
          <div className="p-8 flex flex-wrap justify-center gap-8 max-w-4xl mx-auto">
            {printRows.map((row) => {
              const codeSize = sizeForPrint(row.code);
              const isOverridden = printSizeOverrides[row.code] !== undefined;
              return (
                <div key={row.code} style={{ width: Math.max(codeSize + 50, 130) }} className="flex flex-col items-center text-center gap-1.5 break-inside-avoid">
                  <QrCodeCanvas code={row.code} theme={row.theme} size={codeSize} />
                  <p className="text-[11px] font-mono font-bold text-zinc-800">{row.code}</p>
                  {row.label && <p className="text-[10px] text-zinc-500">{row.label}</p>}
                  {/* Per-code size nudge — hidden from the actual printout,
                      just here so a mix of sizes on one sheet is possible
                      without a full slider per card cluttering the layout. */}
                  <div className="no-print flex items-center gap-1.5 mt-0.5">
                    <button
                      type="button" onClick={() => nudgeCodeSize(row.code, -20)}
                      className="w-5 h-5 flex items-center justify-center rounded border border-zinc-200 text-zinc-500 hover:border-red-300 hover:text-red-600 text-[12px] font-bold leading-none"
                      title="Smaller"
                    >
                      −
                    </button>
                    <span className={`text-[10px] tabular-nums ${isOverridden ? "text-red-600 font-bold" : "text-zinc-400"}`}>{codeSize}px</span>
                    <button
                      type="button" onClick={() => nudgeCodeSize(row.code, 20)}
                      className="w-5 h-5 flex items-center justify-center rounded border border-zinc-200 text-zinc-500 hover:border-red-300 hover:text-red-600 text-[12px] font-bold leading-none"
                      title="Bigger"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #qr-print-sheet, #qr-print-sheet * { visibility: visible; }
          /* The on-screen modal is "fixed inset-0 ... overflow-y-auto" so it
             can scroll within the viewport. Those rules (right/bottom pinned
             to the screen edge, overflow-y: auto) stay active during print
             unless explicitly reset here — otherwise the sheet is clipped to
             one viewport-tall page and everything past it just sits behind
             an inert scrollbar instead of flowing onto page 2, 3, etc. */
          #qr-print-sheet {
            position: absolute;
            top: 0;
            left: 0;
            right: auto;
            bottom: auto;
            width: 100%;
            height: auto;
            overflow: visible;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
