"use client";

import Image from "next/image";
// My Services isn't migrated yet — keep this one plain next/link.
import Link from "next/link";
import { useEffect, useState } from "react";
// Login is migrated and every router.push()/replace() call on this page
// targets it — safe to use next-intl's locale-aware router.
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  Bell, X,
  Calendar, Gauge, Pencil, Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import DashboardSidebarIntl from "@/components/DashboardSidebarIntl";
import DashboardHeaderIntl from "@/components/DashboardHeaderIntl";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { useUnreadMechanicMessages } from "@/lib/useUnreadMechanicMessages";
import { formatDateDMY } from "@/lib/date";
import { computeReminderStatus, REMINDER_STATUS_COLOR, type ReminderStatus } from "@/lib/reminders";
import { getUnitKind } from "@/lib/units";

const assetTypeImg: Record<string, string> = {
  automotive: "/images/car.png",
  motorcycle: "/images/moto.png",
  generator: "/images/generador.png",
  machinery: "/images/excavator.png",
  marine: "/images/barco.png",
  aviation: "/images/avion.png",
};

// Service type is a DB-stored English enum also read by other, not-yet-
// migrated pages — same enum-translation-key pattern used on the Report
// page: map the raw English value to a translation key instead of touching
// the shared value itself.
const SERVICE_TYPE_KEYS: Record<string, string> = {
  "Oil Change": "oilChange", "Service": "service", "Repair": "repair",
  "Inspection": "inspection", "Filter Change": "filterChange",
  "Tire Change": "tireChange", "Brake Service": "brakeService", "Other": "other",
};

type AssetInfo = {
  id: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  vin_serial: string | null;
  asset_type: string;
};

type ScheduledRow = {
  id: string;
  asset_id: string;
  service_type: string;
  service_date: string;
  next_due_date: string | null;
  next_due_km_hours: number | null;
  assets: AssetInfo | AssetInfo[] | null;
};

function getAsset(row: ScheduledRow): AssetInfo | null {
  if (!row.assets) return null;
  return Array.isArray(row.assets) ? row.assets[0] ?? null : row.assets;
}

const STATUS_ORDER: Record<ReminderStatus, number> = { overdue: 0, due_soon: 1, ok: 2, none: 3 };

