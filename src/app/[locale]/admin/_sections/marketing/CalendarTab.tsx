"use client";

// Calendario mensual/semanal de publicaciones (spec §5) con filtros por
// red, responsable y estado, más una lista. Tocar un día crea una
// publicación con esa fecha; tocar una publicación la abre.

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, List, CalendarDays } from "lucide-react";
import { Pill } from "../../page";
import { type Account, type Post, type PostStatus, type Target, type T, STATUS_TONE, ui } from "./shared";

type Props = {
  t: T; locale: string; posts: Post[]; targets: Target[]; accounts: Account[]; people: string[];
  canCreate: boolean; onOpen: (id: string) => void; onNew: (initialDate?: string) => void;
};

const STATUSES: PostStatus[] = ["draft", "review", "approved", "scheduled", "published", "cancelled"];

function ymd(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export default function CalendarTab({ t, locale, posts, targets, accounts, people, canCreate, onOpen, onNew }: Props) {
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [fPlatform, setFPlatform] = useState("all");
  const [fPerson, setFPerson] = useState("all");
  const [fStatus, setFStatus] = useState<"all" | PostStatus>("all");

  const targetsByPost = useMemo(() => { const m = new Map<string, Target[]>(); for (const tg of targets) { const arr = m.get(tg.post_id) ?? []; arr.push(tg); m.set(tg.post_id, arr); } return m; }, [targets]);
  const platformOf = (accountId: string) => accounts.find((a) => a.id === accountId)?.platform ?? "?";

  const filtered = posts.filter((p) => {
    if (fStatus !== "all" && p.status !== fStatus) return false;
    if (fPerson !== "all" && (p.created_by ?? "").toLowerCase() !== fPerson.toLowerCase()) return false;
    if (fPlatform !== "all" && !(targetsByPost.get(p.id) ?? []).some((tg) => platformOf(tg.account_id) === fPlatform)) return false;
    return true;
  });

  const byDay = useMemo(() => { const m = new Map<string, Post[]>(); for (const p of filtered) { if (!p.scheduled_at) continue; const k = ymd(new Date(p.scheduled_at)); const arr = m.get(k) ?? []; arr.push(p); m.set(k, arr); } return m; }, [filtered]);
  const unscheduled = filtered.filter((p) => !p.scheduled_at);

  // Rango visible
  const days: Date[] = useMemo(() => {
    const out: Date[] = [];
    if (view === "week") {
      const start = new Date(cursor); const dow = (start.getDay() + 6) % 7; start.setDate(start.getDate() - dow);
      for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); out.push(d); }
    } else {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const start = new Date(first); const dow = (first.getDay() + 6) % 7; start.setDate(first.getDate() - dow);
      for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); out.push(d); }
    }
    return out;
  }, [cursor, view]);

  function move(delta: number) {
    const d = new Date(cursor);
    if (view === "week") d.setDate(d.getDate() + 7 * delta); else d.setMonth(d.getMonth() + delta);
    setCursor(d);
  }
  const todayKey = ymd(new Date());
  const monthLabel = cursor.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const weekdays = useMemo(() => { const base = new Date(2024, 0, 1); return Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(base.getDate() + i); return d.toLocaleDateString(locale, { weekday: "short" }); }); }, [locale]);

  const PostChip = ({ p }: { p: Post }) => {
    const tgs = targetsByPost.get(p.id) ?? [];
    const tone = STATUS_TONE[p.status];
    const bg = { zinc: "bg-zinc-100 text-zinc-700", amber: "bg-amber-100 text-amber-800", blue: "bg-sky-100 text-sky-800", emerald: "bg-emerald-100 text-emerald-800", red: "bg-red-100 text-red-700 line-through" }[tone];
    return (
      <button type="button" onClick={() => onOpen(p.id)} className={`w-full text-left rounded-lg px-1.5 py-1 text-[11px] font-semibold leading-tight ${bg} hover:brightness-95`} title={p.title}>
        <span className="block truncate">{p.scheduled_at ? new Date(p.scheduled_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: p.timezone }) + " · " : ""}{p.title}</span>
        {tgs.length > 0 && <span className="block text-[9px] uppercase tracking-wider opacity-70">{Array.from(new Set(tgs.map((x) => platformOf(x.account_id)))).join(" · ")}</span>}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(["month", "week", "list"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={ui.chip(view === v)}>{v === "list" ? <List size={12} className="inline" /> : <CalendarDays size={12} className="inline" />} {t(`view_${v}`)}</button>)}
        </div>
        {view !== "list" && (
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => move(-1)} className={ui.icon}><ChevronLeft size={16} /></button>
            <span className="text-[13px] font-bold text-zinc-800 capitalize min-w-[150px] text-center">{monthLabel}</span>
            <button onClick={() => move(1)} className={ui.icon}><ChevronRight size={16} /></button>
            <button onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setCursor(d); }} className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900 px-2">{t("today")}</button>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 ml-auto">
          <select value={fPlatform} onChange={(e) => setFPlatform(e.target.value)} className="rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-[11px]"><option value="all">{t("allNetworks")}</option>{Array.from(new Set(accounts.map((a) => a.platform))).map((p) => <option key={p} value={p}>{p}</option>)}</select>
          <select value={fPerson} onChange={(e) => setFPerson(e.target.value)} className="rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-[11px]"><option value="all">{t("allPeople")}</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as "all" | PostStatus)} className="rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-[11px]"><option value="all">{t("allStatuses")}</option>{STATUSES.map((s) => <option key={s} value={s}>{t(`postStatus_${s}`)}</option>)}</select>
          {canCreate && <button onClick={() => onNew()} className={`${ui.primary} flex items-center gap-1.5`}><Plus size={13} /> {t("newPost")}</button>}
        </div>
      </div>

      {view !== "list" ? (
        <div className={`${ui.card} overflow-hidden`}>
          <div className="grid grid-cols-7 border-b border-zinc-100 bg-zinc-50">{weekdays.map((w) => <div key={w} className="px-2 py-2 text-[9px] font-bold text-zinc-400 uppercase tracking-widest text-center">{w}</div>)}</div>
          <div className={`grid grid-cols-7 ${view === "week" ? "" : "auto-rows-[minmax(96px,auto)]"}`}>
            {days.map((d) => {
              const k = ymd(d); const inMonth = d.getMonth() === cursor.getMonth(); const items = byDay.get(k) ?? [];
              return (
                <div key={k} className={`border-b border-r border-zinc-100 p-1.5 ${view === "week" ? "min-h-[260px]" : ""} ${inMonth || view === "week" ? "" : "bg-zinc-50/60"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-bold ${k === todayKey ? "bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center" : inMonth || view === "week" ? "text-zinc-700" : "text-zinc-300"}`}>{d.getDate()}</span>
                    {canCreate && <button type="button" onClick={() => onNew(`${k}T10:00`)} className="text-zinc-300 hover:text-zinc-700" title={t("newPost")}><Plus size={12} /></button>}
                  </div>
                  <div className="space-y-1">{items.map((p) => <PostChip key={p.id} p={p} />)}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={`${ui.card} overflow-hidden`}>
          {filtered.length === 0 ? <p className="text-[13px] text-zinc-300 text-center py-16">{t("noPosts")}</p> : (
            <div className="divide-y divide-zinc-50">
              {[...filtered].sort((a, b) => (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999")).map((p) => (
                <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-zinc-50">
                  <Pill tone={STATUS_TONE[p.status]}>{t(`postStatus_${p.status}`)}</Pill>
                  <span className="text-[13px] font-bold text-zinc-900 flex-1 truncate">{p.title}</span>
                  <span className="text-[11px] text-zinc-400 hidden sm:inline">{Array.from(new Set((targetsByPost.get(p.id) ?? []).map((x) => platformOf(x.account_id)))).join(" · ")}</span>
                  <span className="text-[11px] text-zinc-500 w-36 text-right">{p.scheduled_at ? new Date(p.scheduled_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short", timeZone: p.timezone }) : t("noDate")}</span>
                  <span className="text-[11px] text-zinc-400 w-24 truncate text-right">{p.created_by}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {view !== "list" && unscheduled.length > 0 && (
        <div className={`${ui.card} p-4`}>
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{t("unscheduled", { n: unscheduled.length })}</p>
          <div className="flex flex-wrap gap-2">{unscheduled.map((p) => <div key={p.id} className="w-56"><PostChip p={p} /></div>)}</div>
        </div>
      )}
    </div>
  );
}
