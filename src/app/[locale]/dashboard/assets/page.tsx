"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  FileText, Box, Plus, X, Copy, Check,
  Wrench, Pencil, History, CheckCircle2, UserCircle2, Camera, Gauge,
  Search, MoreVertical, Trash2, Clock, CalendarClock, ListChecks, ChevronDown,
  QrCode as QrIcon, AlertTriangle,
  Share2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { useUnreadMechanicMessages } from "@/lib/useUnreadMechanicMessages";
import CustomerPickerIntl, { CustomerOption } from "@/components/CustomerPickerIntl";
import { formatDateDMY, daysAgoLabel, daysUntilLabel } from "@/lib/date";
import { computeReminderStatus, ReminderStatus } from "@/lib/reminders";
import { getUnitKind } from "@/lib/units";
import { validateImageFile } from "@/lib/imageValidation";
import NewAssetModalIntl from "@/components/NewAssetModalIntl";
import LinkExistingAssetModalIntl from "@/components/LinkExistingAssetModalIntl";
import ShareAssetModal from "@/components/ShareAssetModal";
import AddAssetChooserIntl from "@/components/AddAssetChooserIntl";
import { assetTypeOptions, fuelTypeOptions, assetTypeImg } from "@/lib/assetTypes";
import { fetchMechanicPublicProfiles } from "@/lib/mechanicPublicProfile";
import DashboardSidebarIntl from "@/components/DashboardSidebarIntl";
import DashboardHeaderIntl from "@/components/DashboardHeaderIntl";

// NOTE: this page's router stays on plain next/navigation's useRouter (not
// @/i18n/navigation) is not strictly required — every router target here is
// "/login" (migrated) — but is left as-is since no locale-aware push/replace
// is needed beyond what plain Link already provides for "/asset/:code" and
// "/asset/:code/report" (both intentionally NOT migrated — see
// src/middleware.ts's matcher comment: exact-segment routes like these stay
// on their own un-migrated route until their own turn).

const SERVICE_TYPE_KEYS: Record<string, string> = {
  "Oil Change": "oilChange", "Service": "service", "Repair": "repair",
  "Inspection": "inspection", "Filter Change": "filterChange",
  "Tire Change": "tireChange", "Brake Service": "brakeService", "Other": "other",
};

const FUEL_TYPE_KEYS: Record<string, string> = {
  Gasoline: "gasoline", Diesel: "diesel", Electric: "electric", Hybrid: "hybrid", Other: "other",
};

const STATUS_RANK: Record<ReminderStatus, number> = { none: 0, ok: 1, due_soon: 2, overdue: 3 };

function assetStatusKey(rs: ReminderStatus): "healthy" | "due_soon" | "overdue" {
  if (rs === "overdue") return "overdue";
  if (rs === "due_soon") return "due_soon";
  return "healthy";
}