export default function ScheduledServicesPage() {
  const t = useTranslations("DashboardScheduledPage");
  const tServiceTypes = useTranslations("ServiceTypes");
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
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ScheduledRow[]>([]);
  const [maxKmByAsset, setMaxKmByAsset] = useState<Record<string, number>>({});

  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | ReminderStatus>("all");

  // Edit modal
  const [editRow, setEditRow] = useState<ScheduledRow | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editKm, setEditKm] = useState("");
  const [editMinKm, setEditMinKm] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const REMINDER_STATUS_LABEL: Record<ReminderStatus, string> = {
    overdue: t("statusOverdue"),
    due_soon: t("statusDueSoon"),
    ok: t("statusOk"),
    none: t("statusNone"),
  };

  function unitLabel(assetType: string | null | undefined) {
    return getUnitKind(assetType) === "horas" ? t("unitHours") : t("unitKm");
  }

  function unitValue(value: number | null | undefined, assetType: string | null | undefined) {
    if (value == null) return "—";
    const short = getUnitKind(assetType) === "horas" ? t("unitShortHours") : t("unitShortKm");
    return `${value.toLocaleString()} ${short}`;
  }

  async function loadScheduled(uid: string) {
    setLoading(true);

    const [{ data: remRows }, { data: kmRows }] = await Promise.all([
      supabase
        .from("service_records")
        .select("id, asset_id, service_type, service_date, next_due_date, next_due_km_hours, assets(id, nickname, brand, model, vin_serial, asset_type)")
        .eq("mechanic_id", uid)
        .or("next_due_date.not.is.null,next_due_km_hours.not.is.null")
        .order("next_due_date", { ascending: true }),
      supabase
        .from("service_records")
        .select("asset_id, km_hours")
        .eq("mechanic_id", uid)
        .not("km_hours", "is", null),
    ]);

    const maxKm: Record<string, number> = {};
    for (const r of (kmRows ?? []) as any[]) {
      if (r.km_hours != null && (maxKm[r.asset_id] == null || r.km_hours > maxKm[r.asset_id])) {
        maxKm[r.asset_id] = r.km_hours;
      }
    }

    setMaxKmByAsset(maxKm);
    setRows((remRows as unknown as ScheduledRow[]) ?? []);
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

      await loadScheduled(session.user.id);
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

  function openEdit(row: ScheduledRow) {
    const asset = getAsset(row);
    setEditRow(row);
    setEditDate(row.next_due_date ?? "");
    setEditKm(row.next_due_km_hours != null ? String(row.next_due_km_hours) : "");
    setEditMinKm(asset ? maxKmByAsset[asset.id] ?? null : null);
    setEditError("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editRow) return;
    setEditError("");

    const todayStr = new Date().toISOString().slice(0, 10);
    if (editDate && editDate < todayStr) {
      setEditError(t("errorDatePast"));
      return;
    }

    if (editKm && editMinKm != null && parseFloat(editKm) < editMinKm) {
      const editUnit = unitLabel(getAsset(editRow)?.asset_type);
      setEditError(t("errorKmTooLow", { unit: editUnit, value: editMinKm.toLocaleString() }));
      return;
    }

    setEditSaving(true);
    const { data, error } = await supabase
      .from("service_records")
      .update({
        next_due_date: editDate || null,
        next_due_km_hours: editKm ? parseFloat(editKm) : null,
      })
      .eq("id", editRow.id)
      .select("id");
    setEditSaving(false);

    if (error) { setEditError(error.message); return; }
    if (!data || data.length === 0) {
      setEditError(t("errorSaveFailed"));
      return;
    }

    setEditRow(null);
    await loadScheduled(mechanicId);
  }

  async function handleClearReminder(row: ScheduledRow) {
    const { error } = await supabase
      .from("service_records")
      .update({ next_due_date: null, next_due_km_hours: null })
      .eq("id", row.id);
    if (!error) await loadScheduled(mechanicId);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">{t("loadingAuth")}</p>
      </div>
    );
  }

  const withStatus = rows.map((row) => {
    const asset = getAsset(row);
    const status = computeReminderStatus({
      nextDueDate: row.next_due_date,
      nextDueKmHours: row.next_due_km_hours,
      currentKmHours: asset ? maxKmByAsset[asset.id] ?? null : null,
    });
    return { row, asset, status };
  }).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const filtered = statusFilter === "all" ? withStatus : withStatus.filter((r) => r.status === statusFilter);

  const overdueCount = withStatus.filter((r) => r.status === "overdue").length;
  const dueSoonCount = withStatus.filter((r) => r.status === "due_soon").length;
  const okCount = withStatus.filter((r) => r.status === "ok").length;

  return (
    <div className="min-h-screen bg-zinc-50 flex relative">

      <DashboardSidebarIntl
        activeHref="/dashboard/scheduled"
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

        <div className="flex-1 overflow-y-auto p-4 md:p-7">

          {/* ── SUMMARY CARDS ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <button
              onClick={() => setStatusFilter(statusFilter === "overdue" ? "all" : "overdue")}
              className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition-all ${statusFilter === "overdue" ? "border-red-400 ring-2 ring-red-100" : "border-zinc-200"}`}
            >
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide">{t("overdue")}</p>
              <p className="text-[26px] font-black text-zinc-900 mt-1">{overdueCount}</p>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === "due_soon" ? "all" : "due_soon")}
              className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition-all ${statusFilter === "due_soon" ? "border-amber-400 ring-2 ring-amber-100" : "border-zinc-200"}`}
            >
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">{t("dueSoon")}</p>
              <p className="text-[26px] font-black text-zinc-900 mt-1">{dueSoonCount}</p>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === "ok" ? "all" : "ok")}
              className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition-all ${statusFilter === "ok" ? "border-green-400 ring-2 ring-green-100" : "border-zinc-200"}`}
            >
              <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide">{t("onTrack")}</p>
              <p className="text-[26px] font-black text-zinc-900 mt-1">{okCount}</p>
            </button>
          </div>

          {statusFilter !== "all" && (
            <button onClick={() => setStatusFilter("all")} className="text-[12px] font-semibold text-zinc-400 hover:text-zinc-700 mb-3">
              {t("clearFilter")}
            </button>
          )}

          {/* ── LIST ── */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
            {loading ? (
              <p className="text-[13px] text-zinc-400 text-center py-12">{t("loadingScheduled")}</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-zinc-100 bg-zinc-50 mb-3">
                  <Bell size={20} className="text-zinc-300" />
                </div>
                <p className="text-[13px] text-zinc-400 mb-1">{statusFilter !== "all" ? t("noScheduledFiltered") : t("noScheduled")}</p>
                <p className="text-[12px] text-zinc-300">
                  {t("setReminderHintPrefix")}{" "}
                  <Link href="/dashboard/services" className="font-bold text-red-500 hover:text-red-600">{t("myServicesLinkLabel")}</Link>
                  {t("setReminderHintSuffix")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {filtered.map(({ row, asset, status }) => {
                  const img = asset ? assetTypeImg[asset.asset_type] ?? "/images/car.png" : "/images/car.png";
                  const label = asset?.nickname || [asset?.brand, asset?.model].filter(Boolean).join(" ") || t("unknownAsset");
                  const sc = REMINDER_STATUS_COLOR[status];
                  return (
                    <div key={row.id} className="flex items-center gap-3 px-5 py-4">
                      <div className="w-10 h-10 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                        <Image src={img} alt={label} width={30} height={30} className="object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-bold text-zinc-800 leading-tight">{label}</p>
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-[2px] rounded-full ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {REMINDER_STATUS_LABEL[status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {row.next_due_date && (
                            <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Calendar size={11} /> {t("duePrefix")} {formatDateDMY(row.next_due_date)}</span>
                          )}
                          {row.next_due_km_hours != null && (
                            <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Gauge size={11} /> {t("dueAtPrefix")} {unitValue(row.next_due_km_hours, asset?.asset_type)}</span>
                          )}
                          <span className="text-[11px] text-zinc-300">
                            {t("fromServiceOn", {
                              serviceType: tServiceTypes(SERVICE_TYPE_KEYS[row.service_type] ?? "other"),
                              date: formatDateDMY(row.service_date),
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(row)}
                          className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title={t("editReminderTitle")}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleClearReminder(row)}
                          className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title={t("clearReminderTitle")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-zinc-400 mt-8">{t("copyright")}</p>
        </div>
      </div>

      {/* ════ EDIT REMINDER MODAL ════ */}
      {editRow && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <Bell size={15} className="text-amber-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[16px] font-black text-zinc-900 leading-tight">{t("editReminderModalTitle")}</h2>
                  {editRow && (() => {
                    const a = getAsset(editRow);
                    const label = a?.nickname || [a?.brand, a?.model].filter(Boolean).join(" ") || t("unknownAsset");
                    return (
                      <p className="text-[11px] text-zinc-400 truncate">
                        {label} · {tServiceTypes(SERVICE_TYPE_KEYS[editRow.service_type] ?? "other")} {t("onDate", { date: formatDateDMY(editRow.service_date) })}
                      </p>
                    );
                  })()}
                </div>
              </div>
              <button onClick={() => setEditRow(null)} className="text-zinc-400 hover:text-zinc-700 shrink-0"><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveEdit} className="px-6 py-5 space-y-4">
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("nextServiceDueDate")}</label>
                <input
                  type="date" min={new Date().toISOString().slice(0, 10)} value={editDate} onChange={(e) => setEditDate(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("nextServiceDueAt", { unit: unitLabel(getAsset(editRow)?.asset_type) })}</label>
                <input
                  type="number" min={editMinKm ?? 0} step="0.1" value={editKm} onChange={(e) => setEditKm(e.target.value)}
                  placeholder={t("egPlaceholder")}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
                {editMinKm != null ? (
                  <p className="text-[11px] text-zinc-400 mt-1">{t("lastRecordedHint", { value: unitValue(editMinKm, getAsset(editRow)?.asset_type) })}</p>
                ) : (
                  <p className="text-[11px] text-zinc-400 mt-1">{t("noRecordedHint", { unit: unitLabel(getAsset(editRow)?.asset_type).toLowerCase() })}</p>
                )}
              </div>

              {editError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{editError}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditRow(null)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">{t("cancel")}</button>
                <button type="submit" disabled={editSaving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                  {editSaving ? t("saving") : t("saveReminder")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
