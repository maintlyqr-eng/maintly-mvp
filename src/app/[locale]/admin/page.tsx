"use client";

import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Users, Box, Wrench, QrCode, BarChart3, Shield,
  LogOut, RefreshCw, AlertCircle,
  Layers, Eye, EyeOff, Menu, X, Search,
  Ban, ShieldCheck, ShieldOff, Trash2, KeyRound, UserCog,
  UserPlus, UserMinus, Plus, Link2Off, ScanLine, ClipboardList,
  LifeBuoy, Send, MessageCircle, Flag, History, ChevronDown, ChevronRight,
  Trash, RotateCcw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDateDMY } from "@/lib/date";
import HoverAvatar from "@/components/HoverAvatar";

// Local enum-key maps, same pattern as ShareAssetModal.tsx / the Settings
// and Assets [locale] pages — raw DB values (English) map to translation
// keys looked up in the ProfessionTypes namespace.
const PROFESSION_KEYS: Record<string, string> = {
  "Owner": "owner",
  "Mechanic": "mechanic",
  "Electrician": "electrician",
  "HVAC Technician": "hvacTechnician",
  "Fleet Manager": "fleetManager",
  "Business": "business",
  "Inspector": "inspector",
};

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

// ── Papelera (soft delete + restauración — item 14 del pedido de Facu) ──
// Fed by /api/admin/trash, not bulk-data — these are the rows bulk-data
// deliberately excludes (deleted_at is not null).
type TrashMechanicRow = {
  id: string;
  name: string;
  email: string;
  workshop_name: string | null;
  is_mechanic: boolean;
  deleted_at: string;
};

type TrashAssetRow = {
  id: string;
  asset_type: string;
  brand: string | null;
  model: string | null;
  nickname: string | null;
  vin_serial: string | null;
  plate: string | null;
  created_by: string | null;
  deleted_at: string;
};

type TrashServiceRow = {
  id: string;
  service_date: string;
  service_type: string;
  mechanic_id: string | null;
  asset_id: string | null;
  customer_id: string | null;
  deleted_at: string;
  mechanics: { name: string } | null;
  assets: { brand: string | null; model: string | null; nickname: string | null } | null;
};

type AssetTypeCount = { type: string; count: number };
type DayBucket = { label: string; count: number };
type UsageMetrics = {
  dbSizeMB: number;
  dbLimitMB: number;
  dbPercent: number;
  storageSizeMB: number;
  storageLimitMB: number;
  storagePercent: number;
  checkedAt: string;
};

type Section = "dashboard" | "accounts" | "mechanics" | "verifications" | "assets" | "services" | "qr" | "support" | "team-chat" | "moderation" | "audit-log" | "trash";

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

// Team Chat oversight — Facu's own words: "esto es una pagina profesional
// y yo quiero tener control sobre los temas que se hablan". These rows
// come from a service-role admin route (see /api/admin/mechanic-messages),
// which deliberately ignores hidden_for_sender / hidden_for_recipient —
// those are per-Maintler soft-delete flags, not real deletes, so the
// Control Center can always see the full, unfiltered history.
type MechanicChatInfo = { name: string; email: string; workshop_name: string | null };

type MechanicMsgRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read: boolean;
  hidden_for_sender: boolean;
  hidden_for_recipient: boolean;
  created_at: string;
  sender: MechanicChatInfo | null;
  recipient: MechanicChatInfo | null;
};

type MechanicConversation = {
  pairKey: string;
  a: { id: string; info: MechanicChatInfo | null };
  b: { id: string; info: MechanicChatInfo | null };
  messages: MechanicMsgRow[];
  lastMessage: MechanicMsgRow;
};

type MechanicReportRow = {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string | null;
  created_at: string;
  reporter: { name: string; email: string } | null;
  reported: { name: string; email: string } | null;
};

// Item 11 del pedido de Facu (ver claude/MAINTLYQR_FEATURE_BACKLOG.md) —
// registro inalterable de acciones administrativas. Escrito por el server
// desde src/lib/auditLog.ts, leído acá desde /api/admin/audit-logs. El tipo
// de acción se mantiene como string suelto (no importa el union type del
// server) para no acoplar el bundle del cliente a un archivo server-only.
type AdminAuditLogRow = {
  id: string;
  created_at: string;
  admin_username: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  ip_address: string | null;
};

