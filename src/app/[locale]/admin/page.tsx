"use client";

import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Users, Box, Wrench, QrCode, BarChart3, Shield,
  LogOut, RefreshCw, AlertCircle,
  Layers, Eye, EyeOff, Menu, X, Search,
  Ban, ShieldCheck, ShieldOff, Trash2, KeyRound, UserCog,
  UserPlus, UserMinus, Plus, Link2Off, ScanLine, ClipboardList,
  LifeBuoy, Send, MessageCircle, Flag, History, ChevronDown, ChevronRight,
  Trash, RotateCcw, TrendingUp, MapPin, Calendar, Pencil, Download, Settings, AlertTriangle, Bug, Undo2, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDateDMY } from "@/lib/date";
import HoverAvatar from "@/components/HoverAvatar";
import ErrorLogger from "@/components/ErrorLogger";
// Facu (26 jul 2026, split del admin): primeras 2 de 15 secciones movidas
// a archivos propios bajo ./_sections/ — ver el comentario en cada uno
// para el criterio (JSX movido tal cual, estado/lógica se quedan acá).
import AuditLogSection from "./_sections/AuditLogSection";
import ErrorsSection from "./_sections/ErrorsSection";
import AnalyticsSection from "./_sections/AnalyticsSection";
import ModerationSection from "./_sections/ModerationSection";
import TeamChatSection from "./_sections/TeamChatSection";
import TrashSection from "./_sections/TrashSection";
import DeleteRequestsSection from "./_sections/DeleteRequestsSection";
import AdminsSection from "./_sections/AdminsSection";
import SystemSection from "./_sections/SystemSection";
import DashboardSection from "./_sections/DashboardSection";
import AssetsSection from "./_sections/AssetsSection";
import ServicesSection from "./_sections/ServicesSection";
import QrSection from "./_sections/QrSection";
import AccountsSection from "./_sections/AccountsSection";
import SupportSection from "./_sections/SupportSection";

// Local enum-key maps, same pattern as ShareAssetModal.tsx / the Settings
// and Assets [locale] pages — raw DB values (English) map to translation
// keys looked up in the ProfessionTypes namespace.
export const PROFESSION_KEYS: Record<string, string> = {
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

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  workshop_name: string | null;
  is_mechanic: boolean;
  verified: boolean;
  suspended: boolean;
  created_at: string;
  last_active_at: string | null;
  photo_url: string | null;
  profession: string | null;
  certificate_path: string | null;
  verification_status: "none" | "pending" | "verified" | "rejected" | null;
  verification_requested_at: string | null;
  verification_reviewed_at: string | null;
  verification_note: string | null;
};

export type ServiceRow = {
  id: string;
  service_date: string;
  service_type: string;
  mechanic_id: string;
  mechanic_name: string;
  asset_id: string;
  asset_label: string;
  customer_name: string;
};

