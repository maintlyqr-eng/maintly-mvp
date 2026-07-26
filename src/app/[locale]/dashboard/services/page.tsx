"use client";

import Image from "next/image";
// Assets isn't migrated yet — keep this one plain next/link.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
// Login is migrated and every router.push()/replace() call on this page
// targets it — safe to use next-intl's locale-aware router.
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  Plus, X, Bell, Search, ChevronLeft, ChevronRight,
  Wrench, CheckCircle2, MoreVertical,
  Box, ClipboardList, CalendarClock, AlertTriangle,
  Eye, Archive, Trash2, Clock3,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import DashboardSidebarIntl from "@/components/DashboardSidebarIntl";
import DashboardHeaderIntl from "@/components/DashboardHeaderIntl";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { useUnreadMechanicMessages } from "@/lib/useUnreadMechanicMessages";
import CustomerPickerIntl, { CustomerOption } from "@/components/CustomerPickerIntl";
import { formatDateDMY } from "@/lib/date";
import { computeReminderStatus, REMINDER_STATUS_COLOR } from "@/lib/reminders";
import { getUnitKind } from "@/lib/units";
import { containsInappropriateContent } from "@/lib/contentModeration";

const SERVICE_TYPE_ORDER = ["Oil Change", "Service", "Repair", "Inspection", "Filter Change", "Tire Change", "Brake Service", "Other"];

// Service type is a DB-stored English enum also read by other, not-yet-
// migrated pages — same enum-translation-key pattern used elsewhere.
const SERVICE_TYPE_KEYS: Record<string, string> = {
  "Oil Change": "oilChange", "Service": "service", "Repair": "repair",
  "Inspection": "inspection", "Filter Change": "filterChange",
  "Tire Change": "tireChange", "Brake Service": "brakeService", "Other": "other",
};

// Facu (17 jul 2026): "usaría colores consistentes... eso hace que el
// cerebro los identifique sin leer" — every service type now has a fixed,
// distinct color so the badge is recognizable at a glance instead of
// several types sharing the same blue. Types not in his reference list
// (Filter/Tire/Brake/Other) got their own colors too, so nothing falls back
// to the generic gray unless it's a genuinely unknown/legacy value.
const typeColors: Record<string, string> = {
  "Oil Change": "bg-amber-100 text-amber-700",
  Inspection: "bg-blue-100 text-blue-700",
  Repair: "bg-red-100 text-red-700",
  Service: "bg-emerald-100 text-emerald-700",
  "Filter Change": "bg-cyan-100 text-cyan-700",
  "Tire Change": "bg-indigo-100 text-indigo-700",
  "Brake Service": "bg-rose-100 text-rose-700",
  Other: "bg-zinc-100 text-zinc-600",
};

// Short "15 Jul" style date, used in the compact Recordatorio bell cell —
// formatDateDMY's "15/08/2026" is too wide for an icon-sized column.
const SHORT_DATE_LOCALE: Record<string, string> = { en: "en-US", es: "es-AR", pt: "pt-BR" };
function formatShortDate(dateStr: string, locale: string) {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(SHORT_DATE_LOCALE[locale] ?? "en-US", { day: "2-digit", month: "short" });
}

// Facu (17 jul 2026): "quiero que se vea igual a esto" — his reference
// shows numbered pagination ("‹ 1 2 3 4 5 ... 39 ›"), not just prev/next
// arrows. Builds "1 2 3 4 5 ... 39"-style windows: the first 5 pages, the
// last page, and a small window around wherever the user currently is —
// with "..." filling any gap so it never lists all 39 buttons at once.
function getPageList(current: number, total: number): (number | "...")[] {
  const keep = new Set([1, 2, 3, 4, 5, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  const sorted = Array.from(keep).sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("...");
    result.push(sorted[i]);
  }
  return result;
}

const assetTypeImg: Record<string, string> = {
  automotive: "/images/car.png",
  motorcycle: "/images/moto.png",
  generator: "/images/generador.png",
  machinery: "/images/excavator.png",
  marine: "/images/barco.png",
  aviation: "/images/avion.png",
};

type QrRow = { code: string };

type AssetInfo = {
  id: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  vin_serial: string | null;
  plate: string | null;
  asset_type: string;
  photo_url: string | null;
  qr_codes: QrRow[] | QrRow | null;
};

// Facu (17 jul 2026): real asset photo instead of a generic type icon —
// "eso hace que el usuario encuentre el activo en medio segundo". Same
// getQrCode pattern as the Assets page, just adapted to the nested shape
// service_records rows carry their asset in (assets: AssetInfo).
function assetQrCode(a: AssetInfo | null): string | null {
  if (!a?.qr_codes) return null;
  const q = Array.isArray(a.qr_codes) ? a.qr_codes[0] : a.qr_codes;
  return q?.code ?? null;
}

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
  mechanic_id: string | null;
  next_due_date: string | null;
  next_due_km_hours: number | null;
  hidden_from_panel_at: string | null;
  assets: AssetInfo | AssetInfo[] | null;
};

// Facu (21 jul 2026): "un tiempito para borrarlo antes de que quede fijo y
// bloqueado" — 1 hour, matching the window migration 042's RLS policy
// actually enforces server-side. This constant is ONLY for the UI (which
// icon/label/action to show); the real gate is the database policy, so a
// stale clock or a delayed page load can never let this UI lie its way
// past what the server will actually allow.
const SELF_DELETE_WINDOW_MS = 60 * 60 * 1000;

function getAsset(row: ServiceRow): AssetInfo | null {
  if (!row.assets) return null;
  return Array.isArray(row.assets) ? row.assets[0] ?? null : row.assets;
}