// Item 6 del pedido de Facu ("Reportes y moderación") — reportes públicos
// sobre un asset/registro/QR o consultas generales, distintos de
// mechanic_reports (Maintler reportando a otro Maintler, ver Team Chat).
// Leído acá desde /api/admin/reports, que ya enriquece cada fila con un
// resumen de su asset/mecánico relacionado (ver ese route.ts).
type ContentReportRow = {
  id: string;
  created_at: string;
  updated_at: string;
  report_type: string;
  status: string;
  asset_id: string | null;
  service_record_id: string | null;
  mechanic_id: string | null;
  qr_code: string | null;
  reporter_name: string | null;
  reporter_contact: string | null;
  message: string;
  internal_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  asset: { brand: string | null; model: string | null; nickname: string | null } | null;
  mechanic: { name: string; email: string } | null;
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

const DATE_LOCALE: Record<string, string> = { en: "en-US", es: "es-AR", pt: "pt-BR" };

function formatTime(iso: string, locale: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(DATE_LOCALE[locale] ?? "en-US", { hour: "2-digit", minute: "2-digit" });
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

function UsageBar({ label, usedMB, limitMB, percent }: {
  label: string; usedMB: number; limitMB: number; percent: number;
}) {
  const color = percent >= 80 ? "bg-red-500" : percent >= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[12px] font-semibold text-zinc-700">{label}</span>
        <span className="text-[11px] text-zinc-400 font-medium">
          {usedMB.toLocaleString()} MB / {limitMB.toLocaleString()} MB · {percent}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
        />
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[13px] font-bold text-zinc-900 tracking-tight">{children}</h2>;
}

function TrendRow({ label, data, color }: { label: string; data: DayBucket[]; color: string }) {
  const t = useTranslations("AdminPage");
  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="flex items-center gap-4 py-3 border-b border-zinc-50 last:border-0">
      <div className="w-36 shrink-0">
        <p className="text-[11px] font-bold text-zinc-600">{label}</p>
        <p className="text-[18px] font-black text-zinc-900 leading-none mt-0.5">{total}</p>
        <p className="text-[10px] text-zinc-300">{t("lastDays", { count: data.length })}</p>
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
  const t = useTranslations("AdminPage");
  const tProfessionTypes = useTranslations("ProfessionTypes");
  const tAssetTypes = useTranslations("AssetTypes");
  const locale = useLocale();
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
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);

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

  // ── Team Chat oversight (mechanic <-> mechanic, read-only for admin) ──
  const [teamChatView, setTeamChatView] = useState<"conversations" | "reports">("conversations");
  const [teamChatMessages, setTeamChatMessages] = useState<MechanicMsgRow[]>([]);
  const [teamChatLoading, setTeamChatLoading] = useState(true);
  const [selectedTeamChatPair, setSelectedTeamChatPair] = useState<string | null>(null);
  const [mechanicReports, setMechanicReports] = useState<MechanicReportRow[]>([]);
  const [mechanicReportsLoading, setMechanicReportsLoading] = useState(true);

  // ── Audit log (Logs de auditoría — item 11 del pedido de Facu) ──
  const AUDIT_LOG_PAGE_SIZE = 25;
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRow[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(true);
  const [auditLogsTotal, setAuditLogsTotal] = useState(0);
  const [auditLogsPage, setAuditLogsPage] = useState(1);
  const [auditLogActionFilter, setAuditLogActionFilter] = useState("all");
  const [auditLogEntityFilter, setAuditLogEntityFilter] = useState("all");
  const [auditLogFrom, setAuditLogFrom] = useState("");
  const [auditLogTo, setAuditLogTo] = useState("");
  const [expandedAuditLogId, setExpandedAuditLogId] = useState<string | null>(null);

  // ── Reportes y Moderación (item 6 del pedido de Facu) ──
  const REPORTS_PAGE_SIZE = 25;
  const [reports, setReports] = useState<ContentReportRow[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportsNewCount, setReportsNewCount] = useState(0);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportStatusFilter, setReportStatusFilter] = useState("all");
  const [reportTypeFilter, setReportTypeFilter] = useState("all");
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  // Draft text for the internal-notes textarea, keyed by report id — kept
  // separate from the loaded row so typing doesn't need a round-trip to
  // show up, and "Guardar" only fires on demand rather than on every
  // keystroke.
  const [reportNotesDraft, setReportNotesDraft] = useState<Record<string, string>>({});
  const [reportNotesSaving, setReportNotesSaving] = useState<string | null>(null);

  // ── Papelera (Trash — soft delete + restauración, item 14 del pedido) ──
  const [trashMechanics, setTrashMechanics] = useState<TrashMechanicRow[]>([]);
  const [trashAssets, setTrashAssets] = useState<TrashAssetRow[]>([]);
  const [trashServices, setTrashServices] = useState<TrashServiceRow[]>([]);
  const [trashLoading, setTrashLoading] = useState(true);
  const [trashTab, setTrashTab] = useState<"mechanics" | "assets" | "services">("mechanics");

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
  // `requireTypeToConfirm` gates the confirm button behind typing that exact
  // word first — reserved for permanent-delete actions (item 13 del pedido
  // de Facu: "acciones críticas no deben ejecutarse con un solo clic"). Soft
  // deletes (restorable from the Papelera) use the plain one-click confirm.
  const [confirmAction, setConfirmAction] = useState<null | {
    title: string; body: string; danger?: boolean; requireTypeToConfirm?: string; onConfirm: () => Promise<void>;
  }>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmTypedText, setConfirmTypedText] = useState("");

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
      flash(bulkRes?.error || t("errorLoadPlatformData"), "error");
      setRefreshing(false);
      setLoading(false);
      return;
    }

    // Non-critical: platform usage vs. Supabase Free plan limits (DB size,
    // Storage size). Fails silently until the get_usage_metrics() SQL
    // function is created — the rest of the panel shouldn't break over this.
    fetch("/api/admin/usage-check")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data && !data.error) setUsageMetrics(data as UsageMetrics); })
      .catch(() => {});

    // Non-critical: just the "new reports" badge count for the sidebar, so
    // it's visible without having to open the Moderación tab first (same
    // lightweight, best-effort pattern as usage-check above). The full
    // list itself still lazy-loads on open, same as every other tab.
    fetch("/api/admin/reports?pageSize=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data && typeof data.newCount === "number") setReportsNewCount(data.newCount); })
      .catch(() => {});

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
        asset_label: asset?.nickname || [asset?.brand, asset?.model].filter(Boolean).join(" ") || t("unknown"),
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

  async function loadTeamChatMessages() {
    setTeamChatLoading(true);
    try {
      const res = await fetch("/api/admin/mechanic-messages");
      const data = await res.json().catch(() => ({}));
      setTeamChatMessages((data.messages as MechanicMsgRow[]) ?? []);
    } finally {
      setTeamChatLoading(false);
    }
  }

  async function loadMechanicReports() {
    setMechanicReportsLoading(true);
    try {
      const res = await fetch("/api/admin/mechanic-reports");
      const data = await res.json().catch(() => ({}));
      setMechanicReports((data.reports as MechanicReportRow[]) ?? []);
    } finally {
      setMechanicReportsLoading(false);
    }
  }

  // Real server-side pagination (page/pageSize -> range() on the server) —
  // this table is meant to grow indefinitely, unlike the "fetch up to N and
  // slice client-side" pattern used for the other tables in this panel.
  async function loadAuditLogs() {
    setAuditLogsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(auditLogsPage));
      params.set("pageSize", String(AUDIT_LOG_PAGE_SIZE));
      if (auditLogActionFilter !== "all") params.set("action", auditLogActionFilter);
      if (auditLogEntityFilter !== "all") params.set("entityType", auditLogEntityFilter);
      if (auditLogFrom) params.set("from", new Date(auditLogFrom).toISOString());
      if (auditLogTo) params.set("to", new Date(new Date(auditLogTo).getTime() + 86400000).toISOString());

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      setAuditLogs((data.logs as AdminAuditLogRow[]) ?? []);
      setAuditLogsTotal((data.total as number) ?? 0);
    } finally {
      setAuditLogsLoading(false);
    }
  }

  // Reportes y Moderación: mismo patrón de paginación real server-side que
  // el log de auditoría (esta tabla la alimenta un formulario público
  // anónimo, así que puede crecer sin límite — ver /api/admin/reports).
  async function loadReports() {
    setReportsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(reportsPage));
      params.set("pageSize", String(REPORTS_PAGE_SIZE));
      if (reportStatusFilter !== "all") params.set("status", reportStatusFilter);
      if (reportTypeFilter !== "all") params.set("reportType", reportTypeFilter);

      const res = await fetch(`/api/admin/reports?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      setReports((data.reports as ContentReportRow[]) ?? []);
      setReportsTotal((data.total as number) ?? 0);
      setReportsNewCount((data.newCount as number) ?? 0);
    } finally {
      setReportsLoading(false);
    }
  }

  async function handleReportStatusChange(report: ContentReportRow, status: string) {
    const res = await adminFetch("/api/admin/reports", "PATCH", { id: report.id, status });
    if (!res.ok) { flash(res.error, "error"); return; }
    setReports((prev) => prev.map((r) => (r.id === report.id
      ? { ...r, status, resolved_at: status === "resolved" ? new Date().toISOString() : null }
      : r)));
    if (report.status === "new" && status !== "new") setReportsNewCount((n) => Math.max(0, n - 1));
    flash(t("reportStatusUpdated"));
  }

  async function handleSaveReportNotes(report: ContentReportRow) {
    const notes = reportNotesDraft[report.id] ?? report.internal_notes ?? "";
    setReportNotesSaving(report.id);
    const res = await adminFetch("/api/admin/reports", "PATCH", { id: report.id, internal_notes: notes });
    setReportNotesSaving(null);
    if (!res.ok) { flash(res.error, "error"); return; }
    setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, internal_notes: notes } : r)));
    flash(t("reportNotesSaved"));
  }

  // Papelera: small capped lists (see /api/admin/trash's own comment on why
  // this doesn't need real pagination the way the audit log does), so a
  // simple lazy-refetch-on-open is enough — same pattern as Support/Team Chat.
  async function loadTrash() {
    setTrashLoading(true);
    try {
      const res = await fetch("/api/admin/trash");
      const data = await res.json().catch(() => ({}));
      setTrashMechanics((data.mechanics as TrashMechanicRow[]) ?? []);
      setTrashAssets((data.assets as TrashAssetRow[]) ?? []);
      setTrashServices((data.serviceRecords as TrashServiceRow[]) ?? []);
    } finally {
      setTrashLoading(false);
    }
  }

  // Grouped by unordered pair (sorted id pair joined into one key) rather
  // than by a single "mechanic_id" the way support conversations are,
  // since here BOTH sides are ordinary Maintlers — there's no fixed
  // counterparty to key off of the way "the admin" works for Support.
  const teamChatConversations: MechanicConversation[] = useMemo(() => {
    const byPair = new Map<string, MechanicMsgRow[]>();
    for (const m of teamChatMessages) {
      const pairKey = [m.sender_id, m.recipient_id].sort().join("|");
      const list = byPair.get(pairKey) ?? [];
      list.push(m);
      byPair.set(pairKey, list);
    }
    const conversations: MechanicConversation[] = [];
    for (const [pairKey, msgs] of byPair) {
      const sorted = [...msgs].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const last = sorted[sorted.length - 1];
      conversations.push({
        pairKey,
        a: { id: last.sender_id, info: last.sender },
        b: { id: last.recipient_id, info: last.recipient },
        messages: sorted,
        lastMessage: last,
      });
    }
    return conversations.sort((x, y) => y.lastMessage.created_at.localeCompare(x.lastMessage.created_at));
  }, [teamChatMessages]);

  const activeTeamChatThread = teamChatConversations.find((c) => c.pairKey === selectedTeamChatPair) ?? null;

  function teamChatPersonLabel(m: MechanicMsgRow, id: string): string {
    const info = id === m.sender_id ? m.sender : id === m.recipient_id ? m.recipient : null;
    return info?.workshop_name || info?.name || info?.email || t("unknownMaintler");
  }

  const activeThread = supportConversations.find((c) => c.mechanicId === selectedThreadMechanic) ?? null;

  async function openThread(mechanicId: string) {
    setSelectedThreadMechanic(mechanicId);
    setConfirmClearThread(false);
    const hasUnread = supportMessages.some((m) => m.mechanic_id === mechanicId && !m.from_admin && !m.read);
    if (hasUnread) {
      const result = await adminFetch("/api/admin/support-messages", "PATCH", { mechanicId });
      if (!result.ok) { flash(result.error || t("couldntMarkRead"), "error"); return; }
      setSupportMessages((prev) => prev.map((x) => (x.mechanic_id === mechanicId && !x.from_admin ? { ...x, read: true } : x)));
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
    flash(result.error || t("couldntSendMessage"), "error");
    return false;
  }

  async function handleClearThread(mechanicId: string) {
    const result = await adminFetch("/api/admin/support-messages", "DELETE", { mechanicId });
    if (!result.ok) { flash(result.error || t("couldntClearConversation"), "error"); return; }
    setSupportMessages((prev) => prev.filter((m) => m.mechanic_id !== mechanicId));
    setSelectedThreadMechanic(null);
    setConfirmClearThread(false);
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
      setDetailMessageMsg({ text: t("messageSent"), ok: true });
    } else {
      setDetailMessageMsg({ text: t("couldntSendMessage"), ok: false });
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

  // Same lazy-refetch-on-open pattern as Support, for the Team Chat
  // oversight tab (both the conversation list and the reports list).
  useEffect(() => {
    if (section === "team-chat" && adminAuthed) {
      loadTeamChatMessages();
      loadMechanicReports();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, adminAuthed]);

  // Audit log: refetch on open AND whenever a filter or the page changes —
  // unlike the other lazy-refetch tabs, this one has server-side filters/
  // pagination, so a filter change has to trigger a real new request. Each
  // filter's onChange resets auditLogsPage to 1 in the SAME event handler
  // (see the JSX below) rather than via a separate effect reacting to the
  // filter — that would cause two renders (one with the stale page, one
  // after the reset) and fetch twice per filter change.
  useEffect(() => {
    if (section === "audit-log" && adminAuthed) {
      loadAuditLogs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, adminAuthed, auditLogsPage, auditLogActionFilter, auditLogEntityFilter, auditLogFrom, auditLogTo]);

  // Reportes y Moderación: same reasoning as the audit log effect above —
  // server-side filters/pagination, so filter changes need a real refetch,
  // not just a client-side re-slice.
  useEffect(() => {
    if (section === "moderation" && adminAuthed) {
      loadReports();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, adminAuthed, reportsPage, reportStatusFilter, reportTypeFilter]);

  // Papelera: refetch every time the tab opens, same lazy pattern as
  // Support/Team Chat — a restore or permanent delete elsewhere shouldn't
  // leave a stale trash list sitting around.
  useEffect(() => {
    if (section === "trash" && adminAuthed) {
      loadTrash();
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
    if (ok) flash(t("mechanicVerifiedAs", { name: a.name }));
  }

  async function handleRejectVerification(a: AccountRow) {
    setVerificationBusyId(a.id);
    const ok = await patchAccount(a.id, {
      verified: false,
      verification_status: "rejected",
      verification_reviewed_at: new Date().toISOString(),
    });
    setVerificationBusyId(null);
    if (ok) flash(t("verificationDeclinedFor", { name: a.name }));
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
    if (ok) flash(t("accountUpdated"));
    else setDetailError(t("couldntSaveChanges"));
  }

  async function handleResetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) flash(error.message, "error");
    else flash(t("passwordResetSent", { email }));
  }

  // Soft delete by default — the account moves to the Papelera and stays
  // fully restorable (see migration 031 + accounts/route.ts). Permanent
  // deletion is a separate, extra-gated action from within the Papelera.
  function confirmDeleteAccount(a: AccountRow) {
    setConfirmAction({
      title: t("deleteAccountConfirmTitle"),
      body: t("deleteAccountConfirmBody", { name: a.name, email: a.email }),
      danger: true,
      onConfirm: async () => {
        const res = await adminFetch("/api/admin/accounts", "DELETE", { id: a.id });
        if (!res.ok) { flash(res.error, "error"); return; }
        setAccounts((prev) => prev.filter((x) => x.id !== a.id));
        setDetailAccount(null);
        flash(t("accountMovedToTrash"));
      },
    });
  }

  function confirmRestoreAccount(row: TrashMechanicRow) {
    setConfirmAction({
      title: t("restoreAccountConfirmTitle"),
      body: t("restoreAccountConfirmBody", { name: row.name, email: row.email }),
      onConfirm: async () => {
        const res = await adminFetch("/api/admin/accounts", "PATCH", { id: row.id, restore: true });
        if (!res.ok) { flash(res.error, "error"); return; }
        setTrashMechanics((prev) => prev.filter((x) => x.id !== row.id));
        flash(t("accountRestored"));
        loadData();
      },
    });
  }

  function confirmPermanentDeleteAccount(row: TrashMechanicRow) {
    setConfirmAction({
      title: t("permanentDeleteAccountConfirmTitle"),
      body: t("permanentDeleteAccountConfirmBody", { name: row.name, email: row.email }),
      danger: true,
      requireTypeToConfirm: t("permanentDeleteConfirmWord"),
      onConfirm: async () => {
        const res = await adminFetch("/api/admin/accounts", "DELETE", { id: row.id, permanent: true });
        if (!res.ok) { flash(res.error, "error"); return; }
        setTrashMechanics((prev) => prev.filter((x) => x.id !== row.id));
        flash(t("accountPermanentlyDeleted"));
      },
    });
  }

  // ── Asset actions ──
  // Assets had no write path from the admin at all before this increment —
  // only ever read (via bulk-data). Soft delete + restore + permanent
  // delete follow the exact same three-state pattern as accounts/services.
  function assetLabel(a: { nickname: string | null; brand: string | null; model: string | null }) {
    return a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || t("unnamedAsset");
  }

  function confirmDeleteAsset(a: AssetRow) {
    setConfirmAction({
      title: t("deleteAssetConfirmTitle"),
      body: t("deleteAssetConfirmBody", { asset: assetLabel(a) }),
      danger: true,
      onConfirm: async () => {
        const res = await adminFetch("/api/admin/assets", "DELETE", { id: a.id });
        if (!res.ok) { flash(res.error, "error"); return; }
        setAssets((prev) => prev.filter((x) => x.id !== a.id));
        flash(t("assetMovedToTrash"));
      },
    });
  }

  function confirmRestoreAsset(row: TrashAssetRow) {
    setConfirmAction({
      title: t("restoreAssetConfirmTitle"),
      body: t("restoreAssetConfirmBody", { asset: assetLabel(row) }),
      onConfirm: async () => {
        const res = await adminFetch("/api/admin/assets", "PATCH", { id: row.id, restore: true });
        if (!res.ok) { flash(res.error, "error"); return; }
        setTrashAssets((prev) => prev.filter((x) => x.id !== row.id));
        flash(t("assetRestored"));
        loadData();
      },
    });
  }

  function confirmPermanentDeleteAsset(row: TrashAssetRow) {
    setConfirmAction({
      title: t("permanentDeleteAssetConfirmTitle"),
      body: t("permanentDeleteAssetConfirmBody", { asset: assetLabel(row) }),
      danger: true,
      requireTypeToConfirm: t("permanentDeleteConfirmWord"),
      onConfirm: async () => {
        const res = await adminFetch("/api/admin/assets", "DELETE", { id: row.id, permanent: true });
        if (!res.ok) { flash(res.error, "error"); return; }
        setTrashAssets((prev) => prev.filter((x) => x.id !== row.id));
        flash(t("assetPermanentlyDeleted"));
      },
    });
  }

  // ── Service actions ──
  function confirmDeleteService(s: ServiceRow) {
    setConfirmAction({
      title: t("deleteServiceConfirmTitle"),
      body: t("deleteServiceConfirmBody", { type: s.service_type, asset: s.asset_label, date: formatDate(s.service_date) }),
      danger: true,
      onConfirm: async () => {
        const res = await adminFetch("/api/admin/services", "DELETE", { id: s.id });
        if (!res.ok) { flash(res.error, "error"); return; }
        setServices((prev) => prev.filter((x) => x.id !== s.id));
        flash(t("serviceRecordMovedToTrash"));
      },
    });
  }

  function confirmRestoreService(row: TrashServiceRow) {
    setConfirmAction({
      title: t("restoreServiceConfirmTitle"),
      body: t("restoreServiceConfirmBody", { type: row.service_type, date: formatDate(row.service_date) }),
      onConfirm: async () => {
        const res = await adminFetch("/api/admin/services", "PATCH", { id: row.id, restore: true });
        if (!res.ok) { flash(res.error, "error"); return; }
        setTrashServices((prev) => prev.filter((x) => x.id !== row.id));
        flash(t("serviceRecordRestored"));
        loadData();
      },
    });
  }

  function confirmPermanentDeleteService(row: TrashServiceRow) {
    setConfirmAction({
      title: t("permanentDeleteServiceConfirmTitle"),
      body: t("permanentDeleteServiceConfirmBody", { type: row.service_type, date: formatDate(row.service_date) }),
      danger: true,
      requireTypeToConfirm: t("permanentDeleteConfirmWord"),
      onConfirm: async () => {
        const res = await adminFetch("/api/admin/services", "DELETE", { id: row.id, permanent: true });
        if (!res.ok) { flash(res.error, "error"); return; }
        setTrashServices((prev) => prev.filter((x) => x.id !== row.id));
        flash(t("serviceRecordPermanentlyDeleted"));
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
    flash(t("qrCodesGenerated", { count }));
    await loadData();
  }

  function confirmUnlinkQr(q: QrRow) {
    setConfirmAction({
      title: t("unlinkQrConfirmTitle"),
      body: t("unlinkQrConfirmBody", { code: q.code }),
      onConfirm: async () => {
        const res = await adminFetch("/api/admin/qr", "PATCH", { code: q.code });
        if (!res.ok) { flash(res.error, "error"); return; }
        setQrCodes((prev) => prev.map((x) => (x.code === q.code ? { ...x, asset_id: null } : x)));
        flash(t("qrCodeUnlinked"));
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
            <p className="text-[12px] text-zinc-400 font-semibold tracking-widest uppercase">{t("controlCenterLabel")}</p>
          </div>

          <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-2xl shadow-zinc-200/60 p-8">
            <h1 className="text-[18px] font-black text-zinc-900 mb-1">{t("loginTitle")}</h1>
            <p className="text-[13px] text-zinc-400 mb-6">{t("loginSubtitle")}</p>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-zinc-600 mb-1.5 block">{t("usernameLabel")}</label>
                <input
                  type="text" autoComplete="off" value={loginUser}
                  onChange={e => { setLoginUser(e.target.value); setLoginError(""); }}
                  placeholder={t("usernamePlaceholder")}
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-red-400 focus:ring-4 focus:ring-red-50 focus:bg-white rounded-xl px-4 py-3 text-[14px] text-zinc-900 placeholder-zinc-300 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-zinc-600 mb-1.5 block">{t("passwordLabel")}</label>
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
                {loginSubmitting ? t("checking") : t("accessButton")}
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-zinc-300 mt-6 font-medium">{t("footerNote")}</p>
        </div>
      </div>
    );
  }

  // ── LOADING ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <div className="w-10 h-10 rounded-full border-[3px] border-zinc-100 border-t-red-600 animate-spin" />
        <p className="text-[13px] text-zinc-400 font-medium">{t("loadingControlCenter")}</p>
      </div>
    );
  }

  const maxAssetCount = Math.max(...assetTypes.map(a => a.count), 1);
  const qrPct = totalQR > 0 ? Math.round((assignedQR / totalQR) * 100) : 0;
  const navItems: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: t("navDashboard"), icon: BarChart3 },
    { id: "accounts",  label: t("navAccounts"),  icon: Users     },
    { id: "mechanics", label: t("navMechanics"), icon: Wrench    },
    { id: "verifications", label: t("navVerifications"), icon: ShieldCheck },
    { id: "assets",    label: t("navAssets"),    icon: Box       },
    { id: "services",  label: t("navServices"),  icon: ClipboardList },
    { id: "qr",        label: t("navQr"), icon: QrCode   },
    { id: "support",   label: t("navSupport"),   icon: LifeBuoy  },
    { id: "team-chat", label: t("navTeamChat"), icon: MessageCircle },
    { id: "moderation", label: t("navModeration"), icon: Flag },
    { id: "audit-log", label: t("navAuditLog"), icon: History },
    { id: "trash",     label: t("navTrash"),     icon: Trash    },
  ];
  const sectionLabels: Record<Section, string> = {
    dashboard: t("navDashboard"), accounts: t("navAccounts"), mechanics: t("navMechanics"), verifications: t("navVerifications"),
    assets: t("navAssets"), services: t("navServices"), qr: t("navQr"), support: t("navSupport"), "team-chat": t("navTeamChat"),
    moderation: t("navModeration"), "audit-log": t("navAuditLog"), trash: t("navTrash"),
  };
  const REPORT_TYPE_LABEL: Record<string, string> = {
    incorrect_info: t("reportTypeIncorrectInfo"),
    fake_record: t("reportTypeFakeRecord"),
    inappropriate_content: t("reportTypeInappropriateContent"),
    wrong_asset: t("reportTypeWrongAsset"),
    qr_issue: t("reportTypeQrIssue"),
    technical_issue: t("reportTypeTechnicalIssue"),
    deletion_request: t("reportTypeDeletionRequest"),
    general_inquiry: t("reportTypeGeneralInquiry"),
  };
  const REPORT_STATUS_LABEL: Record<string, string> = {
    new: t("reportStatusNew"),
    in_review: t("reportStatusInReview"),
    resolved: t("reportStatusResolved"),
    closed: t("reportStatusClosed"),
  };
  const REPORT_STATUS_TONE: Record<string, "amber" | "blue" | "emerald" | "zinc"> = {
    new: "amber", in_review: "blue", resolved: "emerald", closed: "zinc",
  };
  const AUDIT_ACTION_LABEL: Record<string, string> = {
    "admin.login": t("auditActionAdminLogin"),
    "admin.logout": t("auditActionAdminLogout"),
    "account.update": t("auditActionAccountUpdate"),
    "account.delete": t("auditActionAccountDelete"),
    "account.restore": t("auditActionAccountRestore"),
    "account.delete_permanent": t("auditActionAccountDeletePermanent"),
    "asset.delete": t("auditActionAssetDelete"),
    "asset.restore": t("auditActionAssetRestore"),
    "asset.delete_permanent": t("auditActionAssetDeletePermanent"),
    "service.delete": t("auditActionServiceDelete"),
    "service.restore": t("auditActionServiceRestore"),
    "service.delete_permanent": t("auditActionServiceDeletePermanent"),
    "qr.generate_batch": t("auditActionQrGenerateBatch"),
    "qr.unlink": t("auditActionQrUnlink"),
    "support_thread.clear": t("auditActionSupportThreadClear"),
  };
  const AUDIT_ENTITY_LABEL: Record<string, string> = {
    mechanic: t("auditEntityMechanic"),
    asset: t("auditEntityAsset"),
    service_record: t("auditEntityServiceRecord"),
    qr_code: t("auditEntityQrCode"),
    qr_batch: t("auditEntityQrBatch"),
    support_thread: t("auditEntitySupportThread"),
  };
  const auditLogTotalPages = Math.max(1, Math.ceil(auditLogsTotal / AUDIT_LOG_PAGE_SIZE));
  const reportsTotalPages = Math.max(1, Math.ceil(reportsTotal / REPORTS_PAGE_SIZE));
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
              <p className="text-[9px] font-bold text-red-500 tracking-[0.12em] uppercase leading-none mt-0.5">{t("controlCenterLabel")}</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-400 hover:text-zinc-700">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest px-3 pt-2 pb-1.5">{t("navigationLabel")}</p>
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
              {id === "team-chat" && mechanicReports.length > 0 && (
                <span className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none ${
                  section === id ? "bg-white text-red-600" : "bg-amber-500 text-white"
                }`}>
                  {mechanicReports.length}
                </span>
              )}
              {id === "moderation" && reportsNewCount > 0 && (
                <span className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none ${
                  section === id ? "bg-white text-red-600" : "bg-amber-500 text-white"
                }`}>
                  {reportsNewCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-zinc-100 space-y-0.5">
          <Link href="/dashboard"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-all">
            <Layers size={15} />
            {t("mechanicView")}
          </Link>
          <button onClick={handleAdminLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-all">
            <LogOut size={15} />
            {t("logOut")}
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
              <p className="hidden sm:block text-[12px] text-zinc-400 font-medium mt-0.5">{t("headerSubtitle")}</p>
            </div>
          </div>
          <button onClick={loadData} disabled={refreshing}
            className="flex items-center gap-2 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 text-[12px] font-bold px-3 md:px-4 py-2.5 rounded-xl transition-all disabled:opacity-40 shadow-sm shrink-0">
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{t("refresh")}</span>
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
                <StatCard label={t("usersRegistered")}   value={totalUsers}             icon={Users}     accent="bg-blue-500" />
                <StatCard label={t("mechanicAccounts")}   value={totalMechanicAccounts}  icon={Wrench}    accent="bg-orange-500" />
                <StatCard label={t("verifiedMechanics")}  value={totalVerifiedMechanics} icon={ShieldCheck} accent="bg-emerald-500" />
                <StatCard label={t("assetsRegistered")}   value={totalAssets}            icon={Box}       accent="bg-purple-500" />
                <StatCard label={t("qrAssigned")}         value={assignedQR}             icon={QrCode}    accent="bg-red-500" sub={t("qrAssignedSub", { total: totalQR })} />
                <StatCard label={t("servicesCreated")}    value={totalServices}          icon={ClipboardList} accent="bg-cyan-500" />
                <StatCard label={t("scansToday")}         value={scansToday}             icon={ScanLine}  accent="bg-pink-500" />
                <StatCard label={t("scansThisWeek")}     value={scansWeek}              icon={ScanLine}  accent="bg-indigo-500" />
              </div>

              {usageMetrics && (
                <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
                  <SectionTitle>{t("platformUsageTitle")}</SectionTitle>
                  <div className="mt-3">
                    <UsageBar label={t("databaseLabel")} usedMB={usageMetrics.dbSizeMB} limitMB={usageMetrics.dbLimitMB} percent={usageMetrics.dbPercent} />
                    <UsageBar label={t("storageLabel")} usedMB={usageMetrics.storageSizeMB} limitMB={usageMetrics.storageLimitMB} percent={usageMetrics.storagePercent} />
                  </div>
                  {(usageMetrics.dbPercent >= 70 || usageMetrics.storagePercent >= 70) && (
                    <p className="mt-3 text-[11px] font-semibold text-amber-600">
                      {t("approachingLimit")}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
                  <SectionTitle>{t("growthTitle")}</SectionTitle>
                  <div className="mt-2">
                    <TrendRow label={t("newUsers")}      data={newUserDays}     color="bg-blue-500" />
                    <TrendRow label={t("newMechanics")}  data={newMechanicDays} color="bg-orange-500" />
                    <TrendRow label={t("newAssets")}     data={newAssetDays}    color="bg-purple-500" />
                    <TrendRow label={t("qrActivated")}   data={newQrDays}       color="bg-red-500" />
                    <TrendRow label={t("servicesCreatedTrend")} data={newServiceDays} color="bg-cyan-500" />
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                      <SectionTitle>{t("qrUtilizationTitle")}</SectionTitle>
                      <span className="text-[20px] font-black text-zinc-900">{qrPct}%</span>
                    </div>
                    <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden mb-4">
                      <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-700" style={{ width: `${qrPct}%` }} />
                    </div>
                    <div className="flex gap-5">
                      <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <div>
                          <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">{t("linked")}</p>
                          <p className="text-[22px] font-black text-emerald-700 leading-none">{assignedQR}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 flex-1">
                        <div className="w-2 h-2 rounded-full bg-zinc-300 shrink-0" />
                        <div>
                          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{t("free")}</p>
                          <p className="text-[22px] font-black text-zinc-500 leading-none">{totalQR - assignedQR}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
                    <SectionTitle>{t("fleetBreakdownTitle")}</SectionTitle>
                    {assetTypes.length === 0 ? (
                      <p className="text-[13px] text-zinc-300 mt-4">{t("noAssetsYet")}</p>
                    ) : (
                      <div className="space-y-3 mt-4">
                        {assetTypes.map(({ type, count }) => {
                          const pct = Math.round((count / maxAssetCount) * 100);
                          return (
                            <div key={type} className="flex items-center gap-3">
                              <span className="text-[17px] w-6 shrink-0">{ASSET_ICONS[type] ?? "🔧"}</span>
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1.5">
                                  <span className="text-[12px] font-semibold text-zinc-700">{tAssetTypes(type)}</span>
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
                  placeholder={t("searchAccountsPlaceholder")}
                  className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400 transition-colors"
                />
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                <div className="px-7 py-5 border-b border-zinc-100">
                  <SectionTitle>{t("accountsCount", { count: visibleAccounts.length })}</SectionTitle>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px]">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        {[t("colAccount"), t("colRoles"), t("colStatus"), t("colJoined"), ""].map((h) => (
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
                                {owner && <Pill tone="zinc">{t("ownerPill")}</Pill>}
                                {a.is_mechanic && <Pill tone="blue">{t("mechanicPill")}</Pill>}
                                {a.is_mechanic && a.verified && <Pill tone="emerald">{t("verifiedPill")}</Pill>}
                              </div>
                            </td>
                            <td className="px-7 py-4">
                              {a.suspended
                                ? <Pill tone="red">{t("suspendedPill")}</Pill>
                                : <Pill tone="emerald">{t("activePill")}</Pill>}
                            </td>
                            <td className="px-7 py-4 text-[12px] text-zinc-400">{formatDate(a.created_at)}</td>
                            <td className="px-7 py-4 text-right">
                              <span className="text-[11px] font-bold text-zinc-400">{t("viewArrow")}</span>
                            </td>
                          </tr>
                        );
                      })}
                      {visibleAccounts.length === 0 && (
                        <tr><td colSpan={5} className="px-7 py-16 text-center text-[13px] text-zinc-300">{t("noAccountsMatch")}</td></tr>
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
                <SectionTitle>{t("mechanicsCount", { count: visibleMechanics.length })}</SectionTitle>
                <button
                  onClick={() => setMechanicPendingOnly((v) => !v)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                    mechanicPendingOnly ? "bg-amber-500 text-white border-amber-500" : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                  }`}
                >
                  {t("pendingOnlyToggle")}
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px]">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        {[t("colMechanic"), t("colWorkshop"), t("colVerification"), t("colServices"), t("colJoined"), t("colActions")].map((h) => (
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
                          <td className="px-7 py-4 text-[12px] text-zinc-500">{m.workshop_name ?? <span className="text-zinc-300">{t("notSet")}</span>}</td>
                          <td className="px-7 py-4">
                            {m.verified
                              ? <Pill tone="emerald">{t("verifiedCheck")}</Pill>
                              : <Pill tone="amber">{t("pending")}</Pill>}
                          </td>
                          <td className="px-7 py-4 text-[12px] text-zinc-500">{servicesByMechanic[m.id] ?? 0}</td>
                          <td className="px-7 py-4 text-[12px] text-zinc-400">{formatDate(m.created_at)}</td>
                          <td className="px-7 py-4">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => patchAccount(m.id, { verified: !m.verified }).then((ok) => ok && flash(m.verified ? t("verificationRevoked") : t("mechanicVerified")))}
                                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
                                  m.verified ? "border-zinc-200 text-zinc-500 hover:bg-zinc-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                }`}
                              >
                                {m.verified ? t("revoke") : t("approve")}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {visibleMechanics.length === 0 && (
                        <tr><td colSpan={6} className="px-7 py-16 text-center text-[13px] text-zinc-300">{mechanicPendingOnly ? t("noMechanicsPending") : t("noMechanics")}</td></tr>
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
              <SectionTitle>{t("pendingRequestsCount", { count: pendingVerifications.length })}</SectionTitle>

              {pendingVerifications.length === 0 ? (
                <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center">
                  <ShieldCheck size={28} className="text-zinc-200 mx-auto mb-3" />
                  <p className="text-[13px] text-zinc-300">{t("noPendingRequests")}</p>
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
                            <Pill tone="amber">{a.profession ? tProfessionTypes(PROFESSION_KEYS[a.profession] ?? "owner") : ""}</Pill>
                            {a.verification_requested_at && (
                              <span className="text-[10px] text-zinc-400">{t("requestedOn", { date: formatDate(a.verification_requested_at) })}</span>
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
                          {t("viewCertificate")}
                        </button>
                        <button
                          onClick={() => handleRejectVerification(a)}
                          disabled={verificationBusyId === a.id}
                          className="text-[11px] font-bold px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                        >
                          {t("reject")}
                        </button>
                        <button
                          onClick={() => handleApproveVerification(a)}
                          disabled={verificationBusyId === a.id}
                          className="text-[11px] font-bold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40"
                        >
                          {verificationBusyId === a.id ? t("working") : t("approve")}
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
                  placeholder={t("searchAssetsPlaceholder")}
                  className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400 transition-colors"
                />
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                <div className="px-7 py-5 border-b border-zinc-100">
                  <SectionTitle>{t("assetsCount", { count: visibleAssets.length })}</SectionTitle>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px]">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        {[t("colAsset"), t("colType"), t("colVin"), t("colOwner"), t("colServices"), t("colRegistered"), ""].map((h) => (
                          <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {visibleAssets.map((a) => {
                        const label = assetLabel(a);
                        const owner = a.created_by ? mechanicsById[a.created_by] : null;
                        return (
                          <tr key={a.id} className="hover:bg-zinc-50/80 transition-colors">
                            <td className="px-7 py-4">
                              <div className="flex items-center gap-2.5">
                                <span className="text-[16px]">{ASSET_ICONS[a.asset_type] ?? "🔧"}</span>
                                <span className="text-[13px] font-bold text-zinc-900">{label}</span>
                              </div>
                            </td>
                            <td className="px-7 py-4 text-[12px] text-zinc-500">{tAssetTypes(a.asset_type)}</td>
                            <td className="px-7 py-4 text-[12px] text-zinc-500 font-mono">{a.vin_serial || a.plate || "—"}</td>
                            <td className="px-7 py-4 text-[12px] text-zinc-500">{owner?.name ?? "—"}</td>
                            <td className="px-7 py-4 text-[12px] text-zinc-500">{servicesByAsset[a.id] ?? 0}</td>
                            <td className="px-7 py-4 text-[12px] text-zinc-400">{formatDate(a.created_at)}</td>
                            <td className="px-7 py-4 text-right">
                              <button onClick={() => confirmDeleteAsset(a)} className="text-zinc-300 hover:text-red-600 transition-colors" title={t("deleteTitle")}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {visibleAssets.length === 0 && (
                        <tr><td colSpan={7} className="px-7 py-16 text-center text-[13px] text-zinc-300">{t("noAssetsMatch")}</td></tr>
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
                  { label: t("totalServices"), value: totalServices, color: "text-zinc-900" },
                  { label: t("shownFiltered"), value: visibleServices.length, color: "text-emerald-600" },
                  { label: t("avgPerMechanic"), value: totalMechanicAccounts > 0 ? (totalServices / totalMechanicAccounts).toFixed(1) : "—", color: "text-zinc-900" },
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
                  <option value="all">{t("allMechanics")}</option>
                  {accounts.filter((a) => a.is_mechanic).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <select value={svcTypeFilter} onChange={(e) => setSvcTypeFilter(e.target.value)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400">
                  <option value="all">{t("allTypes")}</option>
                  {serviceTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                <div className="px-7 py-5 border-b border-zinc-100">
                  <SectionTitle>{t("serviceHistoryTitle")}</SectionTitle>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px]">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        {[t("colAsset"), t("colServiceType"), t("colMechanic"), t("colCustomer"), t("colDate"), ""].map(h => (
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
                            <button onClick={() => confirmDeleteService(s)} className="text-zinc-300 hover:text-red-600 transition-colors" title={t("deleteTitle")}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {visibleServices.length === 0 && (
                        <tr><td colSpan={6} className="px-7 py-16 text-center text-[13px] text-zinc-300">{t("noServicesMatch")}</td></tr>
                      )}
                    </tbody>
                  </table>
                  {visibleServices.length > 200 && (
                    <p className="text-center text-[11px] text-zinc-300 py-4">{t("showingFirstOf", { shown: 200, total: visibleServices.length })}</p>
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
                  { label: t("totalQrCodes"), value: totalQR, color: "text-zinc-900" },
                  { label: t("linkedToAssets"), value: assignedQR, color: "text-emerald-600" },
                  { label: t("available"), value: totalQR - assignedQR, color: "text-zinc-400" },
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
                    placeholder={t("searchCodePlaceholder")}
                    className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400 transition-colors"
                  />
                </div>
                {(["all", "available", "assigned"] as const).map((f) => (
                  <button key={f} onClick={() => setQrStatusFilter(f)}
                    className={`px-3 py-[7px] rounded-full text-[12px] font-bold transition-colors ${qrStatusFilter === f ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                    {f === "all" ? t("filterAll") : f === "available" ? t("filterAvailable") : t("filterAssigned")}
                  </button>
                ))}
                <button onClick={() => setShowGenerateModal(true)}
                  className="ml-auto flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-[12px] font-bold px-4 py-[9px] rounded-xl transition-all shadow-sm">
                  <Plus size={14} /> {t("generateBatch")}
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px]">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        {[t("colCode"), t("colStatus"), t("colAsset"), t("colCreated"), ""].map((h) => (
                          <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {visibleQr.slice(0, 200).map((q) => {
                        const asset = assets.find((a) => a.id === q.asset_id);
                        const label = asset ? (asset.nickname || [asset.brand, asset.model].filter(Boolean).join(" ") || t("unnamedAsset")) : null;
                        return (
                          <tr key={q.code} className="hover:bg-zinc-50/80 transition-colors">
                            <td className="px-7 py-4 text-[12px] font-mono font-bold text-zinc-800">{q.code}</td>
                            <td className="px-7 py-4">
                              {q.asset_id ? <Pill tone="blue">{t("assignedPill")}</Pill> : <Pill tone="emerald">{t("availablePill")}</Pill>}
                            </td>
                            <td className="px-7 py-4 text-[12px] text-zinc-500">{label ?? "—"}</td>
                            <td className="px-7 py-4 text-[12px] text-zinc-400">{formatDate(q.created_at)}</td>
                            <td className="px-7 py-4 text-right">
                              {q.asset_id && (
                                <button onClick={() => confirmUnlinkQr(q)} className="text-zinc-300 hover:text-red-600 transition-colors" title={t("unlinkTitle")}>
                                  <Link2Off size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {visibleQr.length === 0 && (
                        <tr><td colSpan={5} className="px-7 py-16 text-center text-[13px] text-zinc-300">{t("noQrMatch")}</td></tr>
                      )}
                    </tbody>
                  </table>
                  {visibleQr.length > 200 && (
                    <p className="text-center text-[11px] text-zinc-300 py-4">{t("showingFirstOf", { shown: 200, total: visibleQr.length })}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── SUPPORT (mechanic <-> Control Center, full conversation) ──── */}
          {section === "support" && (
            <div className="space-y-3">
              <p className="text-[12px] text-zinc-400">
                {t("supportIntro")}
              </p>

              {supportLoading ? (
                <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center text-[13px] text-zinc-300">
                  {t("loading")}
                </div>
              ) : supportConversations.length === 0 ? (
                <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center">
                  <MessageCircle size={28} className="mx-auto text-zinc-200 mb-2" />
                  <p className="text-[13px] text-zinc-300 font-medium">{t("noConversationsYet")}</p>
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
                            <p className="text-[12.5px] font-bold text-zinc-900 truncate">{c.mechanic?.name ?? t("unknownMechanic")}</p>
                            <span className="text-[10px] text-zinc-300 shrink-0">{formatDate(c.lastMessage.created_at)}</span>
                          </div>
                          <p className="text-[11.5px] text-zinc-400 truncate mt-0.5">
                            {c.lastMessage.from_admin ? t("youPrefix") : ""}{c.lastMessage.body}
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
                        <p className="text-[12px] text-zinc-300">{t("pickConversationReply")}</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-100">
                          <button onClick={() => setSelectedThreadMechanic(null)} className="md:hidden text-zinc-400 hover:text-zinc-700 mr-1">
                            <X size={16} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-bold text-zinc-900 truncate">{activeThread.mechanic?.name ?? t("unknownMechanic")}</p>
                            <p className="text-[11px] text-zinc-400 truncate">{activeThread.mechanic?.email ?? ""}</p>
                          </div>
                          {confirmClearThread ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] text-zinc-400 hidden sm:inline">{t("clearForYouOnly")}</span>
                              <button
                                onClick={() => handleClearThread(activeThread.mechanicId)}
                                className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 px-2.5 py-1.5 rounded-lg transition-colors"
                              >
                                {t("confirm")}
                              </button>
                              <button
                                onClick={() => setConfirmClearThread(false)}
                                className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 px-2 py-1.5"
                              >
                                {t("cancel")}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmClearThread(true)}
                              className="text-zinc-300 hover:text-red-600 transition-colors shrink-0"
                              title={t("clearConversationTitle")}
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
                                    {m.from_admin ? t("you") : activeThread.mechanic?.name ?? t("mechanicLabel")}
                                  </p>
                                )}
                                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-snug ${
                                  m.from_admin ? "bg-red-600 text-white rounded-br-sm" : "bg-white border border-zinc-200 text-zinc-700 rounded-bl-sm"
                                }`}>
                                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                                  <p className={`text-[9.5px] mt-1 ${m.from_admin ? "text-red-100" : "text-zinc-300"}`}>{formatDate(m.created_at)} · {formatTime(m.created_at, locale)}</p>
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
                            placeholder={t("quickReplyPlaceholder")}
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

          {section === "team-chat" && (
            <div className="space-y-3">
              <p className="text-[12px] text-zinc-400">
                {t("teamChatIntro")}
              </p>

              <div className="flex items-center gap-1 bg-white rounded-xl border border-zinc-200/80 p-1 w-fit">
                <button
                  onClick={() => setTeamChatView("conversations")}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${
                    teamChatView === "conversations" ? "bg-red-600 text-white" : "text-zinc-500 hover:bg-zinc-100"
                  }`}
                >
                  {t("conversationsTab")}
                </button>
                <button
                  onClick={() => setTeamChatView("reports")}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors flex items-center gap-1.5 ${
                    teamChatView === "reports" ? "bg-red-600 text-white" : "text-zinc-500 hover:bg-zinc-100"
                  }`}
                >
                  <Flag size={12} /> {t("reportsTab")}
                  {mechanicReports.length > 0 && (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none ${
                      teamChatView === "reports" ? "bg-white text-red-600" : "bg-amber-500 text-white"
                    }`}>
                      {mechanicReports.length}
                    </span>
                  )}
                </button>
              </div>

              {teamChatView === "reports" ? (
                mechanicReportsLoading ? (
                  <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center text-[13px] text-zinc-300">
                    {t("loading")}
                  </div>
                ) : mechanicReports.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center">
                    <Flag size={28} className="mx-auto text-zinc-200 mb-2" />
                    <p className="text-[13px] text-zinc-300 font-medium">{t("noReportsFiled")}</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm divide-y divide-zinc-50">
                    {mechanicReports.map((r) => {
                      const pairKey = [r.reporter_id, r.reported_id].sort().join("|");
                      const hasThread = teamChatConversations.some((c) => c.pairKey === pairKey);
                      return (
                        <div key={r.id} className="px-5 py-4 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-bold text-zinc-900">
                              {t.rich("reportedLine", {
                                reporter: r.reporter?.name ?? t("unknown"),
                                reported: r.reported?.name ?? t("unknown"),
                                span: (chunks) => <span className="font-normal text-zinc-400">{chunks}</span>,
                              })}
                            </p>
                            <p className="text-[11px] text-zinc-400 mt-0.5">{r.reporter?.email} → {r.reported?.email}</p>
                            {r.reason && <p className="text-[12px] text-zinc-600 mt-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">{r.reason}</p>}
                            <p className="text-[10.5px] text-zinc-300 mt-1.5">{formatDate(r.created_at)} · {formatTime(r.created_at, locale)}</p>
                          </div>
                          {hasThread && (
                            <button
                              onClick={() => { setTeamChatView("conversations"); setSelectedTeamChatPair(pairKey); }}
                              className="text-[11px] font-bold text-red-600 hover:text-red-700 shrink-0 whitespace-nowrap"
                            >
                              {t("viewConversation")}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : teamChatLoading ? (
                <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center text-[13px] text-zinc-300">
                  {t("loading")}
                </div>
              ) : teamChatConversations.length === 0 ? (
                <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center">
                  <MessageCircle size={28} className="mx-auto text-zinc-200 mb-2" />
                  <p className="text-[13px] text-zinc-300 font-medium">{t("noTeamChatConversations")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-260px)] min-h-[420px]">
                  {/* Conversation list */}
                  <div className={`bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-y-auto ${activeTeamChatThread ? "hidden md:block" : ""}`}>
                    {teamChatConversations.map((c) => (
                      <button
                        key={c.pairKey}
                        onClick={() => setSelectedTeamChatPair(c.pairKey)}
                        className={`w-full flex items-start gap-2.5 px-4 py-3.5 text-left border-b border-zinc-50 transition-colors ${
                          selectedTeamChatPair === c.pairKey ? "bg-red-50" : "hover:bg-zinc-50"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-bold text-zinc-900 truncate">
                            {c.a.info?.name ?? t("unknown")} <span className="font-normal text-zinc-400">↔</span> {c.b.info?.name ?? t("unknown")}
                          </p>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className="text-[11.5px] text-zinc-400 truncate">{teamChatPersonLabel(c.lastMessage, c.lastMessage.sender_id)}: {c.lastMessage.body}</p>
                            <span className="text-[10px] text-zinc-300 shrink-0">{formatDate(c.lastMessage.created_at)}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Thread */}
                  <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm flex flex-col overflow-hidden">
                    {!activeTeamChatThread ? (
                      <div className="flex-1 flex items-center justify-center text-center px-6">
                        <p className="text-[12px] text-zinc-300">{t("pickConversationHistory")}</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-100">
                          <button onClick={() => setSelectedTeamChatPair(null)} className="md:hidden text-zinc-400 hover:text-zinc-700 mr-1">
                            <X size={16} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-bold text-zinc-900 truncate">
                              {activeTeamChatThread.a.info?.name ?? t("unknown")} ↔ {activeTeamChatThread.b.info?.name ?? t("unknown")}
                            </p>
                            <p className="text-[11px] text-zinc-400 truncate">{activeTeamChatThread.a.info?.email} · {activeTeamChatThread.b.info?.email}</p>
                          </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5 bg-zinc-50/40">
                          {activeTeamChatThread.messages.map((m, i) => {
                            const prev = activeTeamChatThread.messages[i - 1];
                            const showLabel = !prev || prev.sender_id !== m.sender_id;
                            const isA = m.sender_id === activeTeamChatThread.a.id;
                            const hiddenNote = [
                              m.hidden_for_sender ? t("clearedBySender") : null,
                              m.hidden_for_recipient ? t("clearedByRecipient") : null,
                            ].filter(Boolean).join(", ");
                            return (
                              <div key={m.id} className={`flex flex-col ${isA ? "items-start" : "items-end"}`}>
                                {showLabel && (
                                  <p className="text-[10px] font-black uppercase tracking-wide mb-1 px-1 text-zinc-400">
                                    {teamChatPersonLabel(m, m.sender_id)}
                                  </p>
                                )}
                                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-snug ${
                                  isA ? "bg-white border border-zinc-200 text-zinc-700 rounded-bl-sm" : "bg-red-600 text-white rounded-br-sm"
                                }`}>
                                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                                  <p className={`text-[9.5px] mt-1 ${isA ? "text-zinc-300" : "text-red-100"}`}>
                                    {formatDate(m.created_at)} · {formatTime(m.created_at, locale)}
                                    {hiddenNote && ` · ${hiddenNote}`}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── AUDIT LOG (Logs de auditoría) ────────────────────────────── */}
          {section === "audit-log" && (
            <div className="space-y-4">
              <p className="text-[12px] text-zinc-400">{t("auditLogIntro")}</p>

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("auditFilterAction")}</label>
                  <select
                    value={auditLogActionFilter}
                    onChange={(e) => { setAuditLogActionFilter(e.target.value); setAuditLogsPage(1); }}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
                  >
                    <option value="all">{t("auditFilterAll")}</option>
                    {Object.entries(AUDIT_ACTION_LABEL).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("auditFilterEntity")}</label>
                  <select
                    value={auditLogEntityFilter}
                    onChange={(e) => { setAuditLogEntityFilter(e.target.value); setAuditLogsPage(1); }}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
                  >
                    <option value="all">{t("auditFilterAll")}</option>
                    {Object.entries(AUDIT_ENTITY_LABEL).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("auditFilterFrom")}</label>
                  <input
                    type="date" value={auditLogFrom}
                    onChange={(e) => { setAuditLogFrom(e.target.value); setAuditLogsPage(1); }}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("auditFilterTo")}</label>
                  <input
                    type="date" value={auditLogTo}
                    onChange={(e) => { setAuditLogTo(e.target.value); setAuditLogsPage(1); }}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
                  />
                </div>
                {(auditLogActionFilter !== "all" || auditLogEntityFilter !== "all" || auditLogFrom || auditLogTo) && (
                  <button
                    onClick={() => { setAuditLogActionFilter("all"); setAuditLogEntityFilter("all"); setAuditLogFrom(""); setAuditLogTo(""); setAuditLogsPage(1); }}
                    className="text-[11px] font-bold text-zinc-400 hover:text-red-600 transition-colors px-2 py-2"
                  >
                    {t("auditFilterClear")}
                  </button>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                {auditLogsLoading ? (
                  <p className="text-[13px] text-zinc-400 text-center py-16">{t("loading")}</p>
                ) : auditLogs.length === 0 ? (
                  <div className="text-center py-16">
                    <History size={28} className="mx-auto text-zinc-200 mb-2" />
                    <p className="text-[13px] text-zinc-300 font-medium">{t("auditNoLogs")}</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px]">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-100">
                            {[t("auditColWhen"), t("auditColAdmin"), t("auditColAction"), t("auditColEntity"), t("auditColEntityId"), ""].map((h) => (
                              <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                          {auditLogs.map((log) => {
                            const isExpanded = expandedAuditLogId === log.id;
                            return (
                              <Fragment key={log.id}>
                                <tr
                                  className="hover:bg-zinc-50/80 transition-colors cursor-pointer"
                                  onClick={() => setExpandedAuditLogId(isExpanded ? null : log.id)}
                                >
                                  <td className="px-7 py-4 text-[12px] text-zinc-400 whitespace-nowrap">{formatDate(log.created_at)} · {formatTime(log.created_at, locale)}</td>
                                  <td className="px-7 py-4 text-[12px] font-semibold text-zinc-700">{log.admin_username}</td>
                                  <td className="px-7 py-4"><Pill tone="blue">{AUDIT_ACTION_LABEL[log.action] ?? log.action}</Pill></td>
                                  <td className="px-7 py-4 text-[12px] text-zinc-500">{log.entity_type ? (AUDIT_ENTITY_LABEL[log.entity_type] ?? log.entity_type) : "—"}</td>
                                  <td className="px-7 py-4 text-[12px] font-mono text-zinc-400">{log.entity_id ?? "—"}</td>
                                  <td className="px-7 py-4 text-right text-zinc-300">
                                    {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr key={`${log.id}-detail`} className="bg-zinc-50/60">
                                    <td colSpan={6} className="px-7 py-4">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11.5px]">
                                        <div>
                                          <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("auditDetailOldValue")}</p>
                                          <pre className="whitespace-pre-wrap break-words bg-white border border-zinc-200 rounded-lg p-2.5 text-zinc-600 font-mono text-[11px]">
                                            {log.old_value ? JSON.stringify(log.old_value, null, 2) : "—"}
                                          </pre>
                                        </div>
                                        <div>
                                          <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("auditDetailNewValue")}</p>
                                          <pre className="whitespace-pre-wrap break-words bg-white border border-zinc-200 rounded-lg p-2.5 text-zinc-600 font-mono text-[11px]">
                                            {log.new_value ? JSON.stringify(log.new_value, null, 2) : "—"}
                                          </pre>
                                        </div>
                                        {log.reason && (
                                          <div className="sm:col-span-2">
                                            <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("auditDetailReason")}</p>
                                            <p className="text-zinc-600">{log.reason}</p>
                                          </div>
                                        )}
                                        {log.ip_address && (
                                          <div className="sm:col-span-2">
                                            <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("auditDetailIp")}</p>
                                            <p className="text-zinc-600 font-mono">{log.ip_address}</p>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between px-7 py-4 border-t border-zinc-100">
                      <p className="text-[11px] text-zinc-400">{t("auditTotalCount", { count: auditLogsTotal })}</p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setAuditLogsPage((p) => Math.max(1, p - 1))}
                          disabled={auditLogsPage <= 1}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-30"
                        >
                          {t("auditPrevPage")}
                        </button>
                        <span className="text-[11px] text-zinc-400">{t("auditPageOf", { page: auditLogsPage, totalPages: auditLogTotalPages })}</span>
                        <button
                          onClick={() => setAuditLogsPage((p) => Math.min(auditLogTotalPages, p + 1))}
                          disabled={auditLogsPage >= auditLogTotalPages}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-30"
                        >
                          {t("auditNextPage")}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── REPORTES Y MODERACIÓN (item 6 del pedido de Facu) ──────────── */}
          {section === "moderation" && (
            <div className="space-y-4">
              <p className="text-[12px] text-zinc-400">{t("moderationIntro")}</p>

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("moderationFilterStatus")}</label>
                  <select
                    value={reportStatusFilter}
                    onChange={(e) => { setReportStatusFilter(e.target.value); setReportsPage(1); }}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
                  >
                    <option value="all">{t("auditFilterAll")}</option>
                    {Object.entries(REPORT_STATUS_LABEL).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("moderationFilterType")}</label>
                  <select
                    value={reportTypeFilter}
                    onChange={(e) => { setReportTypeFilter(e.target.value); setReportsPage(1); }}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
                  >
                    <option value="all">{t("auditFilterAll")}</option>
                    {Object.entries(REPORT_TYPE_LABEL).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                {(reportStatusFilter !== "all" || reportTypeFilter !== "all") && (
                  <button
                    onClick={() => { setReportStatusFilter("all"); setReportTypeFilter("all"); setReportsPage(1); }}
                    className="text-[11px] font-bold text-zinc-400 hover:text-red-600 transition-colors px-2 py-2"
                  >
                    {t("auditFilterClear")}
                  </button>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                {reportsLoading ? (
                  <p className="text-[13px] text-zinc-400 text-center py-16">{t("loading")}</p>
                ) : reports.length === 0 ? (
                  <div className="text-center py-16">
                    <Flag size={28} className="mx-auto text-zinc-200 mb-2" />
                    <p className="text-[13px] text-zinc-300 font-medium">{t("moderationNoReports")}</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px]">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-100">
                            {[t("moderationColWhen"), t("moderationColType"), t("moderationColStatus"), t("moderationColRelated"), ""].map((h) => (
                              <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                          {reports.map((report) => {
                            const isExpanded = expandedReportId === report.id;
                            const relatedLabel = report.asset
                              ? assetLabel(report.asset)
                              : (report.mechanic?.name ?? report.qr_code ?? "—");
                            return (
                              <Fragment key={report.id}>
                                <tr
                                  className="hover:bg-zinc-50/80 transition-colors cursor-pointer"
                                  onClick={() => {
                                    setExpandedReportId(isExpanded ? null : report.id);
                                    setReportNotesDraft((prev) => (report.id in prev ? prev : { ...prev, [report.id]: report.internal_notes ?? "" }));
                                  }}
                                >
                                  <td className="px-7 py-4 text-[12px] text-zinc-400 whitespace-nowrap">{formatDate(report.created_at)} · {formatTime(report.created_at, locale)}</td>
                                  <td className="px-7 py-4 text-[12px] text-zinc-600 font-semibold">{REPORT_TYPE_LABEL[report.report_type] ?? report.report_type}</td>
                                  <td className="px-7 py-4"><Pill tone={REPORT_STATUS_TONE[report.status] ?? "zinc"}>{REPORT_STATUS_LABEL[report.status] ?? report.status}</Pill></td>
                                  <td className="px-7 py-4 text-[12px] text-zinc-500 truncate max-w-[220px]">{relatedLabel}</td>
                                  <td className="px-7 py-4 text-right text-zinc-300">
                                    {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr key={`${report.id}-detail`} className="bg-zinc-50/60">
                                    <td colSpan={5} className="px-7 py-5">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-[12px]">
                                        <div className="sm:col-span-2">
                                          <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("moderationDetailMessage")}</p>
                                          <p className="whitespace-pre-wrap break-words bg-white border border-zinc-200 rounded-lg p-3 text-zinc-700">{report.message}</p>
                                        </div>
                                        {(report.reporter_name || report.reporter_contact) && (
                                          <div>
                                            <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("moderationDetailReporter")}</p>
                                            <p className="text-zinc-600">{report.reporter_name || t("moderationAnonymous")}{report.reporter_contact ? ` · ${report.reporter_contact}` : ""}</p>
                                          </div>
                                        )}
                                        {report.qr_code && (
                                          <div>
                                            <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("moderationDetailQrCode")}</p>
                                            <a href={`/asset/${report.qr_code}`} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:text-red-700 font-mono font-bold">
                                              {report.qr_code}
                                            </a>
                                          </div>
                                        )}
                                        <div>
                                          <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("moderationDetailStatus")}</p>
                                          <select
                                            value={report.status}
                                            onChange={(e) => handleReportStatusChange(report, e.target.value)}
                                            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-red-400"
                                          >
                                            {Object.entries(REPORT_STATUS_LABEL).map(([key, label]) => (
                                              <option key={key} value={key}>{label}</option>
                                            ))}
                                          </select>
                                        </div>
                                        {report.resolved_at && (
                                          <div>
                                            <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("moderationDetailResolvedBy")}</p>
                                            <p className="text-zinc-600">{report.resolved_by ?? "—"} · {formatDate(report.resolved_at)}</p>
                                          </div>
                                        )}
                                        <div className="sm:col-span-2">
                                          <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("moderationDetailNotes")}</p>
                                          <textarea
                                            value={reportNotesDraft[report.id] ?? report.internal_notes ?? ""}
                                            onChange={(e) => setReportNotesDraft((prev) => ({ ...prev, [report.id]: e.target.value }))}
                                            placeholder={t("moderationNotesPlaceholder")}
                                            rows={2}
                                            className="w-full bg-white border border-zinc-200 focus:border-red-400 rounded-lg px-3 py-2 text-[12px] text-zinc-700 outline-none transition-all resize-none"
                                          />
                                          <button
                                            onClick={() => handleSaveReportNotes(report)}
                                            disabled={reportNotesSaving === report.id}
                                            className="mt-2 text-[11px] font-bold text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
                                          >
                                            {reportNotesSaving === report.id ? t("saving") : t("moderationSaveNotes")}
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between px-7 py-4 border-t border-zinc-100">
                      <p className="text-[11px] text-zinc-400">{t("auditTotalCount", { count: reportsTotal })}</p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setReportsPage((p) => Math.max(1, p - 1))}
                          disabled={reportsPage <= 1}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-30"
                        >
                          {t("auditPrevPage")}
                        </button>
                        <span className="text-[11px] text-zinc-400">{t("auditPageOf", { page: reportsPage, totalPages: reportsTotalPages })}</span>
                        <button
                          onClick={() => setReportsPage((p) => Math.min(reportsTotalPages, p + 1))}
                          disabled={reportsPage >= reportsTotalPages}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-30"
                        >
                          {t("auditNextPage")}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── PAPELERA ──────────────────────────────────────────────────── */}
          {section === "trash" && (
            <div className="space-y-4">
              <p className="text-[12px] text-zinc-400">{t("trashIntro")}</p>

              <div className="flex flex-wrap gap-2">
                {([
                  { id: "mechanics", label: t("trashTabMechanics"), count: trashMechanics.length },
                  { id: "assets", label: t("trashTabAssets"), count: trashAssets.length },
                  { id: "services", label: t("trashTabServices"), count: trashServices.length },
                ] as const).map((tab) => (
                  <button key={tab.id} onClick={() => setTrashTab(tab.id)}
                    className={`px-3.5 py-[7px] rounded-full text-[12px] font-bold transition-colors ${
                      trashTab === tab.id ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                    }`}>
                    {tab.label} {tab.count > 0 && <span className="opacity-60">· {tab.count}</span>}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                {trashLoading ? (
                  <p className="text-[13px] text-zinc-400 text-center py-16">{t("loading")}</p>
                ) : trashTab === "mechanics" ? (
                  trashMechanics.length === 0 ? (
                    <div className="text-center py-16">
                      <Trash size={28} className="mx-auto text-zinc-200 mb-2" />
                      <p className="text-[13px] text-zinc-300 font-medium">{t("trashEmptyMechanics")}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px]">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-100">
                            {[t("colAccount"), t("colEmail"), t("trashColDeletedAt"), ""].map((h) => (
                              <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                          {trashMechanics.map((row) => (
                            <tr key={row.id} className="hover:bg-zinc-50/80 transition-colors">
                              <td className="px-7 py-4 text-[13px] font-bold text-zinc-900">{row.name}</td>
                              <td className="px-7 py-4 text-[12px] text-zinc-500">{row.email}</td>
                              <td className="px-7 py-4 text-[12px] text-zinc-400 whitespace-nowrap">{formatDate(row.deleted_at)} · {formatTime(row.deleted_at, locale)}</td>
                              <td className="px-7 py-4">
                                <div className="flex items-center justify-end gap-3">
                                  <button onClick={() => confirmRestoreAccount(row)} className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors" title={t("restoreTitle")}>
                                    <RotateCcw size={13} /> {t("restoreTitle")}
                                  </button>
                                  <button onClick={() => confirmPermanentDeleteAccount(row)} className="text-zinc-300 hover:text-red-600 transition-colors" title={t("permanentDeleteTitle")}>
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : trashTab === "assets" ? (
                  trashAssets.length === 0 ? (
                    <div className="text-center py-16">
                      <Trash size={28} className="mx-auto text-zinc-200 mb-2" />
                      <p className="text-[13px] text-zinc-300 font-medium">{t("trashEmptyAssets")}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px]">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-100">
                            {[t("colAsset"), t("colType"), t("colOwner"), t("trashColDeletedAt"), ""].map((h) => (
                              <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                          {trashAssets.map((row) => {
                            const owner = row.created_by ? mechanicsById[row.created_by] : null;
                            return (
                              <tr key={row.id} className="hover:bg-zinc-50/80 transition-colors">
                                <td className="px-7 py-4">
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-[16px]">{ASSET_ICONS[row.asset_type] ?? "🔧"}</span>
                                    <span className="text-[13px] font-bold text-zinc-900">{assetLabel(row)}</span>
                                  </div>
                                </td>
                                <td className="px-7 py-4 text-[12px] text-zinc-500">{tAssetTypes(row.asset_type)}</td>
                                <td className="px-7 py-4 text-[12px] text-zinc-500">{owner?.name ?? "—"}</td>
                                <td className="px-7 py-4 text-[12px] text-zinc-400 whitespace-nowrap">{formatDate(row.deleted_at)} · {formatTime(row.deleted_at, locale)}</td>
                                <td className="px-7 py-4">
                                  <div className="flex items-center justify-end gap-3">
                                    <button onClick={() => confirmRestoreAsset(row)} className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors" title={t("restoreTitle")}>
                                      <RotateCcw size={13} /> {t("restoreTitle")}
                                    </button>
                                    <button onClick={() => confirmPermanentDeleteAsset(row)} className="text-zinc-300 hover:text-red-600 transition-colors" title={t("permanentDeleteTitle")}>
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : trashServices.length === 0 ? (
                  <div className="text-center py-16">
                    <Trash size={28} className="mx-auto text-zinc-200 mb-2" />
                    <p className="text-[13px] text-zinc-300 font-medium">{t("trashEmptyServices")}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px]">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-100">
                          {[t("colAsset"), t("colServiceType"), t("colMechanic"), t("colDate"), t("trashColDeletedAt"), ""].map((h) => (
                            <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {trashServices.map((row) => (
                          <tr key={row.id} className="hover:bg-zinc-50/80 transition-colors">
                            <td className="px-7 py-4 text-[13px] font-bold text-zinc-900">{row.assets ? assetLabel(row.assets) : "—"}</td>
                            <td className="px-7 py-4">
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${TYPE_COLORS[row.service_type] ?? "bg-zinc-100 text-zinc-500 border border-zinc-200"}`}>
                                {row.service_type}
                              </span>
                            </td>
                            <td className="px-7 py-4 text-[12px] text-zinc-500">{row.mechanics?.name ?? "—"}</td>
                            <td className="px-7 py-4 text-[12px] text-zinc-400">{formatDate(row.service_date)}</td>
                            <td className="px-7 py-4 text-[12px] text-zinc-400 whitespace-nowrap">{formatDate(row.deleted_at)} · {formatTime(row.deleted_at, locale)}</td>
                            <td className="px-7 py-4">
                              <div className="flex items-center justify-end gap-3">
                                <button onClick={() => confirmRestoreService(row)} className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors" title={t("restoreTitle")}>
                                  <RotateCcw size={13} /> {t("restoreTitle")}
                                </button>
                                <button onClick={() => confirmPermanentDeleteService(row)} className="text-zinc-300 hover:text-red-600 transition-colors" title={t("permanentDeleteTitle")}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-center text-[10px] text-zinc-300 mt-12 font-medium">{t("mainFooterNote")}</p>
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
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide mt-0.5">{t("assetsStat")}</p>
                </div>
                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                  <p className="text-[18px] font-black text-zinc-900">{servicesByMechanic[detailAccount.id] ?? 0}</p>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide mt-0.5">{t("servicesStat")}</p>
                </div>
                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                  <p className="text-[18px] font-black text-zinc-900">{qrByMechanic[detailAccount.id] ?? 0}</p>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide mt-0.5">{t("qrRegisteredStat")}</p>
                </div>
              </div>

              <p className="text-[11px] text-zinc-400">{t("joinedOn", { date: formatDate(detailAccount.created_at) })}</p>

              {/* Editable fields */}
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-600">{t("nameLabel")}</label>
                  <input value={detailName} onChange={(e) => setDetailName(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-600">{t("workshopLabel")}</label>
                  <input value={detailWorkshop} onChange={(e) => setDetailWorkshop(e.target.value)} placeholder={t("workshopPlaceholder")}
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400" />
                </div>
                {detailError && <p className="text-[12px] text-red-600">{detailError}</p>}
                <button onClick={handleSaveDetail} disabled={detailSaving}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-[13px] transition-all">
                  {detailSaving ? t("saving") : t("saveChanges")}
                </button>
              </div>

              {/* Send Message (Control Center -> mechanic) */}
              <div className="border-t border-zinc-100 pt-4 space-y-2.5">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <MessageCircle size={12} /> {t("sendMessageTitle")}
                </p>
                <textarea
                  value={detailMessageBody}
                  onChange={(e) => { setDetailMessageBody(e.target.value); setDetailMessageMsg(null); }}
                  placeholder={t("writeToPlaceholder", { name: detailAccount.name })}
                  rows={3}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400 resize-none"
                />
                {detailMessageMsg && (
                  <p className={`text-[12px] ${detailMessageMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{detailMessageMsg.text}</p>
                )}
                <button onClick={handleSendDirectMessage} disabled={detailMessageSaving || !detailMessageBody.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-[13px] transition-all">
                  <Send size={14} /> {detailMessageSaving ? t("sending") : t("sendMessageBtn")}
                </button>
              </div>

              {/* Role toggles */}
              <div className="border-t border-zinc-100 pt-4 space-y-2.5">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t("rolesStatusTitle")}</p>

                <button
                  onClick={() => patchAccount(detailAccount.id, { is_mechanic: !detailAccount.is_mechanic }).then((ok) => ok && flash(detailAccount.is_mechanic ? t("mechanicRoleRemoved") : t("convertedToMechanic")))}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors text-left"
                >
                  <span className="flex items-center gap-2 text-[12px] font-bold text-zinc-700">
                    <UserCog size={14} /> {detailAccount.is_mechanic ? t("removeMechanicRole") : t("convertToMechanic")}
                  </span>
                  {detailAccount.is_mechanic ? <UserMinus size={14} className="text-zinc-400" /> : <UserPlus size={14} className="text-zinc-400" />}
                </button>

                {detailAccount.is_mechanic && (
                  <button
                    onClick={() => patchAccount(detailAccount.id, { verified: !detailAccount.verified }).then((ok) => ok && flash(detailAccount.verified ? t("verificationRevoked") : t("mechanicVerified")))}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2 text-[12px] font-bold text-zinc-700">
                      <ShieldCheck size={14} /> {detailAccount.verified ? t("revokeVerification") : t("verifyMechanic")}
                    </span>
                    {detailAccount.verified ? <ShieldOff size={14} className="text-zinc-400" /> : <ShieldCheck size={14} className="text-emerald-500" />}
                  </button>
                )}

                <button
                  onClick={() => patchAccount(detailAccount.id, { suspended: !detailAccount.suspended }).then((ok) => ok && flash(detailAccount.suspended ? t("accountUnsuspended") : t("accountSuspended")))}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors text-left ${
                    detailAccount.suspended ? "border-emerald-200 hover:bg-emerald-50" : "border-amber-200 hover:bg-amber-50"
                  }`}
                >
                  <span className="flex items-center gap-2 text-[12px] font-bold text-zinc-700">
                    <Ban size={14} /> {detailAccount.suspended ? t("unsuspendAccount") : t("suspendAccount")}
                  </span>
                </button>

                <button
                  onClick={() => handleResetPassword(detailAccount.email)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors text-left"
                >
                  <span className="flex items-center gap-2 text-[12px] font-bold text-zinc-700">
                    <KeyRound size={14} /> {t("sendPasswordReset")}
                  </span>
                </button>

                <button
                  onClick={() => confirmDeleteAccount(detailAccount)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-red-200 hover:bg-red-50 transition-colors text-left"
                >
                  <span className="flex items-center gap-2 text-[12px] font-bold text-red-600">
                    <Trash2 size={14} /> {t("deleteAccount")}
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
            <h3 className="text-[16px] font-black text-zinc-900 mb-1">{t("generateQrTitle")}</h3>
            <p className="text-[12px] text-zinc-400 mb-4">{t("generateQrDesc")}</p>
            <label className="text-[11px] font-bold text-zinc-600">{t("howManyCodes")}</label>
            <input
              type="number" min={1} max={500} value={generateCount} onChange={(e) => setGenerateCount(e.target.value)}
              className="w-full mt-1 mb-4 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowGenerateModal(false)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-2.5 rounded-xl text-[13px] hover:bg-zinc-50">{t("cancel")}</button>
              <button onClick={handleGenerateBatch} disabled={generating}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-[13px] transition-all">
                {generating ? t("generating") : t("generate")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CONFIRM ACTION MODAL ══ */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${confirmAction.danger ? "bg-red-50" : "bg-amber-50"}`}>
              <AlertCircle size={20} className={confirmAction.danger ? "text-red-500" : "text-amber-500"} />
            </div>
            <h3 className="text-[16px] font-black text-zinc-900 mb-2">{confirmAction.title}</h3>
            <p className="text-[13px] text-zinc-500 mb-5">{confirmAction.body}</p>
            {confirmAction.requireTypeToConfirm && (
              <div className="mb-5 text-left">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  {t("typeToConfirmLabel", { word: confirmAction.requireTypeToConfirm })}
                </label>
                <input
                  type="text"
                  value={confirmTypedText}
                  onChange={(e) => setConfirmTypedText(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-[9px] text-[13px] font-mono outline-none focus:border-red-400 transition-colors"
                  placeholder={confirmAction.requireTypeToConfirm}
                />
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setConfirmAction(null); setConfirmTypedText(""); }} disabled={confirmBusy}
                className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-3 rounded-xl text-[13px] hover:bg-zinc-50 transition-colors">
                {t("cancel")}
              </button>
              <button
                onClick={async () => {
                  setConfirmBusy(true);
                  await confirmAction.onConfirm();
                  setConfirmBusy(false);
                  setConfirmAction(null);
                  setConfirmTypedText("");
                }}
                disabled={confirmBusy || (!!confirmAction.requireTypeToConfirm && confirmTypedText !== confirmAction.requireTypeToConfirm)}
                className={`flex-1 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-[13px] transition-all ${
                  confirmAction.danger ? "bg-red-600 hover:bg-red-500" : "bg-zinc-900 hover:bg-zinc-800"
                }`}
              >
                {confirmBusy ? t("working") : t("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
