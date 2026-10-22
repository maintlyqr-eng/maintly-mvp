"use client";

// Tareas (spec §6) y Campañas (objetivo, fechas, presupuesto con aprobación
// del CEO sin pagos, tareas y publicaciones asociadas, comentarios).

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, MessageSquare, Send, CalendarClock } from "lucide-react";
import Modal from "./Modal";
import { Pill } from "../../page";
import { type Actor, type AdminLite, type Campaign, type Comment, type Post, type Task, type T, mkGet, mkPost, personLabel, fmtDateTime, ui } from "./shared";

type Common = { t: T; locale: string; actor: Actor; admins: AdminLite[]; campaigns: Campaign[]; flash: (m: string, tone?: "ok" | "error") => void; reload: () => void };

function Comments({ t, locale, type, id }: { t: T; locale: string; type: "task" | "campaign"; id: string }) {
  const [items, setItems] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  useEffect(() => { mkGet<{ items: Comment[] }>({ r: "comments", type, id }).then((j) => setItems(j.items)).catch(() => {}); }, [type, id]);
  async function add() {
    if (!draft.trim()) return;
    const res = await mkPost<{ item: Comment }>({ r: "comments", entity_type: type, entity_id: id, body: draft.trim() });
    if (res.ok) { setItems((x) => [...x, res.data.item]); setDraft(""); }
  }
  return (
    <div className="mt-3 pt-3 border-t border-zinc-100">
      <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1"><MessageSquare size={11} /> {t("comments")}</p>
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {items.length === 0 && <p className="text-[12px] text-zinc-300">{t("noComments")}</p>}
        {items.map((c) => <div key={c.id} className="text-[12px]"><span className="font-bold text-zinc-700">{c.author_username}</span> <span className="text-zinc-400">{fmtDateTime(c.created_at, locale)}</span><p className="text-zinc-700 whitespace-pre-wrap">{c.body}</p></div>)}
      </div>
      <div className="flex gap-1 mt-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={t("commentPlaceholder")} className="flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-[12px] outline-none focus:border-red-500" />
        <button type="button" onClick={add} className={ui.icon}><Send size={14} /></button>
      </div>
    </div>
  );
}

