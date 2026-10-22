"use client";

// Departamento de Marketing — pantalla principal (spec:
// claude/MAINTLYQR_MARKETING_DEPARTAMENTO_SPEC.md). Pestañas: Inicio,
// Calendario, Tareas, Campañas, Cuentas, Biblioteca, Contactos, Feedback y
// (solo Super Admin) Equipo. Los botones se muestran según permisos del
// actor; el servidor verifica cada acción igual.

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, CalendarDays, CheckSquare, Megaphone, KeyRound, Images, Users, MessageSquareText, UserCog, AlertTriangle, Clock, CalendarClock, Target } from "lucide-react";
import { useTranslations } from "next-intl";
import { Pill } from "../../page";
import MarketingSection from "../MarketingSection";
import CalendarTab from "./CalendarTab";
import PostEditor from "./PostEditor";
import { TasksTab, CampaignsTab } from "./TasksCampaignsTab";
import { AccountsTab, LibraryTab } from "./AccountsLibraryTab";
import TeamTab from "./TeamTab";
import { type Account, type Actor, type AdminLite, type Campaign, type LibraryItem, type Post, type Settings, type Target as PostTarget, type Task, mkGet, personLabel, STATUS_TONE, ui } from "./shared";

type Overview = {
  actor: Actor; settings: Settings | null;
  tasksPending: Task[]; tasksOverdue: Task[];
  awaitingApproval: Post[]; upcoming: Post[];
  accountsAttention: { id: string; label: string; platform: string; connection_status: string; connection_note: string | null }[];
  members: { username: string; title: string | null; is_lead: boolean }[];
};

type Tab = "home" | "calendar" | "tasks" | "campaigns" | "accounts" | "library" | "contacts" | "feedback" | "team";

