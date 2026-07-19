"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Box, QrCode, Search,
  CheckCircle2, Clock, ChevronDown, ChevronLeft, ChevronRight,
  Wrench, ClipboardList,
  AlertCircle, ArrowRight, CalendarClock, Lightbulb, TrendingUp, Heart,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { useUnreadMechanicMessages } from "@/lib/useUnreadMechanicMessages";
import { formatDateDMY } from "@/lib/date";
import { computeReminderStatus, daysUntilDate, type ReminderStatus } from "@/lib/reminders";
import ContactSupportWidgetIntl from "@/components/ContactSupportWidgetIntl";
import DashboardSidebarIntl from "@/components/DashboardSidebarIntl";
import DashboardHeaderIntl from "@/components/DashboardHeaderIntl";
import AddAssetChooserIntl from "@/components/AddAssetChooserIntl";
import NewAssetModalIntl from "@/components/NewAssetModalIntl";
import LinkExistingAssetModalIntl from "@/components/LinkExistingAssetModalIntl";
import { assetTypeImg } from "@/lib/assetTypes";
import CalendarDayCellIntl, { type DayInfo } from "@/components/CalendarDayCellIntl";
import { buildMonthGridMondayFirst } from "@/lib/calendarGrid";

// NOTE: this page's router stays on plain next/navigation's useRouter
// (not @/i18n/navigation) — it does router.push(`/dashboard/assets?q=...`)
// and /dashboard/assets is not migrated yet. Per the established rule, ALL
// of a page's router targets must be migrated before the swap; one
// unmigrated target (assets) blocks it even though /dashboard/services IS
// migrated. router.replace("/login") is fine either way since /login is
// migrated.

const SERVICE_TYPE_KEYS: Record<string, string> = {
  "Oil Change": "oilChange", "Service": "service", "Repair": "repair",
  "Inspection": "inspection", "Filter Change": "filterChange",
  "Tire Change": "tireChange", "Brake Service": "brakeService", "Other": "other",
};

// "kind" distinguishes the two very different things that both end up in
// the "Próximos Recordatorios" list: an asset's maintenance due date
// ("service", from service_records.next_due_date/next_due_km_hours) and a
// manually-added Calendar task ("task", from calendar_tasks — e.g. "ir a ver
// a doña ana"). Facu reported that a task he added to the Calendar showed
// up there (as a dot on the mini calendar) but never in this reminders
// list — that's because this list used to be built exclusively from
// service reminders, silently ignoring calendar_tasks entirely even though
// the Calendar feature (migración 008) was explicitly designed for tasks to
// show "alongside services already logged and reminders already due".
type ReminderItem = {
  id: string;
  kind: "service" | "task";
  assetLabel: string; // doubles as the task title when kind === "task"
  assetType: string | null;
  assetId: string | null; // null for kind === "task" (not linked to a specific asset in this UI)
  status: ReminderStatus;
  next_due_date: string | null;
  next_due_km_hours: number | null;
  serviceType: string | null;
};

// "Tus activos" carousel card — one per asset the mechanic has, combining
// its photo/basic info (from mechanic_assets → assets) with two things
// computed from data fetched elsewhere: the worst reminder status across
// all of that asset's service records (assetStatus in the init() effect
// below) and the date of its most recent logged service.
type AssetCardInfo = {
  id: string;
  label: string;
  assetType: string;
  photoUrl: string | null;
  status: ReminderStatus;
  lastServiceDate: string | null;
};

// "Actividad reciente" feed item. Two real, already-tracked sources only:
// a service being logged (service_records) and a QR code being scanned
// (qr_scans, migración 006). Deliberately does NOT show who scanned a QR
// (that table never captures a scanner identity — a scan is anonymous by
// design, no login required to view an asset's public page) and does NOT
// include an "asset updated" event (assets has no confirmed updated_at
// column to source that from).
type ActivityItem = {
  id: string;
  kind: "service" | "scan";
  label: string;
  sub: string;
  timestamp: string; // ISO-ish; service items use service_date (day only), scans use scanned_at (full timestamp)
};

type SearchAsset = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  vin: string | null;
  type: string;
  qrCode: string | null;
};

