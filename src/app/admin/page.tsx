"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Users, Box, Wrench, QrCode, BarChart3, Shield,
  LogOut, RefreshCw, AlertCircle,
  Layers, Eye, EyeOff, Menu, X, Search,
  Ban, ShieldCheck, ShieldOff, Trash2, KeyRound, UserCog,
  UserPlus, UserMinus, Plus, Link2Off, ScanLine, ClipboardList,
  LifeBuoy, Send, MessageCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDateDMY } from "@/lib/date";
import HoverAvatar from "@/components/HoverAvatar";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type AccountRow = {
  id: string;
  name: string;
  email: string;
  workshop_name: string | null;
  is_mechanic: boolean;
  verified: boolean;
  suspended: boolean;
  created_at: string;
  photo_url: string | null;
  profession: string | null;
  certificate_path: string | null;
  verification_status: "none" | "pending" | "verified" | "rejected" | null;
  verification_requested_at: string | null;
  verification_reviewed_at: string | null;
  verification_note: string | null;
};

type ServiceRow = {
  id: string;
  service_date: string;
  service_type: string;
  mechanic_id: string;
  mechanic_name: string;
  asset_id: string;
  asset_label: string;
  customer_name: string;
};

type AssetRow = {
  id: string;
  asset_type: string;
  brand: string | null;
  model: string | null;
  nickname: string | null;
  vin_serial: string | null;
  plate: string | null;
  created_by: string | null;
  created_at: string;
};

type QrRow = {
  code: string;
  asset_id: string | null;
  created_by: string | null;
  created_at: string;
};

type AssetTypeCount = { type: string; count: number };
type DayBucket = { label: string; count: number };

type Section = "dashboard" | "accounts" | "mechanics" | "verifications" | "assets" | "services" | "qr" | "support";

type SupportMessageRow = {
  id: string;
  mechanic_id: string;
  body: string;
  read: boolean;
  created_at: string;
  from_admin: boolean;
  mechanics: { name: string; email: string } | { name: string; email: string }[] | null;
};

type SupportConversation = {
  mechanicId: string;
  mechanic: { name: string; email: string } | null;
  messages: SupportMessageRow[];
  lastMessage: SupportMessageRow;
  unreadCount: number;
};

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────────────
// Small helpers
// ────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return formatDateDMY(iso);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
function getInitials(name: string) {
  return (name || "?").split(" ").filter(Boolean).map(p => p[0]).join("").toUpperCase().slice(0, 2) || "?";
}
function getAvatarColor(name: string) {
  const colors = [
    "bg-red-100 text-red-700", "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700", "bg-purple-100 text-purple-700",
    "bg-orange-100 text-orange-700", "bg-cyan-100 text-cyan-700",
  ];
  return colors[(name || "?").charCodeAt(0) % colors.length];
}

/** Buckets a list of ISO date strings into daily counts for the last `days` days. */
function bucketDaily(dates: string[], days: number): DayBucket[] {
  const buckets: Record<string, number> = {};
  const order: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = 0;
    order.push(key);
  }
  for (const raw of dates) {
    if (!raw) continue;
    const key = raw.slice(0, 10);
    if (key in buckets) buckets[key] += 1;
  }
  return order.map((key) => ({ label: key.slice(5), count: buckets[key] }));
}

async function adminFetch(url: string, method: "PATCH" | "DELETE" | "POST", body: Record<string, unknown>) {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "Something went wrong." };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Presentational pieces
// ────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent, sub }: {
  label: string; value: string | number; icon: React.ElementType;
  accent: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accent} opacity-60`} />
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent} bg-opacity-10 mb-3`}>
        <Icon size={16} className="opacity-80" />
      </div>
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[26px] font-black text-zinc-900 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-zinc-400 mt-1.5 font-medium">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[13px] font-bold text-zinc-900 tracking-tight">{children}</h2>;
}