const ASSET_STATUS_COLOR: Record<"healthy" | "due_soon" | "overdue", { bg: string; text: string; dot: string }> = {
  healthy:  { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  due_soon: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  overdue:  { bg: "bg-red-100",   text: "text-red-700",   dot: "bg-red-500" },
};

const SERVICE_TYPE_ORDER = ["Oil Change", "Service", "Repair", "Inspection", "Filter Change", "Tire Change", "Brake Service", "Other"];

const typeColors: Record<string, { bg: string; text: string }> = {
  "Oil Change":    { bg: "bg-amber-100",  text: "text-amber-700" },
  Service:         { bg: "bg-blue-100",   text: "text-blue-700" },
  Repair:          { bg: "bg-red-100",    text: "text-red-700" },
  Inspection:      { bg: "bg-purple-100", text: "text-purple-700" },
  "Filter Change": { bg: "bg-green-100",  text: "text-green-700" },
  "Tire Change":   { bg: "bg-cyan-100",   text: "text-cyan-700" },
  "Brake Service": { bg: "bg-orange-100", text: "text-orange-700" },
};

type QrRow = { code: string };

type MechanicInfo = { name: string };

type ServiceRecord = {
  id: string;
  service_date: string;
  service_type: string;
  km_hours: number | null;
  notes: string | null;
  mechanics: MechanicInfo | MechanicInfo[] | null;
};

type AssetRow = {
  id: string;
  asset_type: string;
  brand: string | null;
  model: string | null;
  nickname: string | null;
  vin_serial: string | null;
  year: number | null;
  plate: string | null;
  fuel_type: string | null;
  location: string | null;
  photo_url: string | null;
  created_at: string;
  customer_id: string | null;
  qr_codes: QrRow[] | QrRow | null;
  // Set only when this row landed in my workshop via Share (migration 029)
  // rather than my own scan/creation — drives the "Shared by X" badge.
  sharedByName: string | null;
};

type AssetAgg = {
  lastServiceDate: string | null;
  totalServices: number;
  maxKmHours: number | null;
  nextDueDate: string | null;
  nextDueKmHours: number | null;
  reminderStatus: ReminderStatus;
};

function getQrCode(row: AssetRow): string | null {
  if (!row.qr_codes) return null;
  const q = Array.isArray(row.qr_codes) ? row.qr_codes[0] : row.qr_codes;
  return q?.code ?? null;
}

function formatDate(dateStr: string) {
  return formatDateDMY(dateStr);
}

export default function AssetsPage() {
  const router = useRouter();
  const t = useTranslations("DashboardAssetsPage");
  const tServiceTypes = useTranslations("ServiceTypes");
  const tAssetTypes = useTranslations("AssetTypes");
  const tFuelTypes = useTranslations("FuelTypes");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mechanicId, setMechanicId] = useState("");
  const unreadMessages = useUnreadMessagesCount(mechanicId);
  const unreadMechanicMessages = useUnreadMechanicMessages(mechanicId);
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicPhoto, setMechanicPhoto] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [maintlerCode, setMaintlerCode] = useState("");
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  // ── Service aggregates (last service, total count, max km/hours, worst reminder) per asset ──
  const [assetAgg, setAssetAgg] = useState<Record<string, AssetAgg>>({});

  // ── Search / filter / sort ──
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"last_service" | "name" | "status">("last_service");

  function assetDisplayName(a: AssetRow) {
    return a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || t("unnamedAsset");
  }

  function unitLabel(assetType: string | null | undefined) {
    return getUnitKind(assetType) === "horas" ? t("unitHours") : t("unitKm");
  }

  function unitShort(assetType: string | null | undefined) {
    return getUnitKind(assetType) === "horas" ? t("unitShortHours") : t("unitShortKm");
  }

  const ASSET_STATUS_LABEL: Record<"healthy" | "due_soon" | "overdue", string> = {
    healthy: t("assetStatusHealthy"),
    due_soon: t("assetStatusDueSoon"),
    overdue: t("assetStatusOverdue"),
  };

  // Pre-fill search from a deep link (e.g. the dashboard's top search bar: /dashboard/assets?q=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearchQuery(q);
  }, []);

  // ── Per-card "⋯" menu ──
  const [openCardMenuId, setOpenCardMenuId] = useState<string | null>(null);
  const [qrOpenId, setQrOpenId] = useState<string | null>(null);

  // ── Remove from workshop ──
  const [removeTarget, setRemoveTarget] = useState<AssetRow | null>(null);
  const [removing, setRemoving] = useState(false);

  // ── Share with a saved Maintler (migration 029) ──
  const [shareTarget, setShareTarget] = useState<AssetRow | null>(null);

  // ── Add Equipment flow (choose → new / existing) ──
  // Shared components (also used by the dashboard's own "Add Equipment"
  // button) so creating or linking an asset behaves identically everywhere.
  const [addStep, setAddStep] = useState<"closed" | "choose" | "new" | "existing">("closed");
  const [copiedCode, setCopiedCode] = useState("");
  const copiedCodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  // ── Add Service modal ──
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [svcAssetId, setSvcAssetId] = useState("");
  const [svcType, setSvcType] = useState("Oil Change");
  const [svcKmHours, setSvcKmHours] = useState("");
  const [svcNotes, setSvcNotes] = useState("");
  const [svcCustomerId, setSvcCustomerId] = useState("");
  const [svcSaving, setSvcSaving] = useState(false);
  const [svcError, setSvcError] = useState("");
  const [minKmHours, setMinKmHours] = useState<number | null>(null);
  const [minKmHoursLoading, setMinKmHoursLoading] = useState(false);
  const currentServiceAssetIdRef = useRef<string>("");

  // ── History modal ──
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyAssetName, setHistoryAssetName] = useState("");
  const [historyAssetCode, setHistoryAssetCode] = useState<string | null>(null);
  const [historyAssetType, setHistoryAssetType] = useState<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<ServiceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const currentHistoryAssetIdRef = useRef<string>("");

  // ── Edit Asset modal ──
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [editVin, setEditVin] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editPlate, setEditPlate] = useState("");
  const [editFuelType, setEditFuelType] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string>("");
  const [editCustomerId, setEditCustomerId] = useState("");

  async function loadAssets(uid: string) {
    setLoadingAssets(true);
    // Traer todos los assets del workshop del mecánico (los que creó + los que
    // vinculó + los que otro Maintler le compartió — ver migration 029).
    // "sharer" resuelve el nombre de quien compartió vía shared_by; viene null
    // para cualquier fila que el mecánico agregó por su cuenta (escaneo propio).
    const { data } = await supabase
      .from("mechanic_assets")
      .select("asset_id, shared_by, sharer:mechanics!mechanic_assets_shared_by_fkey(name), assets(id, asset_type, brand, model, nickname, vin_serial, year, plate, fuel_type, location, photo_url, created_at, customer_id, deleted_at, qr_codes(code))")
      .eq("mechanic_id", uid)
      .order("added_at", { ascending: false });
    const assetList = (data ?? [])
      .map((row: any) => {
        const a = Array.isArray(row.assets) ? row.assets[0] : row.assets;
        if (!a) return null;
        // Filtered here (not in the query) because `assets` is an embedded
        // relation through mechanic_assets — see admin's soft-delete
        // migration 031. An asset the admin soft-deleted disappears from
        // the owner's own workshop too, same as it does from public view.
        if (a.deleted_at) return null;
        const sharer = Array.isArray(row.sharer) ? row.sharer[0] : row.sharer;
        return { ...a, sharedByName: row.shared_by ? (sharer?.name ?? t("anotherMaintler")) : null };
      })
      .filter(Boolean);
    setAssets(assetList as unknown as AssetRow[]);
    setLoadingAssets(false);
  }

  async function loadCustomers(uid: string) {
    const { data } = await supabase
      .from("customers")
      .select("id, name, phone, email")
      .eq("mechanic_id", uid)
      .order("name", { ascending: true });
    setCustomers((data as CustomerOption[]) ?? []);
  }

  async function loadServiceAggregates(uid: string) {
    const { data } = await supabase
      .from("service_records")
      .select("asset_id, service_date, km_hours, next_due_date, next_due_km_hours")
      .eq("mechanic_id", uid)
      .is("deleted_at", null);

    type Bucket = {
      dates: string[];
      kms: number[];
      reminders: { date: string | null; km: number | null }[];
    };
    const byAsset: Record<string, Bucket> = {};

    for (const r of (data ?? []) as any[]) {
      if (!r.asset_id) continue;
      if (!byAsset[r.asset_id]) byAsset[r.asset_id] = { dates: [], kms: [], reminders: [] };
      const bucket = byAsset[r.asset_id];
      if (r.service_date) bucket.dates.push(r.service_date);
      if (r.km_hours != null) bucket.kms.push(r.km_hours);
      if (r.next_due_date || r.next_due_km_hours != null) {
        bucket.reminders.push({ date: r.next_due_date ?? null, km: r.next_due_km_hours ?? null });
      }
    }

    const agg: Record<string, AssetAgg> = {};
    for (const assetId of Object.keys(byAsset)) {
      const b = byAsset[assetId];
      const lastServiceDate = b.dates.length ? b.dates.reduce((a, c) => (c > a ? c : a)) : null;
      const maxKmHours = b.kms.length ? Math.max(...b.kms) : null;

      let worstStatus: ReminderStatus = "none";
      let chosenDate: string | null = null;
      let chosenKm: number | null = null;
      for (const rem of b.reminders) {
        const st = computeReminderStatus({ nextDueDate: rem.date, nextDueKmHours: rem.km, currentKmHours: maxKmHours });
        if (STATUS_RANK[st] >= STATUS_RANK[worstStatus]) {
          worstStatus = st;
          chosenDate = rem.date;
          chosenKm = rem.km;
        }
      }

      agg[assetId] = {
        lastServiceDate,
        totalServices: b.dates.length,
        maxKmHours,
        nextDueDate: chosenDate,
        nextDueKmHours: chosenKm,
        reminderStatus: worstStatus,
      };
    }

    setAssetAgg(agg);
  }

  useEffect(() => {
    let active = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      if (!active) return;

      setMechanicId(session.user.id);
      setMechanicEmail(session.user.email ?? "");

      const { data: mechanic } = await supabase
        .from("mechanics")
        .select("name, photo_url, maintler_code")
        .eq("id", session.user.id)
        .single();
      if (active && mechanic) { setMechanicName(mechanic.name); setMechanicPhoto(mechanic.photo_url ?? ""); setMaintlerCode(mechanic.maintler_code ?? ""); }

      await Promise.all([loadAssets(session.user.id), loadServiceAggregates(session.user.id), loadCustomers(session.user.id)]);
      if (active) setCheckingAuth(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);


  async function openAddService(assetId: string) {
    currentServiceAssetIdRef.current = assetId;
    setSvcAssetId(assetId);
    setSvcType("Oil Change");
    setSvcKmHours("");
    setSvcNotes("");
    setSvcCustomerId(assets.find((a) => a.id === assetId)?.customer_id ?? "");
    setSvcError("");
    setMinKmHours(null);
    setShowServiceForm(true);
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
    if (currentServiceAssetIdRef.current !== assetId) return;
    setMinKmHours(data?.km_hours ?? null);
    setMinKmHoursLoading(false);
  }

  async function openHistory(a: AssetRow) {
    currentHistoryAssetIdRef.current = a.id;
    setHistoryAssetName(assetDisplayName(a));
    setHistoryAssetCode(getQrCode(a));
    setHistoryAssetType(a.asset_type);
    setHistoryRecords([]);
    setHistoryLoading(true);
    setShowHistoryModal(true);
    const { data } = await supabase
      .from("service_records")
      .select("id, service_date, service_type, km_hours, notes, mechanic_id")
      .eq("asset_id", a.id)
      .is("deleted_at", null)
      .order("service_date", { ascending: false });
    if (currentHistoryAssetIdRef.current !== a.id) return;
    const rows = (data as unknown as (ServiceRecord & { mechanic_id: string | null })[]) ?? [];
    // An asset can have services logged by OTHER mechanics too (shared/multi-shop
    // assets) — `mechanics` is owner-only now, so their name comes from the
    // public-safe view instead. See lib/mechanicPublicProfile.ts.
    const profiles = await fetchMechanicPublicProfiles(supabase, rows.map((r) => r.mechanic_id));
    if (currentHistoryAssetIdRef.current !== a.id) return;
    setHistoryRecords(rows.map((r) => ({ ...r, mechanics: r.mechanic_id ? profiles.get(r.mechanic_id) ?? null : null })));
    setHistoryLoading(false);
  }

  function openEdit(a: AssetRow) {
    setEditingAsset(a);
    setEditBrand(a.brand ?? "");
    setEditModel(a.model ?? "");
    setEditNickname(a.nickname ?? "");
    setEditVin(a.vin_serial ?? "");
    setEditYear(a.year ? String(a.year) : "");
    setEditPlate(a.plate ?? "");
    setEditFuelType(a.fuel_type ?? "");
    setEditLocation(a.location ?? "");
    setEditPhotoFile(null);
    setEditPhotoPreview(a.photo_url ?? "");
    setEditCustomerId(a.customer_id ?? "");
    setEditError("");
    setShowEditForm(true);
  }

  async function uploadPhoto(file: File, assetId: string): Promise<{ url: string | null; error: string | null }> {
    const validationError = validateImageFile(file);
    if (validationError) return { url: null, error: validationError };
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${assetId}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("asset-photos")
      .upload(path, file, { upsert: true });
    if (uploadError) return { url: null, error: uploadError.message };
    const { data } = supabase.storage.from("asset-photos").getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }

  async function handleEditAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAsset) return;
    setEditError("");

    const currentYear = new Date().getFullYear();
    if (editYear && parseInt(editYear, 10) > currentYear) {
      setEditError(t("errorYearFuture", { year: currentYear }));
      return;
    }

    setEditSaving(true);

    // Facu (16 jul 2026): "cuando me meto en el activo y pongo editar y
    // borro la foto y guardo el cambio no se guarda" — this used to only
    // ever REPLACE photoUrl when a new file was picked (editPhotoFile
    // truthy). Clicking the little X clears editPhotoPreview to "" but
    // leaves editPhotoFile null too, so that branch never ran and
    // photoUrl silently stayed pinned to the old editingAsset.photo_url —
    // the removal was never actually sent to the update() below. Added the
    // missing case: no new file AND the preview is empty means the photo
    // was explicitly removed, so persist null.
    let photoUrl: string | null = editingAsset.photo_url;
    let photoUploadError: string | null = null;
    if (editPhotoFile) {
      const { url, error } = await uploadPhoto(editPhotoFile, editingAsset.id);
      if (url) photoUrl = url;
      else photoUploadError = error ?? t("errorPhotoUploadFailed");
    } else if (!editPhotoPreview) {
      photoUrl = null;
    }

    const { error } = await supabase
      .from("assets")
      .update({
        brand: editBrand.trim() || null,
        model: editModel.trim() || null,
        nickname: editNickname.trim() || null,
        vin_serial: editVin.trim() || null,
        year: editYear ? parseInt(editYear, 10) : null,
        plate: editPlate.trim() || null,
        fuel_type: editFuelType || null,
        location: editLocation.trim() || null,
        photo_url: photoUrl,
        customer_id: editCustomerId || null,
      })
      .eq("id", editingAsset.id);

    setEditSaving(false);

    if (error) {
      setEditError(error.message);
      return;
    }

    if (photoUploadError) {
      setEditError(t("errorSavedButPhotoFailed", { error: photoUploadError }));
      await loadAssets(mechanicId);
      return;
    }

    setShowEditForm(false);
    await loadAssets(mechanicId);
  }

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    setSvcError("");

    if (!svcAssetId) {
      setSvcError(t("errorNoAssetSelected"));
      return;
    }

    if (svcKmHours && minKmHours != null && parseFloat(svcKmHours) < minKmHours) {
      const svcUnit = unitLabel(assets.find((a) => a.id === svcAssetId)?.asset_type);
      setSvcError(t("errorKmTooLow", { unit: svcUnit, value: minKmHours.toLocaleString() }));
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

    if (error) {
      setSvcSaving(false);
      setSvcError(error.message);
      return;
    }

    // Keep the asset's "last known customer" cache in sync.
    const asset = assets.find((a) => a.id === svcAssetId);
    const newCustomerId = svcCustomerId || null;
    if (asset && asset.customer_id !== newCustomerId) {
      await supabase.from("assets").update({ customer_id: newCustomerId }).eq("id", svcAssetId);
      setAssets((prev) => prev.map((a) => (a.id === svcAssetId ? { ...a, customer_id: newCustomerId } : a)));
    }

    setSvcSaving(false);
    setShowServiceForm(false);
    await loadServiceAggregates(mechanicId);
  }

  async function handleRemoveFromWorkshop() {
    if (!removeTarget) return;
    setRemoving(true);
    await supabase
      .from("mechanic_assets")
      .delete()
      .eq("mechanic_id", mechanicId)
      .eq("asset_id", removeTarget.id);
    setRemoving(false);
    setRemoveTarget(null);
    await loadAssets(mechanicId);
    await loadServiceAggregates(mechanicId);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function publicUrl(code: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/asset/${code}`;
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(publicUrl(code));
      setCopiedCode(code);
      if (copiedCodeTimeoutRef.current) clearTimeout(copiedCodeTimeoutRef.current);
      copiedCodeTimeoutRef.current = setTimeout(() => setCopiedCode(""), 1500);
    } catch {
      // ignore
    }
  }

  // Filtered + sorted every render otherwise (this page has a lot of other
  // state — edit-modal fields, etc. — that shouldn't force a full re-filter
  // of the asset list on every keystroke). Declared before the early return
  // below since hooks must run unconditionally on every render.
  const visibleAssets = useMemo(() => {
    return assets
      .filter((a) => {
        if (typeFilter !== "all" && a.asset_type !== typeFilter) return false;
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        const haystack = [assetDisplayName(a), a.brand, a.model, a.vin_serial, a.plate]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((x, y) => {
        if (sortBy === "name") return assetDisplayName(x).localeCompare(assetDisplayName(y));
        if (sortBy === "status") {
          const rx = STATUS_RANK[assetAgg[x.id]?.reminderStatus ?? "none"];
          const ry = STATUS_RANK[assetAgg[y.id]?.reminderStatus ?? "none"];
          return ry - rx;
        }
        const dx = assetAgg[x.id]?.lastServiceDate ?? "";
        const dy = assetAgg[y.id]?.lastServiceDate ?? "";
        return dy.localeCompare(dx);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, typeFilter, searchQuery, sortBy, assetAgg]);

  // Facu (26 jul 2026): "vamos a hacer la misma que en las otras. sacar el
  // escroll... solo hay q dejar 9 activos por pagina y queda barbaro" —
  // same fixed-page-size carousel pattern as "Tus activos" on the
  // dashboard and "Códigos QR", now applied here so the grid never grows
  // taller than the viewport no matter how many assets exist. 9 fits the
  // 3-column grid as exactly 3 full rows.
  const ASSETS_PAGE_SIZE = 9;
  const [assetsPage, setAssetsPage] = useState(0);
  const assetsTotalPages = Math.max(1, Math.ceil(visibleAssets.length / ASSETS_PAGE_SIZE));
  const safeAssetsPage = Math.min(assetsPage, assetsTotalPages - 1);
  const pagedAssets = visibleAssets.slice(safeAssetsPage * ASSETS_PAGE_SIZE, safeAssetsPage * ASSETS_PAGE_SIZE + ASSETS_PAGE_SIZE);
  useEffect(() => {
    setAssetsPage(0);
  }, [searchQuery, typeFilter, sortBy]);

  // Facu (26 jul 2026, pantalla táctil): "paso el dedo sobre los activos
  // para escrolear los 9 q tengo y me muestre la pagina siguiente igual
  // como si tocara la flechita pero no lo hace" — the grid itself isn't a
  // scroll container anymore (pagination replaced the scrollbar), so a
  // finger swipe over the cards did nothing. This reads the swipe
  // direction manually and moves the page the same way the arrow buttons
  // do, only past a distance threshold so it doesn't fire on a normal tap.
  //
  // Follow-up (26 jul 2026): "escroleo para la derecha y bien pero cuando
  // quiero volver me manda a servicios" — one direction worked but the
  // other got hijacked by Chrome's own edge-swipe "go back in history"
  // gesture and actually navigated the browser away to whatever page was
  // previously open (Mis Servicios), instead of just changing our React
  // state. The `touch-pan-y` class on the grid div (below) tells the
  // browser this element owns horizontal touch gestures itself, so it
  // stops treating a sideways swipe here as a back/forward navigation.
  const assetsTouchStartX = useRef<number | null>(null);
  function handleAssetsTouchStart(e: React.TouchEvent) {
    assetsTouchStartX.current = e.touches[0].clientX;
  }
  function handleAssetsTouchEnd(e: React.TouchEvent) {
    if (assetsTouchStartX.current === null || assetsTotalPages <= 1) return;
    const deltaX = e.changedTouches[0].clientX - assetsTouchStartX.current;
    assetsTouchStartX.current = null;
    const SWIPE_THRESHOLD = 40;
    if (deltaX > SWIPE_THRESHOLD) {
      setAssetsPage((p) => (p - 1 + assetsTotalPages) % assetsTotalPages);
    } else if (deltaX < -SWIPE_THRESHOLD) {
      setAssetsPage((p) => (p + 1) % assetsTotalPages);
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">{t("loadingAuth")}</p>
      </div>
    );
  }

  const totalAssets = assets.length;
  let healthyCount = 0;
  let dueSoonCount = 0;
  let overdueCount = 0;
  for (const a of assets) {
    const key = assetStatusKey(assetAgg[a.id]?.reminderStatus ?? "none");
    if (key === "healthy") healthyCount++;
    else if (key === "due_soon") dueSoonCount++;
    else overdueCount++;
  }

  const availableTypes = Array.from(new Set(assets.map((a) => a.asset_type)));
  const svcAssetType = assets.find((a) => a.id === svcAssetId)?.asset_type;

  return (
    <div className="h-dvh bg-zinc-50 flex relative overflow-hidden">

      <DashboardSidebarIntl
        activeHref="/dashboard/assets"
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
          title={t("headerTitle")}
          subtitle={t("headerSubtitle")}
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

        <div className="flex-1 overflow-y-auto px-3 md:px-4 pt-1.5 md:pt-2 pb-1.5 md:pb-2">

          {/* KPI summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-3">
              <p className="text-[11px] font-semibold text-zinc-400 mb-1">{t("totalAssets")}</p>
              <p className="text-[22px] font-black text-zinc-900">{totalAssets}</p>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <p className="text-[11px] font-semibold text-zinc-400">{t("healthy")}</p>
              </div>
              <p className="text-[22px] font-black text-green-600">{healthyCount}</p>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <p className="text-[11px] font-semibold text-zinc-400">{t("dueSoon")}</p>
              </div>
              <p className="text-[22px] font-black text-amber-600">{dueSoonCount}</p>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle size={11} className="text-red-500" />
                <p className="text-[11px] font-semibold text-zinc-400">{t("overdue")}</p>
              </div>
              <p className="text-[22px] font-black text-red-600">{overdueCount}</p>
            </div>
          </div>

          {/* Search / filter / sort + New Asset */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-2">
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full pl-9 pr-3 py-[9px] rounded-xl border border-zinc-200 text-[13px] outline-none focus:border-red-500 bg-white"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              <button
                onClick={() => setTypeFilter("all")}
                className={`shrink-0 px-3 py-[7px] rounded-full text-[12px] font-bold transition-colors ${typeFilter === "all" ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}
              >
                {t("all")}
              </button>
              {availableTypes.map((ty) => (
                <button
                  key={ty}
                  onClick={() => setTypeFilter(ty)}
                  className={`shrink-0 px-3 py-[7px] rounded-full text-[12px] font-bold transition-colors ${typeFilter === ty ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}
                >
                  {tAssetTypes(ty)}
                </button>
              ))}
            </div>
            <div className="relative shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "last_service" | "name" | "status")}
                className="appearance-none pl-3 pr-8 py-[9px] rounded-xl border border-zinc-200 text-[12px] font-bold text-zinc-600 outline-none focus:border-red-500 bg-white"
              >
                <option value="last_service">{t("sortLastServiced")}</option>
                <option value="name">{t("sortName")}</option>
                <option value="status">{t("sortStatus")}</option>
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            </div>
            <button
              onClick={() => setAddStep("choose")}
              className="shrink-0 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white text-[13px] font-bold px-4 py-[10px] rounded-xl shadow-sm"
            >
              <Plus size={15} /> {t("addEquipment")}
            </button>
          </div>

          {openCardMenuId && (
            <div className="fixed inset-0 z-10" onClick={() => setOpenCardMenuId(null)} />
          )}

          {loadingAssets ? (
            <p className="text-[13px] text-zinc-400 text-center py-12">{t("loadingAssets")}</p>
          ) : assets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-12 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-red-100 bg-red-50 mb-4">
                <Box size={24} className="text-red-600" />
              </div>
              <h2 className="text-[16px] font-black text-zinc-900 mb-1">{t("noAssetsYetTitle")}</h2>
              <p className="text-[13px] text-zinc-500 mb-5">{t("noAssetsYetDesc")}</p>
              <button
                onClick={() => setAddStep("choose")}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 transition-all text-white text-[13px] font-bold px-5 py-[11px] rounded-xl"
              >
                <Plus size={15} /> {t("addEquipment")}
              </button>
            </div>
          ) : visibleAssets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-12 text-center">
              <p className="text-[13px] text-zinc-500">{t("noAssetsMatch")}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2 gap-3">
                <p className="text-[11.5px] text-zinc-400">
                  {t("showingAssetsCount", { shown: pagedAssets.length, total: visibleAssets.length })}
                </p>
                {assetsTotalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setAssetsPage((p) => (p - 1 + assetsTotalPages) % assetsTotalPages)}
                      aria-label={t("previousPage")}
                      className="w-6 h-6 rounded-full border border-zinc-200 text-zinc-400 hover:text-zinc-700 hover:border-zinc-300 flex items-center justify-center transition-colors"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      onClick={() => setAssetsPage((p) => (p + 1) % assetsTotalPages)}
                      aria-label={t("nextPage")}
                      className="w-6 h-6 rounded-full border border-zinc-200 text-zinc-400 hover:text-zinc-700 hover:border-zinc-300 flex items-center justify-center transition-colors"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            <div
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 touch-pan-y"
              onTouchStart={handleAssetsTouchStart}
              onTouchEnd={handleAssetsTouchEnd}
            >
              {pagedAssets.map((a) => {
                const code = getQrCode(a);
                const label = assetDisplayName(a);
                const imgSrc = assetTypeImg[a.asset_type] ?? "/images/car.png";
                const agg = assetAgg[a.id];
                const statusKey = assetStatusKey(agg?.reminderStatus ?? "none");
                const statusColor = ASSET_STATUS_COLOR[statusKey];
                const qrOpen = qrOpenId === a.id;
                return (
                  <div key={a.id} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4 flex flex-col transition-all duration-200 hover:scale-[1.03] hover:shadow-lg hover:border-zinc-300 hover:z-10">
                    {/* Asset header */}
                    <div className="flex items-center gap-3 mb-2">
                      {/* Photo or icon */}
                      <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {a.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.photo_url} alt={label} className="w-full h-full object-cover" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imgSrc} alt={label} className="w-7 h-7 object-contain" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-zinc-900 leading-tight truncate">{label}</p>
                        {/* Facu (22 jul 2026): "si pongo apodo me muestra el
                            apodo arriba y abajo el vin. deberia aparecer el
                            apodo arriba y la marca y modelo abajo. el vin
                            solo deberia aparecer en caso de no poner apodo"
                            — with a nickname, the subtitle shows brand+model
                            instead of the VIN/plate; without one, `label`
                            above already falls back to brand+model, so the
                            subtitle shows the VIN/plate like before. */}
                        <p className="text-[11px] text-zinc-400 leading-tight truncate">
                          {a.year ? a.year + " · " : ""}
                          {a.nickname ? ([a.brand, a.model].filter(Boolean).join(" ") || "—") : (a.plate || a.vin_serial || "—")}
                        </p>
                        {a.sharedByName && (
                          <p className="text-[10px] text-blue-500 font-semibold leading-tight mt-0.5 flex items-center gap-1">
                            <Share2 size={9} /> {t("sharedBy", { name: a.sharedByName })}
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-[3px] rounded-full ${statusColor.bg} ${statusColor.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`} />
                        {ASSET_STATUS_LABEL[statusKey]}
                      </span>
                      {/* Kebab menu */}
                      <div className="relative shrink-0">
                        <button
                          onClick={() => setOpenCardMenuId(openCardMenuId === a.id ? null : a.id)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors"
                          title={t("moreActions")}
                        >
                          <MoreVertical size={15} />
                        </button>
                        {openCardMenuId === a.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-zinc-200 shadow-lg z-20 py-1">
                            <button
                              onClick={() => { setOpenCardMenuId(null); openEdit(a); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-zinc-600 hover:bg-zinc-50 text-left"
                            >
                              <Pencil size={13} /> {t("editAsset")}
                            </button>
                            <button
                              onClick={() => { setOpenCardMenuId(null); setShareTarget(a); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-zinc-600 hover:bg-zinc-50 text-left"
                            >
                              <Share2 size={13} /> {t("shareEquipment")}
                            </button>
                            <button
                              onClick={() => { setOpenCardMenuId(null); setRemoveTarget(a); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-red-600 hover:bg-red-50 text-left"
                            >
                              <Trash2 size={13} /> {t("removeFromWorkshop")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stat row */}
                    <div className="grid grid-cols-3 gap-2 mb-2 pb-2 border-b border-zinc-100">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 text-zinc-400">
                          <Clock size={11} />
                          <p className="text-[9px] font-semibold uppercase tracking-wide">{t("lastServiced")}</p>
                        </div>
                        <p className="text-[12px] font-bold text-zinc-800 truncate">
                          {agg?.lastServiceDate ? daysAgoLabel(agg.lastServiceDate) : t("noServicesYet")}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 text-zinc-400">
                          <CalendarClock size={11} />
                          <p className="text-[9px] font-semibold uppercase tracking-wide">{t("nextService")}</p>
                        </div>
                        <p className={`text-[12px] font-bold truncate ${statusKey === "overdue" ? "text-red-600" : statusKey === "due_soon" ? "text-amber-600" : "text-zinc-800"}`}>
                          {agg?.nextDueDate
                            ? daysUntilLabel(agg.nextDueDate)
                            : agg?.nextDueKmHours != null
                            ? `${agg.nextDueKmHours.toLocaleString()} ${unitShort(a.asset_type)}`
                            : t("notSet")}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 text-zinc-400">
                          <ListChecks size={11} />
                          <p className="text-[9px] font-semibold uppercase tracking-wide">{t("services")}</p>
                        </div>
                        <button onClick={() => openHistory(a)} className="text-[12px] font-bold text-red-600 hover:text-red-700 truncate">
                          {t("viewCount", { count: agg?.totalServices ?? 0 })}
                        </button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => openHistory(a)}
                        className="flex items-center justify-center gap-1.5 border border-zinc-200 text-zinc-600 hover:bg-zinc-50 active:scale-[0.98] transition-all text-[11px] font-bold py-[6px] rounded-xl"
                      >
                        <History size={12} /> {t("history")}
                      </button>
                      <button
                        onClick={() => openAddService(a.id)}
                        className="flex items-center justify-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 active:scale-[0.98] transition-all text-[11px] font-bold py-[6px] rounded-xl"
                      >
                        <Wrench size={12} /> {t("service")}
                      </button>
                      <button
                        onClick={() => setQrOpenId(qrOpen ? null : a.id)}
                        disabled={!code}
                        className="flex items-center justify-center gap-1.5 border border-zinc-200 text-zinc-600 hover:bg-zinc-50 active:scale-[0.98] transition-all text-[11px] font-bold py-[6px] rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <QrIcon size={12} /> {t("qr")}
                      </button>
                    </div>

                    {/* QR section (collapsible) */}
                    {qrOpen && (
                      code ? (
                        <div className="flex items-center gap-4 pt-3 mt-3 border-t border-zinc-100">
                          <div className="w-20 h-20 rounded-lg border border-zinc-100 bg-white p-1 shrink-0">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(publicUrl(code))}`}
                              alt={`QR ${code}`}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-zinc-400 mb-1">{t("publicLink")}</p>
                            <p className="text-[11px] font-mono text-zinc-600 truncate mb-2">/asset/{code}</p>
                            <button
                              onClick={() => copyLink(code)}
                              className="flex items-center gap-1.5 text-[11px] font-bold text-red-600 hover:text-red-700 mb-2"
                            >
                              {copiedCode === code ? <Check size={12} /> : <Copy size={12} />}
                              {copiedCode === code ? t("copied") : t("copyLink")}
                            </button>
                            <a
                              href={`/asset/${code}/report`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-800"
                            >
                              <FileText size={12} /> {t("viewReport")}
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-amber-600 pt-3 mt-3 border-t border-zinc-100">{t("qrNotGenerated")}</p>
                      )
                    )}
                  </div>
                );
              })}
            </div>
            {visibleAssets.length > ASSETS_PAGE_SIZE && (
              <div className="flex items-center justify-center gap-1.5 mt-4">
                {Array.from({ length: assetsTotalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setAssetsPage(i)}
                    aria-label={`page ${i + 1}`}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === safeAssetsPage ? "bg-red-600" : "bg-zinc-200"}`}
                  />
                ))}
              </div>
            )}
            </>
          )}

          <p className="text-center text-[11px] text-zinc-400 mt-8">{t("copyright")}</p>
        </div>
      </div>

      {/* ════ ADD EQUIPMENT FLOW (shared with the dashboard's own button) ════ */}
      <AddAssetChooserIntl
        open={addStep === "choose"}
        onClose={() => setAddStep("closed")}
        onChooseNew={() => setAddStep("new")}
        onChooseExisting={() => setAddStep("existing")}
      />
      <NewAssetModalIntl
        open={addStep === "new"}
        onClose={() => setAddStep("closed")}
        mechanicId={mechanicId}
        onCreated={() => loadAssets(mechanicId)}
      />
      <LinkExistingAssetModalIntl
        open={addStep === "existing"}
        onClose={() => setAddStep("closed")}
        mechanicId={mechanicId}
        onLinked={() => loadAssets(mechanicId)}
      />

      {/* ════ EDIT ASSET MODAL ════ */}
      {showEditForm && editingAsset && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div>
                <h2 className="text-[16px] font-black text-zinc-900">{t("editAssetTitle")}</h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">{assetDisplayName(editingAsset)}</p>
              </div>
              <button onClick={() => setShowEditForm(false)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>

            <form onSubmit={handleEditAsset} className="px-6 py-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">{t("brand")}</label>
                  <input type="text" value={editBrand} onChange={(e) => setEditBrand(e.target.value)} placeholder={t("brandPlaceholder")} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">{t("model")}</label>
                  <input type="text" value={editModel} onChange={(e) => setEditModel(e.target.value)} placeholder={t("modelPlaceholder")} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
              </div>

              <div className="mb-4">
                <label className="text-[12px] font-bold text-zinc-700">{t("nickname")}</label>
                <input type="text" value={editNickname} onChange={(e) => setEditNickname(e.target.value)} placeholder={t("nicknamePlaceholder")} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">{t("vinSerial")}</label>
                  <input type="text" value={editVin} onChange={(e) => setEditVin(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">{t("year")}</label>
                  <input type="number" max={new Date().getFullYear()} value={editYear} onChange={(e) => setEditYear(e.target.value)} placeholder={t("yearPlaceholder")} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">{t("plate")}</label>
                  <input type="text" value={editPlate} onChange={(e) => setEditPlate(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">{t("fuelType")}</label>
                  <select value={editFuelType} onChange={(e) => setEditFuelType(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500">
                    <option value="">—</option>
                    {fuelTypeOptions.map((f) => <option key={f} value={f}>{tFuelTypes(FUEL_TYPE_KEYS[f] ?? "other")}</option>)}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-[12px] font-bold text-zinc-700">{t("location")}</label>
                <input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder={t("locationPlaceholder")} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
              </div>

              <div className="mb-4">
                <CustomerPickerIntl
                  mechanicId={mechanicId}
                  customers={customers}
                  value={editCustomerId}
                  onChange={setEditCustomerId}
                  onCreated={(c) => setCustomers((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))}
                />
              </div>

              {/* Photo upload / preview */}
              <div className="mb-5">
                <label className="text-[12px] font-bold text-zinc-700">{t("photo")}</label>
                <div className="mt-1 flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer border border-zinc-200 hover:border-red-400 rounded-xl px-4 py-[10px] text-[12px] font-bold text-zinc-600 hover:text-red-600 transition-colors">
                    <Camera size={14} />
                    {editPhotoFile ? t("changePhoto") : editPhotoPreview ? t("replacePhoto") : t("uploadPhoto")}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = "";
                        if (f) {
                          const err = validateImageFile(f);
                          if (err) { setEditError(err); return; }
                        }
                        setEditError("");
                        setEditPhotoFile(f);
                        if (f) setEditPhotoPreview(URL.createObjectURL(f));
                      }}
                    />
                  </label>
                  {editPhotoPreview && (
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-zinc-200 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={editPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setEditPhotoFile(null); setEditPhotoPreview(""); }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-zinc-900/60 rounded-full flex items-center justify-center text-white"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {editError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{editError}</div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowEditForm(false)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">{t("cancel")}</button>
                <button type="submit" disabled={editSaving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                  {editSaving ? t("saving") : t("saveChanges")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ ADD SERVICE MODAL ════ */}
      {showServiceForm && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                  <Wrench size={15} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-[16px] font-black text-zinc-900">{t("logNewService")}</h2>
                  <p className="text-[11px] text-zinc-400 leading-none">{assetDisplayName(assets.find(a => a.id === svcAssetId)!)}</p>
                </div>
              </div>
              <button onClick={() => setShowServiceForm(false)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>

            <form onSubmit={handleAddService} className="px-6 py-5 space-y-4">
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("serviceTypeLabel")}</label>
                <select value={svcType} onChange={(e) => setSvcType(e.target.value)} required className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500">
                  {SERVICE_TYPE_ORDER.map((ty) => <option key={ty} value={ty}>{tServiceTypes(SERVICE_TYPE_KEYS[ty])}</option>)}
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
                  <p className="text-[11px] text-zinc-400 mt-1">{t("lastRecorded", { value: `${minKmHours.toLocaleString()} ${unitShort(svcAssetType)}` })}</p>
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
                <button type="button" onClick={() => setShowServiceForm(false)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">{t("cancel")}</button>
                <button type="submit" disabled={svcSaving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                  {svcSaving ? t("saving") : t("saveService")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ HISTORY MODAL ════ */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center">
                  <History size={15} className="text-zinc-600" />
                </div>
                <div>
                  <h2 className="text-[16px] font-black text-zinc-900">{t("serviceHistory")}</h2>
                  <p className="text-[11px] text-zinc-400 leading-none">{historyAssetName}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {historyAssetCode && (
                  <a
                    href={`/asset/${historyAssetCode}/report`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[12px] font-bold text-red-600 hover:text-red-700"
                  >
                    <FileText size={13} /> {t("viewReport")}
                  </a>
                )}
                <button onClick={() => setShowHistoryModal(false)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="text-center py-10">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-zinc-100 bg-zinc-50 mb-3">
                    <Wrench size={20} className="text-zinc-300" />
                  </div>
                  <p className="text-[13px] text-zinc-400">{t("noRecordsYet")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyRecords.map((svc, idx) => {
                    const tc = typeColors[svc.service_type] ?? { bg: "bg-zinc-100", text: "text-zinc-700" };
                    const isLatest = idx === 0;
                    const mech = Array.isArray(svc.mechanics) ? svc.mechanics[0] : svc.mechanics;
                    return (
                      <div key={svc.id} className="flex gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                        {/* Timeline dot */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isLatest ? "bg-red-600" : "bg-zinc-200"}`}>
                          {isLatest
                            ? <CheckCircle2 size={14} className="text-white" />
                            : <Wrench size={12} className="text-zinc-500" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-[11px] font-bold px-2 py-[2px] rounded-full ${tc.bg} ${tc.text}`}>
                              {tServiceTypes(SERVICE_TYPE_KEYS[svc.service_type] ?? "other")}
                            </span>
                            {isLatest && (
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-[2px] rounded-full">{t("latest")}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[11px] text-zinc-500">{formatDate(svc.service_date)}</span>
                            {svc.km_hours != null && (
                              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                                <Gauge size={10} /> {svc.km_hours.toLocaleString()} {unitShort(historyAssetType)}
                              </span>
                            )}
                          </div>
                          {mech?.name && (
                            <div className="flex items-center gap-1 mt-1">
                              <UserCircle2 size={11} className="text-zinc-400" />
                              <span className="text-[11px] text-zinc-500">{mech.name}</span>
                            </div>
                          )}
                          {svc.notes && (
                            <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed bg-white rounded-lg px-2.5 py-2 border border-zinc-100">{svc.notes}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════ REMOVE FROM WORKSHOP CONFIRM ════ */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                  <Trash2 size={15} className="text-red-600" />
                </div>
                <h2 className="text-[15px] font-black text-zinc-900">{t("removeFromWorkshopTitle")}</h2>
              </div>
              <button onClick={() => setRemoveTarget(null)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>
            <div className="px-6 py-5">
              <p className="text-[13px] text-zinc-600 leading-relaxed">
                {t.rich("removeConfirm", { name: assetDisplayName(removeTarget), b: (chunks) => <span className="font-bold text-zinc-900">{chunks}</span> })}
              </p>
              <div className="flex gap-3 mt-5">
                <button type="button" onClick={() => setRemoveTarget(null)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">{t("cancel")}</button>
                <button
                  type="button"
                  onClick={handleRemoveFromWorkshop}
                  disabled={removing}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]"
                >
                  {removing ? t("removing") : t("remove")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ SHARE EQUIPMENT ════ */}
      <ShareAssetModal
        open={!!shareTarget}
        onClose={() => setShareTarget(null)}
        mechanicId={mechanicId}
        asset={shareTarget ? { id: shareTarget.id, name: assetDisplayName(shareTarget), qrCode: getQrCode(shareTarget) } : null}
        onShared={() => { void loadAssets(mechanicId); }}
      />

    </div>
  );
}