// ───────────────────────── Tareas ─────────────────────────
export function TasksTab({ t, locale, actor, admins, campaigns, flash, reload, tasks, posts, onOpenPost }: Common & { tasks: Task[]; posts: Post[]; onOpenPost: (id: string) => void }) {
  const [filter, setFilter] = useState<"open" | "mine" | "done">("open");
  const [modal, setModal] = useState<Partial<Task> | null>(null);
  const canEdit = actor.isSuper || actor.perms.content;
  const today = new Date().toISOString().slice(0, 10);
  const members = admins.filter((a) => a.active);

  const list = tasks.filter((x) => filter === "done" ? x.status === "done" : filter === "mine" ? x.status !== "done" && (x.assignee_username ?? "").toLowerCase() === actor.username.toLowerCase() : x.status !== "done");

  async function save() {
    if (!modal) return;
    const { id, created_at, created_by, done_at, ...fields } = modal;
    const res = await mkPost({ r: "tasks", id: id ?? null, ...fields });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    setModal(null); reload(); flash(t("saved"));
  }
  async function setStatus(task: Task, status: Task["status"]) {
    const res = await mkPost({ r: "tasks", id: task.id, status });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    reload();
  }
  async function remove(task: Task) {
    if (!confirm(t("confirmDelete", { name: task.title }))) return;
    const res = await mkPost({ r: "tasks", action: "delete", id: task.id });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    reload();
  }
  const prioTone: Record<Task["priority"], "zinc" | "amber" | "red"> = { low: "zinc", normal: "amber", high: "red" };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["open", "mine", "done"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={ui.chip(filter === f)}>{t(`taskFilter_${f}`)}</button>)}
        {canEdit && <button onClick={() => setModal({ title: "", priority: "normal", status: "todo", assignee_username: actor.username })} className={`${ui.primary} ml-auto flex items-center gap-1.5`}><Plus size={13} /> {t("newTask")}</button>}
      </div>
      <div className={`${ui.card} overflow-hidden`}>
        {list.length === 0 ? <p className="text-[13px] text-zinc-300 text-center py-14">{t("noTasks")}</p> : (
          <div className="divide-y divide-zinc-50">
            {list.map((task) => {
              const overdue = task.due_on && task.due_on < today && task.status !== "done";
              const camp = campaigns.find((c) => c.id === task.campaign_id);
              const post = posts.find((p) => p.id === task.post_id);
              return (
                <div key={task.id} className="px-5 py-3 flex items-start gap-3">
                  <button type="button" disabled={!canEdit} onClick={() => setStatus(task, task.status === "done" ? "todo" : "done")} className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${task.status === "done" ? "bg-emerald-600 border-emerald-600 text-white" : "border-zinc-300 hover:border-zinc-500"}`}>{task.status === "done" && <Check size={12} />}</button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-bold ${task.status === "done" ? "text-zinc-400 line-through" : "text-zinc-900"}`}>{task.title}</p>
                    <p className="text-[11px] text-zinc-400 flex flex-wrap gap-x-2">
                      <span>{personLabel(task.assignee_username, admins)}</span>
                      {task.due_on && <span className={overdue ? "text-red-600 font-bold" : ""}><CalendarClock size={10} className="inline" /> {task.due_on}</span>}
                      {camp && <span>· {camp.name}</span>}
                      {post && <button type="button" onClick={() => onOpenPost(post.id)} className="underline hover:text-zinc-700">· {post.title}</button>}
                    </p>
                    {task.description && <p className="text-[12px] text-zinc-500 mt-1 whitespace-pre-wrap">{task.description}</p>}
                  </div>
                  <Pill tone={prioTone[task.priority]}>{t(`prio_${task.priority}`)}</Pill>
                  {task.status !== "done" && canEdit && (
                    <select value={task.status} onChange={(e) => setStatus(task, e.target.value as Task["status"])} className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px]">
                      <option value="todo">{t("task_todo")}</option><option value="doing">{t("task_doing")}</option><option value="done">{t("task_done")}</option>
                    </select>
                  )}
                  {canEdit && <><button onClick={() => setModal(task)} className={ui.icon}><Pencil size={14} /></button><button onClick={() => remove(task)} className={`${ui.icon} hover:text-red-600`}><Trash2 size={14} /></button></>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal.id ? t("editTask") : t("newTask")} onClose={() => setModal(null)}>
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-3">
            <div><label className={ui.label}>{t("taskTitle")}</label><input required value={modal.title ?? ""} onChange={(e) => setModal({ ...modal, title: e.target.value })} className={ui.input} /></div>
            <div><label className={ui.label}>{t("description")}</label><textarea rows={3} value={modal.description ?? ""} onChange={(e) => setModal({ ...modal, description: e.target.value })} className={`${ui.input} resize-none`} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={ui.label}>{t("assignee")}</label><select value={modal.assignee_username ?? ""} onChange={(e) => setModal({ ...modal, assignee_username: e.target.value })} className={ui.input}><option value="">—</option>{members.map((m) => <option key={m.username} value={m.username}>{personLabel(m.username, admins)} (@{m.username})</option>)}</select></div>
              <div><label className={ui.label}>{t("dueDate")}</label><input type="date" value={modal.due_on ?? ""} onChange={(e) => setModal({ ...modal, due_on: e.target.value })} className={ui.input} /></div>
              <div><label className={ui.label}>{t("priority")}</label><select value={modal.priority ?? "normal"} onChange={(e) => setModal({ ...modal, priority: e.target.value as Task["priority"] })} className={ui.input}><option value="low">{t("prio_low")}</option><option value="normal">{t("prio_normal")}</option><option value="high">{t("prio_high")}</option></select></div>
              <div><label className={ui.label}>{t("campaign")}</label><select value={modal.campaign_id ?? ""} onChange={(e) => setModal({ ...modal, campaign_id: e.target.value || null })} className={ui.input}><option value="">—</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="col-span-2"><label className={ui.label}>{t("relatedPost")}</label><select value={modal.post_id ?? ""} onChange={(e) => setModal({ ...modal, post_id: e.target.value || null })} className={ui.input}><option value="">—</option>{posts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
            </div>
            {modal.id && <Comments t={t} locale={locale} type="task" id={modal.id} />}
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setModal(null)} className={ui.ghost}>{t("cancel")}</button><button type="submit" className={ui.primary}>{t("save")}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ───────────────────────── Campañas ─────────────────────────
export function CampaignsTab({ t, locale, actor, admins, campaigns, flash, reload, tasks, posts, onOpenPost }: Common & { tasks: Task[]; posts: Post[]; onOpenPost: (id: string) => void }) {
  const [modal, setModal] = useState<Partial<Campaign> | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const canEdit = actor.isSuper || actor.perms.content;

  async function save() {
    if (!modal) return;
    const { id, created_at, created_by, budget_approved_at, budget_approved_by, ...fields } = modal;
    const res = await mkPost({ r: "campaigns", id: id ?? null, ...fields });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    setModal(null); reload(); flash(t("saved"));
  }
  async function approveBudget(c: Campaign) {
    const note = prompt(t("budgetApproveNote")) ?? "";
    const res = await mkPost({ r: "campaigns", action: "approve_budget", id: c.id, budget_note: note });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    reload(); flash(t("budgetApproved"));
  }
  const list = campaigns.filter((c) => showClosed || c.status === "active");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={() => setShowClosed(!showClosed)} className={ui.chip(showClosed)}>{t("showClosed")}</button>
        {canEdit && <button onClick={() => setModal({ name: "", status: "active", budget_currency: "AUD" })} className={`${ui.primary} ml-auto flex items-center gap-1.5`}><Plus size={13} /> {t("newCampaign")}</button>}
      </div>
      {list.length === 0 ? <p className={`${ui.card} text-[13px] text-zinc-300 text-center py-14`}>{t("noCampaigns")}</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((c) => {
            const cTasks = tasks.filter((x) => x.campaign_id === c.id); const cPosts = posts.filter((p) => p.campaign_id === c.id);
            return (
              <div key={c.id} className={`${ui.card} p-5`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-black text-zinc-900">{c.name}</p>
                    <p className="text-[11px] text-zinc-400">{[c.starts_on, c.ends_on].filter(Boolean).join(" → ") || t("noDates")}{c.status === "closed" ? ` · ${t("closed")}` : ""}</p>
                  </div>
                  {canEdit && <button onClick={() => setModal(c)} className={ui.icon}><Pencil size={14} /></button>}
                </div>
                {c.objective && <p className="text-[12px] text-zinc-600 mt-2 whitespace-pre-wrap">{c.objective}</p>}
                <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-zinc-500">
                  <span>{t("tasksCount", { done: cTasks.filter((x) => x.status === "done").length, total: cTasks.length })}</span>
                  <span>{t("postsCount", { published: cPosts.filter((p) => p.status === "published").length, total: cPosts.length })}</span>
                </div>
                {c.budget_proposed !== null && (
                  <div className="mt-3 flex items-center justify-between gap-2 bg-zinc-50 rounded-xl px-3 py-2">
                    <span className="text-[12px] text-zinc-700"><span className="font-bold">{c.budget_currency} {Number(c.budget_proposed).toLocaleString(locale)}</span> {c.budget_approved_at ? <span className="text-emerald-700">· {t("budgetApprovedBy", { user: personLabel(c.budget_approved_by, admins), when: fmtDateTime(c.budget_approved_at, locale) })}</span> : <span className="text-amber-700">· {t("budgetPending")}</span>}</span>
                    {!c.budget_approved_at && actor.isSuper && <button onClick={() => approveBudget(c)} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">{t("approveBudget")}</button>}
                  </div>
                )}
                {c.budget_note && <p className="text-[11px] text-zinc-400 mt-1">{c.budget_note}</p>}
                {cPosts.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{cPosts.slice(0, 6).map((p) => <button key={p.id} type="button" onClick={() => onOpenPost(p.id)} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 truncate max-w-[160px]">{p.title}</button>)}</div>}
              </div>
            );
          })}
        </div>
      )}
      {modal && (
        <Modal title={modal.id ? t("editCampaign") : t("newCampaign")} onClose={() => setModal(null)}>
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-3">
            <div><label className={ui.label}>{t("campaignName")}</label><input required value={modal.name ?? ""} onChange={(e) => setModal({ ...modal, name: e.target.value })} className={ui.input} /></div>
            <div><label className={ui.label}>{t("objective")}</label><textarea rows={3} value={modal.objective ?? ""} onChange={(e) => setModal({ ...modal, objective: e.target.value })} className={`${ui.input} resize-none`} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={ui.label}>{t("startsOn")}</label><input type="date" value={modal.starts_on ?? ""} onChange={(e) => setModal({ ...modal, starts_on: e.target.value })} className={ui.input} /></div>
              <div><label className={ui.label}>{t("endsOn")}</label><input type="date" value={modal.ends_on ?? ""} onChange={(e) => setModal({ ...modal, ends_on: e.target.value })} className={ui.input} /></div>
              <div><label className={ui.label}>{t("budgetProposed")}</label><input type="number" step="0.01" min="0" value={modal.budget_proposed ?? ""} onChange={(e) => setModal({ ...modal, budget_proposed: e.target.value === "" ? null : Number(e.target.value) })} className={ui.input} /></div>
              <div><label className={ui.label}>{t("currency")}</label><select value={modal.budget_currency ?? "AUD"} onChange={(e) => setModal({ ...modal, budget_currency: e.target.value })} className={ui.input}>{["AUD", "USD", "ARS", "BRL", "EUR"].map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className={ui.label}>{t("status")}</label><select value={modal.status ?? "active"} onChange={(e) => setModal({ ...modal, status: e.target.value as Campaign["status"] })} className={ui.input}><option value="active">{t("active")}</option><option value="closed">{t("closed")}</option></select></div>
            </div>
            <p className="text-[11px] text-zinc-400">{t("budgetHint")}</p>
            {modal.id && <Comments t={t} locale={locale} type="campaign" id={modal.id} />}
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setModal(null)} className={ui.ghost}>{t("cancel")}</button><button type="submit" className={ui.primary}>{t("save")}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