function TrendRow({ label, data, color }: { label: string; data: DayBucket[]; color: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="flex items-center gap-4 py-3 border-b border-zinc-50 last:border-0">
      <div className="w-36 shrink-0">
        <p className="text-[11px] font-bold text-zinc-600">{label}</p>
        <p className="text-[18px] font-black text-zinc-900 leading-none mt-0.5">{total}</p>
        <p className="text-[10px] text-zinc-300">last {data.length} days</p>
      </div>
      <div className="flex-1 flex items-end gap-[3px] h-10">
        {data.map((d, i) => (
          <div
            key={i}
            title={`${d.label}: ${d.count}`}
            className={`flex-1 rounded-sm ${color}`}
            style={{ height: `${Math.max((d.count / max) * 100, 6)}%`, opacity: d.count === 0 ? 0.12 : 0.85 }}
          />
        ))}
      </div>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "zinc" | "blue" | "emerald" | "amber" | "red" }) {
  const tones: Record<string, string> = {
    zinc: "bg-zinc-50 text-zinc-500 border-zinc-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${tones[tone]}`}>
      {children}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [loginUser, setLoginUser]     = useState("");
  const [loginPass, setLoginPass]     = useState("");
  const [loginError, setLoginError]   = useState("");
  const [showPass, setShowPass]       = useState(false);
  const [loginChecked, setLoginChecked] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [section, setSection] = useState<Section>("dashboard");
  const [actionMsg, setActionMsg] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  // ── Raw data ──
  const [accounts, setAccounts]     = useState<AccountRow[]>([]);
  const [services, setServices]     = useState<ServiceRow[]>([]);
  const [assets, setAssets]         = useState<AssetRow[]>([]);
  const [qrCodes, setQrCodes]       = useState<QrRow[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetTypeCount[]>([]);
  const [assetsByMechanic, setAssetsByMechanic]     = useState<Record<string, number>>({});
  const [servicesByMechanic, setServicesByMechanic] = useState<Record<string, number>>({});
  const [qrByMechanic, setQrByMechanic]             = useState<Record<string, number>>({});
  const [servicesByAsset, setServicesByAsset]       = useState<Record<string, number>>({});
  const [scansToday, setScansToday]   = useState(0);
  const [scansWeek, setScansWeek]     = useState(0);
  const [newUserDays, setNewUserDays]         = useState<DayBucket[]>([]);
  const [newMechanicDays, setNewMechanicDays] = useState<DayBucket[]>([]);
  const [newAssetDays, setNewAssetDays]       = useState<DayBucket[]>([]);
  const [newQrDays, setNewQrDays]             = useState<DayBucket[]>([]);
  const [newServiceDays, setNewServiceDays]   = useState<DayBucket[]>([]);
  const [dataTruncatedNotice, setDataTruncatedNotice] = useState<string | null>(null);
  const [mechanicsTotalCount, setMechanicsTotalCount] = useState<number | null>(null);

  // ── Accounts / Mechanics UI state ──
  const [accountSearch, setAccountSearch] = useState("");
  const [mechanicPendingOnly, setMechanicPendingOnly] = useState(false);
  const [detailAccount, setDetailAccount] = useState<AccountRow | null>(null);
  const [detailName, setDetailName] = useState("");
  const [detailWorkshop, setDetailWorkshop] = useState("");
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailMessageBody, setDetailMessageBody] = useState("");
  const [detailMessageSaving, setDetailMessageSaving] = useState(false);
  const [detailMessageMsg, setDetailMessageMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // ── Support inbox (mechanic -> Control Center) ──
  const [supportMessages, setSupportMessages] = useState<SupportMessageRow[]>([]);
  const [supportLoading, setSupportLoading] = useState(true);
  const [selectedThreadMechanic, setSelectedThreadMechanic] = useState<string | null>(null);
  const [threadDraft, setThreadDraft] = useState("");
  const [threadSending, setThreadSending] = useState(false);
  const [confirmClearThread, setConfirmClearThread] = useState(false);

  // ── Assets UI state ──
  const [assetSearch, setAssetSearch] = useState("");

  // ── Services UI state ──
  const [svcMechanicFilter, setSvcMechanicFilter] = useState("all");
  const [svcTypeFilter, setSvcTypeFilter] = useState("all");

  // ── QR Manager UI state ──
  const [qrStatusFilter, setQrStatusFilter] = useState<"all" | "available" | "assigned">("all");
  const [qrSearch, setQrSearch] = useState("");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateCount, setGenerateCount] = useState("50");
  const [generating, setGenerating] = useState(false);

  // ── Confirm dialog (shared) ──
  const [confirmAction, setConfirmAction] = useState<null | {
    title: string; body: string; danger?: boolean; onConfirm: () => Promise<void>;
  }>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  function flash(text: string, tone: "ok" | "error" = "ok") {
    setActionMsg({ text, tone });
    setTimeout(() => setActionMsg((m) => (m?.text === text ? null : m)), 4000);
  }

  async function loadData() {
    setRefreshing(true);

    // mechanics/assets/qr_codes/service_records/mechanic_assets are read
    // through a service-role API route rather than the browser's anon-key
    // client — see /api/admin/bulk-data for why. The two qr_scans queries
    // stay direct since that table's RLS is already narrow (see migration
    // 006) and they're small, date-filtered reads.
    const [bulkRes, { count: scansTodayCount }, { data: scanWeekRows }] = await Promise.all([
      fetch("/api/admin/bulk-data").then((r) => r.json()).catch(() => null),
      supabase.from("qr_scans").select("*", { count: "exact", head: true })
        .gte("scanned_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      supabase.from("qr_scans").select("scanned_at")
        .gte("scanned_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    if (!bulkRes || bulkRes.error) {
      flash(bulkRes?.error || "Couldn't load platform data.", "error");
      setRefreshing(false);
      setLoading(false);
      return;
    }

    const mechRows = bulkRes.mechanics;
    const svcRows = bulkRes.serviceRecords;
    const assetRows = bulkRes.assets;
    const qrRows = bulkRes.qrCodes;
    const maRows = bulkRes.mechanicAssets;

    const truncatedParts: string[] = [];
    if (bulkRes.mechanicsTruncated) truncatedParts.push(`accounts (showing ${bulkRes.mechanics.length.toLocaleString()} of ${bulkRes.mechanicsTotal.toLocaleString()})`);
    if (bulkRes.assetsTruncated) truncatedParts.push(`assets (showing ${bulkRes.assets.length.toLocaleString()} of ${bulkRes.assetsTotal.toLocaleString()})`);
    if (bulkRes.qrCodesTruncated) truncatedParts.push(`QR codes (showing ${bulkRes.qrCodes.length.toLocaleString()} of ${bulkRes.qrCodesTotal.toLocaleString()})`);
    if (bulkRes.serviceRecordsTruncated) truncatedParts.push(`services (showing ${bulkRes.serviceRecords.length.toLocaleString()} of ${bulkRes.serviceRecordsTotal.toLocaleString()} — oldest are hidden)`);
    setDataTruncatedNotice(truncatedParts.length > 0 ? `Some lists are capped for performance: ${truncatedParts.join(", ")}. Time to add real pagination.` : null);
    setMechanicsTotalCount(bulkRes.mechanicsTotal ?? null);

    const accountRows = (mechRows ?? []) as AccountRow[];
    setAccounts(accountRows);

    // customers live behind strict owner-only RLS, so they're resolved
    // through the service-role /api/admin/customers route (see that file).
    let customerNameById: Record<string, string> = {};
    try {
      const custRes = await fetch("/api/admin/customers");
      const custData = await custRes.json().catch(() => ({}));
      const custRows = (custData.customers as { id: string; name: string }[]) ?? [];
      customerNameById = Object.fromEntries(custRows.map((c) => [c.id, c.name]));
    } catch {
      // non-fatal — Services table just shows "—" for the Customer column
    }

    const svcMapped: ServiceRow[] = ((svcRows ?? []) as any[]).map((s) => {
      const mech = Array.isArray(s.mechanics) ? s.mechanics[0] : s.mechanics;
      const asset = Array.isArray(s.assets) ? s.assets[0] : s.assets;
      return {
        id: s.id, service_date: s.service_date, service_type: s.service_type,
        mechanic_id: s.mechanic_id, mechanic_name: mech?.name ?? "—",
        asset_id: s.asset_id,
        asset_label: asset?.nickname || [asset?.brand, asset?.model].filter(Boolean).join(" ") || "Unknown",
        customer_name: s.customer_id ? (customerNameById[s.customer_id] ?? "—") : "—",
      };
    });
    setServices(svcMapped);

    const assetRowsTyped = (assetRows ?? []) as AssetRow[];
    setAssets(assetRowsTyped);

    const typeCounts: Record<string, number> = {};
    for (const a of assetRowsTyped) {
      typeCounts[a.asset_type] = (typeCounts[a.asset_type] ?? 0) + 1;
    }
    setAssetTypes(Object.entries(typeCounts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count));

    const qrRowsTyped = (qrRows ?? []) as QrRow[];
    setQrCodes(qrRowsTyped);

    const maRowsTyped = (maRows ?? []) as { mechanic_id: string }[];
    const aByM: Record<string, number> = {};
    for (const r of maRowsTyped) aByM[r.mechanic_id] = (aByM[r.mechanic_id] ?? 0) + 1;
    setAssetsByMechanic(aByM);

    const sByM: Record<string, number> = {};
    const sByA: Record<string, number> = {};
    for (const s of svcMapped) {
      sByM[s.mechanic_id] = (sByM[s.mechanic_id] ?? 0) + 1;
      sByA[s.asset_id] = (sByA[s.asset_id] ?? 0) + 1;
    }
    setServicesByMechanic(sByM);
    setServicesByAsset(sByA);

    const qByM: Record<string, number> = {};
    for (const q of qrRowsTyped) {
      if (q.created_by) qByM[q.created_by] = (qByM[q.created_by] ?? 0) + 1;
    }
    setQrByMechanic(qByM);

    setScansToday(scansTodayCount ?? 0);
    setScansWeek(((scanWeekRows ?? []) as any[]).length);

    setNewUserDays(bucketDaily(accountRows.map((a) => a.created_at), 14));
    setNewMechanicDays(bucketDaily(accountRows.filter((a) => a.is_mechanic).map((a) => a.created_at), 14));
    setNewAssetDays(bucketDaily(assetRowsTyped.map((a) => a.created_at), 14));
    setNewQrDays(bucketDaily(qrRowsTyped.filter((q) => q.asset_id).map((q) => q.created_at), 14));
    setNewServiceDays(bucketDaily(svcMapped.map((s) => s.service_date), 14));

    await loadSupportMessages();

    setRefreshing(false);
  }

  async function loadSupportMessages() {
    setSupportLoading(true);
    try {
      const res = await fetch("/api/admin/support-messages");
      const data = await res.json().catch(() => ({}));
      setSupportMessages((data.messages as SupportMessageRow[]) ?? []);
    } finally {
      setSupportLoading(false);
    }
  }

  function getSupportMechanic(m: SupportMessageRow) {
    return Array.isArray(m.mechanics) ? m.mechanics[0] ?? null : m.mechanics;
  }

  const supportConversations: SupportConversation[] = useMemo(() => {
    const byMechanic = new Map<string, SupportMessageRow[]>();
    for (const m of supportMessages) {
      const list = byMechanic.get(m.mechanic_id) ?? [];
      list.push(m);
      byMechanic.set(m.mechanic_id, list);
    }
    const conversations: SupportConversation[] = [];
    for (const [mechanicId, msgs] of byMechanic) {
      const sorted = [...msgs].sort((a, b) => a.created_at.localeCompare(b.created_at));
      conversations.push({
        mechanicId,
        mechanic: getSupportMechanic(sorted[sorted.length - 1]),
        messages: sorted,
        lastMessage: sorted[sorted.length - 1],
        unreadCount: sorted.filter((m) => !m.from_admin && !m.read).length,
      });
    }
    return conversations.sort((a, b) => b.lastMessage.created_at.localeCompare(a.lastMessage.created_at));
  }, [supportMessages]);

  const activeThread = supportConversations.find((c) => c.mechanicId === selectedThreadMechanic) ?? null;

  async function openThread(mechanicId: string) {
    setSelectedThreadMechanic(mechanicId);
    setConfirmClearThread(false);
    const hasUnread = supportMessages.some((m) => m.mechanic_id === mechanicId && !m.from_admin && !m.read);
    if (hasUnread) {
      setSupportMessages((prev) => prev.map((x) => (x.mechanic_id === mechanicId && !x.from_admin ? { ...x, read: true } : x)));
      await adminFetch("/api/admin/support-messages", "PATCH", { mechanicId });
    }
  }

  async function sendSupportReply(mechanicId: string, text: string): Promise<boolean> {
    const result = await adminFetch("/api/admin/support-messages", "POST", { mechanicId, body: text });
    if (result.ok) {
      const mech = supportMessages.find((m) => m.mechanic_id === mechanicId)?.mechanics
        ?? (detailAccount && detailAccount.id === mechanicId ? { name: detailAccount.name, email: detailAccount.email } : null);
      setSupportMessages((prev) => [
        ...prev,
        {
          id: `tmp-${prev.length}-${text.length}`,
          mechanic_id: mechanicId,
          body: text,
          read: true,
          created_at: new Date().toISOString(),
          from_admin: true,
          mechanics: mech,
        },
      ]);
      return true;
    }
    flash(result.error || "Couldn't send the message.", "error");
    return false;
  }

  async function handleClearThread(mechanicId: string) {
    setSupportMessages((prev) => prev.filter((m) => m.mechanic_id !== mechanicId));
    setSelectedThreadMechanic(null);
    setConfirmClearThread(false);
    const result = await adminFetch("/api/admin/support-messages", "DELETE", { mechanicId });
    if (!result.ok) flash(result.error || "Couldn't clear the conversation.", "error");
  }

  async function handleSendThreadReply() {
    if (!selectedThreadMechanic || !threadDraft.trim()) return;
    setThreadSending(true);
    const ok = await sendSupportReply(selectedThreadMechanic, threadDraft.trim());
    setThreadSending(false);
    if (ok) setThreadDraft("");
  }

  async function handleSendDirectMessage() {
    if (!detailAccount || !detailMessageBody.trim()) return;
    setDetailMessageSaving(true);
    const ok = await sendSupportReply(detailAccount.id, detailMessageBody.trim());
    setDetailMessageSaving(false);
    if (ok) {
      setDetailMessageBody("");
      setDetailMessageMsg({ text: "Message sent.", ok: true });
    } else {
      setDetailMessageMsg({ text: "Couldn't send the message.", ok: false });
    }
  }

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((data) => {
        setAdminAuthed(!!data.ok);
        setLoginChecked(true);
        if (data.ok) loadData().then(() => setLoading(false));
      })
      .catch(() => setLoginChecked(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Support conversations aren't realtime — refetch every time this tab is
  // opened so a reply is never composed against a stale, half-loaded thread.
  useEffect(() => {
    if (section === "support" && adminAuthed) {
      loadSupportMessages();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, adminAuthed]);

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginSubmitting(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser.trim(), password: loginPass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoginError(data.error || "Incorrect credentials. Please try again.");
        return;
      }
      setAdminAuthed(true);
      await loadData();
      setLoading(false);
    } finally {
      setLoginSubmitting(false);
    }
  }
  async function handleAdminLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAdminAuthed(false);
  }

  // ── Account actions ──
  function openDetail(a: AccountRow) {
    setDetailAccount(a);
    setDetailName(a.name);
    setDetailWorkshop(a.workshop_name ?? "");
    setDetailError("");
    setDetailMessageBody("");
    setDetailMessageMsg(null);
  }

  async function patchAccount(id: string, patch: Record<string, unknown>) {
    const res = await adminFetch("/api/admin/accounts", "PATCH", { id, ...patch });
    if (!res.ok) { flash(res.error, "error"); return false; }
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } as AccountRow : a)));
    setDetailAccount((prev) => (prev && prev.id === id ? { ...prev, ...patch } as AccountRow : prev));
    return true;
  }

  const [verificationBusyId, setVerificationBusyId] = useState<string | null>(null);

  async function handleApproveVerification(a: AccountRow) {
    setVerificationBusyId(a.id);
    const ok = await patchAccount(a.id, {
      verified: true,
      is_mechanic: true,
      verification_status: "verified",
      verification_reviewed_at: new Date().toISOString(),
    });
    setVerificationBusyId(null);
    if (ok) flash(`${a.name} verified as ${a.profession ?? "a"} Maintler.`);
  }

  async function handleRejectVerification(a: AccountRow) {
    setVerificationBusyId(a.id);
    const ok = await patchAccount(a.id, {
      verified: false,
      verification_status: "rejected",
      verification_reviewed_at: new Date().toISOString(),
    });
    setVerificationBusyId(null);
    if (ok) flash(`Verification request declined for ${a.name}.`);
  }

  async function handleViewCertificate(a: AccountRow) {
    if (!a.certificate_path) return;
    const res = await adminFetch("/api/admin/certificate-url", "POST", { id: a.id });
    if (!res.ok) { flash(res.error, "error"); return; }
    const url = (res.data as { url?: string })?.url;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleSaveDetail() {
    if (!detailAccount) return;
    setDetailSaving(true);
    setDetailError("");
    const ok = await patchAccount(detailAccount.id, { name: detailName.trim(), workshop_name: detailWorkshop.trim() || null });
    setDetailSaving(false);
    if (ok) flash("Account updated.");
    else setDetailError("Couldn't save changes.");
  }

  async function handleResetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) flash(error.message, "error");
    else flash(`Password reset email sent to ${email}.`);
  }

  function confirmDeleteAccount(a: AccountRow) {
    setConfirmAction({
      title: "Delete account",
      body: `This permanently deletes ${a.name}'s account (${a.email}). This cannot be undone.`,
      danger: true,
      onConfirm: async () => {
        const res = await adminFetch("/api/admin/accounts", "DELETE", { id: a.id });
        if (!res.ok) { flash(res.error, "error"); return; }
        setAccounts((prev) => prev.filter((x) => x.id !== a.id));
        setDetailAccount(null);
        flash("Account deleted.");
      },
    });
  }

  // ── Service actions ──
  function confirmDeleteService(s: ServiceRow) {
    setConfirmAction({
      title: "Delete service record",
      body: `Delete the "${s.service_type}" service on ${s.asset_label} (${formatDate(s.service_date)})?`,
      danger: true,
      onConfirm: async () => {
        const res = await adminFetch("/api/admin/services", "DELETE", { id: s.id });
        if (!res.ok) { flash(res.error, "error"); return; }
        setServices((prev) => prev.filter((x) => x.id !== s.id));
        flash("Service record deleted.");
      },
    });
  }

  // ── QR actions ──
  async function handleGenerateBatch() {
    const count = Math.min(Math.max(parseInt(generateCount, 10) || 0, 1), 500);
    setGenerating(true);
    const res = await adminFetch("/api/admin/qr", "POST", { count });
    setGenerating(false);
    if (!res.ok) { flash(res.error, "error"); return; }
    setShowGenerateModal(false);
    flash(`${count} new QR codes generated.`);
    await loadData();
  }

  function confirmUnlinkQr(q: QrRow) {
    setConfirmAction({
      title: "Unlink QR code",
      body: `Free up ${q.code} from its asset? The QR sticker will show "not found" until it's reassigned.`,
      onConfirm: async () => {
        const res = await adminFetch("/api/admin/qr", "PATCH", { code: q.code });
        if (!res.ok) { flash(res.error, "error"); return; }
        setQrCodes((prev) => prev.map((x) => (x.code === q.code ? { ...x, asset_id: null } : x)));
        flash("QR code unlinked.");
      },
    });
  }

  // ── Derived data ──
  const totalUsers = mechanicsTotalCount ?? accounts.length;
  const totalMechanicAccounts = accounts.filter((a) => a.is_mechanic).length;
  const totalVerifiedMechanics = accounts.filter((a) => a.is_mechanic && a.verified).length;
  const totalAssets = assets.length;
  const assignedQR = qrCodes.filter((q) => q.asset_id).length;
  const totalQR = qrCodes.length;
  const totalServices = services.length;

  const mechanicsById = useMemo(() => {
    const map: Record<string, AccountRow> = {};
    for (const a of accounts) map[a.id] = a;
    return map;
  }, [accounts]);

  const visibleAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => [a.name, a.email, a.workshop_name].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [accounts, accountSearch]);

  const visibleMechanics = useMemo(() => {
    return accounts
      .filter((a) => a.is_mechanic)
      .filter((a) => (mechanicPendingOnly ? !a.verified : true));
  }, [accounts, mechanicPendingOnly]);

  const pendingVerifications = useMemo(() => {
    return accounts
      .filter((a) => a.verification_status === "pending")
      .sort((a, b) => (a.verification_requested_at ?? "").localeCompare(b.verification_requested_at ?? ""));
  }, [accounts]);

  const visibleAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => {
      const owner = a.created_by ? mechanicsById[a.created_by]?.name : "";
      const hay = [a.brand, a.model, a.nickname, a.vin_serial, a.plate, owner].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [assets, assetSearch, mechanicsById]);

  const serviceTypeOptions = useMemo(() => Array.from(new Set(services.map((s) => s.service_type))), [services]);

  const visibleServices = useMemo(() => {
    return services.filter((s) => {
      if (svcMechanicFilter !== "all" && s.mechanic_id !== svcMechanicFilter) return false;
      if (svcTypeFilter !== "all" && s.service_type !== svcTypeFilter) return false;
      return true;
    });
  }, [services, svcMechanicFilter, svcTypeFilter]);

  const visibleQr = useMemo(() => {
    const q = qrSearch.trim().toLowerCase();
    return qrCodes.filter((r) => {
      if (qrStatusFilter === "available" && r.asset_id) return false;
      if (qrStatusFilter === "assigned" && !r.asset_id) return false;
      if (q && !r.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [qrCodes, qrStatusFilter, qrSearch]);

  if (!loginChecked) return null;

  // ── LOGIN ─────────────────────────────────────────────────────────────────────
  if (!adminAuthed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-red-50/30 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="w-full max-w-[380px] relative">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-600 shadow-xl shadow-red-200 mb-5">
              <Shield size={28} className="text-white" />
            </div>
            <div className="flex justify-center mb-2">
              <Image src="/images/Maintly.png" alt="Maintly" width={36} height={24} priority style={{ objectFit: "contain" }} />
            </div>
            <p className="text-[12px] text-zinc-400 font-semibold tracking-widest uppercase">Control Center</p>
          </div>

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

              <button type="submit" disabled={loginSubmitting}
                className="w-full bg-red-600 hover:bg-red-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-[14px] transition-all shadow-lg shadow-red-200 mt-1">
                {loginSubmitting ? "Checking…" : "Access Control Center"}
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
        <p className="text-[13px] text-zinc-400 font-medium">Loading control center…</p>
      </div>
    );
  }

  const maxAssetCount = Math.max(...assetTypes.map(a => a.count), 1);
  const qrPct = totalQR > 0 ? Math.round((assignedQR / totalQR) * 100) : 0;
  const navItems: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "accounts",  label: "Accounts",  icon: Users     },
    { id: "mechanics", label: "Mechanics", icon: Wrench    },
    { id: "verifications", label: "Verifications", icon: ShieldCheck },
    { id: "assets",    label: "Assets",    icon: Box       },
    { id: "services",  label: "Services",  icon: ClipboardList },
    { id: "qr",        label: "QR Manager", icon: QrCode   },
    { id: "support",   label: "Support",   icon: LifeBuoy  },
  ];
  const sectionLabels: Record<Section, string> = {
    dashboard: "Dashboard", accounts: "Accounts", mechanics: "Mechanics", verifications: "Verifications",
    assets: "Assets", services: "Services", qr: "QR Manager", support: "Support",
  };
  const unreadSupportCount = supportMessages.filter((m) => !m.from_admin && !m.read).length;

  return (
    <div className="min-h-screen bg-zinc-50/60 flex text-zinc-900 relative">

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ══ SIDEBAR ══ */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-[240px] bg-white border-r border-zinc-200/80 flex flex-col shrink-0 transform transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-5 pt-5 pb-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center shadow-sm shrink-0">
              <Shield size={15} className="text-white" />
            </div>
            <div>
              <Image src="/images/Maintly.png" alt="Maintly" width={26} height={17} priority style={{ objectFit: "contain" }} />
              <p className="text-[9px] font-bold text-red-500 tracking-[0.12em] uppercase leading-none mt-0.5">Control Center</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-400 hover:text-zinc-700">
            <X size={18} />
          </button>
        </div>

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
              {id === "support" && unreadSupportCount > 0 && (
                <span className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none ${
                  section === id ? "bg-white text-red-600" : "bg-red-600 text-white"
                }`}>
                  {unreadSupportCount}
                </span>
              )}
              {id === "verifications" && pendingVerifications.length > 0 && (
                <span className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none ${
                  section === id ? "bg-white text-red-600" : "bg-amber-500 text-white"
                }`}>
                  {pendingVerifications.length}
                </span>
              )}
            </button>
          ))}
        </nav>

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

      {/* ══ MAIN ══ */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="bg-white border-b border-zinc-200/80 px-4 md:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden shrink-0 text-zinc-600 hover:text-zinc-900">
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="text-[18px] md:text-[22px] font-black text-zinc-900 leading-tight truncate">{sectionLabels[section]}</h1>
              <p className="hidden sm:block text-[12px] text-zinc-400 font-medium mt-0.5">MaintlyQR operations control center</p>
            </div>
          </div>
          <button onClick={loadData} disabled={refreshing}
            className="flex items-center gap-2 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 text-[12px] font-bold px-3 md:px-4 py-2.5 rounded-xl transition-all disabled:opacity-40 shadow-sm shrink-0">
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </header>

        {actionMsg && (
          <div className={`mx-4 md:mx-8 mt-4 rounded-xl px-4 py-2.5 text-[12px] font-semibold border ${
            actionMsg.tone === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"
          }`}>
            {actionMsg.text}
          </div>
        )}

        {dataTruncatedNotice && (
          <div className="mx-4 md:mx-8 mt-4 rounded-xl px-4 py-2.5 text-[12px] font-semibold border bg-amber-50 border-amber-200 text-amber-700">
            {dataTruncatedNotice}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-8">

          {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
          {section === "dashboard" && (
            <div className="space-y-7">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Users Registered"   value={totalUsers}             icon={Users}     accent="bg-blue-500" />
                <StatCard label="Mechanic Accounts"   value={totalMechanicAccounts}  icon={Wrench}    accent="bg-orange-500" />
                <StatCard label="Verified Mechanics"  value={totalVerifiedMechanics} icon={ShieldCheck} accent="bg-emerald-500" />
                <StatCard label="Assets Registered"   value={totalAssets}            icon={Box}       accent="bg-purple-500" />
                <StatCard label="QR Assigned"         value={assignedQR}             icon={QrCode}    accent="bg-red-500" sub={`of ${totalQR} issued`} />
                <StatCard label="Services Created"    value={totalServices}          icon={ClipboardList} accent="bg-cyan-500" />
                <StatCard label="Scans Today"         value={scansToday}             icon={ScanLine}  accent="bg-pink-500" />
                <StatCard label="Scans This Week"     value={scansWeek}              icon={ScanLine}  accent="bg-indigo-500" />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
                  <SectionTitle>Growth (last 14 days)</SectionTitle>
                  <div className="mt-2">
                    <TrendRow label="New Users"      data={newUserDays}     color="bg-blue-500" />
                    <TrendRow label="New Mechanics"  data={newMechanicDays} color="bg-orange-500" />
                    <TrendRow label="New Assets"     data={newAssetDays}    color="bg-purple-500" />
                    <TrendRow label="QR Activated"   data={newQrDays}       color="bg-red-500" />
                    <TrendRow label="Services Created" data={newServiceDays} color="bg-cyan-500" />
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                      <SectionTitle>QR Code Utilization</SectionTitle>
                      <span className="text-[20px] font-black text-zinc-900">{qrPct}%</span>
                    </div>
                    <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden mb-4">
                      <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-700" style={{ width: `${qrPct}%` }} />
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
                                  <div className={`h-full ${ASSET_COLORS[type] ?? "bg-zinc-500"} rounded-full`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ACCOUNTS ──────────────────────────────────────────────────── */}
          {section === "accounts" && (
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text" value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)}
                  placeholder="Search by name, email or workshop..."
                  className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400 transition-colors"
                />
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                <div className="px-7 py-5 border-b border-zinc-100">
                  <SectionTitle>{visibleAccounts.length} Accounts</SectionTitle>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px]">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        {["Account", "Roles", "Status", "Joined", ""].map((h) => (
                          <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {visibleAccounts.map((a) => {
                        const owner = (assetsByMechanic[a.id] ?? 0) > 0;
                        return (
                          <tr key={a.id} className="hover:bg-zinc-50/80 transition-colors cursor-pointer" onClick={() => openDetail(a)}>
                            <td className="px-7 py-4">
                              <div className="flex items-center gap-3">
                                {a.photo_url ? (
                                  <HoverAvatar src={a.photo_url} size={36} className="shrink-0" />
                                ) : (
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-black shrink-0 ${getAvatarColor(a.name)}`}>
                                    {getInitials(a.name)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-[13px] font-bold text-zinc-900 truncate">{a.name}</p>
                                  <p className="text-[11px] text-zinc-400 truncate">{a.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-7 py-4">
                              <div className="flex flex-wrap gap-1.5">
                                {owner && <Pill tone="zinc">Owner</Pill>}
                                {a.is_mechanic && <Pill tone="blue">Mechanic</Pill>}
                                {a.is_mechanic && a.verified && <Pill tone="emerald">Verified</Pill>}
                              </div>
                            </td>
                            <td className="px-7 py-4">
                              {a.suspended
                                ? <Pill tone="red">🔴 Suspended</Pill>
                                : <Pill tone="emerald">🟢 Active</Pill>}
                            </td>
                            <td className="px-7 py-4 text-[12px] text-zinc-400">{formatDate(a.created_at)}</td>
                            <td className="px-7 py-4 text-right">
                              <span className="text-[11px] font-bold text-zinc-400">View →</span>
                            </td>
                          </tr>
                        );
                      })}
                      {visibleAccounts.length === 0 && (
                        <tr><td colSpan={5} className="px-7 py-16 text-center text-[13px] text-zinc-300">No accounts match your search.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── MECHANICS ─────────────────────────────────────────────────── */}
          {section === "mechanics" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionTitle>{visibleMechanics.length} Mechanics</SectionTitle>
                <button
                  onClick={() => setMechanicPendingOnly((v) => !v)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                    mechanicPendingOnly ? "bg-amber-500 text-white border-amber-500" : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                  }`}
                >
                  Pending verification only
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px]">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        {["Mechanic", "Workshop", "Verification", "Services", "Joined", "Actions"].map((h) => (
                          <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {visibleMechanics.map((m) => (
                        <tr key={m.id} className="hover:bg-zinc-50/80 transition-colors">
                          <td className="px-7 py-4 cursor-pointer" onClick={() => openDetail(m)}>
                            <div className="flex items-center gap-3">
                              {m.photo_url ? (
                                <HoverAvatar src={m.photo_url} size={36} className="shrink-0" />
                              ) : (
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-black shrink-0 ${getAvatarColor(m.name)}`}>
                                  {getInitials(m.name)}
                                </div>
                              )}
                              <span className="text-[13px] font-bold text-zinc-900">{m.name}</span>
                            </div>
                          </td>
                          <td className="px-7 py-4 text-[12px] text-zinc-500">{m.workshop_name ?? <span className="text-zinc-300">Not set</span>}</td>
                          <td className="px-7 py-4">
                            {m.verified
                              ? <Pill tone="emerald">✓ Verified</Pill>
                              : <Pill tone="amber">Pending</Pill>}
                          </td>
                          <td className="px-7 py-4 text-[12px] text-zinc-500">{servicesByMechanic[m.id] ?? 0}</td>
                          <td className="px-7 py-4 text-[12px] text-zinc-400">{formatDate(m.created_at)}</td>
                          <td className="px-7 py-4">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => patchAccount(m.id, { verified: !m.verified }).then((ok) => ok && flash(m.verified ? "Verification revoked." : "Mechanic verified."))}
                                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
                                  m.verified ? "border-zinc-200 text-zinc-500 hover:bg-zinc-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                }`}
                              >
                                {m.verified ? "Revoke" : "Approve"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {visibleMechanics.length === 0 && (
                        <tr><td colSpan={6} className="px-7 py-16 text-center text-[13px] text-zinc-300">No mechanics{mechanicPendingOnly ? " pending verification" : ""}.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── VERIFICATION REQUESTS ─────────────────────────────────────── */}
          {section === "verifications" && (
            <div className="space-y-4">
              <SectionTitle>{pendingVerifications.length} Pending {pendingVerifications.length === 1 ? "Request" : "Requests"}</SectionTitle>

              {pendingVerifications.length === 0 ? (
                <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center">
                  <ShieldCheck size={28} className="text-zinc-200 mx-auto mb-3" />
                  <p className="text-[13px] text-zinc-300">No pending verification requests.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingVerifications.map((a) => (
                    <div key={a.id} className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {a.photo_url ? (
                          <HoverAvatar src={a.photo_url} size={40} className="shrink-0" />
                        ) : (
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-black shrink-0 ${getAvatarColor(a.name)}`}>
                            {getInitials(a.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-zinc-900 truncate">{a.name}</p>
                          <p className="text-[11px] text-zinc-400 truncate">{a.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Pill tone="amber">{a.profession}</Pill>
                            {a.verification_requested_at && (
                              <span className="text-[10px] text-zinc-400">Requested {formatDate(a.verification_requested_at)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleViewCertificate(a)}
                          disabled={!a.certificate_path}
                          className="text-[11px] font-bold px-3 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-40"
                        >
                          View Certificate
                        </button>
                        <button
                          onClick={() => handleRejectVerification(a)}
                          disabled={verificationBusyId === a.id}
                          className="text-[11px] font-bold px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveVerification(a)}
                          disabled={verificationBusyId === a.id}
                          className="text-[11px] font-bold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40"
                        >
                          {verificationBusyId === a.id ? "Working…" : "Approve"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ASSETS ────────────────────────────────────────────────────── */}
          {section === "assets" && (
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text" value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)}
                  placeholder="Search by VIN, brand, model, plate or owner..."
                  className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400 transition-colors"
                />
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                <div className="px-7 py-5 border-b border-zinc-100">
                  <SectionTitle>{visibleAssets.length} Assets</SectionTitle>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px]">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        {["Asset", "Type", "VIN / Serial", "Owner", "Services", "Registered"].map((h) => (
                          <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {visibleAssets.map((a) => {
                        const label = a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || "Unnamed asset";
                        const owner = a.created_by ? mechanicsById[a.created_by] : null;
                        return (
                          <tr key={a.id} className="hover:bg-zinc-50/80 transition-colors">
                            <td className="px-7 py-4">
                              <div className="flex items-center gap-2.5">
                                <span className="text-[16px]">{ASSET_ICONS[a.asset_type] ?? "🔧"}</span>
                                <span className="text-[13px] font-bold text-zinc-900">{label}</span>
                              </div>
                            </td>
                            <td className="px-7 py-4 text-[12px] text-zinc-500 capitalize">{a.asset_type}</td>
                            <td className="px-7 py-4 text-[12px] text-zinc-500 font-mono">{a.vin_serial || a.plate || "—"}</td>
                            <td className="px-7 py-4 text-[12px] text-zinc-500">{owner?.name ?? "—"}</td>
                            <td className="px-7 py-4 text-[12px] text-zinc-500">{servicesByAsset[a.id] ?? 0}</td>
                            <td className="px-7 py-4 text-[12px] text-zinc-400">{formatDate(a.created_at)}</td>
                          </tr>
                        );
                      })}
                      {visibleAssets.length === 0 && (
                        <tr><td colSpan={6} className="px-7 py-16 text-center text-[13px] text-zinc-300">No assets match your search.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── SERVICES ──────────────────────────────────────────────────── */}
          {section === "services" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Total Services", value: totalServices, color: "text-zinc-900" },
                  { label: "Shown (filtered)", value: visibleServices.length, color: "text-emerald-600" },
                  { label: "Avg per Mechanic", value: totalMechanicAccounts > 0 ? (totalServices / totalMechanicAccounts).toFixed(1) : "—", color: "text-zinc-900" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{label}</p>
                    <p className={`text-[36px] font-black leading-none ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <select value={svcMechanicFilter} onChange={(e) => setSvcMechanicFilter(e.target.value)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400">
                  <option value="all">All mechanics</option>
                  {accounts.filter((a) => a.is_mechanic).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <select value={svcTypeFilter} onChange={(e) => setSvcTypeFilter(e.target.value)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400">
                  <option value="all">All types</option>
                  {serviceTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                <div className="px-7 py-5 border-b border-zinc-100">
                  <SectionTitle>Service History</SectionTitle>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px]">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        {["Asset", "Service Type", "Mechanic", "Customer", "Date", ""].map(h => (
                          <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {visibleServices.slice(0, 200).map((s) => (
                        <tr key={s.id} className="hover:bg-zinc-50/80 transition-colors">
                          <td className="px-7 py-4 text-[13px] font-bold text-zinc-900">{s.asset_label}</td>
                          <td className="px-7 py-4">
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${TYPE_COLORS[s.service_type] ?? "bg-zinc-100 text-zinc-500 border border-zinc-200"}`}>
                              {s.service_type}
                            </span>
                          </td>
                          <td className="px-7 py-4 text-[12px] text-zinc-500">{s.mechanic_name}</td>
                          <td className="px-7 py-4 text-[12px] text-zinc-500">{s.customer_name}</td>
                          <td className="px-7 py-4 text-[12px] text-zinc-400">{formatDate(s.service_date)}</td>
                          <td className="px-7 py-4 text-right">
                            <button onClick={() => confirmDeleteService(s)} className="text-zinc-300 hover:text-red-600 transition-colors" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {visibleServices.length === 0 && (
                        <tr><td colSpan={6} className="px-7 py-16 text-center text-[13px] text-zinc-300">No services match these filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                  {visibleServices.length > 200 && (
                    <p className="text-center text-[11px] text-zinc-300 py-4">Showing the first 200 of {visibleServices.length} — narrow the filters to see more.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── QR MANAGER ────────────────────────────────────────────────── */}
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

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text" value={qrSearch} onChange={(e) => setQrSearch(e.target.value)}
                    placeholder="Search code..."
                    className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400 transition-colors"
                  />
                </div>
                {(["all", "available", "assigned"] as const).map((f) => (
                  <button key={f} onClick={() => setQrStatusFilter(f)}
                    className={`px-3 py-[7px] rounded-full text-[12px] font-bold transition-colors ${qrStatusFilter === f ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                    {f === "all" ? "All" : f === "available" ? "🟢 Available" : "🔵 Assigned"}
                  </button>
                ))}
                <button onClick={() => setShowGenerateModal(true)}
                  className="ml-auto flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-[12px] font-bold px-4 py-[9px] rounded-xl transition-all shadow-sm">
                  <Plus size={14} /> Generate Batch
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px]">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        {["Code", "Status", "Asset", "Created", ""].map((h) => (
                          <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {visibleQr.slice(0, 200).map((q) => {
                        const asset = assets.find((a) => a.id === q.asset_id);
                        const label = asset ? (asset.nickname || [asset.brand, asset.model].filter(Boolean).join(" ") || "Unnamed asset") : null;
                        return (
                          <tr key={q.code} className="hover:bg-zinc-50/80 transition-colors">
                            <td className="px-7 py-4 text-[12px] font-mono font-bold text-zinc-800">{q.code}</td>
                            <td className="px-7 py-4">
                              {q.asset_id ? <Pill tone="blue">🔵 Assigned</Pill> : <Pill tone="emerald">🟢 Available</Pill>}
                            </td>
                            <td className="px-7 py-4 text-[12px] text-zinc-500">{label ?? "—"}</td>
                            <td className="px-7 py-4 text-[12px] text-zinc-400">{formatDate(q.created_at)}</td>
                            <td className="px-7 py-4 text-right">
                              {q.asset_id && (
                                <button onClick={() => confirmUnlinkQr(q)} className="text-zinc-300 hover:text-red-600 transition-colors" title="Unlink from asset">
                                  <Link2Off size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {visibleQr.length === 0 && (
                        <tr><td colSpan={5} className="px-7 py-16 text-center text-[13px] text-zinc-300">No QR codes match this filter.</td></tr>
                      )}
                    </tbody>
                  </table>
                  {visibleQr.length > 200 && (
                    <p className="text-center text-[11px] text-zinc-300 py-4">Showing the first 200 of {visibleQr.length} — narrow the filters to see more.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── SUPPORT (mechanic <-> Control Center, full conversation) ──── */}
          {section === "support" && (
            <div className="space-y-3">
              <p className="text-[12px] text-zinc-400">
                Full back-and-forth with each mechanic. Everything sent from either side is kept in one thread.
              </p>

              {supportLoading ? (
                <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center text-[13px] text-zinc-300">
                  Loading…
                </div>
              ) : supportConversations.length === 0 ? (
                <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center">
                  <MessageCircle size={28} className="mx-auto text-zinc-200 mb-2" />
                  <p className="text-[13px] text-zinc-300 font-medium">No conversations yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[420px]">
                  {/* Conversation list */}
                  <div className={`bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-y-auto ${activeThread ? "hidden md:block" : ""}`}>
                    {supportConversations.map((c) => (
                      <button
                        key={c.mechanicId}
                        onClick={() => openThread(c.mechanicId)}
                        className={`w-full flex items-start gap-2.5 px-4 py-3.5 text-left border-b border-zinc-50 transition-colors ${
                          selectedThreadMechanic === c.mechanicId ? "bg-red-50" : "hover:bg-zinc-50"
                        }`}
                      >
                        {c.unreadCount > 0 && <span className="w-2 h-2 rounded-full bg-red-600 mt-1.5 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[12.5px] font-bold text-zinc-900 truncate">{c.mechanic?.name ?? "Unknown mechanic"}</p>
                            <span className="text-[10px] text-zinc-300 shrink-0">{formatDate(c.lastMessage.created_at)}</span>
                          </div>
                          <p className="text-[11.5px] text-zinc-400 truncate mt-0.5">
                            {c.lastMessage.from_admin ? "You: " : ""}{c.lastMessage.body}
                          </p>
                        </div>
                        {c.unreadCount > 0 && (
                          <span className="text-[9px] font-black bg-red-600 text-white rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shrink-0">{c.unreadCount}</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Thread */}
                  <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm flex flex-col overflow-hidden">
                    {!activeThread ? (
                      <div className="flex-1 flex items-center justify-center text-center px-6">
                        <p className="text-[12px] text-zinc-300">Pick a conversation to see the full history and reply.</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-100">
                          <button onClick={() => setSelectedThreadMechanic(null)} className="md:hidden text-zinc-400 hover:text-zinc-700 mr-1">
                            <X size={16} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-bold text-zinc-900 truncate">{activeThread.mechanic?.name ?? "Unknown mechanic"}</p>
                            <p className="text-[11px] text-zinc-400 truncate">{activeThread.mechanic?.email ?? ""}</p>
                          </div>
                          {confirmClearThread ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] text-zinc-400 hidden sm:inline">Clear for you only?</span>
                              <button
                                onClick={() => handleClearThread(activeThread.mechanicId)}
                                className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 px-2.5 py-1.5 rounded-lg transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmClearThread(false)}
                                className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 px-2 py-1.5"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmClearThread(true)}
                              className="text-zinc-300 hover:text-red-600 transition-colors shrink-0"
                              title="Clear conversation (only from your view — the mechanic keeps their copy)"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5 bg-zinc-50/40">
                          {activeThread.messages.map((m, i) => {
                            const prev = activeThread.messages[i - 1];
                            const showLabel = !prev || prev.from_admin !== m.from_admin;
                            return (
                              <div key={m.id} className={`flex flex-col ${m.from_admin ? "items-end" : "items-start"}`}>
                                {showLabel && (
                                  <p className={`text-[10px] font-black uppercase tracking-wide mb-1 px-1 ${m.from_admin ? "text-zinc-400" : "text-zinc-400"}`}>
                                    {m.from_admin ? "You" : activeThread.mechanic?.name ?? "Mechanic"}
                                  </p>
                                )}
                                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-snug ${
                                  m.from_admin ? "bg-red-600 text-white rounded-br-sm" : "bg-white border border-zinc-200 text-zinc-700 rounded-bl-sm"
                                }`}>
                                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                                  <p className={`text-[9.5px] mt-1 ${m.from_admin ? "text-red-100" : "text-zinc-300"}`}>{formatDate(m.created_at)} · {formatTime(m.created_at)}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="px-4 py-3 border-t border-zinc-100 flex items-end gap-2">
                          <textarea
                            value={threadDraft}
                            onChange={(e) => setThreadDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendThreadReply(); } }}
                            placeholder="Type a quick reply…"
                            rows={1}
                            className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-[13px] outline-none focus:border-red-400 resize-none"
                          />
                          <button
                            onClick={handleSendThreadReply}
                            disabled={threadSending || !threadDraft.trim()}
                            className="flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-[12px] transition-all shrink-0"
                          >
                            <Send size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-[10px] text-zinc-300 mt-12 font-medium">MaintlyQR Admin · Internal use only</p>
        </div>
      </div>

      {/* ══ ACCOUNT DETAIL MODAL ══ */}
      {detailAccount && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4" onClick={() => setDetailAccount(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <div className="flex items-center gap-3 min-w-0">
                {detailAccount.photo_url ? (
                  <HoverAvatar src={detailAccount.photo_url} size={40} previewSize={200} className="shrink-0" />
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-black shrink-0 ${getAvatarColor(detailAccount.name)}`}>
                    {getInitials(detailAccount.name)}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-[15px] font-black text-zinc-900 truncate">{detailAccount.name}</h2>
                  <p className="text-[11px] text-zinc-400 truncate">{detailAccount.email}</p>
                </div>
              </div>
              <button onClick={() => setDetailAccount(null)} className="text-zinc-400 hover:text-zinc-700 shrink-0"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                  <p className="text-[18px] font-black text-zinc-900">{assetsByMechanic[detailAccount.id] ?? 0}</p>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide mt-0.5">Assets</p>
                </div>
                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                  <p className="text-[18px] font-black text-zinc-900">{servicesByMechanic[detailAccount.id] ?? 0}</p>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide mt-0.5">Services</p>
                </div>
                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                  <p className="text-[18px] font-black text-zinc-900">{qrByMechanic[detailAccount.id] ?? 0}</p>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide mt-0.5">QR Registered</p>
                </div>
              </div>

              <p className="text-[11px] text-zinc-400">Joined {formatDate(detailAccount.created_at)}</p>

              {/* Editable fields */}
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-600">Name</label>
                  <input value={detailName} onChange={(e) => setDetailName(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-600">Workshop name</label>
                  <input value={detailWorkshop} onChange={(e) => setDetailWorkshop(e.target.value)} placeholder="Not set"
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400" />
                </div>
                {detailError && <p className="text-[12px] text-red-600">{detailError}</p>}
                <button onClick={handleSaveDetail} disabled={detailSaving}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-[13px] transition-all">
                  {detailSaving ? "Saving…" : "Save changes"}
                </button>
              </div>

              {/* Send Message (Control Center -> mechanic) */}
              <div className="border-t border-zinc-100 pt-4 space-y-2.5">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <MessageCircle size={12} /> Send a message
                </p>
                <textarea
                  value={detailMessageBody}
                  onChange={(e) => { setDetailMessageBody(e.target.value); setDetailMessageMsg(null); }}
                  placeholder={`Write to ${detailAccount.name}…`}
                  rows={3}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400 resize-none"
                />
                {detailMessageMsg && (
                  <p className={`text-[12px] ${detailMessageMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{detailMessageMsg.text}</p>
                )}
                <button onClick={handleSendDirectMessage} disabled={detailMessageSaving || !detailMessageBody.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-[13px] transition-all">
                  <Send size={14} /> {detailMessageSaving ? "Sending…" : "Send message"}
                </button>
              </div>

              {/* Role toggles */}
              <div className="border-t border-zinc-100 pt-4 space-y-2.5">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Roles &amp; status</p>

                <button
                  onClick={() => patchAccount(detailAccount.id, { is_mechanic: !detailAccount.is_mechanic }).then((ok) => ok && flash(detailAccount.is_mechanic ? "Mechanic role removed." : "Converted to mechanic."))}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors text-left"
                >
                  <span className="flex items-center gap-2 text-[12px] font-bold text-zinc-700">
                    <UserCog size={14} /> {detailAccount.is_mechanic ? "Remove Mechanic role" : "Convert to Mechanic"}
                  </span>
                  {detailAccount.is_mechanic ? <UserMinus size={14} className="text-zinc-400" /> : <UserPlus size={14} className="text-zinc-400" />}
                </button>

                {detailAccount.is_mechanic && (
                  <button
                    onClick={() => patchAccount(detailAccount.id, { verified: !detailAccount.verified }).then((ok) => ok && flash(detailAccount.verified ? "Verification revoked." : "Mechanic verified."))}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2 text-[12px] font-bold text-zinc-700">
                      <ShieldCheck size={14} /> {detailAccount.verified ? "Revoke verification" : "Verify mechanic"}
                    </span>
                    {detailAccount.verified ? <ShieldOff size={14} className="text-zinc-400" /> : <ShieldCheck size={14} className="text-emerald-500" />}
                  </button>
                )}

                <button
                  onClick={() => patchAccount(detailAccount.id, { suspended: !detailAccount.suspended }).then((ok) => ok && flash(detailAccount.suspended ? "Account unsuspended." : "Account suspended."))}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors text-left ${
                    detailAccount.suspended ? "border-emerald-200 hover:bg-emerald-50" : "border-amber-200 hover:bg-amber-50"
                  }`}
                >
                  <span className="flex items-center gap-2 text-[12px] font-bold text-zinc-700">
                    <Ban size={14} /> {detailAccount.suspended ? "Unsuspend account" : "Suspend account"}
                  </span>
                </button>

                <button
                  onClick={() => handleResetPassword(detailAccount.email)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors text-left"
                >
                  <span className="flex items-center gap-2 text-[12px] font-bold text-zinc-700">
                    <KeyRound size={14} /> Send password reset email
                  </span>
                </button>

                <button
                  onClick={() => confirmDeleteAccount(detailAccount)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-red-200 hover:bg-red-50 transition-colors text-left"
                >
                  <span className="flex items-center gap-2 text-[12px] font-bold text-red-600">
                    <Trash2 size={14} /> Delete account
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ GENERATE QR BATCH MODAL ══ */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4" onClick={() => setShowGenerateModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-black text-zinc-900 mb-1">Generate QR Batch</h3>
            <p className="text-[12px] text-zinc-400 mb-4">Creates a batch of unassigned QR codes, ready to print on stickers.</p>
            <label className="text-[11px] font-bold text-zinc-600">How many codes?</label>
            <input
              type="number" min={1} max={500} value={generateCount} onChange={(e) => setGenerateCount(e.target.value)}
              className="w-full mt-1 mb-4 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowGenerateModal(false)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-2.5 rounded-xl text-[13px] hover:bg-zinc-50">Cancel</button>
              <button onClick={handleGenerateBatch} disabled={generating}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-[13px] transition-all">
                {generating ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CONFIRM ACTION MODAL ══ */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${confirmAction.danger ? "bg-red-50" : "bg-amber-50"}`}>
              <AlertCircle size={20} className={confirmAction.danger ? "text-red-500" : "text-amber-500"} />
            </div>
            <h3 className="text-[16px] font-black text-zinc-900 mb-2">{confirmAction.title}</h3>
            <p className="text-[13px] text-zinc-500 mb-5">{confirmAction.body}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} disabled={confirmBusy}
                className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-3 rounded-xl text-[13px] hover:bg-zinc-50">
                Cancel
              </button>
              <button
                onClick={async () => {
                  setConfirmBusy(true);
                  await confirmAction.onConfirm();
                  setConfirmBusy(false);
                  setConfirmAction(null);
                }}
                disabled={confirmBusy}
                className={`flex-1 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-[13px] transition-all ${
                  confirmAction.danger ? "bg-red-600 hover:bg-red-500" : "bg-zinc-900 hover:bg-zinc-800"
                }`}
              >
                {confirmBusy ? "Working…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