export default function ServicesPage() {
  const t = useTranslations("DashboardServicesPage");
  const tServiceTypes = useTranslations("ServiceTypes");
  const locale = useLocale();
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
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetOptions, setAssetOptions] = useState<AssetOption[]>([]);

  // Filters
  // Facu (17 jul 2026): "quiero agregar Status... y una búsqueda" — a third
  // dropdown (Completed / Scheduled / Overdue, derived from the same
  // reminder-status logic already powering the Recordatorio column) plus a
  // free-text search across asset name, QR code, plate and notes, "porque
  // el 95% de las notas son cortitas... es probablemente lo primero que
  // haría un usuario con 300 servicios".
  const [filterAsset, setFilterAsset] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

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
  const minKmHoursAssetIdRef = useRef<string>("");

  // Reminder menu / modal
  const [openMenuRowId, setOpenMenuRowId] = useState<string | null>(null);
  const [reminderRow, setReminderRow] = useState<ServiceRow | null>(null);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderKm, setReminderKm] = useState("");
  const [reminderMinKm, setReminderMinKm] = useState<number | null>(null);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderError, setReminderError] = useState("");

  // Facu (19 jul 2026): "no se debería poder editar un servicio ya
  // cargado... eso queda ahí para siempre a menos que el administrador lo
  // elimine por alguna causa razonable" — a logged service is now
  // immutable. The menu only has View (read-only detail, also where Notes
  // now live — hidden from the table itself per his earlier note 5, "las
  // notas las ocultaría... las mostraría solamente al abrir el servicio").
  // There used to be Edit/Duplicate/Delete actions here too — all removed;
  // see git history if any of them ever needs to come back.
  //
  // Facu (19 jul 2026): "nuestro sistema le da prioridad a la máquina, de
  // la cual nadie es dueño... los diferentes maintlers le pueden cargar
  // información pero nunca borrar algo ya cargado en ella" — any logged-in
  // mechanic can ADD a service to any asset (that's intentional, by
  // design), but NONE of them — not even the one who logged it — can
  // truly delete a service once it exists. Real deletion is admin-only,
  // via the admin Papelera (src/app/api/admin/trash/route.ts + services/
  // route.ts), gated by capability checks + audit log, and enforced at the
  // DB level too (supabase/migrations/040_lock_service_records_delete.sql
  // blocks any non-admin from setting deleted_at, even via a direct API
  // call — not just hiding the button here).
  //
  // Facu (19 jul 2026), clarifying further with an example (mechanic
  // creates an asset, logs a service, later removes both from "sus
  // registros" — but "ni el asset ni el service será borrado jamás de
  // MaintlyQR... si alguien escanea el QR va a poder ver todo lo que se
  // cargó"): a mechanic SHOULD still be able to clear things out of their
  // own personal panel — that's the same pattern `mechanic_assets` already
  // gives assets (handleRemoveFromWorkshop in dashboard/assets/page.tsx
  // only unlinks, never touches the shared `assets` row). service_records
  // doesn't have that many-to-many link table (each row already belongs to
  // one mechanic_id), so the equivalent here is the `hidden_from_panel_at`
  // column (migration 041): setting it only removes the row from THIS
  // mechanic's own "Mis Servicios" (see the .is("hidden_from_panel_at",
  // null) filter in loadServices above) — the public QR history and any
  // other mechanic's view of the same asset are untouched. This is why the
  // menu below has "Quitar de mis registros" and NOT "Eliminar".
  const [viewRow, setViewRow] = useState<ServiceRow | null>(null);

  const [hideRow, setHideRow] = useState<ServiceRow | null>(null);
  const [hideSaving, setHideSaving] = useState(false);
  const [hideError, setHideError] = useState("");

  // Facu (21 jul 2026): "un tiempito para borrarlo antes de que quede fijo
  // y bloqueado... y una vez pasado ese tiempo, la opción de pedirle al
  // administrador que lo borre" (migration 042). One button/icon in the
  // row menu ("lo que se me ocurre es que el mismo ícono de borrar, una
  // vez pasada la hora, te abra la solicitud de borrado") routes to one of
  // two flows depending on how old the row is — see
  // handleOpenDeleteOrRequest below. deleteRow/deleteSaving/deleteError
  // power the direct self-delete confirm (only reachable within the
  // window); requestRow/requestReason/requestSaving/requestError power the
  // "solicitar borrado al admin" form (only reachable once the window has
  // passed). pendingDeleteRequestIds tracks which rows already have an
  // unresolved request filed, so the menu can show "pendiente de revisión"
  // instead of letting the mechanic file a second one for the same row.
  const [deleteRow, setDeleteRow] = useState<ServiceRow | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [requestRow, setRequestRow] = useState<ServiceRow | null>(null);
  const [requestReason, setRequestReason] = useState("");
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestError, setRequestError] = useState("");

  const [pendingDeleteRequestIds, setPendingDeleteRequestIds] = useState<Set<string>>(new Set());

  function isWithinSelfDeleteWindow(row: ServiceRow) {
    return Date.now() - new Date(row.created_at).getTime() < SELF_DELETE_WINDOW_MS;
  }

  function handleOpenDeleteOrRequest(row: ServiceRow) {
    if (pendingDeleteRequestIds.has(row.id)) return; // already filed, nothing to do here
    if (isWithinSelfDeleteWindow(row)) {
      setDeleteError("");
      setDeleteRow(row);
    } else {
      setRequestError("");
      setRequestReason("");
      setRequestRow(row);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteRow) return;
    setDeleteSaving(true);
    setDeleteError("");
    const { error } = await supabase
      .from("service_records")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteRow.id);
    setDeleteSaving(false);
    if (error) { setDeleteError(t("errorDeleteService")); return; }
    setDeleteRow(null);
    await loadServices(mechanicId);
  }

  async function handleSubmitDeleteRequest() {
    if (!requestRow) return;
    setRequestSaving(true);
    setRequestError("");
    const { error } = await supabase.from("service_delete_requests").insert({
      service_record_id: requestRow.id,
      requested_by: mechanicId,
      reason: requestReason.trim() || null,
    });
    setRequestSaving(false);
    if (error) { setRequestError(t("errorSendDeleteRequest")); return; }
    setPendingDeleteRequestIds((prev) => new Set(prev).add(requestRow.id));
    setRequestRow(null);
  }

  function assetLabel(a: AssetOption | null) {
    if (!a) return "—";
    return a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || t("unnamedAsset");
  }

  function unitLabel(assetType: string | null | undefined) {
    return getUnitKind(assetType) === "horas" ? t("unitHours") : t("unitKm");
  }

  function unitValue(value: number | null | undefined, assetType: string | null | undefined) {
    if (value == null) return "—";
    const short = getUnitKind(assetType) === "horas" ? t("unitShortHours") : t("unitShortKm");
    return `${value.toLocaleString()} ${short}`;
  }

  // Pre-fill the asset filter from a deep link (e.g. the dashboard's top search bar: /dashboard/services?asset=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const assetId = params.get("asset");
    if (assetId) setFilterAsset(assetId);

    if (params.get("new") === "1") handleOpenAddService();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadServices(uid: string) {
    setLoading(true);
    const { data } = await supabase
      .from("service_records")
      .select("id, service_date, service_type, km_hours, notes, created_at, mechanic_id, next_due_date, next_due_km_hours, hidden_from_panel_at, assets(id, nickname, brand, model, vin_serial, plate, asset_type, photo_url, qr_codes(code))")
      .eq("mechanic_id", uid)
      .is("deleted_at", null)
      // Facu (19 jul 2026): "eso sí debería poder hacer, borrar lo que él
      // quiera porque es su panel, pero nunca se borra de la máquina" —
      // hidden_from_panel_at (migration 041) is the per-mechanic "remove
      // from my Mis Servicios list" flag, separate from deleted_at (which
      // migration 040 locked to Super Admin only). Only THIS query — the
      // mechanic's own panel — filters on it; the public QR history and
      // any other mechanic's view of the same asset intentionally do not.
      .is("hidden_from_panel_at", null)
      .order("service_date", { ascending: false });
    setServices((data as unknown as ServiceRow[]) ?? []);

    // Facu (21 jul 2026): which rows already have a pending "solicitar
    // borrado al admin" request filed — see migration 042. RLS on
    // service_delete_requests only lets a mechanic SELECT their own rows,
    // so this is already scoped without needing a .eq("requested_by", uid)
    // (kept anyway for clarity and as a second line of defense).
    const { data: pendingRequests } = await supabase
      .from("service_delete_requests")
      .select("service_record_id")
      .eq("requested_by", uid)
      .eq("status", "pending");
    setPendingDeleteRequestIds(new Set((pendingRequests ?? []).map((r: { service_record_id: string }) => r.service_record_id)));

    setLoading(false);
  }

  async function loadAssets(uid: string) {
    // 26 jul 2026: antes esto sólo traía `assets` con created_by = uid, así
    // que un activo vinculado o compartido por otro Maintler (migration 029)
    // no aparecía acá — ni en el tile "Activos" ni en el selector "por
    // activo" — aunque sí se le pudieran registrar servicios. Ahora usa la
    // misma fuente (mechanic_assets, todo el taller) y el mismo criterio de
    // soft-delete que la página Activos, para que "Activos" signifique lo
    // mismo en toda la app (ver auditoría de métricas cruzadas).
    const { data } = await supabase
      .from("mechanic_assets")
      .select("assets(id, nickname, brand, model, asset_type, customer_id, deleted_at)")
      .eq("mechanic_id", uid)
      .order("added_at", { ascending: false });
    const opts = ((data ?? []) as any[])
      .map((row) => {
        const a = Array.isArray(row.assets) ? row.assets[0] : row.assets;
        if (!a || a.deleted_at) return null;
        return a as AssetOption;
      })
      .filter(Boolean) as AssetOption[];
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

      // Facu (26 jul 2026, revisión de rendimiento): el perfil propio se
      // pedía antes que las otras 3 cargas, en fila — ahora las 4 van
      // juntas, ninguna depende de otra.
      const [{ data: mechanic }] = await Promise.all([
        supabase
          .from("mechanics").select("name, photo_url, maintler_code").eq("id", session.user.id).maybeSingle(),
        loadServices(session.user.id),
        loadAssets(session.user.id),
        loadCustomers(session.user.id),
      ]);
      if (active && mechanic) { setMechanicName(mechanic.name); setMechanicPhoto(mechanic.photo_url ?? ""); setMaintlerCode(mechanic.maintler_code ?? ""); }
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
    resetForm();
    setShowForm(true);
  }

  async function fetchMinKmHours(assetId: string) {
    if (!assetId) { setMinKmHours(null); return; }
    minKmHoursAssetIdRef.current = assetId;
    setMinKmHoursLoading(true);
    const { data } = await supabase
      .from("service_records")
      .select("km_hours")
      .eq("asset_id", assetId)
      .is("deleted_at", null)
      .not("km_hours", "is", null)
      .order("km_hours", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (minKmHoursAssetIdRef.current !== assetId) return;
    setMinKmHours(data?.km_hours ?? null);
    setMinKmHoursLoading(false);
  }

  useEffect(() => {
    if (showForm && svcAssetId) fetchMinKmHours(svcAssetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, svcAssetId]);

  useEffect(() => {
    if (!showForm || !svcAssetId) return;
    const asset = assetOptions.find((a) => a.id === svcAssetId);
    setSvcCustomerId(asset?.customer_id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, svcAssetId]);

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    setSvcError("");
    if (!svcAssetId) { setSvcError(t("errorSelectAsset")); return; }

    if (svcKmHours && minKmHours != null && parseFloat(svcKmHours) < minKmHours) {
      const svcUnit = unitLabel(assetOptions.find((a) => a.id === svcAssetId)?.asset_type);
      setSvcError(t("errorKmTooLow", { unit: svcUnit, value: minKmHours.toLocaleString() }));
      return;
    }

    // Facu (19 jul 2026): "qué pasa si una persona por hacer bromas o daño
    // escribe cosas impropias?" — since a service can no longer be edited
    // once saved (see comment above viewRow), catching this at save time
    // is the only chance to keep obviously inappropriate text out of a
    // permanent record. Blocks the save outright rather than saving-and-
    // flagging, per his call.
    if (containsInappropriateContent(svcNotes)) {
      setSvcError(t("errorInappropriateContent"));
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
      setReminderError(t("errorDatePast"));
      return;
    }

    if (reminderKm && reminderMinKm != null && parseFloat(reminderKm) < reminderMinKm) {
      const remUnit = unitLabel(getAsset(reminderRow)?.asset_type);
      setReminderError(t("errorReminderKmTooLow", { unit: remUnit, value: reminderMinKm.toLocaleString() }));
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
      setReminderError(t("errorSaveFailed"));
      return;
    }

    setReminderRow(null);
    await loadServices(mechanicId);
  }

  function handleOpenView(row: ServiceRow) {
    setViewRow(row);
    setOpenMenuRowId(null);
  }

  function handleOpenHide(row: ServiceRow) {
    setHideRow(row);
    setHideError("");
    setOpenMenuRowId(null);
  }

  // Sets hidden_from_panel_at, never deleted_at — see the comment above
  // hideRow's declaration. Only affects this mechanic's own "Mis
  // Servicios" list; the record itself is untouched everywhere else.
  async function handleConfirmHide() {
    if (!hideRow) return;
    setHideSaving(true);
    setHideError("");
    const { error } = await supabase
      .from("service_records")
      .update({ hidden_from_panel_at: new Date().toISOString() })
      .eq("id", hideRow.id);
    setHideSaving(false);
    if (error) { setHideError(error.message); return; }
    setHideRow(null);
    await loadServices(mechanicId);
  }

  // Facu (17 jul 2026): the Status filter isn't a new concept — every
  // logged service IS "completed" (it already happened, hence the green
  // Estado badge on every row), but whether it still has an open reminder
  // attached is exactly what the Recordatorio column already tracks. So
  // "Completado" = no pending reminder, "Programado" = has one and it's
  // not overdue yet, "Vencido" = overdue. Same computeReminderStatus this
  // page already used for the Recordatorio pill.
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return services.filter(row => {
      const asset = getAsset(row);
      if (filterAsset !== "all" && asset?.id !== filterAsset) return false;
      if (filterType !== "all" && row.service_type !== filterType) return false;

      if (filterStatus !== "all") {
        const hasReminder = row.next_due_date != null || row.next_due_km_hours != null;
        const status = computeReminderStatus({
          nextDueDate: row.next_due_date,
          nextDueKmHours: row.next_due_km_hours,
          currentKmHours: currentKmHoursForAsset(asset?.id),
        });
        if (filterStatus === "overdue" && status !== "overdue") return false;
        if (filterStatus === "scheduled" && !(hasReminder && status !== "overdue")) return false;
        if (filterStatus === "completed" && hasReminder) return false;
      }

      if (q) {
        const label = (asset?.nickname || [asset?.brand, asset?.model].filter(Boolean).join(" ") || "").toLowerCase();
        const qr = (assetQrCode(asset) ?? "").toLowerCase();
        const plate = (asset?.plate ?? "").toLowerCase();
        const model = (asset?.model ?? "").toLowerCase();
        const notes = (row.notes ?? "").toLowerCase();
        const haystack = `${label} ${qr} ${plate} ${model} ${notes}`;
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [services, filterAsset, filterType, filterStatus, searchQuery]);

  // Facu (17 jul 2026): "no quiero scrollear la página sino que deberíamos
  // usar esa forma como hicimos antes en el panel con los activos,
  // flechitas para movernos" — same paginate-instead-of-scroll approach as
  // the dashboard's "Tus activos" carousel. First tried 10/page, but with
  // the taller Stripe-style rows that still needed a scroll to see the last
  // couple — dropped to 7, matching how many rows actually fit on screen
  // without scrolling per his own screenshot.
  const SERVICES_PAGE_SIZE = 7;
  const [servicesPage, setServicesPage] = useState(0);
  const servicesTotalPages = Math.max(1, Math.ceil(filtered.length / SERVICES_PAGE_SIZE));
  const safeServicesPage = Math.min(servicesPage, servicesTotalPages - 1);
  const paginatedServices = filtered.slice(safeServicesPage * SERVICES_PAGE_SIZE, safeServicesPage * SERVICES_PAGE_SIZE + SERVICES_PAGE_SIZE);

  // Jump back to page 1 whenever a filter or the search box changes —
  // otherwise picking a filter while sitting on, say, page 4 could land on
  // an empty page even though the new filtered set has plenty of results.
  useEffect(() => {
    setServicesPage(0);
  }, [filterAsset, filterType, filterStatus, searchQuery]);

  // Facu (26 jul 2026): "me meti en mis servicios o en codigos qr y le paso
  // el dedo y nada. si funciona con activos" — same swipe-to-change-page
  // gesture as Mis Activos, now wired up here too (arrow buttons on this
  // page don't wrap around at the ends, so the swipe mirrors that with
  // Math.max/Math.min instead of the modulo wraparound used elsewhere).
  const servicesTouchStartX = useRef<number | null>(null);
  function handleServicesTouchStart(e: React.TouchEvent) {
    servicesTouchStartX.current = e.touches[0].clientX;
  }
  function handleServicesTouchEnd(e: React.TouchEvent) {
    if (servicesTouchStartX.current === null || servicesTotalPages <= 1) return;
    const deltaX = e.changedTouches[0].clientX - servicesTouchStartX.current;
    servicesTouchStartX.current = null;
    const SWIPE_THRESHOLD = 40;
    if (deltaX > SWIPE_THRESHOLD) {
      setServicesPage((p) => Math.max(0, p - 1));
    } else if (deltaX < -SWIPE_THRESHOLD) {
      setServicesPage((p) => Math.min(servicesTotalPages - 1, p + 1));
    }
  }

  // ── Summary tiles (Activos / Servicios / Programados / Vencidos) ──
  // Facu (17 jul 2026): "eso convierte la pantalla en un pequeño dashboard"
  // — counts are over the FULL unfiltered `services` list (not `filtered`),
  // same convention as the dashboard home page's own summary tiles, so
  // these numbers don't shift around as someone types into the search box.
  const summaryTiles = useMemo(() => {
    let scheduled = 0;
    let overdue = 0;
    for (const row of services) {
      const asset = getAsset(row);
      const hasReminder = row.next_due_date != null || row.next_due_km_hours != null;
      if (!hasReminder) continue;
      const status = computeReminderStatus({
        nextDueDate: row.next_due_date,
        nextDueKmHours: row.next_due_km_hours,
        currentKmHours: currentKmHoursForAsset(asset?.id),
      });
      if (status === "overdue") overdue++;
      else scheduled++;
    }
    return { assets: assetOptions.length, services: services.length, scheduled, overdue };
  }, [services, assetOptions]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">{t("loadingAuth")}</p>
      </div>
    );
  }

  const svcAssetType = assetOptions.find((a) => a.id === svcAssetId)?.asset_type;

  return (
    <div className="h-dvh bg-zinc-50 flex relative overflow-hidden">

      <DashboardSidebarIntl
        activeHref="/dashboard/services"
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        mechanicId={mechanicId}
        unreadMessages={unreadMessages}
        unreadMechanicMessages={unreadMechanicMessages}
        photoUrl={mechanicPhoto}
        name={mechanicName}
        email={mechanicEmail}
      />

      {/* ════ MAIN ════ */}
      <div className="flex-1 flex flex-col min-w-0">

        <DashboardHeaderIntl
          title={t("title")}
          subtitle={t("subtitle")}
          onOpenSidebar={() => setSidebarOpen(true)}
          mechanicId={mechanicId}
          unreadMessages={unreadMessages}
          unreadMechanicMessages={unreadMechanicMessages}
          photoUrl={mechanicPhoto}
          name={mechanicName}
          email={mechanicEmail}
          maintlerCode={maintlerCode}
          onLogout={handleLogout}
        />

        {/* Facu (17 jul 2026): "el espacio que hay entre la barra de arriba
            y los rectángulos de Activos... sigue siendo grande" — this
            container still had the old p-7 (28px) desktop padding from
            before the rest of the app got tightened up. Matches the
            dashboard home page's own p-4/p-5 convention now. */}
        {/* Facu (21 jul 2026): medido con la consola — este contenedor
            sobraba 83px respecto al alto visible, suficiente para que
            apareciera la barra de scroll de Chrome incluso con el resto
            del dashboard ya sin ese problema. Recortado en varios lugares
            a la vez (este padding, los 2 "mb-5" de abajo, y el padding
            vertical de las filas de la tabla) en vez de un solo cambio
            grande, para no perder legibilidad en ningún punto puntual. */}
        <div className="flex-1 overflow-y-auto px-3 md:px-4 pt-1.5 md:pt-2 pb-2 md:pb-3">

          {/* ── Summary tiles ── Facu (17 jul 2026): "quiero que se vea igual
              a esto" — matching his reference screenshot exactly this time:
              full-width grid, each tile tinted with its own soft color
              (not plain white), solid-color icon circle, label on top in
              regular gray, big bold number below. */}
          {/* Facu (17 jul 2026): "hay demasiado espacio entre rectángulos...
              llevalo a 4" — tightened the grid gap down to 4px. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1 mb-3">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0"><Box size={18} /></div>
              <div><p className="text-[12.5px] text-zinc-500 leading-tight">{t("tileAssets")}</p><p className="text-[21px] font-black text-zinc-900 leading-tight">{summaryTiles.assets}</p></div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0"><ClipboardList size={18} /></div>
              <div><p className="text-[12.5px] text-zinc-500 leading-tight">{t("tileServices")}</p><p className="text-[21px] font-black text-zinc-900 leading-tight">{summaryTiles.services}</p></div>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0"><CalendarClock size={18} /></div>
              <div><p className="text-[12.5px] text-zinc-500 leading-tight">{t("tileScheduled")}</p><p className="text-[21px] font-black text-zinc-900 leading-tight">{summaryTiles.scheduled}</p></div>
            </div>
            <div className="rounded-2xl border border-red-100 bg-red-50/60 px-4 py-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0"><AlertTriangle size={18} /></div>
              <div><p className="text-[12.5px] text-zinc-500 leading-tight">{t("tileOverdue")}</p><p className="text-[21px] font-black text-zinc-900 leading-tight">{summaryTiles.overdue}</p></div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
              {/* Facu (17 jul 2026): "es probablemente lo primero que haría
                  un usuario con 300 servicios" — searches asset name, QR
                  code, plate/matrícula, model and notes all at once. */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="w-[230px] rounded-xl border border-zinc-200 bg-white pl-8 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400"
                />
              </div>
              <select
                value={filterAsset}
                onChange={(e) => setFilterAsset(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-[9px] text-[12px] outline-none focus:border-red-400"
              >
                <option value="all">{t("allAssets")}</option>
                {assetOptions.map(a => <option key={a.id} value={a.id}>{assetLabel(a)}</option>)}
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-[9px] text-[12px] outline-none focus:border-red-400"
              >
                <option value="all">{t("allTypes")}</option>
                {SERVICE_TYPE_ORDER.map(ty => <option key={ty} value={ty}>{tServiceTypes(SERVICE_TYPE_KEYS[ty])}</option>)}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-[9px] text-[12px] outline-none focus:border-red-400"
              >
                <option value="all">{t("allStatuses")}</option>
                <option value="completed">{t("filterStatusCompleted")}</option>
                <option value="scheduled">{t("filterStatusScheduled")}</option>
                <option value="overdue">{t("filterStatusOverdue")}</option>
              </select>
            </div>
            {/* Facu (17 jul 2026): "lo haría un poquito más grande y con más
                aire" — bumped padding up from the original 4/10px. */}
            <button
              onClick={handleOpenAddService}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white text-[13.5px] font-bold px-5 py-[13px] rounded-xl shadow-sm shrink-0"
            >
              <Plus size={17} /> {t("addService")}
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
            {loading ? (
              <p className="text-[13px] text-zinc-400 text-center py-12">{t("loadingServices")}</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-red-100 bg-red-50 mb-3">
                  <Wrench size={20} className="text-red-500" />
                </div>
                <p className="text-[13px] text-zinc-400 mb-3">{t("noServicesFound")}</p>
                <button
                  onClick={handleOpenAddService}
                  className="text-[12px] font-bold text-red-600 hover:text-red-700"
                >
                  {t("logFirstService")}
                </button>
              </div>
            ) : (
              <div
                className="overflow-x-auto overscroll-x-contain touch-pan-y relative"
                onTouchStart={handleServicesTouchStart}
                onTouchEnd={handleServicesTouchEnd}
              >
              {openMenuRowId && (
                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuRowId(null)} />
              )}
              <table className="w-full min-w-[780px]">
                <thead>
                  <tr className="text-left text-[10px] text-zinc-400 font-bold uppercase border-b border-zinc-100">
                    <th className="px-5 py-3 font-bold">{t("columnAsset")}</th>
                    <th className="px-3 py-3 font-bold">{t("columnDate")}</th>
                    <th className="px-3 py-3 font-bold">{t("columnServiceType")}</th>
                    <th className="px-3 py-3 font-bold">{t("columnReading")}</th>
                    <th className="px-3 py-3 font-bold">{t("columnStatus")}</th>
                    <th className="px-3 py-3 font-bold">{t("columnReminder")}</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedServices.map((row, rowIdx) => {
                    // Facu (22 jul 2026): "cuando toco en los 3 puntitos el
                    // cartelito que se abre me hace tener que escrolear hacia
                    // abajo... sobre todo los de abajo" — the menu always
                    // opened downward from the button, so on the last couple
                    // rows of the page it got clipped below the visible
                    // table and forced a scroll to see the rest of it. For
                    // the last 3 rows of the current page, open it upward
                    // instead so it always lands fully on screen.
                    const openMenuUpward = rowIdx >= paginatedServices.length - 3;
                    const asset = getAsset(row);
                    const photo = asset?.photo_url ?? null;
                    const img = asset ? assetTypeImg[asset.asset_type] ?? "/images/car.png" : "/images/car.png";
                    const label = asset?.nickname || [asset?.brand, asset?.model].filter(Boolean).join(" ") || t("unknownAsset");
                    const qrCode = assetQrCode(asset);
                    const hasReminder = row.next_due_date != null || row.next_due_km_hours != null;
                    const reminderStatus = computeReminderStatus({
                      nextDueDate: row.next_due_date,
                      nextDueKmHours: row.next_due_km_hours,
                      currentKmHours: currentKmHoursForAsset(asset?.id),
                    });
                    const rc = REMINDER_STATUS_COLOR[reminderStatus];
                    return (
                      <tr
                        key={row.id}
                        // Facu (17 jul 2026): "el mismo service sea un
                        // botón... uno no tenga que tocar los 3 puntos para
                        // ir a ver el service" — the whole row now opens the
                        // View modal on click. The reminder bell and the
                        // actions column each stop propagation (below) so
                        // clicking THEM fires their own action instead of
                        // also opening View underneath.
                        onClick={() => handleOpenView(row)}
                        className="border-t border-zinc-100 hover:bg-zinc-50/50 transition-colors cursor-pointer"
                      >
                        {/* Facu (17 jul 2026): "en vez de icono + nombre +
                            número de serie, haría icono + nombre, y abajo QR
                            #### en gris claro" — plus a real photo instead of
                            a generic icon when the asset has one uploaded. */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                              {photo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={photo} alt={label} className="w-full h-full object-cover" />
                              ) : (
                                <Image src={img} alt={label} width={28} height={28} className="object-contain" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[12.5px] font-bold text-zinc-800 leading-tight truncate">{label}</p>
                              <p className="text-[10px] text-zinc-400 leading-tight font-mono">{qrCode ? t("qrLabel", { code: qrCode }) : ""}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[12px] text-zinc-700 whitespace-nowrap">{formatDateDMY(row.service_date)}</td>
                        <td className="px-3 py-3">
                          <span className={`text-[10.5px] font-semibold px-2 py-[3px] rounded-full whitespace-nowrap ${typeColors[row.service_type] ?? "bg-zinc-100 text-zinc-700"}`}>
                            {tServiceTypes(SERVICE_TYPE_KEYS[row.service_type] ?? "other")}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[12px] text-zinc-700 font-medium whitespace-nowrap">{unitValue(row.km_hours, asset?.asset_type)}</td>
                        {/* Facu (17 jul 2026): "yo haría un badge... más
                            compacto" — same pill shape as the Recordatorio
                            and service-type badges instead of a bare icon +
                            text row. */}
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-[3px] rounded-full bg-green-100 text-green-700 whitespace-nowrap">
                            <CheckCircle2 size={11} /> {t("completed")}
                          </span>
                        </td>
                        {/* Facu (17 jul 2026): "la mayoría dice — Configurar,
                            eso ensucia mucho... yo pondría solamente un
                            icono" — gray bell if nothing's set, colored bell
                            + short date if it is. */}
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openReminderModal(row)}
                            title={hasReminder ? t("viewEditReminder") : t("setReminder")}
                            className={`inline-flex items-center gap-1 text-[10.5px] font-semibold transition-opacity hover:opacity-70 ${hasReminder ? rc.text : "text-zinc-300"}`}
                          >
                            <Bell size={14} />
                            {hasReminder && row.next_due_date && <span className="whitespace-nowrap">{formatShortDate(row.next_due_date, locale)}</span>}
                          </button>
                        </td>
                        {/* Facu (22 jul 2026): "creo q los 3 puntitos se
                            deberian ver mas, no se notan mucho, solo
                            aparecen cuando les paso el mouse x encima,
                            prefiero q se vean siempre y negros" — reverting
                            the earlier hover-only/gray treatment (17 jul) in
                            favor of always-visible and dark. */}
                        <td className="px-3 py-3 text-right relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setOpenMenuRowId(openMenuRowId === row.id ? null : row.id)}
                            className="text-zinc-900 hover:text-black transition-colors relative z-20"
                          >
                            <MoreVertical size={15} />
                          </button>
                          {openMenuRowId === row.id && (
                            <div className={`absolute right-3 z-20 w-44 bg-white border border-zinc-200 rounded-xl shadow-lg py-1 text-left ${openMenuUpward ? "bottom-9" : "top-9"}`}>
                              <button
                                onClick={() => handleOpenView(row)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
                              >
                                <Eye size={13} className="text-zinc-400" /> {t("actionView")}
                              </button>
                              <button
                                onClick={() => openReminderModal(row)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
                              >
                                <Bell size={13} className="text-zinc-400" />
                                {hasReminder ? t("editReminderMenu") : t("setReminderMenu")}
                              </button>
                              <div className="my-1 border-t border-zinc-100" />
                              {/* Facu (19 jul 2026): "eso sí debería poder
                                  hacer, borrar lo que él quiera porque es su
                                  panel" — deliberately NOT called "Eliminar":
                                  this only clears it from THIS mechanic's own
                                  Mis Servicios, never from the machine. */}
                              <button
                                onClick={() => handleOpenHide(row)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
                              >
                                <Archive size={13} className="text-zinc-400" /> {t("actionRemoveFromPanel")}
                              </button>
                              {/* Facu (21 jul 2026): "un tiempito para
                                  borrarlo antes de que quede fijo... y una
                                  vez pasado ese tiempo, pedirle al admin que
                                  lo borre" — same icon/slot the whole time,
                                  handleOpenDeleteOrRequest decides which of
                                  the two flows it opens (see migration 042).
                                  A row with a pending request already filed
                                  shows as disabled instead of offering the
                                  action again. */}
                              {pendingDeleteRequestIds.has(row.id) ? (
                                <div className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-zinc-300 cursor-default">
                                  <Clock3 size={13} /> {t("deleteRequestPending")}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleOpenDeleteOrRequest(row)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 size={13} />
                                  {isWithinSelfDeleteWindow(row) ? t("actionDelete") : t("actionRequestDelete")}
                                </button>
                              )}
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
            {/* Facu (17 jul 2026): "quiero que se vea igual a esto" — his
                reference has a "Mostrando 10 de 381 servicios" count on the
                left and numbered page buttons ("‹ 1 2 3 4 5 ... 39 ›") on
                the right, not just a plain prev/next + "Página X de Y". */}
            {!loading && filtered.length > 0 && (
              <div className="flex items-center justify-between gap-3 flex-wrap border-t border-zinc-100 px-5 py-2">
                <p className="text-[11.5px] text-zinc-400">
                  {t("showingCount", { shown: paginatedServices.length, total: filtered.length })}
                </p>
                {servicesTotalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setServicesPage((p) => Math.max(0, p - 1))}
                      disabled={safeServicesPage === 0}
                      className="w-7 h-7 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                      aria-label={t("previousPage")}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {getPageList(safeServicesPage + 1, servicesTotalPages).map((p, i) =>
                      p === "..." ? (
                        <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-[11.5px] text-zinc-300">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setServicesPage(p - 1)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[11.5px] font-bold transition-colors ${
                            p === safeServicesPage + 1 ? "bg-red-600 text-white" : "text-zinc-500 hover:bg-zinc-50"
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => setServicesPage((p) => Math.min(servicesTotalPages - 1, p + 1))}
                      disabled={safeServicesPage >= servicesTotalPages - 1}
                      className="w-7 h-7 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                      aria-label={t("nextPage")}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-zinc-400 mt-8">{t("copyright")}</p>
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
                <h2 className="text-[16px] font-black text-zinc-900">{t("modalLogNewService")}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>

            <form onSubmit={handleAddService} className="px-6 py-5 space-y-4">
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("assetLabel")}</label>
                {assetOptions.length === 0 ? (
                  <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] text-amber-700">
                    {t("noAssetsYet")} <Link href="/dashboard/assets" className="font-bold underline">{t("createOneFirst")}</Link>
                  </div>
                ) : (
                  <select value={svcAssetId} onChange={(e) => setSvcAssetId(e.target.value)} required className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500">
                    {assetOptions.map(a => <option key={a.id} value={a.id}>{assetLabel(a)}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("serviceTypeLabel")}</label>
                <select value={svcType} onChange={(e) => setSvcType(e.target.value)} required className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500">
                  {SERVICE_TYPE_ORDER.map(ty => <option key={ty} value={ty}>{tServiceTypes(SERVICE_TYPE_KEYS[ty])}</option>)}
                </select>
              </div>

              <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-3 py-2.5 text-[12px] text-zinc-500">
                {t("serviceDateAutoNote", { date: formatDateDMY(new Date().toISOString().slice(0, 10)) })}
              </div>

              <div>
                <label className="text-[12px] font-bold text-zinc-700">{unitLabel(svcAssetType)}</label>
                <input
                  type="number" min={minKmHours ?? 0} step="0.1"
                  value={svcKmHours} onChange={(e) => setSvcKmHours(e.target.value)}
                  placeholder={t("kmPlaceholder")}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
                {minKmHoursLoading ? (
                  <p className="text-[11px] text-zinc-400 mt-1">{t("checkingLastValue")}</p>
                ) : minKmHours != null ? (
                  <p className="text-[11px] text-zinc-400 mt-1">{t("lastRecorded", { value: unitValue(minKmHours, svcAssetType) })}</p>
                ) : null}
              </div>

              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("notesOptional")}</label>
                <textarea rows={3} value={svcNotes} onChange={(e) => setSvcNotes(e.target.value)} placeholder={t("notesPlaceholder")} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 resize-none" />
              </div>

              <CustomerPickerIntl
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
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">{t("cancel")}</button>
                <button type="submit" disabled={svcSaving || assetOptions.length === 0} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                  {svcSaving ? t("saving") : t("saveService")}
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
                  <h2 className="text-[16px] font-black text-zinc-900 leading-tight">{t("maintenanceReminderTitle")}</h2>
                  {reminderRow && (() => {
                    const a = getAsset(reminderRow);
                    const label = a?.nickname || [a?.brand, a?.model].filter(Boolean).join(" ") || t("unknownAsset");
                    return (
                      <p className="text-[11px] text-zinc-400 truncate">
                        {label} · {tServiceTypes(SERVICE_TYPE_KEYS[reminderRow.service_type] ?? "other")} {t("onDate", { date: formatDateDMY(reminderRow.service_date) })}
                      </p>
                    );
                  })()}
                </div>
              </div>
              <button onClick={() => setReminderRow(null)} className="text-zinc-400 hover:text-zinc-700 shrink-0"><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveReminder} className="px-6 py-5 space-y-4">
              <p className="text-[12px] text-zinc-500 -mt-1">
                {t("setReminderHint")}
              </p>

              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("nextServiceDueDate")}</label>
                <input
                  type="date" min={new Date().toISOString().slice(0, 10)} value={reminderDate} onChange={(e) => setReminderDate(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("nextServiceDueAt", { unit: unitLabel(getAsset(reminderRow)?.asset_type) })}</label>
                <input
                  type="number" min={reminderMinKm ?? 0} step="0.1" value={reminderKm} onChange={(e) => setReminderKm(e.target.value)}
                  placeholder={t("egPlaceholder")}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
                {reminderMinKm != null ? (
                  <p className="text-[11px] text-zinc-400 mt-1">{t("lastRecordedReading", { value: unitValue(reminderMinKm, getAsset(reminderRow)?.asset_type) })}</p>
                ) : (
                  <p className="text-[11px] text-zinc-400 mt-1">{t("noRecordedYet", { unit: unitLabel(getAsset(reminderRow)?.asset_type).toLowerCase() })}</p>
                )}
              </div>

              {reminderError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{reminderError}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setReminderRow(null)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">{t("cancel")}</button>
                <button type="submit" disabled={reminderSaving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                  {reminderSaving ? t("saving") : t("saveReminder")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ VIEW SERVICE MODAL ════ */}
      {/* Facu (17 jul 2026): "las notas las ocultaría... las mostraría
          solamente al abrir el servicio" — this is that "open the service"
          view: read-only, includes notes (not shown in the table anymore). */}
      {viewRow && (() => {
        const asset = getAsset(viewRow);
        const label = asset?.nickname || [asset?.brand, asset?.model].filter(Boolean).join(" ") || t("unknownAsset");
        const qrCode = assetQrCode(asset);
        const hasReminder = viewRow.next_due_date != null || viewRow.next_due_km_hours != null;
        const reminderStatus = computeReminderStatus({
          nextDueDate: viewRow.next_due_date,
          nextDueKmHours: viewRow.next_due_km_hours,
          currentKmHours: currentKmHoursForAsset(asset?.id),
        });
        const rc = REMINDER_STATUS_COLOR[reminderStatus];
        return (
          <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4" onClick={() => setViewRow(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0"><Eye size={15} className="text-zinc-600" /></div>
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-black text-zinc-900 leading-tight truncate">{label}</h2>
                    {qrCode && <p className="text-[11px] text-zinc-400 font-mono">{t("qrLabel", { code: qrCode })}</p>}
                  </div>
                </div>
                <button onClick={() => setViewRow(null)} className="text-zinc-400 hover:text-zinc-700 shrink-0"><X size={18} /></button>
              </div>

              <div className="px-6 py-5 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10.5px] font-semibold px-2 py-[3px] rounded-full ${typeColors[viewRow.service_type] ?? "bg-zinc-100 text-zinc-700"}`}>
                    {tServiceTypes(SERVICE_TYPE_KEYS[viewRow.service_type] ?? "other")}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-[3px] rounded-full bg-green-100 text-green-700">
                    <CheckCircle2 size={11} /> {t("completed")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[12.5px]">
                  <div><p className="text-zinc-400 text-[11px]">{t("columnDate")}</p><p className="font-semibold text-zinc-800">{formatDateDMY(viewRow.service_date)}</p></div>
                  <div><p className="text-zinc-400 text-[11px]">{t("columnReading")}</p><p className="font-semibold text-zinc-800">{unitValue(viewRow.km_hours, asset?.asset_type)}</p></div>
                </div>

                <div>
                  <p className="text-zinc-400 text-[11px] mb-1">{t("notesOptional")}</p>
                  <p className="text-[12.5px] text-zinc-700 whitespace-pre-wrap">{viewRow.notes || t("noNotes")}</p>
                </div>

                <div>
                  <p className="text-zinc-400 text-[11px] mb-1">{t("columnReminder")}</p>
                  {hasReminder ? (
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-[3px] rounded-full ${rc.bg} ${rc.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                      {viewRow.next_due_date ? formatDateDMY(viewRow.next_due_date) : unitValue(viewRow.next_due_km_hours, asset?.asset_type)}
                    </span>
                  ) : (
                    <p className="text-[12.5px] text-zinc-400">{t("statusNone")}</p>
                  )}
                </div>
              </div>

              <div className="px-6 pb-5">
                <button onClick={() => setViewRow(null)} className="w-full border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">{t("close")}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ════ REMOVE FROM PANEL CONFIRM MODAL ════ */}
      {/* Facu (19 jul 2026): NOT the same thing as deleting — copy is
          explicit that the service stays on the machine's history, this
          only clears it from the mechanic's own Mis Servicios list. */}
      {hideRow && (() => {
        const asset = getAsset(hideRow);
        const label = asset?.nickname || [asset?.brand, asset?.model].filter(Boolean).join(" ") || t("unknownAsset");
        return (
          <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4" onClick={() => setHideRow(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
                  <Archive size={17} className="text-amber-600" />
                </div>
                <h2 className="text-[15px] font-black text-zinc-900 mb-1">{t("removeFromPanelConfirmTitle")}</h2>
                <p className="text-[12.5px] text-zinc-500">
                  {t("removeFromPanelConfirmBody", {
                    asset: label,
                    type: tServiceTypes(SERVICE_TYPE_KEYS[hideRow.service_type] ?? "other"),
                    date: formatDateDMY(hideRow.service_date),
                  })}
                </p>
                {hideError && (
                  <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{hideError}</div>
                )}
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setHideRow(null)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">{t("cancel")}</button>
                  <button onClick={handleConfirmHide} disabled={hideSaving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                    {hideSaving ? t("removingFromPanel") : t("actionRemoveFromPanel")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Facu (21 jul 2026): direct self-delete, only reachable within
          SELF_DELETE_WINDOW_MS of logging it (see handleOpenDeleteOrRequest
          and migration 042's matching RLS window — the server enforces the
          same 1-hour cutoff independently of this UI). Unlike "Quitar de
          mis registros", this really does soft-delete the row
          (deleted_at), same as any admin-initiated delete — it's just
          scoped to the mechanic's own honest mistake, in the first hour. */}
      {deleteRow && (() => {
        const asset = getAsset(deleteRow);
        const label = asset?.nickname || [asset?.brand, asset?.model].filter(Boolean).join(" ") || t("unknownAsset");
        return (
          <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4" onClick={() => setDeleteRow(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-5">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-3">
                  <Trash2 size={17} className="text-red-600" />
                </div>
                <h2 className="text-[15px] font-black text-zinc-900 mb-1">{t("deleteConfirmTitle")}</h2>
                <p className="text-[12.5px] text-zinc-500">
                  {t("deleteConfirmBody", {
                    asset: label,
                    type: tServiceTypes(SERVICE_TYPE_KEYS[deleteRow.service_type] ?? "other"),
                    date: formatDateDMY(deleteRow.service_date),
                  })}
                </p>
                {deleteError && (
                  <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{deleteError}</div>
                )}
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setDeleteRow(null)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">{t("cancel")}</button>
                  <button onClick={handleConfirmDelete} disabled={deleteSaving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                    {deleteSaving ? t("deleting") : t("actionDelete")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Facu (21 jul 2026): once the 1-hour window is gone, this is the
          only path left for the mechanic's own mistake — a request the
          admin has to approve before anything actually gets deleted (see
          migration 042 + /api/admin/delete-requests). Never deletes
          anything itself. */}
      {requestRow && (() => {
        const asset = getAsset(requestRow);
        const label = asset?.nickname || [asset?.brand, asset?.model].filter(Boolean).join(" ") || t("unknownAsset");
        return (
          <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4" onClick={() => setRequestRow(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
                  <Clock3 size={17} className="text-amber-600" />
                </div>
                <h2 className="text-[15px] font-black text-zinc-900 mb-1">{t("requestDeleteTitle")}</h2>
                <p className="text-[12.5px] text-zinc-500 mb-3">
                  {t("requestDeleteBody", {
                    asset: label,
                    type: tServiceTypes(SERVICE_TYPE_KEYS[requestRow.service_type] ?? "other"),
                    date: formatDateDMY(requestRow.service_date),
                  })}
                </p>
                <label className="text-[12px] font-bold text-zinc-700">{t("requestDeleteReasonLabel")}</label>
                <textarea
                  rows={3}
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder={t("requestDeleteReasonPlaceholder")}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 resize-none"
                />
                {requestError && (
                  <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{requestError}</div>
                )}
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setRequestRow(null)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">{t("cancel")}</button>
                  <button onClick={handleSubmitDeleteRequest} disabled={requestSaving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                    {requestSaving ? t("sendingRequest") : t("sendDeleteRequest")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
