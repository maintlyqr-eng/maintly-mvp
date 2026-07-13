"use client";

// Scheduled and Services aren't migrated yet — keep this one plain next/link.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
// Login is migrated and every router.push()/replace() call on this page
// targets it — safe to use next-intl's locale-aware router.
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2, Circle, Gauge, Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import DashboardSidebarIntl from "@/components/DashboardSidebarIntl";
import DashboardHeaderIntl from "@/components/DashboardHeaderIntl";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { useUnreadMechanicMessages } from "@/lib/useUnreadMechanicMessages";
import CustomerPickerIntl, { CustomerOption } from "@/components/CustomerPickerIntl";
import { computeReminderStatus, REMINDER_STATUS_COLOR, type ReminderStatus } from "@/lib/reminders";
import { getUnitKind } from "@/lib/units";
import { dateKey, todayKey, buildMonthGrid } from "@/lib/calendarGrid";

const DATE_LOCALE: Record<string, string> = { en: "en-US", es: "es-AR", pt: "pt-BR" };

type AssetInfo = {
  id: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  asset_type: string;
};

type ServiceRow = {
  id: string;
  asset_id: string;
  service_date: string;
  service_type: string;
  next_due_date: string | null;
  next_due_km_hours: number | null;
  assets: AssetInfo | AssetInfo[] | null;
};

type TaskRow = {
  id: string;
  asset_id: string | null;
  title: string;
  notes: string | null;
  task_date: string;
  done: boolean;
  assets: AssetInfo | AssetInfo[] | null;
};

type AssetOption = { id: string; nickname: string | null; brand: string | null; model: string | null };

function getAsset(a: AssetInfo | AssetInfo[] | null): AssetInfo | null {
  if (!a) return null;
  return Array.isArray(a) ? a[0] ?? null : a;
}

// Service type is a DB-stored English enum also read by other, not-yet-
// migrated pages — same enum-translation-key pattern used elsewhere.
const SERVICE_TYPE_KEYS: Record<string, string> = {
  "Oil Change": "oilChange", "Service": "service", "Repair": "repair",
  "Inspection": "inspection", "Filter Change": "filterChange",
  "Tire Change": "tireChange", "Brake Service": "brakeService", "Other": "other",
};

