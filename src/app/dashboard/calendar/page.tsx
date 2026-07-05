"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings, Bell, X, LogOut, Crown, Menu,
  ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2, Circle, Gauge, Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import HoverAvatar from "@/components/HoverAvatar";
import { formatDateDMY } from "@/lib/date";
import { computeReminderStatus, REMINDER_STATUS_LABEL, REMINDER_STATUS_COLOR, type ReminderStatus } from "@/lib/reminders";
import { formatUnitValue } from "@/lib/units";
import { dateKey, todayKey, buildMonthGrid } from "@/lib/calendarGrid";

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/dashboard" },
  { icon: FileText, label: "My Services", href: "/dashboard/services" },
  { icon: Bell, label: "Scheduled Services", href: "/dashboard/scheduled" },
  { icon: Box, label: "Assets", href: "/dashboard/assets" },
  { icon: QrCode, label: "QR Codes", href: "/dashboard/assets" },
  { icon: Users, label: "Customers", href: "#" },
  { icon: BarChart3, label: "Reports", href: "/dashboard/reports" },
  { icon: CalendarIcon, label: "Calendar", href: "/dashboard/calendar" },
  { icon: Mail, label: "Messages", href: "/dashboard/messages" },
  { icon: FolderOpen, label: "Document Library", href: "#" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

function assetLabel(a: AssetInfo | AssetOption | null) {
  if (!a) return "Unknown asset";
  return a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || "Unnamed asset";
}

export default function CalendarPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mechanicId, setMechanicId] = useState("");
  const unreadMessages = useUnreadMessagesCount(mechanicId);
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicPhoto, setMechanicPhoto] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");

  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => todayKey());

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
      .eq("mechanic_id", uid);
    setServiceRows((svc as unknown as ServiceRow[]) ?? []);

    const { data: kmRows } = await supabase
      .from("service_records")
      .select("asset_id, km_hours")
      .eq("mechanic_id", uid)
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
      .order("created_at", { ascending: false });
    setAssetOptions((assets as AssetOption[]) ?? []);

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
        .from("mechanics").select("name, photo_url").eq("id", session.user.id).single();
      if (active && mechanic) { setMechanicName(mechanic.name); setMechanicPhoto(mechanic.photo_url ?? ""); }

      await loadAll(session.user.id);
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
  }, [serviceRows, maxKmByAsset]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, TaskRow[]> = {};
    for (const t of taskRows) (map[t.task_date] ??= []).push(t);
    return map;
  }, [taskRows]);

  function resetTaskForm() {
    setTaskTitle("");
    setTaskAssetId("");
    setTaskNotes("");
    setTaskError("");
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) { setTaskError("Give the task a short title."); return; }

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
      })
      .select("id");
    setTaskSaving(false);

    if (error || !data || data.length === 0) {
      setTaskError(error?.message || "Couldn't save the task — please try again.");
      return;
    }

    resetTaskForm();
    setShowAddTask(false);
    await loadTasks(mechanicId);
  }

  async function handleToggleTask(task: TaskRow) {
    setTaskRows((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    const { error } = await supabase.from("calendar_tasks").update({ done: !task.done }).eq("id", task.id);
    if (error) await loadTasks(mechanicId);
  }

  async function handleDeleteTask(task: TaskRow) {
    setTaskRows((prev) => prev.filter((t) => t.id !== task.id));
    await supabase.from("calendar_tasks").delete().eq("id", task.id);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">Loading...</p>
      </div>
    );
  }

  const initials = mechanicName.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "ME";

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const grid = buildMonthGrid(year, month);

  const todayKeyStr = todayKey();

  const selectedTasks = tasksByDate[selectedKey] ?? [];
  const selectedReminders = remindersByDate[selectedKey] ?? [];
  const selectedServices = servicesByDate[selectedKey] ?? [];

  const selectedDateObj = new Date(selectedKey + "T00:00:00");
  const selectedLabel = selectedDateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  function goToMonth(delta: number) {
    setViewDate(new Date(year, month + delta, 1));
  }

  function goToToday() {
    const t = new Date();
    setViewDate(t);
    setSelectedKey(dateKey(t.getFullYear(), t.getMonth(), t.getDate()));
  }

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
                item.label === "Calendar"
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
              <h1 className="text-[17px] md:text-[20px] font-black text-zinc-900 truncate">Calendar</h1>
              <p className="hidden sm:block text-[12px] text-zinc-400 truncate">Plan future work and see what happened each day.</p>
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
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">

            {/* ── MONTH CALENDAR ── */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                <h2 className="text-[15px] font-black text-zinc-900">{MONTH_LABELS[month]} {year}</h2>
                <div className="flex items-center gap-1.5">
                  <button onClick={goToToday} className="text-[11px] font-bold text-zinc-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors mr-1">
                    Today
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
                {WEEKDAY_LABELS.map((w) => (
                  <div key={w} className="text-center text-[9px] font-bold text-zinc-400 uppercase tracking-wide py-2">{w}</div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {grid.map((cell) => {
                  const tasks = tasksByDate[cell.key] ?? [];
                  const openTasks = tasks.filter((t) => !t.done).length;
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
                          <span className="text-[9px] font-bold text-blue-700 bg-blue-50 rounded px-1 leading-[14px]">{openTasks} task{openTasks > 1 ? "s" : ""}</span>
                        )}
                        {worstStatus && (
                          <span className={`text-[9px] font-bold rounded px-1 leading-[14px] ${REMINDER_STATUS_COLOR[worstStatus].bg} ${REMINDER_STATUS_COLOR[worstStatus].text}`}>
                            {reminders.length} due
                          </span>
                        )}
                        {services.length > 0 && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 rounded px-1 leading-[14px]">{services.length} done</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── DAY DETAIL ── */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 lg:sticky lg:top-7">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{selectedKey === todayKeyStr ? "Today" : ""}</p>
              <h3 className="text-[14px] font-black text-zinc-900 mb-4">{selectedLabel}</h3>

              {/* Planned tasks */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">Planned tasks</p>
                  <button
                    onClick={() => { setShowAddTask((v) => !v); resetTaskForm(); }}
                    className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700"
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>

                {showAddTask && (
                  <form onSubmit={handleAddTask} className="mb-3 p-3 rounded-xl bg-zinc-50 border border-zinc-100 space-y-2">
                    <input
                      value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="e.g. Oil change for Ford F-150"
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-[12px] outline-none focus:border-red-500"
                    />
                    <select
                      value={taskAssetId} onChange={(e) => setTaskAssetId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-[12px] outline-none focus:border-red-500 bg-white"
                    >
                      <option value="">No specific asset</option>
                      {assetOptions.map((a) => (
                        <option key={a.id} value={a.id}>{assetLabel(a)}</option>
                      ))}
                    </select>
                    <textarea
                      value={taskNotes} onChange={(e) => setTaskNotes(e.target.value)}
                      placeholder="Notes (optional)" rows={2}
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-[12px] outline-none focus:border-red-500 resize-none"
                    />
                    {taskError && <p className="text-[11px] text-red-600 font-semibold">{taskError}</p>}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowAddTask(false)} className="flex-1 text-[12px] font-bold text-zinc-500 hover:bg-zinc-100 py-1.5 rounded-lg transition-colors">Cancel</button>
                      <button type="submit" disabled={taskSaving} className="flex-1 text-[12px] font-bold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 py-1.5 rounded-lg transition-colors">
                        {taskSaving ? "Saving…" : "Save task"}
                      </button>
                    </div>
                  </form>
                )}

                {selectedTasks.length === 0 ? (
                  <p className="text-[12px] text-zinc-300">No tasks planned for this day.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedTasks.map((t) => {
                      const asset = getAsset(t.assets);
                      return (
                        <div key={t.id} className="flex items-start gap-2 group">
                          <button onClick={() => handleToggleTask(t)} className="mt-0.5 shrink-0 text-zinc-300 hover:text-emerald-600 transition-colors">
                            {t.done ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[12.5px] font-semibold leading-tight ${t.done ? "text-zinc-300 line-through" : "text-zinc-800"}`}>{t.title}</p>
                            {asset && <p className="text-[11px] text-zinc-400 truncate">{assetLabel(asset)}</p>}
                          </div>
                          <button onClick={() => handleDeleteTask(t)} className="shrink-0 opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-600 transition-all">
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
                  <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide mb-2">Due this day</p>
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
                            <Wrench size={10} /> {r.type}
                            {r.kmHours != null && <span className="flex items-center gap-1"><Gauge size={10} /> {formatUnitValue(r.kmHours, r.assetType)}</span>}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Services logged */}
              <div>
                <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide mb-2">Services logged</p>
                {selectedServices.length === 0 ? (
                  <p className="text-[12px] text-zinc-300">No services were logged this day.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedServices.map((s) => (
                      <Link key={s.id} href={`/dashboard/services?asset=${s.assetId}`} className="block p-2.5 rounded-xl bg-emerald-50/60 hover:bg-emerald-50 transition-colors">
                        <p className="text-[12px] font-bold text-zinc-800 truncate">{s.label}</p>
                        <p className="text-[11px] text-zinc-500">{s.type}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-center text-[11px] text-zinc-400 mt-8">© 2026 Maintly. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