export type AssetRow = {
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

export type QrRow = {
  code: string;
  asset_id: string | null;
  created_by: string | null;
  created_at: string;
};

// "Actividad en tiempo real" (item Fase 2 / punto 2 del pedido) — un escaneo
// crudo, traído directo con el cliente de anon key (mismo criterio ya
// establecido en loadData() de que qr_scans tiene RLS angosta y segura para
// esto, ver migración 006), solo para alimentar el feed de actividad
// reciente del Dashboard.
type RecentScanRow = {
  code: string;
  asset_id: string | null;
  scanned_at: string;
};

// ── Papelera (soft delete + restauración — item 14 del pedido de Facu) ──
// Fed by /api/admin/trash, not bulk-data — these are the rows bulk-data
// deliberately excludes (deleted_at is not null).
export type TrashMechanicRow = {
  id: string;
  name: string;
  email: string;
  workshop_name: string | null;
  is_mechanic: boolean;
  deleted_at: string;
};

export type TrashAssetRow = {
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

export type TrashServiceRow = {
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

// Facu (21 jul 2026): "una vez pasado ese tiempo debería tener la opción
// de pedirle al administrador que borre ese service" — see migration 042
// + /api/admin/delete-requests. Row shape matches that endpoint's GET
// exactly (nested joins typed as plain objects, same convention as
// TrashServiceRow above).
export type DeleteRequestRow = {
  id: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  service_record_id: string;
  requested_by: string;
  mechanics: { name: string; email: string } | null;
  service_records: {
    id: string;
    service_date: string;
    service_type: string;
    km_hours: number | null;
    deleted_at: string | null;
    assets: { brand: string | null; model: string | null; nickname: string | null } | null;
  } | null;
};

export type AssetTypeCount = { type: string; count: number };
export type DayBucket = { label: string; count: number };
export type UsageMetrics = {
  dbSizeMB: number;
  dbLimitMB: number;
  dbPercent: number;
  storageSizeMB: number;
  storageLimitMB: number;
  storagePercent: number;
  checkedAt: string;
};

// Movido a scope de módulo (26 jul 2026, split del admin — DashboardSection)
// para poder exportarlo; no cierra sobre nada del componente, así que el
// movimiento es seguro. La declaración original vivía dentro del cuerpo del
// componente, justo antes de recentActivityFeed.
export type ActivityEvent = {
  id: string; type: "new_mechanic" | "new_asset" | "new_service" | "qr_scan" | "admin_action";
  timestamp: string; icon: React.ElementType; iconBg: string; text: string;
  onClick?: () => void;
};

// Incremento 15 (15 jul 2026, pedido de Facu: "tengo por un lado cuentas y
// por otro mecanicos, eso no me gusta... al final son todos Maintlers y
// habra subclases dependiendo de la funcion que cada uno elija"): "mechanics"
// y "verifications" dejaron de ser Section propias — la tabla `mechanics` ya
// era, desde el incremento 5 de i18n Fase 2 en adelante, una única tabla de
// usuarios (dueños, mecánicos, electricistas, todos la misma fila; "Owner",
// "Mechanic", etc. son solo el valor de `profession`). El sidebar mostraba
// esa única tabla en 3 secciones separadas (Cuentas = todas las filas,
// Mecánicos = filtro is_mechanic, Verificaciones = filtro de estado de
// verificación pendiente) — ahora es una sola sección "accounts" (label
// "Maintlers" en el sidebar) con pestañas internas, ver `maintlersTab` más
// abajo.
type Section = "dashboard" | "accounts" | "assets" | "services" | "delete-requests" | "qr" | "support" | "team-chat" | "moderation" | "analytics" | "audit-log" | "trash" | "admins" | "system" | "errors";

// Incremento 11 (14 jul 2026, roles y permisos): rol de un admin del panel
// y las capacidades que devuelve /api/admin/session — mismo tipo/nombres
// que src/lib/adminRoles.ts, duplicado acá a propósito (un componente
// "use client" no debería importar nada del lado del servidor, aunque este
// archivo en particular no toca crypto/env — es más simple mantener este
// tipo como fuente de verdad del lado del cliente).
export type AdminRole = "super_admin" | "support_admin" | "content_moderator" | "analytics_viewer";
export type AdminUserRow = {
  id: string;
  username: string;
  role: AdminRole;
  active: boolean;
  created_at: string;
  created_by: string | null;
  last_login_at: string | null;
};

// Incremento 17 (15 jul 2026, Fase 3 — "Configuraciones globales
// avanzadas"): fila única de src/app/api/admin/system-settings/route.ts
// (migración 037). Nombres en snake_case porque viajan tal cual desde
// la fila de Postgres, mismo criterio que AccountRow/AssetRow.
export type SystemSettingsRow = {
  maintenance_mode: boolean;
  maintenance_message: string | null;
  banner_enabled: boolean;
  banner_text: string | null;
  banner_severity: "info" | "warning" | "critical";
  banner_link_url: string | null;
  max_asset_photo_mb: number;
  max_document_mb: number;
  max_certificate_mb: number;
  updated_at: string | null;
  updated_by: string | null;
};

export type ChangelogEntry = {
  id: string;
  version_label: string;
  notes: string;
  published_at: string;
  created_by: string | null;
};

// Mapeo sección → capacidad requerida (ver src/lib/adminRoles.ts para el
// mismo mapeo del lado del servidor — cada ruta de API vuelve a chequear
// esto por su cuenta, este mapeo del lado del cliente es solo para decidir
// qué mostrar en el sidebar, nunca la única barrera de seguridad).
// "dashboard" y "trash" no están acá porque su regla no es "una capacidad
// puntual" sino "accounts O assets" — ver el caso especial en
// canSeeSection() más abajo.
const SECTION_CAPABILITY: Partial<Record<Section, string>> = {
  accounts: "accounts",
  assets: "assets",
  services: "assets",
  // Incremento 21 (migración 042): mismas manos que "services" — es la
  // misma tabla service_records, solo con un paso de revisión en el medio.
  "delete-requests": "assets",
  qr: "qr",
  support: "support",
  "team-chat": "reports",
  moderation: "reports",
  analytics: "analytics",
  "audit-log": "audit_logs",
  admins: "admin_management",
  // Incremento 17: "Sistema" (modo mantenimiento, banner global, límites
  // de archivo, changelog) afecta a toda la plataforma — mismo criterio
  // de gating que la eliminación permanente y la gestión de admins.
  system: "critical_actions",
  // Incremento 19: "Errores" (panel técnico de errores y rendimiento) usa
  // el mismo capability que "audit-log" — es otro tipo de log de
  // plataforma, mismo nivel de sensibilidad (solo Super Admin hoy), y
  // evita sumar un capability nuevo a src/lib/adminRoles.ts solo para esto.
  errors: "audit_logs",
};

function canSeeSection(id: Section, capabilities: string[]): boolean {
  // Incremento 12: Dashboard y Papelera dependen los dos de
  // /api/admin/bulk-data (mechanics + assets + service_records + qr_codes
  // de una sola lectura) — visibles solo si el rol tiene "accounts" o
  // "assets". Antes, "dashboard" estaba marcado como visible para
  // cualquier admin autenticado, pero eso dejaba a Analytics Viewer
  // (solo "analytics"+"reports", el único rol sin ninguna de las dos)
  // aterrizando en una pantalla que le tiraba 403 en loop — ver
  // landingSection() más abajo para el aterrizaje correcto de ese rol.
  if (id === "dashboard" || id === "trash") {
    return capabilities.includes("accounts") || capabilities.includes("assets");
  }
  const cap = SECTION_CAPABILITY[id];
  return !cap || capabilities.includes(cap);
}

// Orden de aterrizaje al loguearse o al perder acceso a la sección abierta
// (ej. cambio de rol). Preferencia: Dashboard (la vista más completa) si el
// rol puede verla; si no (hoy: solo Analytics Viewer), Analytics (la
// sección pensada para ese rol, ver adminRoles.ts); si tampoco, la primera
// sección visible en el orden del sidebar — este último caso es un
// fallback defensivo, no debería activarse con los 4 roles actuales.
const SECTION_LANDING_ORDER: Section[] = [
  "dashboard", "accounts", "assets", "services", "delete-requests",
  "qr", "support", "team-chat", "moderation", "analytics", "audit-log", "trash", "admins", "system", "errors",
];

function landingSection(capabilities: string[]): Section {
  if (canSeeSection("dashboard", capabilities)) return "dashboard";
  if (canSeeSection("analytics", capabilities)) return "analytics";
  return SECTION_LANDING_ORDER.find((id) => canSeeSection(id, capabilities)) ?? "dashboard";
}

export type SupportMessageRow = {
  id: string;
  mechanic_id: string;
  body: string;
  read: boolean;
  created_at: string;
  from_admin: boolean;
  mechanics: { name: string; email: string } | { name: string; email: string }[] | null;
};

export type SupportConversation = {
  mechanicId: string;
  mechanic: { name: string; email: string } | null;
  messages: SupportMessageRow[];
  lastMessage: SupportMessageRow;
  unreadCount: number;
};

// Herramientas de soporte (item 7 del pedido de Facu: "cambiar estado,
// asignar prioridad, notas internas, ... cerrar caso") — metadata por
// thread (una fila por mechanic_id), separada de los mensajes en sí.
// Un thread sin fila todavía en `support_thread_state` se trata como
// status "open" / priority "normal" / sin notas (ver defaultThreadState()).
export type SupportThreadState = {
  mechanic_id: string;
  status: "open" | "closed";
  priority: "low" | "normal" | "high";
  internal_notes: string | null;
  closed_at: string | null;
  closed_by: string | null;
};

// Team Chat oversight — Facu's own words: "esto es una pagina profesional
// y yo quiero tener control sobre los temas que se hablan". These rows
// come from a service-role admin route (see /api/admin/mechanic-messages),
// which deliberately ignores hidden_for_sender / hidden_for_recipient —
// those are per-Maintler soft-delete flags, not real deletes, so the
// Control Center can always see the full, unfiltered history.
type MechanicChatInfo = { name: string; email: string; workshop_name: string | null };

export type MechanicMsgRow = {
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

export type MechanicConversation = {
  pairKey: string;
  a: { id: string; info: MechanicChatInfo | null };
  b: { id: string; info: MechanicChatInfo | null };
  messages: MechanicMsgRow[];
  lastMessage: MechanicMsgRow;
};

export type MechanicReportRow = {
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
export type AdminAuditLogRow = {
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
export type ContentReportRow = {
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

// Incremento 18 (Fase 3, ítem 2 — "detección de spam o actividad
// sospechosa"), leído desde /api/admin/suspicious-activity. Ver ese
// route.ts para el detalle de cada heurística y sus umbrales.
type SuspiciousReason =
  | { key: "burst_assets"; count: number }
  | { key: "burst_services"; count: number }
  | { key: "duplicate_notes"; count: number }
  | { key: "reported"; count: number }
  | { key: "new_account_volume"; count: number };

export type FlaggedMechanicRow = {
  mechanicId: string;
  name: string;
  email: string;
  createdAt: string;
  suspended: boolean;
  score: number;
  reasons: SuspiciousReason[];
};

// Incremento 19 (Fase 3 — "Panel técnico de errores y rendimiento"),
// leído desde /api/admin/error-logs. Ver ese route.ts y
// src/lib/errorLog.ts para cómo se llenan estas filas.
export type PlatformErrorLogRow = {
  id: string;
  created_at: string;
  source: "client" | "server";
  severity: "error" | "warning";
  message: string;
  stack: string | null;
  route: string | null;
  user_agent: string | null;
  ip_address: string | null;
  context: unknown;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
};

// Item 8 del pedido de Facu ("Analytics avanzados") + la parte de item 9
// ("Estado y calidad de la plataforma") derivable de datos existentes.
// Leído acá desde /api/admin/analytics — ver ese route.ts para el detalle
// de cómo se calcula cada campo.
export type AnalyticsAssetRef = { assetId: string; count: number; asset: { asset_type: string; brand: string | null; model: string | null; nickname: string | null } | null };
export type AnalyticsData = {
  range: { from: string; to: string };
  activeToday: number;
  activeThisWeek: number;
  activeThisMonth: number;
  inactiveMechanics: number;
  totalMechanics: number;
  returningMechanics: number;
  totalAssets: number;
  totalServices: number;
  totalQrCodes: number;
  avgRecordsPerAsset: number;
  avgDaysToFirstMaintenance: number | null;
  scansInRange: number;
  scansInRangeTruncated: boolean;
  servicesInRange: number;
  servicesInRangeTruncated: boolean;
  topScannedAssets: AnalyticsAssetRef[];
  topAssetsByRecords: AnalyticsAssetRef[];
  topLocations: { location: string; count: number }[];
  assetsWithoutRecords: number;
  qrNeverScanned: number;
  // Incremento 15 (pedido de Facu: "cuantos maintlers tengo y de esos
  // quienes son mecanicos quienes son electricos, etc."):
  totalMaintlers: number;
  professionBreakdown: { profession: string; count: number }[];
  noProfessionCount: number;
};

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

export const TYPE_COLORS: Record<string, string> = {
  "Oil Change":    "bg-amber-100 text-amber-700 border border-amber-200",
  "Service":       "bg-blue-100 text-blue-700 border border-blue-200",
  "Repair":        "bg-red-100 text-red-700 border border-red-200",
  "Inspection":    "bg-violet-100 text-violet-700 border border-violet-200",
  "Filter Change": "bg-emerald-100 text-emerald-700 border border-emerald-200",
  "Tire Change":   "bg-cyan-100 text-cyan-700 border border-cyan-200",
  "Brake Service": "bg-orange-100 text-orange-700 border border-orange-200",
};
export const ASSET_ICONS: Record<string, string> = {
  automotive: "🚗", motorcycle: "🏍️", generator: "⚡",
  machinery: "🚜", marine: "⛵", aviation: "✈️",
};
export const ASSET_COLORS: Record<string, string> = {
  automotive: "bg-blue-500", motorcycle: "bg-orange-500",
  generator: "bg-yellow-500", machinery: "bg-green-600",
  marine: "bg-cyan-500", aviation: "bg-indigo-500",
};

// ────────────────────────────────────────────────────────────────────────────
// Small helpers
// ────────────────────────────────────────────────────────────────────────────

// Facu (26 jul 2026, split del admin): exportadas (antes internas al
// archivo) para que los componentes de sección nuevos en ./_sections/
// puedan importarlas en vez de duplicar esta lógica — nada cambia para
// quien las usaba desde acá adentro.
export function formatDate(iso: string) {
  return formatDateDMY(iso);
}

// "Sin actividad" threshold used both for the amber highlight on the
// Accounts table's "Último acceso" column and for the Analytics section's
// inactive-Maintlers count (item 8/9 del pedido de Facu) — kept as one
// constant so both places agree on what "inactive" means.
export const INACTIVE_DAYS_THRESHOLD = 30;
export function isStaleActivity(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() > INACTIVE_DAYS_THRESHOLD * 24 * 60 * 60 * 1000;
}

const DATE_LOCALE: Record<string, string> = { en: "en-US", es: "es-AR", pt: "pt-BR" };

export function formatTime(iso: string, locale: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(DATE_LOCALE[locale] ?? "en-US", { hour: "2-digit", minute: "2-digit" });
}

// "Hace 2 min" / "hace 3 h" para el feed de Actividad reciente — Intl ya
// trae esto sin necesitar una librería nueva.
const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000], ["month", 2592000], ["week", 604800],
  ["day", 86400], ["hour", 3600], ["minute", 60],
];
export function timeAgo(iso: string, locale: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const seconds = Math.round((d.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(DATE_LOCALE[locale] ?? "en-US", { numeric: "auto" });
  for (const [unit, secondsInUnit] of RELATIVE_TIME_UNITS) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return rtf.format(Math.round(seconds / secondsInUnit), unit);
    }
  }
  return rtf.format(seconds, "second");
}
export function getInitials(name: string) {
  return (name || "?").split(" ").filter(Boolean).map(p => p[0]).join("").toUpperCase().slice(0, 2) || "?";
}
export function getAvatarColor(name: string) {
  const colors = [
    "bg-red-100 text-red-700", "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700", "bg-purple-100 text-purple-700",
    "bg-orange-100 text-orange-700", "bg-cyan-100 text-cyan-700",
  ];
  return colors[(name || "?").charCodeAt(0) % colors.length];
}

// ────────────────────────────────────────────────────────────────────────────
// Exportación CSV (Fase 2 / punto 5 del pedido: "Exportación de reportes", y
// item 15: "tablas con ... exportación") — export client-side, sin pedir nada
// al backend, para las tablas cuyos datos YA están completos en memoria
// (bulk-data trae todo de una, sin paginación server-side): Maintlers,
// Assets, Servicios, QR. Se exporta el conjunto ya filtrado/buscado que el
// admin está viendo (`visibleX`), no la tabla entera sin filtrar. Las
// secciones con paginación real server-side (Logs de Auditoría, Reportes y
// Moderación) tienen su propio export vía backend — ver esos botones más
// abajo, que pegan contra `?export=csv` en sus rutas existentes en vez de
// usar esta función.
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(","));
  // BOM al principio para que Excel abra el UTF-8 sin arruinar acentos (es/pt).
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
/** Descarga un export server-side (Logs de Auditoría / Reportes) pegándole a la misma ruta GET con `?export=csv` + los filtros vigentes. */
async function downloadCsvFromApi(url: string, fallbackFilename: string) {
  const res = await fetch(url);
  if (!res.ok) return false;
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackFilename;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
  return true;
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

export function StatCard({ label, value, icon: Icon, accent, sub }: {
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

export function UsageBar({ label, usedMB, limitMB, percent }: {
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

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[13px] font-bold text-zinc-900 tracking-tight">{children}</h2>;
}

export function TrendRow({ label, data, color }: { label: string; data: DayBucket[]; color: string }) {
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

export function Pill({ children, tone }: { children: React.ReactNode; tone: "zinc" | "blue" | "emerald" | "amber" | "red" }) {
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
  // Incremento 10 (14 jul 2026, pedido explícito de Facu: "el boton de
  // actualizar ese que tengo no deberia existir y la pagina del
  // administrador deberia actualizarse sola todo el tiempo") — reemplaza el
  // botón manual "Actualizar" del header por un auto-refresh silencioso
  // (ver el useEffect de "Auto-refresco global" más abajo); este timestamp
  // alimenta el indicador de "actualizado hace X" que ocupa el lugar del
  // botón.
  const [lastFullRefreshAt, setLastFullRefreshAt] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [section, setSection] = useState<Section>("dashboard");
  const [actionMsg, setActionMsg] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  // Incremento 11 (14 jul 2026, roles y permisos — item 12 del pedido
  // original): rol/capacidades del admin logueado, devueltos por
  // /api/admin/session (ver ese route.ts). adminCapabilities maneja qué
  // secciones del sidebar se muestran (ver canSeeSection más abajo) y
  // adminReadOnly bloquea acciones de escritura para Analytics Viewer en
  // las secciones que sí puede ver (Reportes).
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [adminCapabilities, setAdminCapabilities] = useState<string[]>([]);
  const [adminReadOnly, setAdminReadOnly] = useState(false);

  // ── Administradores (incremento 11) ──
  const [adminsList, setAdminsList] = useState<AdminUserRow[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<AdminRole>("support_admin");
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // ── Sistema (incremento 17): modo mantenimiento, banner global,
  // límites de archivo, changelog interno ──
  const [systemSettings, setSystemSettings] = useState<SystemSettingsRow | null>(null);
  const [systemSettingsLoading, setSystemSettingsLoading] = useState(false);
  const [systemSettingsSaving, setSystemSettingsSaving] = useState(false);
  const [systemSettingsDraft, setSystemSettingsDraft] = useState<Partial<SystemSettingsRow>>({});
  const [changelogEntries, setChangelogEntries] = useState<ChangelogEntry[]>([]);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [newChangelogVersion, setNewChangelogVersion] = useState("");
  const [newChangelogNotes, setNewChangelogNotes] = useState("");
  const [creatingChangelogEntry, setCreatingChangelogEntry] = useState(false);

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

  // ── Actividad en tiempo real (item Fase 2 / punto 2 del pedido) ──
  // Aproximación deliberada por polling en vez de suscripciones push
  // (supabase.channel().on("postgres_changes", ...), ya usadas en Team Chat
  // y NotificationBellIntl) — esas requieren que la tabla esté agregada a
  // la publicación supabase_realtime Y que su RLS permita leer con la
  // anon key, y no se puede verificar ninguna de las dos cosas para
  // mechanics/assets/service_records desde este sandbox (misma limitación
  // documentada para esas tablas desde el incremento 2 de Item 6). Refrescar
  // cada 30s con datos ya cubiertos por rutas/policies confirmadas es lo
  // más "tiempo real" que se puede ofrecer con confianza sin poder probar
  // contra la base real — ver el comentario del useEffect que la dispara.
  const [recentAuditLogs, setRecentAuditLogs] = useState<AdminAuditLogRow[]>([]);
  const [recentScans, setRecentScans] = useState<RecentScanRow[]>([]);
  const [activityRefreshedAt, setActivityRefreshedAt] = useState<string | null>(null);

  // ── Accounts / Mechanics UI state ──
  const [accountSearch, setAccountSearch] = useState("");
  // Incremento 15: reemplaza el viejo toggle "solo pendientes" de la
  // sección "Mecánicos" (que ya no existe como sección propia, ver el tipo
  // Section más arriba) — pestaña activa dentro de la sección unificada
  // "Maintlers", y filtro de profesión para la pestaña "Por profesión".
  const [maintlersTab, setMaintlersTab] = useState<"all" | "profession" | "verifications">("all");
  const [professionFilter, setProfessionFilter] = useState<string>("all");
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
  // Herramientas de soporte (incremento 9, item 7 del pedido + Fase 2 punto
  // 6: "herramientas de soporte") — búsqueda/filtro sobre la lista de casos,
  // más el estado por thread (status/prioridad/notas internas) cargado junto
  // con los mensajes en loadSupportMessages().
  const [supportSearch, setSupportSearch] = useState("");
  const [supportStatusFilter, setSupportStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [supportPriorityFilter, setSupportPriorityFilter] = useState<"all" | "low" | "normal" | "high">("all");
  const [supportThreadStates, setSupportThreadStates] = useState<Record<string, SupportThreadState>>({});
  const [supportNotesDraft, setSupportNotesDraft] = useState("");
  const [supportStateSaving, setSupportStateSaving] = useState(false);

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
  // Filtro por ID exacto de entidad — alimentado normalmente por los botones
  // "Ver historial" de Cuentas/Assets (viewHistory()), pero también editable
  // a mano por si el admin ya tiene un ID copiado de otro lado.
  const [auditLogEntityIdFilter, setAuditLogEntityIdFilter] = useState("");
  const [auditLogFrom, setAuditLogFrom] = useState("");
  const [auditLogTo, setAuditLogTo] = useState("");
  const [expandedAuditLogId, setExpandedAuditLogId] = useState<string | null>(null);
  // Export CSV (Fase 2 / punto 5 del pedido: "Exportación de reportes") — esta
  // sección tiene paginación real server-side, así que el export no puede
  // armarse desde `auditLogs` (solo tiene la página actual); pega contra la
  // misma ruta GET con `?export=csv`, respetando los filtros vigentes.
  const [auditExportBusy, setAuditExportBusy] = useState(false);

  // ── Errores (panel técnico de errores y rendimiento — incremento 19 de
  // Item 6, Fase 3) — mismo patrón de paginación real server-side +
  // filtros + fila expandible que el log de auditoría de arriba, ver
  // /api/admin/error-logs. ──
  const ERROR_LOGS_PAGE_SIZE = 25;
  const [errorLogs, setErrorLogs] = useState<PlatformErrorLogRow[]>([]);
  const [errorLogsLoading, setErrorLogsLoading] = useState(true);
  const [errorLogsTotal, setErrorLogsTotal] = useState(0);
  const [errorLogsUnresolvedCount, setErrorLogsUnresolvedCount] = useState(0);
  const [errorLogsPage, setErrorLogsPage] = useState(1);
  const [errorLogSourceFilter, setErrorLogSourceFilter] = useState("all");
  const [errorLogSeverityFilter, setErrorLogSeverityFilter] = useState("all");
  const [errorLogResolvedFilter, setErrorLogResolvedFilter] = useState<"all" | "unresolved" | "resolved">("unresolved");
  const [expandedErrorLogId, setExpandedErrorLogId] = useState<string | null>(null);
  const [errorLogBusyId, setErrorLogBusyId] = useState<string | null>(null);

  // ── Analytics (item 8 del pedido de Facu) ──
  // Rango con fecha por defecto de últimos 30 días, mismo criterio que el
  // resto del panel usa para "sin actividad" (INACTIVE_DAYS_THRESHOLD).
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsFrom, setAnalyticsFrom] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [analyticsTo, setAnalyticsTo] = useState(() => new Date().toISOString().slice(0, 10));

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
  // Export CSV — mismo criterio que auditExportBusy arriba: paginación real
  // server-side, así que pega contra /api/admin/reports?export=csv con los
  // filtros vigentes en vez de exportar solo la página cargada en memoria.
  const [reportsExportBusy, setReportsExportBusy] = useState(false);

  // Incremento 18 (Fase 3, ítem 2: "detección de spam o actividad
  // sospechosa"): "Reportes y Moderación" ganó una segunda pestaña interna,
  // mismo patrón que las pestañas de "Maintlers" del incremento 15.
  // moderationTab por sí solo no dispara ningún fetch — moderationTab hace
  // que se dispare loadSuspiciousActivity() la primera vez que se abre esa
  // pestaña (ver el useEffect correspondiente más abajo).
  const [moderationTab, setModerationTab] = useState<"reports" | "suspicious">("reports");
  const [suspiciousActivity, setSuspiciousActivity] = useState<FlaggedMechanicRow[]>([]);
  const [suspiciousActivityLoading, setSuspiciousActivityLoading] = useState(false);
  const [suspiciousActivitySummary, setSuspiciousActivitySummary] = useState<{
    flaggedTotal: number;
    scannedMechanics: number;
  } | null>(null);

  // ── Papelera (Trash — soft delete + restauración, item 14 del pedido) ──
  const [trashMechanics, setTrashMechanics] = useState<TrashMechanicRow[]>([]);
  const [trashAssets, setTrashAssets] = useState<TrashAssetRow[]>([]);
  const [trashServices, setTrashServices] = useState<TrashServiceRow[]>([]);
  const [trashLoading, setTrashLoading] = useState(true);
  const [trashTab, setTrashTab] = useState<"mechanics" | "assets" | "services">("mechanics");
  // Filtro de fecha de la Papelera (por fecha de borrado, deleted_at) — se
  // aplica en el cliente sobre los datos ya cargados, mismo criterio que el
  // resto del panel (sin paginación server-side acá, ver /api/admin/trash).
  const [trashFilterFrom, setTrashFilterFrom] = useState("");
  const [trashFilterTo, setTrashFilterTo] = useState("");

  // ── Solicitudes de Borrado (migración 042, item pedido 21 jul 2026) ──
  const [deleteRequests, setDeleteRequests] = useState<DeleteRequestRow[]>([]);
  const [deleteRequestsLoading, setDeleteRequestsLoading] = useState(true);

  // ── Assets UI state ──
  const [assetSearch, setAssetSearch] = useState("");
  // Edición de campos de asset desde el admin (item 3 del pedido: "editar") —
  // el asset editado en el modal, y un draft local por campo hasta guardar.
  const [editAssetRow, setEditAssetRow] = useState<AssetRow | null>(null);
  const [editAssetType, setEditAssetType] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [editVin, setEditVin] = useState("");
  const [editPlate, setEditPlate] = useState("");
  const [editAssetSaving, setEditAssetSaving] = useState(false);
  const [editAssetError, setEditAssetError] = useState("");

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
    title: string; body: string; danger?: boolean; requireTypeToConfirm?: string;
    // Incremento 13: "motivo" opcional (item 3/13 del pedido: "eliminar con
    // confirmación + registro de quién/cuándo/por qué") — solo se pide en
    // las 6 acciones de "eliminar" (soft-delete + permanent-delete de
    // cuentas/assets/servicios), nunca en restaurar ni en el resto de las
    // acciones que ya usan este mismo modal compartido.
    collectReason?: boolean;
    onConfirm: (reason?: string) => Promise<void>;
  }>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmTypedText, setConfirmTypedText] = useState("");
  const [confirmReasonText, setConfirmReasonText] = useState("");

  // Facu (26 jul 2026): swipe-to-change-page refs for the 3 paginated
  // tables (Auditoría / Reportes / Errores) below. IMPORTANT — these must
  // stay up here with the rest of the hooks, BEFORE the `if (!loginChecked)
  // return null`, `if (!adminAuthed) return (...)` and `if (loading)
  // return (...)` early returns further down. Declaring them after those
  // (like a previous version of this file did) means React calls this
  // hook on some renders (once logged in) but not others (still on the
  // login screen) — a Rules-of-Hooks violation that crashed the whole
  // panel with "Minified React error #310" right after logging in. Hooks
  // must always run unconditionally, in the same order, on every render.
  const auditLogTouchStartX = useRef<number | null>(null);
  const reportsTouchStartX = useRef<number | null>(null);
  const errorLogsTouchStartX = useRef<number | null>(null);

  function flash(text: string, tone: "ok" | "error" = "ok") {
    setActionMsg({ text, tone });
    setTimeout(() => setActionMsg((m) => (m?.text === text ? null : m)), 4000);
  }

  // Incremento 14 (15 jul 2026, bug reportado por Facu: "no me muestra el
  // panel de la izquierda", "los datos tardan en llegar, a veces estan en
  // 0", "cambié de usuario ... me muestra datos distintos"): loadData()
  // leía `adminCapabilities` del estado del componente, pero la primerísima
  // vez que se llama (justo después de setAdminCapabilities(...) en el
  // mismo tick, tanto en el useEffect de sesión como en handleAdminLogin)
  // esa lectura caía sobre el closure de la versión de loadData creada
  // ANTES de que el nuevo estado existiera — React no muta ese binding
  // retroactivamente. Resultado: canLoadBulkData evaluaba siempre `false`
  // en la primera carga, sin importar el rol real, y el panel entero
  // quedaba en 0 hasta el próximo loadData() con closure fresco (el
  // auto-refresco de 60s). Se soluciona aceptando las capacidades como
  // parámetro opcional, para que los llamados desde esos dos lugares las
  // pasen explícitamente en vez de depender del estado.
  async function loadData(capsOverride?: string[]) {
    setRefreshing(true);
    const caps = capsOverride ?? adminCapabilities;

    // Incremento 12: Analytics Viewer no tiene "accounts" ni "assets" — sin
    // este chequeo, loadData() pedía /api/admin/bulk-data igual, se comía un
    // 403 ("Not authorized.") y caía en el branch de error de más abajo,
    // mostrando un toast de error cada vez que corre el auto-refresco de
    // 60s (incremento 10), sin ninguna forma de que ese rol lo silencie —
    // el gap que había quedado documentado como "fuera de alcance" en el
    // incremento 11. Ahora, si el rol no tiene ninguna de las dos
    // capacidades que bulk-data exige, directamente no se pide.
    const canLoadBulkData = caps.includes("accounts") || caps.includes("assets");

    if (canLoadBulkData) {
    // mechanics/assets/qr_codes/service_records/mechanic_assets are read
    // through a service-role API route rather than the browser's anon-key
    // client — see /api/admin/bulk-data for why. qr_scans now follows the
    // same pattern via /api/admin/qr-scan-stats (revisión de seguridad, 26
    // jul 2026) — la sesión de admin no es una sesión "authenticated" real
    // de Supabase, así que ya no puede leer esta tabla directo una vez que
    // su RLS se angostó (ver migración 044).
    const [bulkRes, scanStatsRes] = await Promise.all([
      fetch("/api/admin/bulk-data").then((r) => r.json()).catch(() => null),
      fetch("/api/admin/qr-scan-stats").then((r) => r.json()).catch(() => null),
    ]);
    const scansTodayCount = scanStatsRes?.scansToday ?? 0;
    const scanWeekRows = scanStatsRes?.scanWeekRows ?? [];

    if (!bulkRes || bulkRes.error) {
      flash(bulkRes?.error || t("errorLoadPlatformData"), "error");
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
    } else {
      // Rol sin "accounts" ni "assets" (hoy: solo Analytics Viewer) — ninguna
      // de las tablas de bulk-data aplica. El sidebar ya oculta Dashboard,
      // Papelera, Maintlers, Assets, Servicios y QR para este rol (ver
      // canSeeSection/landingSection más abajo), así que estos valores por
      // default nunca llegan a renderizarse — solo evitan dejar el estado
      // "pegado" con datos de una sesión anterior si el rol cambió en caliente.
      setAccounts([]);
      setServices([]);
      setAssets([]);
      setAssetTypes([]);
      setQrCodes([]);
      setAssetsByMechanic({});
      setServicesByMechanic({});
      setServicesByAsset({});
      setQrByMechanic({});
      setScansToday(0);
      setScansWeek(0);
      setNewUserDays(bucketDaily([], 14));
      setNewMechanicDays(bucketDaily([], 14));
      setNewAssetDays(bucketDaily([], 14));
      setNewQrDays(bucketDaily([], 14));
      setNewServiceDays(bucketDaily([], 14));
      setDataTruncatedNotice(null);
      setMechanicsTotalCount(null);
    }

    // Non-critical: platform usage vs. Supabase Free plan limits (DB size,
    // Storage size). Fails silently until the get_usage_metrics() SQL
    // function is created — the rest of the panel shouldn't break over this.
    // Gateada del lado del servidor por "critical_actions" (solo Super
    // Admin) — para cualquier otro rol vuelve un 403 que este fetch ya
    // ignora en silencio (mismo `if (data && !data.error)` de siempre).
    fetch("/api/admin/usage-check")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data && !data.error) setUsageMetrics(data as UsageMetrics); })
      .catch(() => {});

    // Non-critical: just the "new reports" badge count for the sidebar, so
    // it's visible without having to open the Moderación tab first (same
    // lightweight, best-effort pattern as usage-check above). The full
    // list itself still lazy-loads on open, same as every other tab. Corre
    // para cualquier rol con "reports" (incluye Analytics Viewer).
    fetch("/api/admin/reports?pageSize=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data && typeof data.newCount === "number") setReportsNewCount(data.newCount); })
      .catch(() => {});

    // support-messages exige capacidad "support" del lado del servidor —
    // saltearlo acá si el rol no la tiene evita un 403 innecesario cada
    // 60s (mismo motivo que canLoadBulkData arriba). Content Moderator y
    // Analytics Viewer caen acá.
    if (caps.includes("support")) {
      await loadSupportMessages();
    } else {
      setSupportMessages([]);
      setSupportThreadStates({});
    }

    setLastFullRefreshAt(new Date().toISOString());
    setRefreshing(false);
  }

  async function loadSupportMessages() {
    setSupportLoading(true);
    try {
      const res = await fetch("/api/admin/support-messages");
      const data = await res.json().catch(() => ({}));
      setSupportMessages((data.messages as SupportMessageRow[]) ?? []);
      // El estado por thread (status/prioridad/notas, incremento 9) viaja en
      // la misma respuesta que los mensajes — un solo fetch, sin pedir nada
      // nuevo al servidor por separado.
      const states = (data.states as SupportThreadState[]) ?? [];
      setSupportThreadStates(Object.fromEntries(states.map((s) => [s.mechanic_id, s])));
    } finally {
      setSupportLoading(false);
    }
  }

  function getSupportMechanic(m: SupportMessageRow) {
    return Array.isArray(m.mechanics) ? m.mechanics[0] ?? null : m.mechanics;
  }

  // Un mechanic_id sin fila todavía en support_thread_state (caso nunca
  // tocado con las herramientas nuevas) es, por definición, un caso abierto
  // de prioridad normal sin notas — no hace falta escribir una fila por cada
  // conversación existente de antemano.
  function defaultThreadState(mechanicId: string): SupportThreadState {
    return { mechanic_id: mechanicId, status: "open", priority: "normal", internal_notes: null, closed_at: null, closed_by: null };
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

  // Búsqueda (por nombre/email del Maintler) + filtros de estado/prioridad
  // sobre la lista de casos — item 7 del pedido: "buscar/filtrar".
  const visibleSupportConversations = useMemo(() => {
    const q = supportSearch.trim().toLowerCase();
    return supportConversations.filter((c) => {
      const state = supportThreadStates[c.mechanicId] ?? defaultThreadState(c.mechanicId);
      if (supportStatusFilter !== "all" && state.status !== supportStatusFilter) return false;
      if (supportPriorityFilter !== "all" && state.priority !== supportPriorityFilter) return false;
      if (!q) return true;
      const name = (c.mechanic?.name ?? "").toLowerCase();
      const email = (c.mechanic?.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [supportConversations, supportThreadStates, supportSearch, supportStatusFilter, supportPriorityFilter]);

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
  // Filtros compartidos por loadAuditLogs() y el export CSV — se separó para
  // no repetir la misma construcción de params en dos lugares.
  function auditLogFilterParams() {
    const params = new URLSearchParams();
    if (auditLogActionFilter !== "all") params.set("action", auditLogActionFilter);
    if (auditLogEntityFilter !== "all") params.set("entityType", auditLogEntityFilter);
    if (auditLogEntityIdFilter.trim()) params.set("entityId", auditLogEntityIdFilter.trim());
    if (auditLogFrom) params.set("from", new Date(auditLogFrom).toISOString());
    if (auditLogTo) params.set("to", new Date(new Date(auditLogTo).getTime() + 86400000).toISOString());
    return params;
  }

  async function loadAuditLogs() {
    setAuditLogsLoading(true);
    try {
      const params = auditLogFilterParams();
      params.set("page", String(auditLogsPage));
      params.set("pageSize", String(AUDIT_LOG_PAGE_SIZE));

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      setAuditLogs((data.logs as AdminAuditLogRow[]) ?? []);
      setAuditLogsTotal((data.total as number) ?? 0);
    } finally {
      setAuditLogsLoading(false);
    }
  }

  // Export CSV (Fase 2 / punto 5 del pedido) — pega contra la misma ruta con
  // `?export=csv` + los filtros vigentes; el backend ignora la paginación y
  // devuelve hasta 5000 filas (ver la ruta para el motivo del tope).
  async function handleExportAuditLogs() {
    setAuditExportBusy(true);
    try {
      const params = auditLogFilterParams();
      params.set("export", "csv");
      const ok = await downloadCsvFromApi(`/api/admin/audit-logs?${params.toString()}`, "maintlyqr-audit-log.csv");
      if (!ok) flash(t("exportFailed"), "error");
    } finally {
      setAuditExportBusy(false);
    }
  }

  // Incremento 19: mismo patrón de paginación real server-side que el log
  // de auditoría de arriba, ver /api/admin/error-logs.
  async function loadErrorLogs() {
    setErrorLogsLoading(true);
    try {
      const params = new URLSearchParams();
      if (errorLogSourceFilter !== "all") params.set("source", errorLogSourceFilter);
      if (errorLogSeverityFilter !== "all") params.set("severity", errorLogSeverityFilter);
      if (errorLogResolvedFilter === "resolved") params.set("resolved", "true");
      if (errorLogResolvedFilter === "unresolved") params.set("resolved", "false");
      params.set("page", String(errorLogsPage));
      params.set("pageSize", String(ERROR_LOGS_PAGE_SIZE));

      const res = await fetch(`/api/admin/error-logs?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setErrorLogs((data.logs as PlatformErrorLogRow[]) ?? []);
        setErrorLogsTotal((data.total as number) ?? 0);
        setErrorLogsUnresolvedCount((data.unresolvedCount as number) ?? 0);
      } else {
        flash(data.error || t("errorLoadErrorLogs"), "error");
      }
    } catch {
      flash(t("errorLoadErrorLogs"), "error");
    }
    setErrorLogsLoading(false);
  }

  async function toggleErrorLogResolved(log: PlatformErrorLogRow) {
    setErrorLogBusyId(log.id);
    const res = await adminFetch("/api/admin/error-logs", "PATCH", { id: log.id, resolved: !log.resolved });
    setErrorLogBusyId(null);
    if (!res.ok) { flash(res.error, "error"); return; }
    setErrorLogs((prev) => prev.map((l) => (l.id === log.id
      ? { ...l, resolved: !log.resolved, resolved_at: !log.resolved ? new Date().toISOString() : null }
      : l)));
    setErrorLogsUnresolvedCount((n) => Math.max(0, n + (log.resolved ? 1 : -1)));
    flash(log.resolved ? t("errorLogReopened") : t("errorLogResolved"));
  }

  async function loadAnalytics() {
    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("from", new Date(analyticsFrom).toISOString());
      params.set("to", new Date(new Date(analyticsTo).getTime() + 86400000).toISOString());
      const res = await fetch(`/api/admin/analytics?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (data && !data.error) setAnalyticsData(data as AnalyticsData);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  const RECENT_ACTIVITY_LOG_LIMIT = 20;
  const RECENT_SCANS_LIMIT = 15;

  // Refresco liviano para el feed de "Actividad reciente" del Dashboard —
  // deliberadamente separado de loadData() (que re-trae accounts/assets/
  // services enteros, capados pero igual pesados) para que el polling cada
  // 30s no repita ese costo. Cuentas/assets/registros nuevos igual aparecen
  // en el feed porque ya están ordenados por fecha en el estado que dejó el
  // último loadData() — ver recentActivityFeed más abajo.
  async function loadRecentActivity() {
    try {
      const [logsRes, scansRes] = await Promise.all([
        fetch(`/api/admin/audit-logs?page=1&pageSize=${RECENT_ACTIVITY_LOG_LIMIT}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/admin/qr-scan-stats?only=recent`).then((r) => r.json()).catch(() => null),
      ]);
      if (logsRes && Array.isArray(logsRes.logs)) setRecentAuditLogs(logsRes.logs as AdminAuditLogRow[]);
      if (scansRes && !scansRes.error && Array.isArray(scansRes.recentScans)) setRecentScans(scansRes.recentScans as RecentScanRow[]);
      setActivityRefreshedAt(new Date().toISOString());
    } catch {
      // Best-effort, silencioso — un refresco de fondo que falla no debería
      // interrumpir al admin ni mostrar un error intrusivo.
    }
  }

  // Reportes y Moderación: mismo patrón de paginación real server-side que
  // el log de auditoría (esta tabla la alimenta un formulario público
  // anónimo, así que puede crecer sin límite — ver /api/admin/reports).
  function reportsFilterParams() {
    const params = new URLSearchParams();
    if (reportStatusFilter !== "all") params.set("status", reportStatusFilter);
    if (reportTypeFilter !== "all") params.set("reportType", reportTypeFilter);
    return params;
  }

  async function loadReports() {
    setReportsLoading(true);
    try {
      const params = reportsFilterParams();
      params.set("page", String(reportsPage));
      params.set("pageSize", String(REPORTS_PAGE_SIZE));

      const res = await fetch(`/api/admin/reports?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      setReports((data.reports as ContentReportRow[]) ?? []);
      setReportsTotal((data.total as number) ?? 0);
      setReportsNewCount((data.newCount as number) ?? 0);
    } finally {
      setReportsLoading(false);
    }
  }

  // Export CSV — mismo patrón que handleExportAuditLogs() más arriba.
  async function handleExportReports() {
    setReportsExportBusy(true);
    try {
      const params = reportsFilterParams();
      params.set("export", "csv");
      const ok = await downloadCsvFromApi(`/api/admin/reports?${params.toString()}`, "maintlyqr-reports.csv");
      if (!ok) flash(t("exportFailed"), "error");
    } finally {
      setReportsExportBusy(false);
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

  // Incremento 18: la pestaña "Actividad sospechosa" de Reportes y
  // Moderación. Sin paginación server-side (a diferencia de Reportes) —
  // /api/admin/suspicious-activity ya devuelve como mucho 100 filas,
  // ordenadas por score. Se recalcula entero cada vez que se abre la
  // pestaña (ver el useEffect más abajo) — no hay estado que persista
  // entre cargas, así que no hay nada que quede desactualizado.
  async function loadSuspiciousActivity() {
    setSuspiciousActivityLoading(true);
    try {
      const res = await fetch("/api/admin/suspicious-activity");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuspiciousActivity((data.flagged as FlaggedMechanicRow[]) ?? []);
        setSuspiciousActivitySummary({
          flaggedTotal: (data.flaggedTotal as number) ?? 0,
          scannedMechanics: (data.scannedMechanics as number) ?? 0,
        });
      } else {
        flash(data.error || t("errorLoadSuspicious"), "error");
      }
    } catch {
      flash(t("errorLoadSuspicious"), "error");
    }
    setSuspiciousActivityLoading(false);
  }

  // Abre el mismo modal de detalle de cuenta que usa la sección Maintlers —
  // busca la fila completa en `accounts` (ya cargada por loadData()/
  // bulk-data) en vez de duplicar todos sus campos en la respuesta de
  // suspicious-activity, que solo trae lo mínimo para la lista.
  function openSuspiciousMechanicDetail(mechanicId: string) {
    const account = accounts.find((a) => a.id === mechanicId);
    if (account) setDetailAccount(account);
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

  async function loadDeleteRequests() {
    setDeleteRequestsLoading(true);
    try {
      const res = await fetch("/api/admin/delete-requests");
      const data = await res.json().catch(() => ({}));
      setDeleteRequests((data.requests as DeleteRequestRow[]) ?? []);
    } finally {
      setDeleteRequestsLoading(false);
    }
  }

  function confirmApproveDeleteRequest(row: DeleteRequestRow) {
    const label = row.service_records?.assets ? assetLabel(row.service_records.assets) : t("unnamedAsset");
    setConfirmAction({
      title: t("approveDeleteRequestConfirmTitle"),
      body: t("approveDeleteRequestConfirmBody", { type: row.service_records?.service_type ?? "", asset: label }),
      danger: true,
      onConfirm: async () => {
        const res = await adminFetch("/api/admin/delete-requests", "PATCH", { id: row.id, decision: "approve" });
        if (!res.ok) { flash(res.error, "error"); return; }
        setDeleteRequests((prev) => prev.filter((x) => x.id !== row.id));
        flash(t("deleteRequestApproved"));
      },
    });
  }

  function confirmRejectDeleteRequest(row: DeleteRequestRow) {
    const label = row.service_records?.assets ? assetLabel(row.service_records.assets) : t("unnamedAsset");
    setConfirmAction({
      title: t("rejectDeleteRequestConfirmTitle"),
      body: t("rejectDeleteRequestConfirmBody", { type: row.service_records?.service_type ?? "", asset: label }),
      collectReason: true,
      onConfirm: async (reason) => {
        const res = await adminFetch("/api/admin/delete-requests", "PATCH", { id: row.id, decision: "reject", note: reason });
        if (!res.ok) { flash(res.error, "error"); return; }
        setDeleteRequests((prev) => prev.filter((x) => x.id !== row.id));
        flash(t("deleteRequestRejected"));
      },
    });
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
    setSupportNotesDraft((supportThreadStates[mechanicId] ?? defaultThreadState(mechanicId)).internal_notes ?? "");
    const hasUnread = supportMessages.some((m) => m.mechanic_id === mechanicId && !m.from_admin && !m.read);
    if (hasUnread) {
      const result = await adminFetch("/api/admin/support-messages", "PATCH", { mechanicId });
      if (!result.ok) { flash(result.error || t("couldntMarkRead"), "error"); return; }
      setSupportMessages((prev) => prev.map((x) => (x.mechanic_id === mechanicId && !x.from_admin ? { ...x, read: true } : x)));
    }
  }

  // Herramientas de soporte (incremento 9): cambiar estado/prioridad/notas
  // internas de un caso. Un solo endpoint (`/api/admin/support-thread-state`)
  // que hace upsert de la fila de estado — el llamador manda solo los campos
  // que cambian, el resto se completa con el estado actual (o el default).
  async function updateSupportThreadState(mechanicId: string, updates: Partial<Pick<SupportThreadState, "status" | "priority" | "internal_notes">>) {
    setSupportStateSaving(true);
    const result = await adminFetch("/api/admin/support-thread-state", "PATCH", { mechanicId, ...updates });
    setSupportStateSaving(false);
    if (!result.ok) { flash(result.error || t("couldntUpdateSupportState"), "error"); return; }
    const saved = (result.data as { state: SupportThreadState }).state;
    setSupportThreadStates((prev) => ({ ...prev, [mechanicId]: saved }));
  }

  async function handleToggleSupportStatus(mechanicId: string) {
    const current = supportThreadStates[mechanicId] ?? defaultThreadState(mechanicId);
    await updateSupportThreadState(mechanicId, { status: current.status === "open" ? "closed" : "open" });
  }

  async function handleChangeSupportPriority(mechanicId: string, priority: SupportThreadState["priority"]) {
    await updateSupportThreadState(mechanicId, { priority });
  }

  async function handleSaveSupportNotes(mechanicId: string) {
    await updateSupportThreadState(mechanicId, { internal_notes: supportNotesDraft });
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

  // Incremento 11: rol/capacidades del admin logueado (ver
  // /api/admin/session/route.ts) — alimentan qué secciones del sidebar se
  // muestran y si las acciones de escritura están habilitadas para este rol.
  // Extraído a una función propia en el incremento 14 para que tanto el
  // chequeo de sesión al montar como handleAdminLogin (ver más abajo) usen
  // exactamente la misma lógica — antes handleAdminLogin nunca la llamaba,
  // así que después de tipear usuario/contraseña el admin quedaba con
  // adminCapabilities en su valor inicial ([]), el sidebar prácticamente
  // vacío, y solo un refresh manual de la página (que sí dispara este
  // useEffect) lo arreglaba. Devuelve las capacidades para que el que la
  // llama pueda pasárselas a loadData() sin depender del estado.
  async function fetchAdminSession(): Promise<{ ok: boolean; capabilities: string[] }> {
    const data = await fetch("/api/admin/session").then((r) => r.json()).catch(() => ({ ok: false }));
    const ok = !!data.ok;
    setAdminAuthed(ok);
    setAdminRole(ok ? (data.role ?? null) : null);
    const capabilities = ok && Array.isArray(data.capabilities) ? data.capabilities : [];
    setAdminCapabilities(capabilities);
    setAdminReadOnly(ok ? !!data.readOnly : false);
    return { ok, capabilities };
  }

  useEffect(() => {
    fetchAdminSession()
      .then(({ ok, capabilities }) => {
        setLoginChecked(true);
        if (ok) loadData(capabilities).then(() => setLoading(false));
      })
      .catch(() => setLoginChecked(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si la sección abierta no está entre las que el rol logueado puede ver
  // (ej. cambió de rol, o quedó una sección vieja en el estado de una
  // sesión anterior con otro rol), vuelve a la sección de aterrizaje de
  // ese rol — Dashboard para la mayoría, Analytics para Analytics Viewer
  // (ver landingSection más arriba) — en vez de dejar una pantalla a medio
  // cargar pidiendo datos que van a volver 403.
  useEffect(() => {
    if (!adminAuthed) return;
    if (!canSeeSection(section, adminCapabilities)) setSection(landingSection(adminCapabilities));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminAuthed, adminCapabilities, section]);

  // Sección "Administradores" (incremento 11) — mismo patrón de lazy-load
  // que el resto de las secciones (support/team-chat/audit-log/etc.): se
  // trae la lista recién cuando se abre la sección, no de entrada.
  useEffect(() => {
    if (section === "admins" && adminAuthed && adminCapabilities.includes("admin_management")) {
      loadAdmins();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, adminAuthed]);

  // Sección "Sistema" (incremento 17) — mismo patrón de lazy-load.
  useEffect(() => {
    if (section === "system" && adminAuthed && adminCapabilities.includes("critical_actions")) {
      loadSystemSettings();
      loadChangelog();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, adminAuthed]);

  // Auto-refresco global (incremento 10, 14 jul 2026 — pedido explícito de
  // Facu: "el boton de actualizar ese que tengo no deberia existir y la
  // pagina del administrador deberia actualizarse sola todo el tiempo").
  // Reemplaza el botón manual "Actualizar" del header: mientras haya una
  // sesión de admin activa, se vuelve a correr `loadData()` (lo mismo que
  // hacía ese botón) cada 60s, sin importar qué sección esté abierta —
  // mismo patrón de polling ya usado para "Actividad en tiempo real"
  // (incremento 7), solo que a nivel de todo el panel en vez de un feed
  // puntual. `loadData()` no toca `loading` (el spinner de carga inicial),
  // así que estos refrescos son silenciosos y no generan saltos de layout;
  // el único indicador visible es el "actualizado hace X" del header.
  useEffect(() => {
    if (!adminAuthed) return;
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminAuthed]);

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
  }, [section, adminAuthed, auditLogsPage, auditLogActionFilter, auditLogEntityFilter, auditLogEntityIdFilter, auditLogFrom, auditLogTo]);

  // Incremento 19: mismo criterio que el log de auditoría — filtros/página
  // reales del lado del servidor, así que un cambio de filtro necesita un
  // refetch de verdad.
  useEffect(() => {
    if (section === "errors" && adminAuthed) {
      loadErrorLogs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, adminAuthed, errorLogsPage, errorLogSourceFilter, errorLogSeverityFilter, errorLogResolvedFilter]);

  // Reportes y Moderación: same reasoning as the audit log effect above —
  // server-side filters/pagination, so filter changes need a real refetch,
  // not just a client-side re-slice.
  useEffect(() => {
    if (section === "moderation" && adminAuthed) {
      loadReports();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, adminAuthed, reportsPage, reportStatusFilter, reportTypeFilter]);

  // Incremento 18: la pestaña "Actividad sospechosa" recalcula cada vez que
  // se abre — es una consulta más pesada que Reportes (escanea hasta miles
  // de assets/service_records), así que no se dispara junto con Reportes,
  // solo cuando el admin efectivamente hace click en esa pestaña.
  useEffect(() => {
    if (section === "moderation" && moderationTab === "suspicious" && adminAuthed) {
      loadSuspiciousActivity();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, moderationTab, adminAuthed]);

  // Analytics: refetch on open and whenever the date range changes.
  useEffect(() => {
    if (section === "analytics" && adminAuthed) {
      loadAnalytics();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, adminAuthed, analyticsFrom, analyticsTo]);

  // "Actividad en tiempo real" (item Fase 2 / punto 2 del pedido): mientras
  // el admin esté mirando el Dashboard, refresca el feed de actividad cada
  // 30s. Se detiene solo (clearInterval) al salir de la sección o cerrar
  // sesión, para no seguir pegándole al servidor desde una pestaña en
  // segundo plano en otra sección del panel.
  useEffect(() => {
    if (section !== "dashboard" || !adminAuthed) return;
    loadRecentActivity();
    const interval = setInterval(loadRecentActivity, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, adminAuthed]);

  // Papelera: refetch every time the tab opens, same lazy pattern as
  // Support/Team Chat — a restore or permanent delete elsewhere shouldn't
  // leave a stale trash list sitting around.
  useEffect(() => {
    if (section === "trash" && adminAuthed) {
      loadTrash();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, adminAuthed]);

  // Solicitudes de Borrado (migración 042, item pedido 21 jul 2026): mismo
  // patrón perezoso que Papelera — se recarga cada vez que se abre la
  // pestaña, así una aprobación/rechazo hecho en otra pestaña no deja la
  // lista desactualizada.
  useEffect(() => {
    if (section === "delete-requests" && adminAuthed) {
      loadDeleteRequests();
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
      // Incremento 14: /api/admin/login solo confirma la contraseña y pone
      // la cookie — el rol/capacidades hay que pedirlos aparte, con la misma
      // fetchAdminSession() que usa el chequeo de sesión al montar. Antes
      // este paso faltaba directamente acá, así que un login manual (a
      // diferencia de refrescar la página con la cookie ya puesta) dejaba
      // adminCapabilities en [] — sidebar casi vacío hasta refrescar.
      const { capabilities } = await fetchAdminSession();
      await loadData(capabilities);
      setLoading(false);
    } finally {
      setLoginSubmitting(false);
    }
  }
  async function handleAdminLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAdminAuthed(false);
    // Incremento 14: limpiar rol/capacidades al salir — si el próximo login
    // en esta misma pestaña es de otro admin con otro rol, no debe arrancar
    // con las capacidades del admin anterior ni por un instante.
    setAdminRole(null);
    setAdminCapabilities([]);
    setAdminReadOnly(false);
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

  // ── Administradores (incremento 11, "admin_management" — solo Super
  // Admin) ── Crear/desactivar/reactivar otros admins y asignarles rol.
  async function loadAdmins() {
    setAdminsLoading(true);
    try {
      const res = await fetch("/api/admin/admins");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setAdminsList((data.admins as AdminUserRow[]) ?? []);
      else flash(data.error || t("errorLoadAdmins"), "error");
    } catch {
      flash(t("errorLoadAdmins"), "error");
    }
    setAdminsLoading(false);
  }

  async function createAdmin() {
    if (!newAdminUsername.trim() || newAdminPassword.length < 8) return;
    setCreatingAdmin(true);
    const res = await adminFetch("/api/admin/admins", "POST", {
      username: newAdminUsername.trim(),
      password: newAdminPassword,
      role: newAdminRole,
    });
    setCreatingAdmin(false);
    if (!res.ok) { flash(res.error, "error"); return; }
    setAdminsList((prev) => [...prev, res.data.admin as AdminUserRow]);
    setNewAdminUsername("");
    setNewAdminPassword("");
    setNewAdminRole("support_admin");
    flash(t("adminCreated"));
  }

  async function updateAdmin(id: string, patch: { role?: AdminRole; active?: boolean }) {
    const res = await adminFetch("/api/admin/admins", "PATCH", { id, ...patch });
    if (!res.ok) { flash(res.error, "error"); return; }
    setAdminsList((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  // ── Sistema (incremento 17) ──
  async function loadSystemSettings() {
    setSystemSettingsLoading(true);
    try {
      const res = await fetch("/api/admin/system-settings");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSystemSettings((data.settings as SystemSettingsRow) ?? null);
        setSystemSettingsDraft({});
      } else {
        flash(data.error || t("errorLoadSystemSettings"), "error");
      }
    } catch {
      flash(t("errorLoadSystemSettings"), "error");
    }
    setSystemSettingsLoading(false);
  }

  async function saveSystemSettings() {
    if (Object.keys(systemSettingsDraft).length === 0) return;
    setSystemSettingsSaving(true);
    const res = await adminFetch("/api/admin/system-settings", "PATCH", { updates: systemSettingsDraft });
    setSystemSettingsSaving(false);
    if (!res.ok) { flash(res.error, "error"); return; }
    setSystemSettings((res.data as { settings?: SystemSettingsRow })?.settings ?? null);
    setSystemSettingsDraft({});
    flash(t("systemSettingsSaved"));
  }

  // Lee el valor efectivo: lo que el admin editó en este render si lo tocó,
  // si no lo que ya está guardado — mismo patrón que un formulario
  // controlado con "draft" separado del valor persistido.
  function systemSettingValue<K extends keyof SystemSettingsRow>(key: K): SystemSettingsRow[K] | undefined {
    if (key in systemSettingsDraft) return systemSettingsDraft[key];
    return systemSettings?.[key];
  }

  async function loadChangelog() {
    setChangelogLoading(true);
    try {
      const res = await fetch("/api/admin/changelog");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setChangelogEntries((data.entries as ChangelogEntry[]) ?? []);
      else flash(data.error || t("errorLoadChangelog"), "error");
    } catch {
      flash(t("errorLoadChangelog"), "error");
    }
    setChangelogLoading(false);
  }

  async function createChangelogEntry() {
    if (!newChangelogVersion.trim() || !newChangelogNotes.trim()) return;
    setCreatingChangelogEntry(true);
    const res = await adminFetch("/api/admin/changelog", "POST", {
      versionLabel: newChangelogVersion.trim(),
      notes: newChangelogNotes.trim(),
    });
    setCreatingChangelogEntry(false);
    if (!res.ok) { flash(res.error, "error"); return; }
    setNewChangelogVersion("");
    setNewChangelogNotes("");
    loadChangelog();
    flash(t("changelogEntryCreated"));
  }

  async function deleteChangelogEntry(id: string) {
    const res = await adminFetch("/api/admin/changelog", "DELETE", { id });
    if (!res.ok) { flash(res.error, "error"); return; }
    setChangelogEntries((prev) => prev.filter((e) => e.id !== id));
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
      collectReason: true,
      onConfirm: async (reason) => {
        const res = await adminFetch("/api/admin/accounts", "DELETE", { id: a.id, reason });
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
      collectReason: true,
      onConfirm: async (reason) => {
        const res = await adminFetch("/api/admin/accounts", "DELETE", { id: row.id, permanent: true, reason });
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
      collectReason: true,
      onConfirm: async (reason) => {
        const res = await adminFetch("/api/admin/assets", "DELETE", { id: a.id, reason });
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
      collectReason: true,
      onConfirm: async (reason) => {
        const res = await adminFetch("/api/admin/assets", "DELETE", { id: row.id, permanent: true, reason });
        if (!res.ok) { flash(res.error, "error"); return; }
        setTrashAssets((prev) => prev.filter((x) => x.id !== row.id));
        flash(t("assetPermanentlyDeleted"));
      },
    });
  }

  // Edición de campos de asset (item 3 del pedido: "editar") — el primer
  // punto de escritura de campos generales sobre "assets" desde el admin;
  // hasta este incremento solo existía soft-delete/restore/permanent-delete.
  function openEditAsset(a: AssetRow) {
    setEditAssetRow(a);
    setEditAssetType(a.asset_type);
    setEditBrand(a.brand ?? "");
    setEditModel(a.model ?? "");
    setEditNickname(a.nickname ?? "");
    setEditVin(a.vin_serial ?? "");
    setEditPlate(a.plate ?? "");
    setEditAssetError("");
  }

  async function handleSaveAssetEdit() {
    if (!editAssetRow) return;
    setEditAssetSaving(true);
    setEditAssetError("");
    const updates = {
      asset_type: editAssetType,
      brand: editBrand.trim() || null,
      model: editModel.trim() || null,
      nickname: editNickname.trim() || null,
      vin_serial: editVin.trim() || null,
      plate: editPlate.trim() || null,
    };
    const res = await adminFetch("/api/admin/assets", "PATCH", { id: editAssetRow.id, updates });
    setEditAssetSaving(false);
    if (!res.ok) { setEditAssetError(res.error); return; }
    setAssets((prev) => prev.map((x) => (x.id === editAssetRow.id ? { ...x, ...updates } : x)));
    flash(t("assetUpdated"));
    setEditAssetRow(null);
  }

  // "Ver historial de acciones" (item 2/3 del pedido) — salta a Logs de
  // Auditoría filtrado por esta entidad exacta, en vez de tener que buscarla
  // a mano entre todas las acciones de todos los admins.
  function viewHistory(entityType: string, entityId: string) {
    setAuditLogEntityFilter(entityType);
    setAuditLogEntityIdFilter(entityId);
    setAuditLogActionFilter("all");
    setAuditLogFrom("");
    setAuditLogTo("");
    setAuditLogsPage(1);
    setDetailAccount(null);
    setSection("audit-log");
  }

  // ── Service actions ──
  function confirmDeleteService(s: ServiceRow) {
    setConfirmAction({
      title: t("deleteServiceConfirmTitle"),
      body: t("deleteServiceConfirmBody", { type: s.service_type, asset: s.asset_label, date: formatDate(s.service_date) }),
      danger: true,
      collectReason: true,
      onConfirm: async (reason) => {
        const res = await adminFetch("/api/admin/services", "DELETE", { id: s.id, reason });
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
      collectReason: true,
      onConfirm: async (reason) => {
        const res = await adminFetch("/api/admin/services", "DELETE", { id: row.id, permanent: true, reason });
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

  const assetsById = useMemo(() => {
    const map: Record<string, AssetRow> = {};
    for (const a of assets) map[a.id] = a;
    return map;
  }, [assets]);

  const visibleAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => [a.name, a.email, a.workshop_name].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [accounts, accountSearch]);

  // Incremento 15 (pedido de Facu: "son todos Maintlers y habra subclases
  // dependiendo de la funcion que cada uno elija"): conteo por profesión
  // para los chips de la pestaña "Por profesión" — sobre TODAS las cuentas,
  // no `visibleAccounts` (que ya viene filtrado por búsqueda), para que los
  // números de los chips sean siempre el total real, independiente de si
  // hay algo tipeado en el buscador de la pestaña "Todos".
  const professionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of accounts) {
      if (!a.profession) continue;
      counts[a.profession] = (counts[a.profession] ?? 0) + 1;
    }
    return counts;
  }, [accounts]);

  const professionFilteredAccounts = useMemo(() => {
    if (professionFilter === "all") return accounts;
    if (professionFilter === "none") return accounts.filter((a) => !a.profession);
    return accounts.filter((a) => a.profession === professionFilter);
  }, [accounts, professionFilter]);

  const pendingVerifications = useMemo(() => {
    return accounts
      .filter((a) => a.verification_status === "pending")
      .sort((a, b) => (a.verification_requested_at ?? "").localeCompare(b.verification_requested_at ?? ""));
  }, [accounts]);

  // asset_id -> códigos de QR vinculados, para poder buscar un asset por su
  // QR (item 3 del pedido: búsqueda por "QR/ID/serie/matrícula/marca/
  // modelo/nombre/tipo/creador/fecha" — antes solo cubría marca/modelo/
  // apodo/VIN/matrícula/dueño).
  const qrCodesByAssetId = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const q of qrCodes) {
      if (!q.asset_id) continue;
      (m[q.asset_id] ??= []).push(q.code);
    }
    return m;
  }, [qrCodes]);

  const visibleAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => {
      const owner = a.created_by ? mechanicsById[a.created_by]?.name : "";
      const qrs = qrCodesByAssetId[a.id]?.join(" ") ?? "";
      const hay = [
        a.id, a.brand, a.model, a.nickname, a.vin_serial, a.plate, owner,
        tAssetTypes(a.asset_type), qrs, formatDate(a.created_at),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [assets, assetSearch, mechanicsById, qrCodesByAssetId, tAssetTypes]);

  // Filtro de fecha para la Papelera (por deleted_at) — pedido explícito
  // pendiente desde el incremento 2 de Item 6 ("filtrar Papelera por
  // fecha"). Se filtra en el cliente porque /api/admin/trash ya trae todo
  // capado a 500 filas por tipo sin paginación real (ver ese archivo).
  function withinTrashRange(deletedAt: string) {
    if (!trashFilterFrom && !trashFilterTo) return true;
    const d = new Date(deletedAt).getTime();
    if (trashFilterFrom && d < new Date(trashFilterFrom).getTime()) return false;
    if (trashFilterTo && d > new Date(trashFilterTo).getTime() + 86400000) return false;
    return true;
  }
  const visibleTrashMechanics = useMemo(
    () => trashMechanics.filter((r) => withinTrashRange(r.deleted_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trashMechanics, trashFilterFrom, trashFilterTo]
  );
  const visibleTrashAssets = useMemo(
    () => trashAssets.filter((r) => withinTrashRange(r.deleted_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trashAssets, trashFilterFrom, trashFilterTo]
  );
  const visibleTrashServices = useMemo(
    () => trashServices.filter((r) => withinTrashRange(r.deleted_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trashServices, trashFilterFrom, trashFilterTo]
  );

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

  // Movido acá arriba de los primeros `return` condicionales (login/loading)
  // — este objeto y el useMemo de abajo (`recentActivityFeed`) tienen que
  // ejecutarse en TODOS los renders, sin importar el estado de auth/carga.
  // Antes estaban después de esos `return`, lo que violaba las Reglas de
  // los Hooks (un useMemo que a veces corre y a veces no, según el render)
  // y producía "Minified React error #310" en producción una vez logueado
  // — bug detectado por Facu el 14 jul 2026 y corregido acá.
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
    "asset.update": t("auditActionAssetUpdate"),
    "service.delete": t("auditActionServiceDelete"),
    "service.restore": t("auditActionServiceRestore"),
    "service.delete_permanent": t("auditActionServiceDeletePermanent"),
    "qr.generate_batch": t("auditActionQrGenerateBatch"),
    "qr.unlink": t("auditActionQrUnlink"),
    "support_thread.clear": t("auditActionSupportThreadClear"),
    "support_thread.update_state": t("auditActionSupportThreadUpdateState"),
    "report.update_status": t("auditActionReportUpdateStatus"),
  };

  // "Actividad en tiempo real" (item 1 del pedido: "actividad reciente" del
  // Dashboard, y Fase 2 / punto 2: "Actividad en tiempo real") — mezcla, en
  // el cliente, 5 fuentes que YA se cargan por separado en distintas partes
  // del panel: cuentas/assets/servicios nuevos vienen de `accounts`/
  // `assets`/`services` (ya ordenados por fecha desde bulk-data, así que
  // `.slice(0, N)` alcanza sin pedir nada de nuevo); escaneos y acciones de
  // admin vienen de `recentScans`/`recentAuditLogs`, refrescados cada 30s
  // por loadRecentActivity(). `services` usa `service_date` como proxy de
  // "cuándo pasó" (no hay `created_at` en ese tipo) — una carga atrasada
  // podría aparecer "vieja" acá aunque se haya cargado recién; aceptable
  // para un feed de actividad, no para una métrica de auditoría exacta.
  const ACTIVITY_FEED_LIMIT = 20;
  // ActivityEvent ahora se importa desde scope de módulo (ver arriba, cerca
  // de DayBucket) — se movió para poder exportarlo hacia DashboardSection.
  const recentActivityFeed = useMemo(() => {
    const events: ActivityEvent[] = [];

    for (const a of accounts.slice(0, 8)) {
      events.push({
        id: `mech-${a.id}`, type: "new_mechanic", timestamp: a.created_at,
        icon: Users, iconBg: "bg-blue-500",
        text: t("activityNewMechanic", { name: a.name }),
        onClick: () => openDetail(a),
      });
    }
    for (const a of assets.slice(0, 8)) {
      events.push({
        id: `asset-${a.id}`, type: "new_asset", timestamp: a.created_at,
        icon: Box, iconBg: "bg-purple-500",
        text: t("activityNewAsset", { asset: assetLabel(a) }),
      });
    }
    for (const s of services.slice(0, 8)) {
      events.push({
        id: `svc-${s.id}`, type: "new_service", timestamp: s.service_date,
        icon: ClipboardList, iconBg: "bg-cyan-500",
        text: t("activityNewService", { type: s.service_type, asset: s.asset_label }),
      });
    }
    for (const sc of recentScans) {
      const asset = sc.asset_id ? assetsById[sc.asset_id] : null;
      events.push({
        id: `scan-${sc.code}-${sc.scanned_at}`, type: "qr_scan", timestamp: sc.scanned_at,
        icon: ScanLine, iconBg: "bg-pink-500",
        text: asset ? t("activityQrScan", { asset: assetLabel(asset) }) : t("activityQrScanUnlinked", { code: sc.code }),
      });
    }
    for (const log of recentAuditLogs) {
      events.push({
        id: `log-${log.id}`, type: "admin_action", timestamp: log.created_at,
        icon: History, iconBg: "bg-zinc-700",
        text: t("activityAdminAction", { action: AUDIT_ACTION_LABEL[log.action] ?? log.action }),
        onClick: log.entity_type && log.entity_id ? () => viewHistory(log.entity_type as string, log.entity_id as string) : undefined,
      });
    }

    return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, ACTIVITY_FEED_LIMIT);
  }, [accounts, assets, services, recentScans, recentAuditLogs, assetsById, AUDIT_ACTION_LABEL, t]);

  if (!loginChecked) return null;

  // ── LOGIN ─────────────────────────────────────────────────────────────────────
  if (!adminAuthed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-red-50/30 flex items-center justify-center p-4">
        <ErrorLogger />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="w-full max-w-[380px] relative">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-600 shadow-xl shadow-red-200 mb-5">
              <Shield size={28} className="text-white" />
            </div>
            <div className="flex justify-center mb-2">
              {/* Incremento 14: Maintly.png (1536x1024) es una imagen con
                  mucho fondo vacío/degradado alrededor del isologo — a este
                  tamaño se veía como una mancha borrosa apenas visible.
                  Maintly_crop.png es el mismo isologo pero recortado justo
                  al contenido (1081x207, fondo transparente), así que se ve
                  nítido incluso chico. El width/height respeta su relación
                  de aspecto real (~5.22:1) en vez de la 1.5:1 de antes. */}
              <Image src="/images/Maintly_crop.png" alt="MaintlyQR" width={136} height={26} priority style={{ objectFit: "contain" }} />
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
  // Incremento 11: navItems se filtra por canSeeSection antes de
  // renderizar el sidebar — un rol limitado (Support Admin, Content
  // Moderator, Analytics Viewer) directamente no ve las secciones que no
  // puede tocar, en vez de verlas y chocar con un 403 al abrirlas.
  // ALL_NAV_ITEMS separado de navItems a propósito: si el array literal se
  // tipa directamente en la misma expresión que el .filter() de abajo,
  // TypeScript deja de aplicar el tipado contextual de la anotación al
  // literal (cada `id: "dashboard"` se ensancha a `string` en vez de
  // quedar como el literal `Section` correspondiente) y el build de
  // Next.js falla con un error de tipos que este sandbox no puede
  // reproducir (no corre `next build`, solo `tsc` sobre un archivo
  // aislado) — detectado recién en el build real de Vercel.
  const ALL_NAV_ITEMS: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: t("navDashboard"), icon: BarChart3 },
    // Incremento 15: "Cuentas" + "Mecánicos" + "Verificaciones" eran 3 vistas
    // filtradas de la misma tabla `mechanics` — se unificaron en un solo
    // ítem "Maintlers" con pestañas internas (ver maintlersTab más abajo).
    { id: "accounts",  label: t("navMaintlers"),  icon: Users     },
    { id: "assets",    label: t("navAssets"),    icon: Box       },
    { id: "services",  label: t("navServices"),  icon: ClipboardList },
    { id: "delete-requests", label: t("navDeleteRequests"), icon: Undo2 },
    { id: "qr",        label: t("navQr"), icon: QrCode   },
    { id: "support",   label: t("navSupport"),   icon: LifeBuoy  },
    { id: "team-chat", label: t("navTeamChat"), icon: MessageCircle },
    { id: "moderation", label: t("navModeration"), icon: Flag },
    { id: "analytics", label: t("navAnalytics"), icon: TrendingUp },
    { id: "audit-log", label: t("navAuditLog"), icon: History },
    { id: "trash",     label: t("navTrash"),     icon: Trash    },
    { id: "admins",    label: t("navAdmins"),    icon: UserCog  },
    { id: "system",    label: t("navSystem"),    icon: Settings },
    { id: "errors",    label: t("navErrors"),    icon: Bug      },
  ];
  const navItems = ALL_NAV_ITEMS.filter(({ id }) => canSeeSection(id, adminCapabilities));
  const sectionLabels: Record<Section, string> = {
    dashboard: t("navDashboard"), accounts: t("navMaintlers"),
    assets: t("navAssets"), services: t("navServices"), "delete-requests": t("navDeleteRequests"), qr: t("navQr"), support: t("navSupport"), "team-chat": t("navTeamChat"),
    moderation: t("navModeration"), analytics: t("navAnalytics"), "audit-log": t("navAuditLog"), trash: t("navTrash"),
    admins: t("navAdmins"), system: t("navSystem"), errors: t("navErrors"),
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
  const AUDIT_ENTITY_LABEL: Record<string, string> = {
    mechanic: t("auditEntityMechanic"),
    asset: t("auditEntityAsset"),
    service_record: t("auditEntityServiceRecord"),
    qr_code: t("auditEntityQrCode"),
    qr_batch: t("auditEntityQrBatch"),
    support_thread: t("auditEntitySupportThread"),
    content_report: t("auditEntityContentReport"),
  };
  const auditLogTotalPages = Math.max(1, Math.ceil(auditLogsTotal / AUDIT_LOG_PAGE_SIZE));
  const reportsTotalPages = Math.max(1, Math.ceil(reportsTotal / REPORTS_PAGE_SIZE));
  const errorLogsTotalPages = Math.max(1, Math.ceil(errorLogsTotal / ERROR_LOGS_PAGE_SIZE));
  const unreadSupportCount = supportMessages.filter((m) => !m.from_admin && !m.read).length;

  // Facu (26 jul 2026): "te habia pedido q lo agregues en todos lados
  // donde haya escrol de ese tipo" — same swipe-to-change-page gesture as
  // the mechanic-facing pages, now on these 3 admin tables too. Pages here
  // are 1-indexed and clamp (not wrap) at both ends, same as their arrow
  // buttons below. (The refs themselves live up near the other hooks —
  // see the comment there for why.)
  function handleAuditLogTouchStart(e: React.TouchEvent) {
    auditLogTouchStartX.current = e.touches[0].clientX;
  }
  function handleAuditLogTouchEnd(e: React.TouchEvent) {
    if (auditLogTouchStartX.current === null || auditLogTotalPages <= 1) return;
    const deltaX = e.changedTouches[0].clientX - auditLogTouchStartX.current;
    auditLogTouchStartX.current = null;
    const SWIPE_THRESHOLD = 40;
    if (deltaX > SWIPE_THRESHOLD) {
      setAuditLogsPage((p) => Math.max(1, p - 1));
    } else if (deltaX < -SWIPE_THRESHOLD) {
      setAuditLogsPage((p) => Math.min(auditLogTotalPages, p + 1));
    }
  }
  function handleReportsTouchStart(e: React.TouchEvent) {
    reportsTouchStartX.current = e.touches[0].clientX;
  }
  function handleReportsTouchEnd(e: React.TouchEvent) {
    if (reportsTouchStartX.current === null || reportsTotalPages <= 1) return;
    const deltaX = e.changedTouches[0].clientX - reportsTouchStartX.current;
    reportsTouchStartX.current = null;
    const SWIPE_THRESHOLD = 40;
    if (deltaX > SWIPE_THRESHOLD) {
      setReportsPage((p) => Math.max(1, p - 1));
    } else if (deltaX < -SWIPE_THRESHOLD) {
      setReportsPage((p) => Math.min(reportsTotalPages, p + 1));
    }
  }
  function handleErrorLogsTouchStart(e: React.TouchEvent) {
    errorLogsTouchStartX.current = e.touches[0].clientX;
  }
  function handleErrorLogsTouchEnd(e: React.TouchEvent) {
    if (errorLogsTouchStartX.current === null || errorLogsTotalPages <= 1) return;
    const deltaX = e.changedTouches[0].clientX - errorLogsTouchStartX.current;
    errorLogsTouchStartX.current = null;
    const SWIPE_THRESHOLD = 40;
    if (deltaX > SWIPE_THRESHOLD) {
      setErrorLogsPage((p) => Math.max(1, p - 1));
    } else if (deltaX < -SWIPE_THRESHOLD) {
      setErrorLogsPage((p) => Math.min(errorLogsTotalPages, p + 1));
    }
  }

  // Incremento 15: tabla compartida entre las pestañas "Todos" y "Por
  // profesión" de la sección Maintlers (antes eran 2 secciones separadas
  // con tablas casi idénticas, "Cuentas" y "Mecánicos" — ver el tipo
  // Section más arriba) — evita duplicar ~60 líneas de JSX por una
  // diferencia real de una sola cosa: qué array de filas le llega.
  // renderMaintlersTable se movió a AccountsSection.tsx (26 jul 2026, split
  // del admin) — era una función local que cerraba sobre t, tProfessionTypes,
  // assetsByMechanic y openDetail; ahora vive adentro del componente de la
  // sección, cerrando sobre esas mismas cosas pero recibidas como props.

  return (
    <div className="min-h-screen bg-zinc-50/60 flex text-zinc-900 relative">
      <ErrorLogger />

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
              {/* Incremento 14: mismo cambio que el logo del login — usar
                  el recorte nítido en vez de Maintly.png a tamaño chico. */}
              <Image src="/images/Maintly_crop.png" alt="MaintlyQR" width={84} height={16} priority style={{ objectFit: "contain" }} />
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
              {id === "accounts" && pendingVerifications.length > 0 && (
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
          <div className="flex items-center gap-2 text-zinc-400 shrink-0" title={t("autoRefreshTitle")}>
            <RefreshCw size={13} className={refreshing ? "animate-spin text-zinc-500" : ""} />
            {lastFullRefreshAt && (
              <span className="hidden sm:inline text-[11px] font-semibold">{t("lastRefreshedAt", { time: timeAgo(lastFullRefreshAt, locale) })}</span>
            )}
          </div>
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
            <DashboardSection
              t={t} locale={locale} tAssetTypes={tAssetTypes}
              totalUsers={totalUsers} totalMechanicAccounts={totalMechanicAccounts}
              totalVerifiedMechanics={totalVerifiedMechanics} totalAssets={totalAssets}
              assignedQR={assignedQR} totalQR={totalQR} totalServices={totalServices}
              scansToday={scansToday} scansWeek={scansWeek}
              usageMetrics={usageMetrics}
              newUserDays={newUserDays} newMechanicDays={newMechanicDays} newAssetDays={newAssetDays}
              newQrDays={newQrDays} newServiceDays={newServiceDays}
              qrPct={qrPct} assetTypes={assetTypes} maxAssetCount={maxAssetCount}
              activityRefreshedAt={activityRefreshedAt} recentActivityFeed={recentActivityFeed}
            />
          )}

          {/* ── MAINTLERS (incremento 15: Cuentas + Mecánicos + Verificaciones
               unificados en una sola sección con pestañas — ver el comentario
               del tipo Section más arriba) ──────────────────────────────── */}
          {section === "accounts" && (
            <AccountsSection
              t={t} tProfessionTypes={tProfessionTypes}
              maintlersTab={maintlersTab} setMaintlersTab={setMaintlersTab}
              pendingVerifications={pendingVerifications}
              accountSearch={accountSearch} setAccountSearch={setAccountSearch}
              visibleAccounts={visibleAccounts}
              professionFilter={professionFilter} setProfessionFilter={setProfessionFilter}
              accounts={accounts} professionCounts={professionCounts} professionFilteredAccounts={professionFilteredAccounts}
              assetsByMechanic={assetsByMechanic} openDetail={openDetail}
              handleViewCertificate={handleViewCertificate}
              handleRejectVerification={handleRejectVerification}
              handleApproveVerification={handleApproveVerification}
              verificationBusyId={verificationBusyId}
            />
          )}

          {/* ── ASSETS ────────────────────────────────────────────────────── */}
          {section === "assets" && (
            <AssetsSection
              t={t} tAssetTypes={tAssetTypes}
              assetSearch={assetSearch} setAssetSearch={setAssetSearch}
              visibleAssets={visibleAssets} mechanicsById={mechanicsById}
              servicesByAsset={servicesByAsset} qrCodesByAssetId={qrCodesByAssetId}
              assetLabel={assetLabel}
              openEditAsset={openEditAsset} viewHistory={viewHistory} confirmDeleteAsset={confirmDeleteAsset}
            />
          )}

          {/* ── SERVICES ──────────────────────────────────────────────────── */}
          {section === "services" && (
            <ServicesSection
              t={t}
              totalServices={totalServices} totalMechanicAccounts={totalMechanicAccounts}
              visibleServices={visibleServices}
              svcMechanicFilter={svcMechanicFilter} setSvcMechanicFilter={setSvcMechanicFilter}
              svcTypeFilter={svcTypeFilter} setSvcTypeFilter={setSvcTypeFilter}
              accounts={accounts} serviceTypeOptions={serviceTypeOptions}
              viewHistory={viewHistory} confirmDeleteService={confirmDeleteService}
            />
          )}

          {/* ── QR MANAGER ────────────────────────────────────────────────── */}
          {section === "qr" && (
            <QrSection
              t={t}
              totalQR={totalQR} assignedQR={assignedQR}
              qrSearch={qrSearch} setQrSearch={setQrSearch}
              qrStatusFilter={qrStatusFilter} setQrStatusFilter={setQrStatusFilter}
              visibleQr={visibleQr} assetsById={assetsById} assets={assets}
              assetLabel={assetLabel}
              setShowGenerateModal={setShowGenerateModal} confirmUnlinkQr={confirmUnlinkQr}
            />
          )}

          {/* ── SUPPORT (mechanic <-> Control Center, full conversation) ──── */}
          {section === "support" && (
            <SupportSection
              t={t} locale={locale}
              supportLoading={supportLoading} supportConversations={supportConversations}
              supportSearch={supportSearch} setSupportSearch={setSupportSearch}
              supportStatusFilter={supportStatusFilter} setSupportStatusFilter={setSupportStatusFilter}
              supportPriorityFilter={supportPriorityFilter} setSupportPriorityFilter={setSupportPriorityFilter}
              visibleSupportConversations={visibleSupportConversations}
              supportThreadStates={supportThreadStates} defaultThreadState={defaultThreadState}
              selectedThreadMechanic={selectedThreadMechanic} openThread={openThread}
              activeThread={activeThread} setSelectedThreadMechanic={setSelectedThreadMechanic}
              confirmClearThread={confirmClearThread} setConfirmClearThread={setConfirmClearThread}
              handleClearThread={handleClearThread}
              handleToggleSupportStatus={handleToggleSupportStatus} supportStateSaving={supportStateSaving}
              handleChangeSupportPriority={handleChangeSupportPriority}
              supportNotesDraft={supportNotesDraft} setSupportNotesDraft={setSupportNotesDraft}
              handleSaveSupportNotes={handleSaveSupportNotes}
              threadDraft={threadDraft} setThreadDraft={setThreadDraft}
              handleSendThreadReply={handleSendThreadReply} threadSending={threadSending}
            />
          )}

          {section === "team-chat" && (
            <TeamChatSection
              t={t} locale={locale}
              teamChatView={teamChatView} setTeamChatView={setTeamChatView}
              mechanicReports={mechanicReports} mechanicReportsLoading={mechanicReportsLoading}
              teamChatConversations={teamChatConversations} teamChatLoading={teamChatLoading}
              selectedTeamChatPair={selectedTeamChatPair} setSelectedTeamChatPair={setSelectedTeamChatPair}
              activeTeamChatThread={activeTeamChatThread}
              teamChatPersonLabel={teamChatPersonLabel}
            />
          )}

          {/* ── AUDIT LOG (Logs de auditoría) ────────────────────────────── */}
          {section === "audit-log" && (
            <AuditLogSection
              t={t} locale={locale}
              auditLogs={auditLogs} auditLogsLoading={auditLogsLoading} auditLogsTotal={auditLogsTotal}
              auditLogsPage={auditLogsPage} auditLogTotalPages={auditLogTotalPages} setAuditLogsPage={setAuditLogsPage}
              auditLogActionFilter={auditLogActionFilter} setAuditLogActionFilter={setAuditLogActionFilter}
              auditLogEntityFilter={auditLogEntityFilter} setAuditLogEntityFilter={setAuditLogEntityFilter}
              auditLogEntityIdFilter={auditLogEntityIdFilter} setAuditLogEntityIdFilter={setAuditLogEntityIdFilter}
              auditLogFrom={auditLogFrom} setAuditLogFrom={setAuditLogFrom}
              auditLogTo={auditLogTo} setAuditLogTo={setAuditLogTo}
              AUDIT_ACTION_LABEL={AUDIT_ACTION_LABEL} AUDIT_ENTITY_LABEL={AUDIT_ENTITY_LABEL}
              expandedAuditLogId={expandedAuditLogId} setExpandedAuditLogId={setExpandedAuditLogId}
              auditExportBusy={auditExportBusy} handleExportAuditLogs={handleExportAuditLogs}
              handleAuditLogTouchStart={handleAuditLogTouchStart} handleAuditLogTouchEnd={handleAuditLogTouchEnd}
            />
          )}

          {/* ── REPORTES Y MODERACIÓN (item 6 del pedido de Facu) ──────────── */}
          {/* ── REPORTES Y MODERACIÓN (incremento 18: ganó una segunda
               pestaña interna "Actividad sospechosa" — mismo patrón de
               pestañas que "Maintlers" del incremento 15) ──────────────── */}
          {section === "moderation" && (
            <ModerationSection
              t={t} locale={locale}
              moderationTab={moderationTab} setModerationTab={setModerationTab}
              suspiciousActivitySummary={suspiciousActivitySummary}
              assetLabel={assetLabel}
              REPORT_TYPE_LABEL={REPORT_TYPE_LABEL} REPORT_STATUS_LABEL={REPORT_STATUS_LABEL} REPORT_STATUS_TONE={REPORT_STATUS_TONE}
              reportStatusFilter={reportStatusFilter} setReportStatusFilter={setReportStatusFilter}
              reportTypeFilter={reportTypeFilter} setReportTypeFilter={setReportTypeFilter}
              reportsPage={reportsPage} setReportsPage={setReportsPage}
              reportsTotal={reportsTotal} reportsTotalPages={reportsTotalPages}
              handleExportReports={handleExportReports} reportsExportBusy={reportsExportBusy}
              reportsLoading={reportsLoading} reports={reports}
              expandedReportId={expandedReportId} setExpandedReportId={setExpandedReportId}
              reportNotesDraft={reportNotesDraft} setReportNotesDraft={setReportNotesDraft}
              reportNotesSaving={reportNotesSaving}
              handleReportStatusChange={handleReportStatusChange} handleSaveReportNotes={handleSaveReportNotes}
              handleReportsTouchStart={handleReportsTouchStart} handleReportsTouchEnd={handleReportsTouchEnd}
              suspiciousActivityLoading={suspiciousActivityLoading} suspiciousActivity={suspiciousActivity}
              openSuspiciousMechanicDetail={openSuspiciousMechanicDetail}
            />
          )}

          {/* ── ANALYTICS (item 8 del pedido de Facu) ───────────────────────── */}
          {section === "analytics" && (
            <AnalyticsSection
              t={t} tProfessionTypes={tProfessionTypes}
              analyticsData={analyticsData} analyticsLoading={analyticsLoading}
              analyticsFrom={analyticsFrom} setAnalyticsFrom={setAnalyticsFrom}
              analyticsTo={analyticsTo} setAnalyticsTo={setAnalyticsTo}
              assetLabel={assetLabel}
            />
          )}

          {/* ── PAPELERA ──────────────────────────────────────────────────── */}
          {section === "trash" && (
            <TrashSection
              t={t} locale={locale} tAssetTypes={tAssetTypes}
              trashTab={trashTab} setTrashTab={setTrashTab}
              trashMechanics={trashMechanics} trashAssets={trashAssets} trashServices={trashServices}
              trashLoading={trashLoading}
              trashFilterFrom={trashFilterFrom} setTrashFilterFrom={setTrashFilterFrom}
              trashFilterTo={trashFilterTo} setTrashFilterTo={setTrashFilterTo}
              visibleTrashMechanics={visibleTrashMechanics} visibleTrashAssets={visibleTrashAssets} visibleTrashServices={visibleTrashServices}
              mechanicsById={mechanicsById}
              assetLabel={assetLabel}
              confirmRestoreAccount={confirmRestoreAccount} confirmPermanentDeleteAccount={confirmPermanentDeleteAccount}
              confirmRestoreAsset={confirmRestoreAsset} confirmPermanentDeleteAsset={confirmPermanentDeleteAsset}
              confirmRestoreService={confirmRestoreService} confirmPermanentDeleteService={confirmPermanentDeleteService}
            />
          )}

          {/* ── SOLICITUDES DE BORRADO (migración 042, item pedido 21 jul
               2026 — "recien me paso de q cargue un service en un generador
               erroneamente... deberiamos tener la opcion de tener un
               tiempito para borrarlo antes q quede fijo y bloqueado el
               service" + "y un vez pasdo ese tiempo deberia tener la opcion
               de pedirle al administrador q borre ese service"). El
               mecánico dueño del registro puede borrarlo solo dentro de la
               primera hora; pasado ese tiempo el mismo ícono de borrar le
               abre este flujo de solicitud, que termina acá: el admin
               aprueba (soft-delete real, mismo efecto que Papelera) o
               rechaza (el registro queda intacto). ──────────────────── */}
          {section === "delete-requests" && (
            <DeleteRequestsSection
              t={t} locale={locale}
              deleteRequestsLoading={deleteRequestsLoading} deleteRequests={deleteRequests}
              assetLabel={assetLabel}
              confirmApproveDeleteRequest={confirmApproveDeleteRequest} confirmRejectDeleteRequest={confirmRejectDeleteRequest}
            />
          )}

          {/* ── ADMINISTRADORES (incremento 11, 14 jul 2026 — solo Super
               Admin, capacidad "admin_management") ──────────────────── */}
          {section === "admins" && (
            <AdminsSection
              t={t}
              newAdminUsername={newAdminUsername} setNewAdminUsername={setNewAdminUsername}
              newAdminPassword={newAdminPassword} setNewAdminPassword={setNewAdminPassword}
              newAdminRole={newAdminRole} setNewAdminRole={setNewAdminRole}
              creatingAdmin={creatingAdmin} createAdmin={createAdmin}
              adminsLoading={adminsLoading} adminsList={adminsList} updateAdmin={updateAdmin}
            />
          )}

          {section === "system" && (
            <SystemSection
              t={t}
              systemSettingsLoading={systemSettingsLoading} systemSettingValue={systemSettingValue}
              setSystemSettingsDraft={setSystemSettingsDraft} systemSettingsDraft={systemSettingsDraft}
              systemSettings={systemSettings} systemSettingsSaving={systemSettingsSaving} saveSystemSettings={saveSystemSettings}
              newChangelogVersion={newChangelogVersion} setNewChangelogVersion={setNewChangelogVersion}
              newChangelogNotes={newChangelogNotes} setNewChangelogNotes={setNewChangelogNotes}
              createChangelogEntry={createChangelogEntry} creatingChangelogEntry={creatingChangelogEntry}
              changelogLoading={changelogLoading} changelogEntries={changelogEntries} deleteChangelogEntry={deleteChangelogEntry}
            />
          )}

          {/* ── ERRORES (panel técnico de errores y rendimiento — incremento
               19, Fase 3) ─────────────────────────────────────────────── */}
          {section === "errors" && (
            <ErrorsSection
              t={t} locale={locale}
              errorLogs={errorLogs} errorLogsLoading={errorLogsLoading} errorLogsTotal={errorLogsTotal}
              errorLogsUnresolvedCount={errorLogsUnresolvedCount}
              errorLogsPage={errorLogsPage} errorLogsTotalPages={errorLogsTotalPages} setErrorLogsPage={setErrorLogsPage}
              errorLogSourceFilter={errorLogSourceFilter} setErrorLogSourceFilter={setErrorLogSourceFilter}
              errorLogSeverityFilter={errorLogSeverityFilter} setErrorLogSeverityFilter={setErrorLogSeverityFilter}
              errorLogResolvedFilter={errorLogResolvedFilter} setErrorLogResolvedFilter={setErrorLogResolvedFilter}
              expandedErrorLogId={expandedErrorLogId} setExpandedErrorLogId={setExpandedErrorLogId}
              errorLogBusyId={errorLogBusyId} toggleErrorLogResolved={toggleErrorLogResolved}
              handleErrorLogsTouchStart={handleErrorLogsTouchStart} handleErrorLogsTouchEnd={handleErrorLogsTouchEnd}
            />
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

              <p className="text-[11px] text-zinc-400">
                {t("joinedOn", { date: formatDate(detailAccount.created_at) })}
                {detailAccount.last_active_at && ` · ${t("lastActiveOn", { date: formatDate(detailAccount.last_active_at) })}`}
              </p>

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
                  onClick={() => viewHistory("mechanic", detailAccount.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors text-left"
                >
                  <span className="flex items-center gap-2 text-[12px] font-bold text-zinc-700">
                    <History size={14} /> {t("viewHistoryTitle")}
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

      {/* ══ EDIT ASSET MODAL (item 3 del pedido: "editar") ══ */}
      {editAssetRow && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4" onClick={() => setEditAssetRow(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-black text-zinc-900 mb-1">{t("editAssetTitle")}</h3>
            <p className="text-[12px] text-zinc-400 mb-4">{assetLabel(editAssetRow)}</p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-zinc-600">{t("colType")}</label>
                <select
                  value={editAssetType} onChange={(e) => setEditAssetType(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400"
                >
                  {Object.keys(ASSET_ICONS).map((type) => (
                    <option key={type} value={type}>{tAssetTypes(type)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-zinc-600">{t("editAssetNickname")}</label>
                <input
                  type="text" value={editNickname} onChange={(e) => setEditNickname(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-600">{t("editAssetBrand")}</label>
                  <input
                    type="text" value={editBrand} onChange={(e) => setEditBrand(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-600">{t("editAssetModel")}</label>
                  <input
                    type="text" value={editModel} onChange={(e) => setEditModel(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-600">{t("editAssetVin")}</label>
                  <input
                    type="text" value={editVin} onChange={(e) => setEditVin(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] font-mono outline-none focus:border-red-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-600">{t("editAssetPlate")}</label>
                  <input
                    type="text" value={editPlate} onChange={(e) => setEditPlate(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] font-mono outline-none focus:border-red-400"
                  />
                </div>
              </div>
            </div>

            {editAssetError && <p className="text-[12px] text-red-600 mt-3">{editAssetError}</p>}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditAssetRow(null)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-2.5 rounded-xl text-[13px] hover:bg-zinc-50">{t("cancel")}</button>
              <button onClick={handleSaveAssetEdit} disabled={editAssetSaving}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-[13px] transition-all">
                {editAssetSaving ? t("saving") : t("saveChanges")}
              </button>
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
            {confirmAction.collectReason && (
              <div className="mb-5 text-left">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  {t("reasonOptionalLabel")}
                </label>
                <textarea
                  value={confirmReasonText}
                  onChange={(e) => setConfirmReasonText(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-[9px] text-[13px] outline-none focus:border-red-400 transition-colors resize-none"
                  placeholder={t("reasonPlaceholder")}
                />
              </div>
            )}
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
              <button onClick={() => { setConfirmAction(null); setConfirmTypedText(""); setConfirmReasonText(""); }} disabled={confirmBusy}
                className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-3 rounded-xl text-[13px] hover:bg-zinc-50 transition-colors">
                {t("cancel")}
              </button>
              <button
                onClick={async () => {
                  setConfirmBusy(true);
                  await confirmAction.onConfirm(confirmReasonText.trim() || undefined);
                  setConfirmBusy(false);
                  setConfirmAction(null);
                  setConfirmTypedText("");
                  setConfirmReasonText("");
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