export default function CalendarPage() {
  const t = useTranslations("DashboardCalendarPage");
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

  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => todayKey());

  const WEEKDAY_LABELS = [
    t("weekdaySun"), t("weekdayMon"), t("weekdayTue"), t("weekdayWed"),
    t("weekdayThu"), t("weekdayFri"), t("weekdaySat"),
  ];
  const MONTH_LABELS = [
    t("monthJanuary"), t("monthFebruary"), t("monthMarch"), t("monthApril"),
    t("monthMay"), t("monthJune"), t("monthJuly"), t("monthAugust"),
    t("monthSeptember"), t("monthOctober"), t("monthNovember"), t("monthDecember"),
  ];
  const REMINDER_STATUS_LABEL: Record<ReminderStatus, string> = {
    overdue: t("statusOverdue"),
    due_soon: t("statusDueSoon"),
    ok: t("statusOk"),
    none: t("statusNone"),
  };

  function assetLabel(a: AssetInfo | AssetOption | null) {
    if (!a) return t("unknownAsset");
    return a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || t("unnamedAsset");
  }

  function unitValue(value: number | null | undefined, assetType: string | null | undefined) {
    if (value == null) return "—";
    const short = getUnitKind(assetType) === "horas" ? t("unitShortHours") : t("unitShortKm");
    return `${value.toLocaleString()} ${short}`;
  }

  // Deep link from the Dashboard's mini calendar widget: /dashboard/calendar?date=YYYY-MM-DD
  useEffect(() => {
    if (typeof window === "undefined") return;
    const d = new URLSearchParams(window.location.search).get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setSelectedKey(d);
      const parsed = new Date(d + "T00:00:00");
      if (!isNaN(parsed.getTime())) setViewDate(parsed);
    }
  }, []);

  const [serviceRows, setServiceRows] = useState<ServiceRow[]>([]);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([]);
  const [maxKmByAsset, setMaxKmByAsset] = useState<Record<string, number>>({});
  const [assetOptions, setAssetOptions] = useState<AssetOption[]>([]);

  // Add task form
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssetId, setTaskAssetId] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskCustomerId, setTaskCustomerId] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskError, setTaskError] = useState("");

  async function loadTasks(uid: string) {
    const { data } = await supabase
      .from("calendar_tasks")
      .select("id, asset_id, title, notes, task_date, done, assets(id, nickname, brand, model, asset_type)")
      .eq("mechanic_id", uid)
      .order("created_at", { ascending: true });
    setTaskRows((data as unknown as TaskRow[]) ?? []);
  }

  async function loadAll(uid: string) {
    const { data: svc } = await supabase
      .from("service_records")
      .select("id, asset_id, service_date, service_type, next_due_date, next_due_km_hours, assets(id, nickname, brand, model, asset_type)")
      .eq("mechanic_id", uid)
      .is("deleted_at", null);
    setServiceRows((svc as unknown as ServiceRow[]) ?? []);

    const { data: kmRows } = await supabase
      .from("service_records")
      .select("asset_id, km_hours")
      .eq("mechanic_id", uid)
      .is("deleted_at", null)
      .not("km_hours", "is", null);
    const maxKm: Record<string, number> = {};
    for (const r of (kmRows ?? []) as any[]) {
      if (r.km_hours != null && (maxKm[r.asset_id] == null || r.km_hours > maxKm[r.asset_id])) {
        maxKm[r.asset_id] = r.km_hours;
      }
    }
    setMaxKmByAsset(maxKm);

    const { data: assets } = await supabase
      .from("assets")
      .select("id, nickname, brand, model")
      .eq("created_by", uid)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setAssetOptions((assets as AssetOption[]) ?? []);

    const { data: custRows } = await supabase
      .from("customers")
      .select("id, name, phone, email")
      .eq("mechanic_id", uid)
      .order("name", { ascending: true });
    setCustomers((custRows as CustomerOption[]) ?? []);

    await loadTasks(uid);
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

      await loadAll(session.user.id);
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

  const { servicesByDate, remindersByDate } = useMemo(() => {
    const services: Record<string, { id: string; label: string; type: string; assetId: string }[]> = {};
    const reminders: Record<string, { id: string; label: string; type: string; status: ReminderStatus; kmHours: number | null; assetType: string | null; assetId: string }[]> = {};

    for (const row of serviceRows) {
      const asset = getAsset(row.assets);
      const label = assetLabel(asset);
      (services[row.service_date] ??= []).push({ id: row.id, label, type: row.service_type, assetId: row.asset_id });

      if (row.next_due_date) {
        const status = computeReminderStatus({
          nextDueDate: row.next_due_date,
          nextDueKmHours: row.next_due_km_hours,
          currentKmHours: asset ? maxKmByAsset[asset.id] ?? null : null,
        });
        (reminders[row.next_due_date] ??= []).push({
          id: row.id, label, type: row.service_type, status,
          kmHours: row.next_due_km_hours, assetType: asset?.asset_type ?? null, assetId: row.asset_id,
        });
      }
    }
    return { servicesByDate: services, remindersByDate: reminders };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceRows, maxKmByAsset]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, TaskRow[]> = {};
    for (const tk of taskRows) (map[tk.task_date] ??= []).push(tk);
    return map;
  }, [taskRows]);

  function resetTaskForm() {
    setTaskTitle("");
    setTaskAssetId("");
    setTaskNotes("");
    setTaskCustomerId("");
    setTaskError("");
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) { setTaskError(t("giveTaskTitle")); return; }

    setTaskSaving(true);
    setTaskError("");
    const { data, error } = await supabase
      .from("calendar_tasks")
      .insert({
        mechanic_id: mechanicId,
        asset_id: taskAssetId || null,
        title: taskTitle.trim(),
        notes: taskNotes.trim() || null,
        task_date: selectedKey,
        customer_id: taskCustomerId || null,
      })
      .select("id");
    setTaskSaving(false);

    if (error || !data || data.length === 0) {
      setTaskError(error?.message || t("saveTaskFailed"));
      return;
    }

    resetTaskForm();
    setShowAddTask(false);
    await loadTasks(mechanicId);
  }

  async function handleToggleTask(task: TaskRow) {
    setTaskRows((prev) => prev.map((tk) => (tk.id === task.id ? { ...tk, done: !tk.done } : tk)));
    const { error } = await supabase.from("calendar_tasks").update({ done: !task.done }).eq("id", task.id);
    if (error) await loadTasks(mechanicId);
  }

  async function handleDeleteTask(task: TaskRow) {
    setTaskRows((prev) => prev.filter((tk) => tk.id !== task.id));
    const { error } = await supabase.from("calendar_tasks").delete().eq("id", task.id);
    if (error) await loadTasks(mechanicId);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">{t("loadingAuth")}</p>
      </div>
    );
  }

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const grid = buildMonthGrid(year, month);

  const todayKeyStr = todayKey();

  const selectedTasks = tasksByDate[selectedKey] ?? [];
  const selectedReminders = remindersByDate[selectedKey] ?? [];
  const selectedServices = servicesByDate[selectedKey] ?? [];

  const selectedDateObj = new Date(selectedKey + "T00:00:00");
  const selectedLabel = selectedDateObj.toLocaleDateString(DATE_LOCALE[locale] ?? "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  function goToMonth(delta: number) {
    setViewDate(new Date(year, month + delta, 1));
  }

  function goToToday() {
    const tNow = new Date();
    setViewDate(tNow);
    setSelectedKey(dateKey(tNow.getFullYear(), tNow.getMonth(), tNow.getDate()));
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex relative">

      <DashboardSidebarIntl
        activeHref="/dashboard/calendar"
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
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">

            {/* ── MONTH CALENDAR ── */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                <h2 className="text-[15px] font-black text-zinc-900">{MONTH_LABELS[month]} {year}</h2>
                <div className="flex items-center gap-1.5">
                  <button onClick={goToToday} className="text-[11px] font-bold text-zinc-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors mr-1">
                    {t("today")}
                  </button>
                  <button onClick={() => goToMonth(-1)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-50 transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => goToMonth(1)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-50 transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 border-b border-zinc-100">
                {WEEKDAY_LABELS.map((w, i) => (
                  <div key={i} className="text-center text-[9px] font-bold text-zinc-400 uppercase tracking-wide py-2">{w}</div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {grid.map((cell) => {
                  const tasks = tasksByDate[cell.key] ?? [];
                  const openTasks = tasks.filter((tk) => !tk.done).length;
                  const reminders = remindersByDate[cell.key] ?? [];
                  const services = servicesByDate[cell.key] ?? [];
                  const worstStatus: ReminderStatus | null = reminders.some((r) => r.status === "overdue")
                    ? "overdue"
                    : reminders.some((r) => r.status === "due_soon")
                    ? "due_soon"
                    : reminders.length > 0 ? "ok" : null;
                  const isSelected = cell.key === selectedKey;

                  return (
                    <button
                      key={cell.key}
                      onClick={() => setSelectedKey(cell.key)}
                      className={`relative flex flex-col items-start p-2 h-[74px] border-b border-r border-zinc-50 text-left transition-colors ${
                        cell.inMonth ? "bg-white hover:bg-zinc-50" : "bg-zinc-50/50 hover:bg-zinc-50"
                      } ${isSelected ? "ring-2 ring-inset ring-red-500" : ""}`}
                    >
                      <span className={`text-[12px] font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                        cell.isToday ? "bg-red-600 text-white" : cell.inMonth ? "text-zinc-700" : "text-zinc-300"
                      }`}>
                        {cell.day}
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {openTasks > 0 && (
                          <span className="text-[9px] font-bold text-blue-700 bg-blue-50 rounded px-1 leading-[14px]">
                            {openTasks} {openTasks > 1 ? t("tasksPlural") : t("taskSingular")}
                          </span>
                        )}
                        {worstStatus && (
                          <span className={`text-[9px] font-bold rounded px-1 leading-[14px] ${REMINDER_STATUS_COLOR[worstStatus].bg} ${REMINDER_STATUS_COLOR[worstStatus].text}`}>
                            {t("dueCount", { count: reminders.length })}
                          </span>
                        )}
                        {services.length > 0 && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 rounded px-1 leading-[14px]">{t("doneCount", { count: services.length })}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── DAY DETAIL ── */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 lg:sticky lg:top-7">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{selectedKey === todayKeyStr ? t("today") : ""}</p>
              <h3 className="text-[14px] font-black text-zinc-900 mb-4">{selectedLabel}</h3>

              {/* Planned tasks */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">{t("plannedTasks")}</p>
                  <button
                    onClick={() => { setShowAddTask((v) => !v); resetTaskForm(); }}
                    className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700"
                  >
                    <Plus size={13} /> {t("add")}
                  </button>
                </div>

                {showAddTask && (
                  <form onSubmit={handleAddTask} className="mb-3 p-3 rounded-xl bg-zinc-50 border border-zinc-100 space-y-2">
                    <input
                      value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder={t("taskTitlePlaceholder")}
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-[12px] outline-none focus:border-red-500"
                    />
                    <select
                      value={taskAssetId} onChange={(e) => setTaskAssetId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-[12px] outline-none focus:border-red-500 bg-white"
                    >
                      <option value="">{t("noSpecificAsset")}</option>
                      {assetOptions.map((a) => (
                        <option key={a.id} value={a.id}>{assetLabel(a)}</option>
                      ))}
                    </select>
                    <textarea
                      value={taskNotes} onChange={(e) => setTaskNotes(e.target.value)}
                      placeholder={t("notesOptionalPlaceholder")} rows={2}
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-[12px] outline-none focus:border-red-500 resize-none"
                    />
                    <CustomerPickerIntl
                      mechanicId={mechanicId}
                      customers={customers}
                      value={taskCustomerId}
                      onChange={setTaskCustomerId}
                      onCreated={(c) => setCustomers((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))}
                    />
                    {taskError && <p className="text-[11px] text-red-600 font-semibold">{taskError}</p>}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowAddTask(false)} className="flex-1 text-[12px] font-bold text-zinc-500 hover:bg-zinc-100 py-1.5 rounded-lg transition-colors">{t("cancel")}</button>
                      <button type="submit" disabled={taskSaving} className="flex-1 text-[12px] font-bold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 py-1.5 rounded-lg transition-colors">
                        {taskSaving ? t("savingEllipsis") : t("saveTask")}
                      </button>
                    </div>
                  </form>
                )}

                {selectedTasks.length === 0 ? (
                  <p className="text-[12px] text-zinc-300">{t("noTasksPlanned")}</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedTasks.map((tk) => {
                      const asset = getAsset(tk.assets);
                      return (
                        <div key={tk.id} className="flex items-start gap-2 group">
                          <button onClick={() => handleToggleTask(tk)} className="mt-0.5 shrink-0 text-zinc-300 hover:text-emerald-600 transition-colors">
                            {tk.done ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[12.5px] font-semibold leading-tight ${tk.done ? "text-zinc-300 line-through" : "text-zinc-800"}`}>{tk.title}</p>
                            {asset && <p className="text-[11px] text-zinc-400 truncate">{assetLabel(asset)}</p>}
                          </div>
                          <button onClick={() => handleDeleteTask(tk)} className="shrink-0 opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-600 transition-all">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Due reminders */}
              {selectedReminders.length > 0 && (
                <div className="mb-5">
                  <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide mb-2">{t("dueThisDay")}</p>
                  <div className="space-y-2">
                    {selectedReminders.map((r) => {
                      const sc = REMINDER_STATUS_COLOR[r.status];
                      return (
                        <Link key={r.id} href="/dashboard/scheduled" className="block p-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[12px] font-bold text-zinc-800 truncate">{r.label}</p>
                            <span className={`shrink-0 text-[9px] font-bold px-1.5 py-[2px] rounded-full ${sc.bg} ${sc.text}`}>{REMINDER_STATUS_LABEL[r.status]}</span>
                          </div>
                          <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                            <Wrench size={10} /> {tServiceTypes(SERVICE_TYPE_KEYS[r.type] ?? "other")}
                            {r.kmHours != null && <span className="flex items-center gap-1"><Gauge size={10} /> {unitValue(r.kmHours, r.assetType)}</span>}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Services logged */}
              <div>
                <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide mb-2">{t("servicesLogged")}</p>
                {selectedServices.length === 0 ? (
                  <p className="text-[12px] text-zinc-300">{t("noServicesLoggedDay")}</p>
                ) : (
                  <div className="space-y-2">
                    {selectedServices.map((s) => (
                      <Link key={s.id} href={`/dashboard/services?asset=${s.assetId}`} className="block p-2.5 rounded-xl bg-emerald-50/60 hover:bg-emerald-50 transition-colors">
                        <p className="text-[12px] font-bold text-zinc-800 truncate">{s.label}</p>
                        <p className="text-[11px] text-zinc-500">{tServiceTypes(SERVICE_TYPE_KEYS[s.type] ?? "other")}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-center text-[11px] text-zinc-400 mt-8">{t("copyright")}</p>
        </div>
      </div>
    </div>
  );
}