export default function MarketingDept({ tAdmin, locale, flash }: { tAdmin: (key: string, values?: Record<string, string | number>) => string; locale: string; flash: (m: string, tone?: "ok" | "error") => void }) {
  const t = useTranslations("MarketingDept");
  const [tab, setTab] = useState<Tab>("home");
  const [ov, setOv] = useState<Overview | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [targets, setTargets] = useState<PostTarget[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vaultOk, setVaultOk] = useState(true);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [admins, setAdmins] = useState<AdminLite[]>([]);
  const [editor, setEditor] = useState<{ id: string | null; initialDate?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [o, p, tk, c, a, l] = await Promise.all([
        mkGet<Overview>({ r: "overview" }),
        mkGet<{ items: Post[]; targets: PostTarget[] }>({ r: "posts" }),
        mkGet<{ items: Task[] }>({ r: "tasks" }),
        mkGet<{ items: Campaign[] }>({ r: "campaigns" }),
        mkGet<{ items: Account[]; vaultConfigured: boolean }>({ r: "accounts" }),
        mkGet<{ items: LibraryItem[] }>({ r: "library" }),
      ]);
      setOv(o); setPosts(p.items); setTargets(p.targets); setTasks(tk.items); setCampaigns(c.items); setAccounts(a.items); setVaultOk(a.vaultConfigured !== false); setLibrary(l.items); setError(null);
      if (o.actor.isSuper) { try { const m = await mkGet<{ admins: AdminLite[] }>({ r: "members" }); setAdmins(m.admins); } catch { /* opcional */ } }
      else setAdmins(o.members.map((m) => ({ username: m.username, role: "", active: true, first_name: null, last_name: null, nickname: null, display_name: null })));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const actor = ov?.actor ?? null;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[12px] text-red-700">{error}</div>;
  if (!actor) return <p className="text-[13px] text-zinc-400 text-center py-16">{tAdmin("loading")}</p>;
  if (!actor.isMember) return <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[12px] text-amber-800 flex items-center gap-2"><AlertTriangle size={14} /> {t("notMember")}</div>;

  const canContent = actor.isSuper || actor.perms.content;
  const people = Array.from(new Set(posts.map((p) => p.created_by).filter(Boolean) as string[]));
  const TABS: { key: Tab; label: string; icon: React.ElementType; show: boolean; badge?: number }[] = [
    { key: "home", label: t("tab_home"), icon: LayoutGrid, show: true },
    { key: "calendar", label: t("tab_calendar"), icon: CalendarDays, show: true, badge: ov?.awaitingApproval.length && (actor.isSuper || actor.perms.approve) ? ov.awaitingApproval.length : 0 },
    { key: "tasks", label: t("tab_tasks"), icon: CheckSquare, show: true, badge: ov?.tasksOverdue.length ?? 0 },
    { key: "campaigns", label: t("tab_campaigns"), icon: Megaphone, show: true },
    { key: "accounts", label: t("tab_accounts"), icon: KeyRound, show: true, badge: ov?.accountsAttention.filter((a) => a.connection_status === "needs_reconnect").length ?? 0 },
    { key: "library", label: t("tab_library"), icon: Images, show: true },
    { key: "contacts", label: t("tab_contacts"), icon: Users, show: true },
    { key: "feedback", label: t("tab_feedback"), icon: MessageSquareText, show: true },
    { key: "team", label: t("tab_team"), icon: UserCog, show: actor.isSuper },
  ];

  const openPost = (id: string) => setEditor({ id });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {TABS.filter((x) => x.show).map(({ key, label, icon: Icon, badge }) => (
          <button key={key} onClick={() => setTab(key)} className={`${ui.chip(tab === key)} flex items-center gap-1.5 !px-3 !py-2 !text-[12px]`}>
            <Icon size={13} /> {label}{badge ? <span className="ml-1 text-[10px] font-black px-1.5 rounded-full bg-red-600 text-white">{badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === "home" && ov && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: t("awaitingApproval"), n: ov.awaitingApproval.length, go: () => setTab("calendar"), icon: CalendarClock, tone: ov.awaitingApproval.length ? "text-amber-600" : "text-zinc-400" },
              { label: t("upcoming14"), n: ov.upcoming.length, go: () => setTab("calendar"), icon: CalendarDays, tone: "text-sky-600" },
              { label: t("tasksPending"), n: ov.tasksPending.length, go: () => setTab("tasks"), icon: CheckSquare, tone: ov.tasksOverdue.length ? "text-red-600" : "text-zinc-600" },
              { label: t("accountsAttention"), n: ov.accountsAttention.filter((a) => a.connection_status === "needs_reconnect").length, go: () => setTab("accounts"), icon: KeyRound, tone: "text-zinc-600" },
            ].map((c) => (
              <button key={c.label} onClick={c.go} className={`${ui.card} p-4 text-left hover:bg-zinc-50`}>
                <c.icon size={16} className={c.tone} />
                <p className="text-[26px] font-black text-zinc-900 mt-1 leading-none">{c.n}</p>
                <p className="text-[11px] text-zinc-400 mt-1">{c.label}</p>
              </button>
            ))}
          </div>

          {ov.settings?.monthly_goals && (
            <div className={`${ui.card} p-5`}>
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-2"><Target size={12} /> {t("monthlyGoals")}</p>
              <p className="text-[13px] text-zinc-700 whitespace-pre-wrap">{ov.settings.monthly_goals}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={`${ui.card} p-5`}>
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3">{t("awaitingApproval")}</p>
              {ov.awaitingApproval.length === 0 ? <p className="text-[12px] text-zinc-300">{t("nothingHere")}</p> : ov.awaitingApproval.map((p) => (
                <button key={p.id} onClick={() => openPost(p.id)} className="w-full text-left flex items-center gap-2 py-2 border-b border-zinc-50 last:border-0 hover:bg-zinc-50 rounded-lg px-1">
                  <Pill tone="amber">{t("postStatus_review")}</Pill><span className="text-[13px] font-bold text-zinc-800 flex-1 truncate">{p.title}</span><span className="text-[11px] text-zinc-400">{personLabel(p.created_by, admins)}</span>
                </button>
              ))}
            </div>
            <div className={`${ui.card} p-5`}>
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3">{t("upcoming14")}</p>
              {ov.upcoming.length === 0 ? <p className="text-[12px] text-zinc-300">{t("nothingHere")}</p> : ov.upcoming.map((p) => (
                <button key={p.id} onClick={() => openPost(p.id)} className="w-full text-left flex items-center gap-2 py-2 border-b border-zinc-50 last:border-0 hover:bg-zinc-50 rounded-lg px-1">
                  <Pill tone={STATUS_TONE[p.status]}>{t(`postStatus_${p.status}`)}</Pill><span className="text-[13px] font-bold text-zinc-800 flex-1 truncate">{p.title}</span><span className="text-[11px] text-zinc-500">{p.scheduled_at ? new Date(p.scheduled_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : ""}</span>
                </button>
              ))}
            </div>
            <div className={`${ui.card} p-5`}>
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Clock size={12} /> {t("tasksPending")}</p>
              {ov.tasksPending.length === 0 ? <p className="text-[12px] text-zinc-300">{t("nothingHere")}</p> : ov.tasksPending.slice(0, 8).map((x) => {
                const overdue = ov.tasksOverdue.some((o) => o.id === x.id);
                return <button key={x.id} onClick={() => setTab("tasks")} className="w-full text-left flex items-center gap-2 py-2 border-b border-zinc-50 last:border-0 hover:bg-zinc-50 rounded-lg px-1"><span className={`text-[13px] font-bold flex-1 truncate ${overdue ? "text-red-700" : "text-zinc-800"}`}>{x.title}</span><span className="text-[11px] text-zinc-400">{personLabel(x.assignee_username, admins)}{x.due_on ? ` · ${x.due_on}` : ""}</span></button>;
              })}
            </div>
            <div className={`${ui.card} p-5`}>
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3">{t("accountsAttention")}</p>
              {ov.accountsAttention.length === 0 ? <p className="text-[12px] text-zinc-300">{t("nothingHere")}</p> : ov.accountsAttention.map((a) => (
                <button key={a.id} onClick={() => setTab("accounts")} className="w-full text-left flex items-center gap-2 py-2 border-b border-zinc-50 last:border-0 hover:bg-zinc-50 rounded-lg px-1">
                  <Pill tone={a.connection_status === "needs_reconnect" ? "amber" : "zinc"}>{t(`conn_${a.connection_status}`)}</Pill><span className="text-[13px] font-bold text-zinc-800 flex-1 truncate">{a.label}</span><span className="text-[11px] text-zinc-400 truncate">{a.connection_note ?? ""}</span>
                </button>
              ))}
              <p className="text-[11px] text-zinc-400 mt-2">{t("integrationsLater")}</p>
            </div>
          </div>
        </div>
      )}

      {tab === "calendar" && <CalendarTab t={t} locale={locale} posts={posts} targets={targets} accounts={accounts} people={people} canCreate={canContent} onOpen={openPost} onNew={(d) => setEditor({ id: null, initialDate: d })} />}
      {tab === "tasks" && <TasksTab t={t} locale={locale} actor={actor} admins={admins} campaigns={campaigns} flash={flash} reload={loadAll} tasks={tasks} posts={posts} onOpenPost={openPost} />}
      {tab === "campaigns" && <CampaignsTab t={t} locale={locale} actor={actor} admins={admins} campaigns={campaigns} flash={flash} reload={loadAll} tasks={tasks} posts={posts} onOpenPost={openPost} />}
      {tab === "accounts" && <AccountsTab t={t} locale={locale} actor={actor} admins={admins} flash={flash} reload={loadAll} accounts={accounts} vaultOk={vaultOk} />}
      {tab === "library" && <LibraryTab t={t} locale={locale} actor={actor} admins={admins} flash={flash} reload={loadAll} items={library} />}
      {tab === "contacts" && <MarketingSection t={tAdmin} locale={locale} flash={flash} embedTab="contacts" />}
      {tab === "feedback" && <MarketingSection t={tAdmin} locale={locale} flash={flash} embedTab="feedback" />}
      {tab === "team" && <TeamTab t={t} locale={locale} actor={actor} settings={ov?.settings ?? null} flash={flash} onSettingsChanged={loadAll} />}

      {editor && (
        <PostEditor t={t} locale={locale} actor={actor} accounts={accounts} campaigns={campaigns} settings={ov?.settings ?? null} postId={editor.id} initialDate={editor.initialDate} onClose={() => setEditor(null)} onChanged={loadAll} flash={flash} />
      )}
    </div>
  );
}