type SearchServiceResult = {
  id: string;
  asset_id: string;
  service_type: string;
  service_date: string;
  assetName: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations("DashboardHomePage");
  // Month/weekday labels for the calendar hover-preview reuse the full
  // Calendar page's own namespace (DashboardCalendarPage already has
  // monthJanuary..monthDecember / weekdayMon..weekdaySun) instead of
  // duplicating those 19 keys under DashboardHomePage — same strings, one
  // source of truth, at the cost of one extra useTranslations() call.
  const tCal = useTranslations("DashboardCalendarPage");
  const tServiceTypes = useTranslations("ServiceTypes");
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mechanicId, setMechanicId] = useState("");
  const unreadMessages = useUnreadMessagesCount(mechanicId);
  const unreadMechanicMessages = useUnreadMechanicMessages(mechanicId);
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicPhoto, setMechanicPhoto] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [maintlerCode, setMaintlerCode] = useState("");
  const [totalServices, setTotalServices] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [assetCards, setAssetCards] = useState<AssetCardInfo[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [assetCarouselPage, setAssetCarouselPage] = useState(0);
  const [priorityCarouselPage, setPriorityCarouselPage] = useState(0);

  // ── Calendar preview popover (hover on "Ver calendario completo") ──
  const [calViewDate, setCalViewDate] = useState(() => new Date());
  const [calServices, setCalServices] = useState<{ date: string; label: string; type: string }[]>([]);
  const [calReminders, setCalReminders] = useState<{ date: string; status: ReminderStatus; label: string; type: string }[]>([]);
  const [calTasks, setCalTasks] = useState<{ date: string; done: boolean; title: string }[]>([]);
  // Facu (16 jul 2026): "el calendario no hace nada cuando le paso el
  // mouse por encima" — the popover was originally pure CSS
  // (`hidden group-hover:block`), the same show/hide-on-hover trick used
  // elsewhere in this file, but it never showed on the live deploy. Rather
  // than keep guessing at a possible Tailwind/production-build quirk with
  // that specific class combo, switched to explicit JS hover state driven
  // by onMouseEnter/onMouseLeave — the exact same reliable pattern
  // CalendarDayCellIntl.tsx already uses for its own per-day tooltip, so
  // it's proven to work in this codebase regardless of any CSS build
  // subtlety.
  const [calHover, setCalHover] = useState(false);

  // ── Top search bar ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchAssetsList, setSearchAssetsList] = useState<SearchAsset[]>([]);
  const [searchServiceResults, setSearchServiceResults] = useState<SearchServiceResult[]>([]);
  const [searchingServices, setSearchingServices] = useState(false);

  // ── Add Equipment flow (choose → new / existing) ──
  // Shared components (also used by the Assets page) so this behaves
  // identically everywhere — see src/components/{AddAssetChooserIntl,
  // NewAssetModalIntl,LinkExistingAssetModalIntl}.tsx.
  const [addStep, setAddStep] = useState<"closed" | "choose" | "new" | "existing">("closed");

  async function refreshTotalAssets(uid: string) {
    const { count } = await supabase
      .from("mechanic_assets")
      .select("*", { count: "exact", head: true })
      .eq("mechanic_id", uid);
    setTotalAssets((prev) => count ?? prev);
  }

  useEffect(() => {
    let active = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      if (!active) return;

      setMechanicId(session.user.id);
      setMechanicEmail(session.user.email ?? "");

      // These 8 queries are all independent (none depends on another's
      // result), so they're fired concurrently instead of one after another
      // — page load time is now bounded by the slowest single query instead
      // of the sum of all of them.
      const [
        { data: mechanic },
        { count: assetCount },
        { count: svcCount },
        { data: remRows },
        { data: kmRows },
        { data: allSvcRows },
        { data: taskRowsForCal },
        { data: assetRows },
      ] = await Promise.all([
        supabase.from("mechanics").select("name, photo_url, maintler_code").eq("id", session.user.id).single(),
        supabase.from("mechanic_assets").select("*", { count: "exact", head: true }).eq("mechanic_id", session.user.id),
        supabase.from("service_records").select("*", { count: "exact", head: true }).eq("mechanic_id", session.user.id).is("deleted_at", null),
        supabase
          .from("service_records")
          .select("id, asset_id, service_type, next_due_date, next_due_km_hours, assets(nickname, brand, model, asset_type)")
          .eq("mechanic_id", session.user.id)
          .is("deleted_at", null)
          .or("next_due_date.not.is.null,next_due_km_hours.not.is.null"),
        supabase
          .from("service_records")
          .select("asset_id, km_hours")
          .eq("mechanic_id", session.user.id)
          .is("deleted_at", null)
          .not("km_hours", "is", null),
        supabase
          .from("service_records")
          .select("asset_id, service_date, service_type, assets(nickname, brand, model)")
          .eq("mechanic_id", session.user.id)
          .is("deleted_at", null)
          .order("service_date", { ascending: false })
          .limit(3000), // feeds "last service per asset" + the activity feed — bounds payload for very long-tenured accounts
        supabase
          .from("calendar_tasks")
          .select("id, task_date, done, title")
          .eq("mechanic_id", session.user.id),
        supabase
          .from("mechanic_assets")
          .select("assets(id, nickname, brand, model, vin_serial, asset_type, photo_url, qr_codes(code))")
          .eq("mechanic_id", session.user.id),
      ]);

      if (!active) return;

      if (mechanic) { setMechanicName(mechanic.name); setMechanicPhoto(mechanic.photo_url ?? ""); setMaintlerCode(mechanic.maintler_code ?? ""); }
      setTotalAssets(assetCount ?? 0);
      setTotalServices(svcCount ?? 0);

      // ── Upcoming reminders ──
      const maxKmByAsset: Record<string, number> = {};
      for (const r of (kmRows ?? []) as any[]) {
        if (r.km_hours != null && (maxKmByAsset[r.asset_id] == null || r.km_hours > maxKmByAsset[r.asset_id])) {
          maxKmByAsset[r.asset_id] = r.km_hours;
        }
      }

      const allReminderItems: ReminderItem[] = ((remRows ?? []) as any[]).map((r) => {
        const a = Array.isArray(r.assets) ? r.assets[0] : r.assets;
        const label = a?.nickname || [a?.brand, a?.model].filter(Boolean).join(" ") || t("unknownAsset");
        const status = computeReminderStatus({
          nextDueDate: r.next_due_date,
          nextDueKmHours: r.next_due_km_hours,
          currentKmHours: maxKmByAsset[r.asset_id] ?? null,
        });
        return { id: r.id, kind: "service" as const, assetLabel: label, assetType: a?.asset_type ?? null, assetId: r.asset_id ?? null, status, next_due_date: r.next_due_date, next_due_km_hours: r.next_due_km_hours, serviceType: r.service_type };
      });

      // Calendar tasks (migración 008) that aren't done yet also count as
      // "upcoming reminders" — same due-date math as a service reminder
      // (computeReminderStatus doesn't care where the date came from), just
      // with no km/hours component and no asset attached to it.
      const taskReminderItems: ReminderItem[] = ((taskRowsForCal ?? []) as any[])
        .filter((r) => !r.done)
        .map((r) => ({
          id: r.id,
          kind: "task" as const,
          assetLabel: r.title,
          assetType: null,
          assetId: null,
          status: computeReminderStatus({ nextDueDate: r.task_date }),
          next_due_date: r.task_date,
          next_due_km_hours: null,
          serviceType: null,
        }));

      const reminderItems = [...allReminderItems, ...taskReminderItems]
        .filter((i) => i.status === "overdue" || i.status === "due_soon")
        .sort((a, b) => (a.status === "overdue" ? 0 : 1) - (b.status === "overdue" ? 0 : 1));

      setReminders(reminderItems);

      // ── Calendar preview (hover bubble on "Ver calendario completo") ──
      // Facu (16 jul 2026): wants that card to pop open a mini month
      // calendar on hover instead of only linking through. Reuses data this
      // effect already fetched for other widgets — allReminderItems (every
      // status, not just overdue/due_soon, unlike the `reminders` state
      // above), allSvcRows, and taskRowsForCal — so this costs zero extra
      // queries, only the same JS derivation the old always-visible mini
      // calendar used to do before the redesign replaced it with this
      // on-hover version.
      setCalReminders(
        allReminderItems
          .filter((i): i is ReminderItem & { next_due_date: string } => !!i.next_due_date)
          .map((i) => ({ date: i.next_due_date, status: i.status, label: i.assetLabel, type: i.serviceType ?? "" }))
      );
      setCalServices(
        ((allSvcRows ?? []) as any[]).map((r) => {
          const a = Array.isArray(r.assets) ? r.assets[0] : r.assets;
          const label = a?.nickname || [a?.brand, a?.model].filter(Boolean).join(" ") || t("unknownAsset");
          return { date: r.service_date, label, type: r.service_type };
        })
      );
      setCalTasks(((taskRowsForCal ?? []) as any[]).map((r) => ({ date: r.task_date, done: r.done, title: r.title })));

      // ── Full asset list, for the top search bar (assets + QR codes) ──
      const searchList: SearchAsset[] = ((assetRows ?? []) as any[])
        .map((r) => {
          const a = Array.isArray(r.assets) ? r.assets[0] : r.assets;
          if (!a) return null;
          const qr = Array.isArray(a.qr_codes) ? a.qr_codes[0]?.code : a.qr_codes?.code;
          return {
            id: a.id,
            name: a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || t("unknownAsset"),
            brand: a.brand ?? null,
            model: a.model ?? null,
            vin: a.vin_serial ?? null,
            type: a.asset_type,
            qrCode: qr ?? null,
          };
        })
        .filter(Boolean) as SearchAsset[];
      if (active) setSearchAssetsList(searchList);

      // ── "Tus activos" carousel: each asset's card needs a status badge
      // (worst reminder status across all its service records — same
      // "worse" ranking used everywhere else: overdue > due_soon > ok >
      // none) and its most recent service date. ──
      const assetStatusById: Record<string, ReminderStatus> = {};
      const STATUS_RANK: Record<ReminderStatus, number> = { none: 0, ok: 1, due_soon: 2, overdue: 3 };
      for (const r of allReminderItems) {
        if (!r.assetId) continue;
        const prev = assetStatusById[r.assetId];
        if (!prev || STATUS_RANK[r.status] > STATUS_RANK[prev]) assetStatusById[r.assetId] = r.status;
      }

      const lastServiceDateByAsset: Record<string, string> = {};
      for (const r of (allSvcRows ?? []) as any[]) {
        // allSvcRows is already ordered service_date desc, so the first
        // row seen for a given asset_id is that asset's most recent service.
        if (r.asset_id && !lastServiceDateByAsset[r.asset_id]) lastServiceDateByAsset[r.asset_id] = r.service_date;
      }

      const assetIds: string[] = [];
      const cards: AssetCardInfo[] = ((assetRows ?? []) as any[])
        .map((r) => {
          const a = Array.isArray(r.assets) ? r.assets[0] : r.assets;
          if (!a) return null;
          assetIds.push(a.id);
          return {
            id: a.id,
            label: a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || t("unknownAsset"),
            assetType: a.asset_type,
            photoUrl: a.photo_url ?? null,
            status: assetStatusById[a.id] ?? "none",
            lastServiceDate: lastServiceDateByAsset[a.id] ?? null,
          };
        })
        .filter(Boolean) as AssetCardInfo[];
      if (active) setAssetCards(cards);

      // ── "Actividad reciente": merges two real, already-tracked sources
      // (see the ActivityItem type comment for why nothing else is mixed
      // in). Recent services come from the same allSvcRows fetched above
      // for the calendar dots; QR scans need their own query, fired here
      // (not in the Promise.all above) because it depends on knowing this
      // mechanic's asset ids, which we only just now finished computing. ──
      const serviceActivity: ActivityItem[] = ((allSvcRows ?? []) as any[]).slice(0, 8).map((r) => {
        const a = Array.isArray(r.assets) ? r.assets[0] : r.assets;
        const label = a?.nickname || [a?.brand, a?.model].filter(Boolean).join(" ") || t("unknownAsset");
        return {
          id: `svc-${r.asset_id}-${r.service_date}-${r.service_type}`,
          kind: "service" as const,
          label: t("activityServiceLogged", { asset: label }),
          sub: tServiceTypes(SERVICE_TYPE_KEYS[r.service_type] ?? "other"),
          timestamp: r.service_date,
        };
      });

      let scanActivity: ActivityItem[] = [];
      if (assetIds.length > 0) {
        const { data: scanRows } = await supabase
          .from("qr_scans")
          .select("id, asset_id, scanned_at")
          .in("asset_id", assetIds)
          .order("scanned_at", { ascending: false })
          .limit(8);
        const assetLabelById = Object.fromEntries(cards.map((c) => [c.id, c.label]));
        scanActivity = ((scanRows ?? []) as any[]).map((r) => ({
          id: `scan-${r.id}`,
          kind: "scan" as const,
          label: t("activityQrScanned", { asset: assetLabelById[r.asset_id] ?? t("unknownAsset") }),
          sub: "",
          timestamp: r.scanned_at,
        }));
      }

      if (active) {
        setRecentActivity(
          [...serviceActivity, ...scanActivity]
            .sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())
            .slice(0, 4) // kept short on purpose — this card sits next to a 4-card asset grid, so it shouldn't be the tallest thing in the row
        );
      }

      if (active) setAuthChecked(true);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => { active = false; listener.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ── Live search: services (debounced, searches full history, not just the recent 6) ──
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchServiceResults([]); setSearchingServices(false); return; }

    const safeQ = q.replace(/[%,()]/g, "").trim();
    if (!safeQ) { setSearchServiceResults([]); setSearchingServices(false); return; }

    let cancelled = false;
    setSearchingServices(true);
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) { if (!cancelled) setSearchingServices(false); return; }

      const { data } = await supabase
        .from("service_records")
        .select("id, asset_id, service_type, service_date, notes, assets(nickname, brand, model)")
        .eq("mechanic_id", session.user.id)
        .is("deleted_at", null)
        .or(`service_type.ilike.%${safeQ}%,notes.ilike.%${safeQ}%`)
        .order("service_date", { ascending: false })
        .limit(5);

      if (cancelled) return;
      const results: SearchServiceResult[] = ((data ?? []) as any[]).map((s) => {
        const a = Array.isArray(s.assets) ? s.assets[0] : s.assets;
        return {
          id: s.id,
          asset_id: s.asset_id,
          service_type: s.service_type,
          service_date: s.service_date,
          assetName: a?.nickname || [a?.brand, a?.model].filter(Boolean).join(" ") || t("unknownAsset"),
        };
      });
      setSearchServiceResults(results);
      setSearchingServices(false);
    }, 300);

    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">{t("loadingAuth")}</p>
      </div>
    );
  }

  const displayName = mechanicName || mechanicEmail;

  // ── Top search bar: matching assets (client-side, from the full workshop list) ──
  const searchQ = searchQuery.trim().toLowerCase();
  const matchedAssets = searchQ.length > 0
    ? searchAssetsList.filter((a) => {
        const hay = [a.name, a.brand, a.model, a.vin, a.qrCode].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(searchQ);
      }).slice(0, 5)
    : [];
  const hasSearchResults = matchedAssets.length > 0 || searchServiceResults.length > 0;

  function goToAsset(a: SearchAsset) {
    setSearchOpen(false);
    router.push(`/dashboard/assets?q=${encodeURIComponent(a.name)}`);
  }
  function goToService(s: SearchServiceResult) {
    setSearchOpen(false);
    router.push(`/dashboard/services?asset=${s.asset_id}`);
  }
  function handleSearchSubmit() {
    if (!searchQ) return;
    setSearchOpen(false);
    router.push(`/dashboard/assets?q=${encodeURIComponent(searchQuery.trim())}`);
  }

  // Facu (jul 2026, "que se vea así" mockup): full dashboard redesign for
  // warmth — a real time-of-day greeting, a "today's priorities" strip, a
  // maintenance-health gauge, a real activity feed and an assets carousel.
  // "Tus logros" (achievements/gamification, the locked-badges strip in the
  // mockup) is EXPLICITLY OUT of this pass — Facu chose "build the layout
  // now, design achievements later" since that piece needs real product
  // decisions (what unlocks what) rather than just a restyle.
  const firstName = (mechanicName || t("defaultMaintlerName")).split(" ")[0];
  const greetingHour = new Date().getHours();
  const greetingKey = greetingHour < 12 ? "greetingMorning" : greetingHour < 19 ? "greetingAfternoon" : "greetingEvening";

  const overdueCount = reminders.filter((r) => r.status === "overdue").length;
  const dueThisWeekCount = reminders.filter(
    (r) => r.status === "due_soon" && r.next_due_date != null && daysUntilDate(r.next_due_date) <= 7
  ).length;
  const greetingSubtitle =
    overdueCount > 0 && dueThisWeekCount > 0 ? t("greetingBoth", { overdue: overdueCount, dueSoon: dueThisWeekCount })
    : overdueCount > 0 ? t("greetingOverdueOnly", { overdue: overdueCount })
    : dueThisWeekCount > 0 ? t("greetingDueSoonOnly", { dueSoon: dueThisWeekCount })
    : t("greetingAllClear");

  // Heuristic, not a scientific formula — penalizes overdue items more
  // heavily than due-soon ones, clamped to 0..100. 100 = nothing overdue or
  // due soon. The weights (15/8) are just a starting point; easy to retune
  // later if Facu wants the score to feel stricter or more forgiving.
  const maintenanceHealth = Math.max(0, Math.min(100, 100 - overdueCount * 15 - dueThisWeekCount * 8 - (reminders.length - overdueCount - dueThisWeekCount) * 3));
  const healthArcColor = maintenanceHealth >= 70 ? "#16a34a" : maintenanceHealth >= 40 ? "#d97706" : "#dc2626";
  const healthStatusLabel =
    maintenanceHealth >= 90 ? t("healthGreat")
    : maintenanceHealth >= 70 ? t("healthGood")
    : maintenanceHealth >= 40 ? t("healthWarning")
    : t("healthUrgent");
  const healthTip = maintenanceHealth >= 70 ? t("healthTipGood") : t("healthTipBad");

  function relativeDueLabel(item: ReminderItem) {
    if (!item.next_due_date) return "";
    const days = daysUntilDate(item.next_due_date);
    if (days < 0) return t("overdueByDays", { count: Math.abs(days) });
    if (days === 0) return t("dueToday");
    return t("dueInDays", { count: days, date: formatDateDMY(item.next_due_date) });
  }

  // Facu (16 jul 2026): "quiero que el calendario quede fijo del lado
  // derecho... y que si hay más de 3 tareas se scrollee igual que los
  // activos" — paginated 3-at-a-time (like the asset carousel), with the
  // "Ver calendario completo" card pinned to the 4th grid column via
  // lg:col-start-4 in the JSX below, regardless of how many real items are
  // on the current page (1, 2, or 3).
  const priorityTotalPages = Math.max(1, Math.ceil(reminders.length / 3));
  // Clamp instead of trusting state directly — if a task gets completed
  // (or a page is deep-linked with fewer reminders than before) while
  // sitting on, say, page 2 of 2, the raw state could point past the new
  // last page and render an empty grid instead of snapping back.
  const safePriorityPage = Math.min(priorityCarouselPage, priorityTotalPages - 1);
  const priorityItems = reminders.slice(safePriorityPage * 3, safePriorityPage * 3 + 3);
  const assetTotalPages = Math.ceil(assetCards.length / 4);

  // ── Calendar preview popover (hover on "Ver calendario completo") ──
  // Facu (16 jul 2026): wants that card to pop open a mini month calendar on
  // hover, matching what used to live permanently in this panel before the
  // "fits in one screen" cleanup removed it. Rebuilt from calServices /
  // calReminders / calTasks (already derived for free in init(), see the
  // comment there) — same grid + dot-priority logic the old always-visible
  // widget used.
  const CAL_MONTH_LABELS = [
    tCal("monthJanuary"), tCal("monthFebruary"), tCal("monthMarch"), tCal("monthApril"),
    tCal("monthMay"), tCal("monthJune"), tCal("monthJuly"), tCal("monthAugust"),
    tCal("monthSeptember"), tCal("monthOctober"), tCal("monthNovember"), tCal("monthDecember"),
  ];
  const CAL_WEEKDAY_LABELS = [
    tCal("weekdayMon"), tCal("weekdayTue"), tCal("weekdayWed"),
    tCal("weekdayThu"), tCal("weekdayFri"), tCal("weekdaySat"), tCal("weekdaySun"),
  ];
  const calYear = calViewDate.getFullYear();
  const calMonth = calViewDate.getMonth();
  const calendarGrid = buildMonthGridMondayFirst(calYear, calMonth);

  // Groups the 3 already-fetched lists by date key, so each day cell can
  // look up "what's on this day" in O(1) instead of filtering 3 arrays per
  // cell (42 cells × 3 arrays would add up fast otherwise).
  const calActivityByDate: Record<string, DayInfo> = {};
  function ensureCalDay(key: string): DayInfo {
    if (!calActivityByDate[key]) calActivityByDate[key] = { services: [], tasks: [], reminders: [] };
    return calActivityByDate[key];
  }
  for (const s of calServices) ensureCalDay(s.date).services.push({ label: s.label, type: s.type });
  for (const r of calReminders) ensureCalDay(r.date).reminders.push({ label: r.label, type: r.type, status: r.status });
  for (const tk of calTasks) ensureCalDay(tk.date).tasks.push({ title: tk.title, done: tk.done });

  // Priority order for the day's dot color: an overdue reminder always wins
  // (most urgent), then a due-soon reminder, then an open (not-done) task,
  // then a logged service, then a reminder that's merely ok/none (still
  // worth a neutral dot), else no dot at all.
  function calDotColor(info?: DayInfo): string | null {
    if (!info) return null;
    if (info.reminders.some((r) => r.status === "overdue")) return "bg-red-500";
    if (info.reminders.some((r) => r.status === "due_soon")) return "bg-amber-500";
    if (info.tasks.some((tk) => !tk.done)) return "bg-blue-400";
    if (info.services.length > 0) return "bg-emerald-500";
    if (info.reminders.length > 0) return "bg-zinc-300";
    return null;
  }

  // "Actividad reciente" timestamps: service items only have a service_date
  // (day granularity, no time-of-day), scans have a full scanned_at
  // timestamp — this handles both, falling back to a plain date once
  // something is more than a week old rather than an increasingly useless
  // "hace 42 días".
  function formatRelativeTime(iso: string) {
    const then = new Date(iso).getTime();
    if (isNaN(then)) return "";
    const diffMs = Date.now() - then;
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffHours / 24);
    if (diffHours < 1) return t("justNow");
    if (diffHours < 24) return t("hoursAgo", { count: diffHours });
    if (diffDays === 1) return t("yesterday");
    if (diffDays < 7) return t("daysAgo", { count: diffDays });
    return formatDateDMY(iso.slice(0, 10));
  }

  // Facu (jul 2026): the dashboard felt "cold" — every one of these 4 cards
  // used to show the exact same generic "↗ Tus totales" caption under a
  // trend arrow that was always green/up regardless of the real number (it
  // was hardcoded `up: true` on all four, so it never actually meant
  // anything). Rebuilt as "Resumen rápido" per the redesign: same 3 real
  // counts plus the health score, replacing the old "Completados" tile
  // (that number now lives in the health checklist instead, right next to
  // the gauge, so it isn't shown twice).
  const resumenTiles = [
    {
      id: "assets",
      value: String(totalAssets),
      caption: t("resumenAssets"),
      icon: Box,
      color: "bg-blue-50 text-blue-500",
    },
    {
      id: "services",
      value: String(totalServices),
      caption: t("resumenServices"),
      icon: ClipboardList,
      color: "bg-indigo-50 text-indigo-500",
    },
    {
      id: "pending",
      value: String(reminders.length),
      caption: t("resumenPending"),
      icon: Clock,
      color: "bg-amber-50 text-amber-500",
    },
    {
      id: "health",
      value: `${maintenanceHealth}%`,
      caption: t("resumenHealthCaption"),
      icon: TrendingUp,
      color: "bg-green-50 text-green-500",
    },
  ];

  // ── Top search bar, rendered inside DashboardHeaderIntl's extraHeaderContent
  // slot — this is the one bit of header markup unique to this page (no
  // other dashboard page has a live search box), which is why Dashboard
  // stayed on its own hand-rolled header/sidebar until this slot existed. ──
  const dashboardSearchBar = (
    <div className="hidden lg:block relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
        onFocus={() => { if (searchQuery.trim()) setSearchOpen(true); }}
        onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSearchSubmit(); if (e.key === "Escape") setSearchOpen(false); }}
        placeholder={t("searchPlaceholder")}
        className="w-[280px] rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400 transition-colors"
      />

      {searchOpen && searchQuery.trim().length > 0 && (
        <div className="absolute top-[calc(100%+6px)] left-0 w-[340px] bg-white rounded-xl border border-zinc-200 shadow-lg py-2 z-50 max-h-[360px] overflow-y-auto">
          {matchedAssets.length > 0 && (
            <div className="px-2">
              <p className="px-2 pb-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{t("searchAssets")}</p>
              {matchedAssets.map((a) => (
                <button
                  key={a.id}
                  onMouseDown={() => goToAsset(a)}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-zinc-50 text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                    <Box size={13} className="text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-zinc-800 truncate">{a.name}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{a.qrCode || a.vin || a.type}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchServiceResults.length > 0 && (
            <div className="px-2 mt-1">
              <p className="px-2 pb-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{t("searchServices")}</p>
              {searchServiceResults.map((s) => (
                <button
                  key={s.id}
                  onMouseDown={() => goToService(s)}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-zinc-50 text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Wrench size={13} className="text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-zinc-800 truncate">{tServiceTypes(SERVICE_TYPE_KEYS[s.service_type] ?? "other")} · {s.assetName}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{formatDateDMY(s.service_date)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!hasSearchResults && (
            <p className="px-4 py-3 text-[12px] text-zinc-400">
              {searchingServices ? t("searching") : t("noResultsFor", { query: searchQuery.trim() })}
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex relative">

      {/* Redesign (jul 2026): this page used to hide the sidebar's own
          "¿Necesitás ayuda?" support card (hideSupportWidget) and render an
          inline "Contactar Soporte" button up top instead. Per the new
          mockup, both the sidebar card AND a floating chat bubble
          (rendered further below) are visible at once, and the inline
          top button is gone — so hideSupportWidget is dropped here.
          name/email are passed as `displayName` twice (not name+email
          separately, like every other dashboard page) so the shared
          component's initials-fallback math matches exactly what this page
          computed before the migration (a mechanic with no name set still
          got an initial derived from their email). */}
      <DashboardSidebarIntl
        activeHref="/dashboard"
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        mechanicId={mechanicId}
        unreadMessages={unreadMessages}
        unreadMechanicMessages={unreadMechanicMessages}
        photoUrl={mechanicPhoto}
        name={displayName}
        email={displayName}
      />

      {/* ════ MAIN CONTENT ════ */}
      <div className="flex-1 flex flex-col min-w-0">

        <DashboardHeaderIntl
          title={t(greetingKey, { name: firstName })}
          subtitle={greetingSubtitle}
          onOpenSidebar={() => setSidebarOpen(true)}
          mechanicId={mechanicId}
          unreadMessages={unreadMessages}
          unreadMechanicMessages={unreadMechanicMessages}
          photoUrl={mechanicPhoto}
          name={displayName}
          email={displayName}
          maintlerCode={maintlerCode}
          onLogout={handleLogout}
          extraHeaderContent={dashboardSearchBar}
        />

        <div className="flex-1 overflow-y-auto p-3 md:p-4">

          {/* ── "Tus prioridades de hoy" ── the most urgent 3 reminders
              (overdue first, then soonest-due), same merged services+tasks
              list already powering "Próximos Recordatorios" below — plus a
              permanent 4th card linking straight to the full calendar.
              Facu (16 jul 2026): the "Agregar Servicio"/"Agregar Equipo"
              buttons used to sit alone on their own empty row above this
              card — folded them into this card's header line instead, so
              that dead strip of whitespace is gone. */}
          {/* Facu (19 jul 2026): "quiero 0 escroll... MaintlyQR tiene que
              ser fácil y práctico" — this whole page got a second, more
              aggressive density pass on top of the p-4/p-7 -> p-3/p-4
              container change from before: every card's own padding,
              every section's inner gaps, all trimmed a notch further. */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-3 mb-1">
            {/* flex-col on phones, side-by-side from sm: up — on a narrow
                screen, a title + 2 buttons on one "justify-between" row
                either overflowed the card or squished the buttons down to
                unreadable. Stacking avoids both. */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 mb-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-black text-zinc-900">{t("todaysPriorities")}</h2>
                {reminders.length > 0 && (
                  <span className="bg-red-600 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{reminders.length}</span>
                )}
                {/* Same prev/next affordance as "Tus activos" — shown only
                    when there's more than one page of 3 to page through. */}
                {priorityTotalPages > 1 && (
                  <div className="flex items-center gap-1 ml-1">
                    <button
                      onClick={() => setPriorityCarouselPage((p) => (p - 1 + priorityTotalPages) % priorityTotalPages)}
                      aria-label={t("previousPage")}
                      className="w-6 h-6 rounded-full border border-zinc-200 text-zinc-400 hover:text-zinc-700 hover:border-zinc-300 flex items-center justify-center transition-colors"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      onClick={() => setPriorityCarouselPage((p) => (p + 1) % priorityTotalPages)}
                      aria-label={t("nextPage")}
                      className="w-6 h-6 rounded-full border border-zinc-200 text-zinc-400 hover:text-zinc-700 hover:border-zinc-300 flex items-center justify-center transition-colors"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                <Link
                  href="/dashboard/services?new=1"
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 border border-red-200 bg-white hover:bg-red-50 active:scale-[0.98] transition-all text-red-600 text-[12px] font-bold px-3 py-[7px] rounded-xl shadow-sm"
                >
                  <Wrench size={13} /> {t("addService")} <ChevronDown size={11} className="opacity-60" />
                </Link>
                <button
                  onClick={() => setAddStep("choose")}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white text-[12px] font-bold px-3 py-[7px] rounded-xl shadow-sm"
                >
                  <Box size={13} /> {t("addEquipment")} <ChevronDown size={11} className="opacity-70" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {priorityItems.map((item) => {
                const overdue = item.status === "overdue";
                // Facu (16 jul 2026): these used to be plain non-clickable
                // divs with a decorative arrow that implied you could tap
                // them — now they actually go somewhere. A "service" item
                // deep-links into the add-service form for that exact asset
                // (the services page already supports ?asset=&new=1, used
                // by the header's own "Agregar Servicio" button), logging a
                // new service is what actually clears the reminder. A
                // "task" item goes to the Calendar, where it can be checked
                // off (calendar_tasks.done) — there's no per-task deep link
                // yet, so it lands on the full calendar rather than that
                // one task pre-opened.
                const itemHref = item.kind === "service" && item.assetId
                  ? `/dashboard/services?asset=${item.assetId}&new=1`
                  : "/dashboard/calendar";
                return (
                  <Link
                    key={`${item.kind}-${item.id}`}
                    href={itemHref}
                    className={`rounded-xl border p-2.5 flex items-center gap-2.5 transition-colors ${overdue ? "bg-red-50 border-red-200 hover:border-red-300" : "bg-amber-50 border-amber-200 hover:border-amber-300"}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${overdue ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
                      {overdue ? <AlertCircle size={15} /> : <Clock size={15} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[9.5px] font-black uppercase tracking-wide ${overdue ? "text-red-600" : "text-amber-600"}`}>
                        {overdue ? t("statusOverdue") : t("statusUpcoming")}
                      </p>
                      <p className="text-[12.5px] font-bold text-zinc-800 truncate">{item.assetLabel}</p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {item.kind === "service" ? tServiceTypes(SERVICE_TYPE_KEYS[item.serviceType ?? "Other"] ?? "other") : t("scheduledTask")}
                        {" · "}{relativeDueLabel(item)}
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-zinc-300 shrink-0" />
                  </Link>
                );
              })}
              {/* lg:col-start-4 (now on the wrapper, not the Link — see
                  below) pins this to the last column always — with 1 or 2
                  real priority items on a page it used to just slot in right
                  after them (3rd column), leaving an empty 4th column and
                  making the card jump around depending on the count. Fixed
                  position now, same as "where it was when there were three
                  tasks".
                  Facu (16 jul 2026): "hay forma de q se abra como ventana
                  tipo burbuja cuando uno le apoya el mouse ahi mismo" —
                  hovering this card now pops open a mini month calendar
                  instead of only linking through. Driven by explicit
                  onMouseEnter/onMouseLeave state (calHover) rather than a
                  pure-CSS `group-hover` toggle — same reliable pattern
                  CalendarDayCellIntl already uses for its own per-day
                  tooltip. `pt-2` (padding, not margin) on the popover keeps
                  the gap between card and bubble inside the hoverable box —
                  a margin gap there would let the mouse pass through
                  un-hoverable empty space and close the popover before it's
                  reached. */}
              <div
                className="relative lg:col-start-4"
                onMouseEnter={() => setCalHover(true)}
                onMouseLeave={() => setCalHover(false)}
              >
                <Link
                  href="/dashboard/calendar"
                  className="rounded-xl border border-dashed border-zinc-300 hover:border-zinc-400 p-2.5 flex items-center gap-2.5 text-zinc-500 hover:text-zinc-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                    <CalendarClock size={15} />
                  </div>
                  <p className="text-[12px] font-bold">{t("viewFullCalendar")}</p>
                </Link>

                {calHover && (
                <div className="absolute z-50 top-full right-0 pt-2 w-[280px]">
                  <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[12px] font-black text-zinc-900">
                        {CAL_MONTH_LABELS[calMonth]} {calYear}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setCalViewDate(new Date(calYear, calMonth - 1, 1)); }}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                          aria-label={t("previousPage")}
                        >
                          <ChevronLeft size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setCalViewDate(new Date(calYear, calMonth + 1, 1)); }}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                          aria-label={t("nextPage")}
                        >
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-y-0.5">
                      {CAL_WEEKDAY_LABELS.map((w, i) => (
                        <p key={i} className="text-[8.5px] font-bold text-zinc-300 text-center uppercase">{w}</p>
                      ))}
                      {calendarGrid.map((cell) => (
                        <CalendarDayCellIntl
                          key={cell.key}
                          dateKey={cell.key}
                          day={cell.day}
                          inMonth={cell.inMonth}
                          isToday={cell.isToday}
                          dateLabel={formatDateDMY(cell.key)}
                          info={calActivityByDate[cell.key]}
                          dotColor={calDotColor(calActivityByDate[cell.key])}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                )}
              </div>
            </div>
            {reminders.length === 0 && (
              <p className="text-[12px] text-zinc-400 mt-1">{t("noRemindersDueSoon")}</p>
            )}
            {priorityTotalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-2">
                {Array.from({ length: priorityTotalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPriorityCarouselPage(i)}
                    aria-label={`page ${i + 1}`}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === safePriorityPage ? "bg-red-600" : "bg-zinc-200"}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── "Estado de tu mantenimiento" (gauge) + "Resumen rápido" + "Próximos Recordatorios" ── */}
          {/* Facu (16 jul 2026): "todo está dividido por rectángulos y entre
              ellos hay espacios" — these 3 used to be separate white cards
              with a gap between each (their own border+shadow+rounded
              corners apiece). Merged into one card with thin internal
              dividers instead, so it reads as one unit, not three. */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-zinc-100 bg-white rounded-2xl border border-zinc-200 shadow-sm mb-1">

            <div className="p-3">
              <h3 className="text-[13px] font-black text-zinc-900 mb-2.5">{t("maintenanceHealth")}</h3>
              <div className="flex items-center gap-4">
                <div className="relative w-[84px] h-[84px] shrink-0">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#e4e4e7" strokeWidth="12" />
                    <circle
                      cx="60" cy="60" r="52" fill="none" stroke={healthArcColor} strokeWidth="12" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 52}
                      strokeDashoffset={2 * Math.PI * 52 * (1 - maintenanceHealth / 100)}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[17px] font-black text-zinc-900">{maintenanceHealth}%</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold mb-1.5" style={{ color: healthArcColor }}>{healthStatusLabel}</p>
                  <ul className="space-y-1">
                    <li className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                      <CheckCircle2 size={12} className="text-green-500 shrink-0" /> {t("healthCheckAssets", { count: totalAssets })}
                    </li>
                    <li className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                      <CheckCircle2 size={12} className="text-green-500 shrink-0" /> {t("healthCheckServices", { count: totalServices })}
                    </li>
                    <li className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                      <Clock size={12} className="text-amber-500 shrink-0" /> {t("healthCheckPending", { count: reminders.length })}
                    </li>
                  </ul>
                </div>
              </div>
              <div className="mt-2 flex items-start gap-2.5 bg-zinc-50 border border-zinc-100 rounded-xl p-2">
                <Lightbulb size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-zinc-500 leading-relaxed">{healthTip}</p>
              </div>
            </div>

            <div className="p-3">
              <h3 className="text-[13px] font-black text-zinc-900 mb-2.5">{t("quickSummary")}</h3>
              {/* Facu (16 jul 2026): each tile used to stack icon → value →
                  caption vertically, which made this card one of the
                  tallest on the page for not much information. Laid out
                  horizontally (icon beside the number) instead — same 4
                  numbers, roughly half the height. */}
              <div className="grid grid-cols-2 gap-1.5">
                {resumenTiles.map(({ id, value, caption, icon: Icon, color }) => (
                  <div key={id} className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/60 p-1.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                      <Icon size={13} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-black text-zinc-900 leading-tight">{value}</p>
                      <p className="text-[9px] font-semibold text-zinc-500 leading-snug truncate">{caption}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-[13px] font-black text-zinc-900">{t("upcomingReminders")}</h3>
                <Link href="/dashboard/services" className="text-[11px] font-semibold text-red-600 hover:text-red-700">{t("viewAll")}</Link>
              </div>
              {reminders.length === 0 ? (
                <p className="text-[12px] text-zinc-400 text-center py-4">{t("noRemindersDueSoon")}</p>
              ) : (
                <div className="space-y-1.5">
                  {reminders.slice(0, 4).map((r) => {
                    const overdue = r.status === "overdue";
                    const rHref = r.kind === "service" && r.assetId
                      ? `/dashboard/services?asset=${r.assetId}&new=1`
                      : "/dashboard/calendar";
                    return (
                      <Link key={`${r.kind}-${r.id}`} href={rHref} className="flex items-center gap-2.5 -mx-1 px-1 py-0.5 rounded-lg hover:bg-zinc-50 transition-colors">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${overdue ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
                          {overdue ? <AlertCircle size={13} /> : <Clock size={13} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-zinc-800 truncate">{r.assetLabel}</p>
                          <p className="text-[10px] text-zinc-400 truncate">
                            {r.kind === "service" ? tServiceTypes(SERVICE_TYPE_KEYS[r.serviceType ?? "Other"] ?? "other") : t("scheduledTask")}
                          </p>
                        </div>
                        <p className={`text-[10.5px] font-bold shrink-0 whitespace-nowrap ${overdue ? "text-red-600" : "text-amber-600"}`}>
                          {relativeDueLabel(r)}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── "Tus activos" carousel + "Actividad reciente" ── same
              merge-into-one-card treatment as the row above. */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-zinc-100 bg-white rounded-2xl border border-zinc-200 shadow-sm mb-1">

            <div className="p-3">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-[13px] font-black text-zinc-900">{t("yourAssets")}</h3>
                <div className="flex items-center gap-2">
                  {/* Facu (16 jul 2026): the page dots alone didn't make it
                      obvious this grid pages sideways — added explicit
                      prev/next arrows next to them as a clearer affordance. */}
                  {assetTotalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setAssetCarouselPage((p) => (p - 1 + assetTotalPages) % assetTotalPages)}
                        aria-label={t("previousPage")}
                        className="w-6 h-6 rounded-full border border-zinc-200 text-zinc-400 hover:text-zinc-700 hover:border-zinc-300 flex items-center justify-center transition-colors"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <button
                        onClick={() => setAssetCarouselPage((p) => (p + 1) % assetTotalPages)}
                        aria-label={t("nextPage")}
                        className="w-6 h-6 rounded-full border border-zinc-200 text-zinc-400 hover:text-zinc-700 hover:border-zinc-300 flex items-center justify-center transition-colors"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  )}
                  <Link href="/dashboard/assets" className="text-[11px] font-semibold text-red-600 hover:text-red-700">{t("viewAll")}</Link>
                </div>
              </div>
              {assetCards.length === 0 ? (
                <p className="text-[12px] text-zinc-400 text-center py-6">{t("noAssetsYet")}</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {assetCards.slice(assetCarouselPage * 4, assetCarouselPage * 4 + 4).map((a) => {
                      const overdue = a.status === "overdue";
                      const dueSoon = a.status === "due_soon";
                      const badgeLabel = overdue ? t("assetOverdue") : dueSoon ? t("assetUpcomingService") : t("assetUpToDate");
                      const badgeColor = overdue ? "bg-red-100 text-red-700" : dueSoon ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700";
                      const img = a.photoUrl || assetTypeImg[a.assetType] || "/images/car.png";
                      return (
                        <button
                          key={a.id}
                          onClick={() => router.push(`/dashboard/assets?q=${encodeURIComponent(a.label)}`)}
                          className="rounded-xl border border-zinc-100 hover:border-zinc-300 bg-zinc-50/50 p-2 text-left transition-colors"
                        >
                          {/* Fixed height (not aspect-square) — a full-width
                              square image scaled to whatever this card's
                              column happens to be, which on a wide screen
                              made the photo (and the whole card) way taller
                              than it needed to be.
                              Facu (16 jul 2026): "la foto que tiene cargado
                              el activo no se ve entera... quiero que se
                              ajuste a ese espacio que tenemos no me importa
                              que se vea chiquita" — real uploaded photos used
                              object-cover, which fills the box by cropping
                              whatever doesn't fit the aspect ratio (so tall/
                              wide photos got their edges cut off). Switched
                              to object-contain, same as the fallback icon
                              below, so the whole photo is always visible,
                              shrunk to fit instead of cropped. */}
                          <div className="w-full h-14 rounded-lg bg-white border border-zinc-100 flex items-center justify-center overflow-hidden mb-1.5">
                            {a.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={img} alt={a.label} className="w-full h-full object-contain" />
                            ) : (
                              <Image src={img} alt={a.label} width={32} height={32} className="object-contain" />
                            )}
                          </div>
                          <p className="text-[11px] font-bold text-zinc-800 truncate">{a.label}</p>
                          <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-[2px] rounded-full ${badgeColor}`}>{badgeLabel}</span>
                          <p className="text-[9px] text-zinc-400 mt-1 truncate">
                            {a.lastServiceDate ? t("lastServiceOn", { date: formatDateDMY(a.lastServiceDate) }) : t("noServiceLoggedYet")}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  {assetCards.length > 4 && (
                    <div className="flex items-center justify-center gap-1.5 mt-3">
                      {Array.from({ length: Math.ceil(assetCards.length / 4) }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setAssetCarouselPage(i)}
                          aria-label={`page ${i + 1}`}
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${i === assetCarouselPage ? "bg-red-600" : "bg-zinc-200"}`}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-3">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-[13px] font-black text-zinc-900">{t("recentActivity")}</h3>
              </div>
              {recentActivity.length === 0 ? (
                <p className="text-[12px] text-zinc-400 text-center py-6">{t("noActivityYet")}</p>
              ) : (
                <div className="space-y-2">
                  {recentActivity.map((act) => (
                    <div key={act.id} className="flex items-start gap-2.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${act.kind === "service" ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"}`}>
                        {act.kind === "service" ? <CheckCircle2 size={12} /> : <QrCode size={12} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11.5px] font-bold text-zinc-800 leading-tight">{act.label}</p>
                        {act.sub && <p className="text-[10px] text-zinc-400">{act.sub}</p>}
                      </div>
                      <p className="text-[9.5px] text-zinc-400 shrink-0 whitespace-nowrap">{formatRelativeTime(act.timestamp)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Facu (16 jul 2026): his reference mockup fits on one screen —
              this dashboard doesn't need a duplicate "Servicios Recientes"
              table, mini calendar, or quick-access list, since "Mis
              Servicios" and "Calendario" already have their own pages in the
              sidebar nav, and "Ver todos"/"Ver calendario completo" links
              above already point there. Removed to match the mockup and cut
              the extra scroll height. */}

          {/* "Tus logros" (achievements/gamification, the locked-badges
              strip in the mockup) is deliberately NOT here — Facu chose to
              design that separately later since it needs real unlock
              rules, not just a restyle. This banner is just the warm,
              values-oriented copy from the same mockup, on its own. */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-2.5 mb-1 flex items-center gap-3">
            <Heart size={18} className="text-red-500 shrink-0" />
            <div>
              <p className="text-[12.5px] font-bold text-zinc-800">{t("valuePropTitle")}</p>
              <p className="text-[11px] text-zinc-500">{t("valuePropDesc")}</p>
            </div>
          </div>

          <p className="text-center text-[10px] text-zinc-400 mt-1">{t("copyright")}</p>
        </div>
      </div>

      {/* ════ FLOATING SUPPORT CHAT BUBBLE ════ always-visible, bottom-right
          — third touchpoint alongside the sidebar's "¿Necesitás ayuda?" card,
          matching the redesign mockup. Same underlying widget/modal as
          everywhere else (ContactSupportWidgetIntl), just a new trigger. */}
      <div className="fixed bottom-5 right-5 z-40">
        <ContactSupportWidgetIntl mechanicId={mechanicId} variant="floating" />
      </div>

      {/* ════ ADD EQUIPMENT FLOW (shared with the Assets page) ════ */}
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
        onCreated={() => refreshTotalAssets(mechanicId)}
      />
      <LinkExistingAssetModalIntl
        open={addStep === "existing"}
        onClose={() => setAddStep("closed")}
        mechanicId={mechanicId}
        onLinked={() => refreshTotalAssets(mechanicId)}
      />

    </div>
  );
}
