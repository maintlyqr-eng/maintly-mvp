"use client";

// Equipo del departamento (solo Super Admin): miembros y permisos por
// persona (spec §1), ajustes (aprobación obligatoria, zona horaria,
// objetivos del mes) y transferencia del departamento (spec §9).

import { useEffect, useState } from "react";
import { UserCog, ShieldCheck, ArrowRightLeft, Check } from "lucide-react";
import { Pill } from "../../page";
import { type Actor, type AdminLite, type Handover, type Member, type Perm, type Settings, type T, PERMS, mkGet, mkPost, personLabel, fmtDateTime, ui } from "./shared";

type Props = { t: T; locale: string; actor: Actor; settings: Settings | null; flash: (m: string, tone?: "ok" | "error") => void; onSettingsChanged: () => void };

export default function TeamTab({ t, locale, actor, settings, flash, onSettingsChanged }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [admins, setAdmins] = useState<AdminLite[]>([]);
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<{ username: string; title: string; is_lead: boolean; permissions: Record<Perm, boolean> } | null>(null);
  const [goals, setGoals] = useState(settings?.monthly_goals ?? "");
  const [tz, setTz] = useState(settings?.default_timezone ?? "Australia/Brisbane");
  const [reqApproval, setReqApproval] = useState(settings?.require_approval ?? true);
  const [hoFrom, setHoFrom] = useState(""); const [hoTo, setHoTo] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [m, h] = await Promise.all([mkGet<{ members: Member[]; admins: AdminLite[] }>({ r: "members" }), mkGet<{ items: Handover[] }>({ r: "handovers" })]);
      setMembers(m.members); setAdmins(m.admins); setHandovers(h.items);
    } catch (e) { flash(e instanceof Error ? e.message : String(e), "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setGoals(settings?.monthly_goals ?? ""); setTz(settings?.default_timezone ?? "Australia/Brisbane"); setReqApproval(settings?.require_approval ?? true); }, [settings]);

  if (!actor.isSuper) return null;
  const active = members.filter((m) => !m.revoked_at);
  const candidates = admins.filter((a) => a.active && a.role !== "super_admin");

  function startEdit(username: string) {
    const m = members.find((x) => x.username.toLowerCase() === username.toLowerCase());
    const perms = Object.fromEntries(PERMS.map((p) => [p, !!m?.permissions?.[p]])) as Record<Perm, boolean>;
    setEdit({ username, title: m?.title ?? "", is_lead: !!m?.is_lead, permissions: perms });
  }
  async function saveMember() {
    if (!edit) return;
    const res = await mkPost({ r: "members", ...edit });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    setEdit(null); load(); flash(t("saved"));
  }
  async function revoke(username: string) {
    if (!confirm(t("confirmRevoke", { user: username }))) return;
    const res = await mkPost({ r: "members", action: "revoke", username });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    load();
  }
  async function saveSettings() {
    const res = await mkPost({ r: "settings", require_approval: reqApproval, default_timezone: tz, monthly_goals: goals });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    onSettingsChanged(); flash(t("saved"));
  }
  async function startHandover() {
    if (!hoFrom) return;
    const res = await mkPost({ r: "handover", action: "start", from_username: hoFrom, to_username: hoTo || null });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    setHoFrom(""); setHoTo(""); load();
  }
  async function step(h: Handover, key: string, done: boolean) {
    const res = await mkPost({ r: "handover", action: "step", id: h.id, key, done });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    load();
  }
  async function complete(h: Handover) {
    const res = await mkPost({ r: "handover", action: "complete", id: h.id });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    load(); flash(t("handoverCompleted"));
  }

  return (
    <div className="space-y-5">
      {/* Miembros */}
      <div className={`${ui.card} p-5`}>
        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><UserCog size={12} /> {t("membersTitle")}</p>
        <p className="text-[12px] text-zinc-400 mb-4">{t("membersHint")}</p>
        {loading ? <p className="text-[12px] text-zinc-400">{t("loading")}</p> : (
          <div className="space-y-2">
            {active.length === 0 && <p className="text-[12px] text-zinc-300">{t("noMembers")}</p>}
            {active.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3">
                <div className="flex-1 min-w-[180px]">
                  <p className="text-[13px] font-bold text-zinc-900">{personLabel(m.username, admins)} <span className="text-[11px] font-medium text-zinc-400">@{m.username}</span>{m.is_lead && <Pill tone="emerald">{t("lead")}</Pill>}</p>
                  <p className="text-[11px] text-zinc-400">{m.title ?? "—"} · {t("grantedBy", { user: m.granted_by ?? "—", when: fmtDateTime(m.granted_at, locale) })}</p>
                </div>
                <div className="flex flex-wrap gap-1">{PERMS.map((p) => <span key={p} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.permissions?.[p] ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-zinc-50 text-zinc-300 border border-zinc-100"}`}>{t(`perm_${p}`)}</span>)}</div>
                <button onClick={() => startEdit(m.username)} className={ui.ghost}>{t("editPermissions")}</button>
                <button onClick={() => revoke(m.username)} className="text-[12px] font-bold text-red-600 hover:underline px-2">{t("revoke")}</button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <select onChange={(e) => { if (e.target.value) startEdit(e.target.value); e.target.value = ""; }} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px]" defaultValue="">
                <option value="">{t("addMemberSelect")}</option>
                {candidates.filter((a) => !active.some((m) => m.username.toLowerCase() === a.username.toLowerCase())).map((a) => <option key={a.username} value={a.username}>{personLabel(a.username, admins)} (@{a.username}, {a.role})</option>)}
              </select>
              <p className="text-[11px] text-zinc-400">{t("addMemberHint")}</p>
            </div>
          </div>
        )}
      </div>

      {edit && (
        <div className={`${ui.card} p-5 border-2 !border-zinc-900`}>
          <p className="text-[13px] font-black text-zinc-900 mb-3">{t("permissionsFor", { user: personLabel(edit.username, admins) })}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div><label className={ui.label}>{t("jobTitle")}</label><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Social Media & Marketing Manager" className={ui.input} /></div>
            <label className="flex items-center gap-2 text-[12px] text-zinc-700 mt-6"><input type="checkbox" checked={edit.is_lead} onChange={(e) => setEdit({ ...edit, is_lead: e.target.checked })} /> {t("isLead")}</label>
          </div>
          <div className="space-y-2">
            {PERMS.map((p) => (
              <label key={p} className="flex items-start gap-3 rounded-xl border border-zinc-200 px-3 py-2 cursor-pointer hover:bg-zinc-50">
                <input type="checkbox" checked={edit.permissions[p]} onChange={(e) => setEdit({ ...edit, permissions: { ...edit.permissions, [p]: e.target.checked } })} className="mt-1" />
                <span><span className="text-[13px] font-bold text-zinc-800">{t(`perm_${p}`)}</span><span className="block text-[11px] text-zinc-400">{t(`permDesc_${p}`)}</span></span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-3"><button onClick={() => setEdit(null)} className={ui.ghost}>{t("cancel")}</button><button onClick={saveMember} className={ui.primary}>{t("save")}</button></div>
        </div>
      )}

      {/* Ajustes */}
      <div className={`${ui.card} p-5`}>
        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-3"><ShieldCheck size={12} /> {t("settingsTitle")}</p>
        <label className="flex items-start gap-3 text-[12px] text-zinc-700 mb-3"><input type="checkbox" checked={reqApproval} onChange={(e) => setReqApproval(e.target.checked)} className="mt-0.5" /><span><span className="font-bold">{t("requireApproval")}</span><span className="block text-[11px] text-zinc-400">{t("requireApprovalHint")}</span></span></label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={ui.label}>{t("defaultTimezone")}</label><input value={tz} onChange={(e) => setTz(e.target.value)} className={ui.input} /></div>
          <div className="sm:col-span-2"><label className={ui.label}>{t("monthlyGoals")}</label><textarea rows={3} value={goals} onChange={(e) => setGoals(e.target.value)} placeholder={t("monthlyGoalsPlaceholder")} className={`${ui.input} resize-none`} /></div>
        </div>
        <div className="flex justify-end mt-3"><button onClick={saveSettings} className={ui.primary}>{t("save")}</button></div>
      </div>

      {/* Transferencia */}
      <div className={`${ui.card} p-5`}>
        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><ArrowRightLeft size={12} /> {t("handoverTitle")}</p>
        <p className="text-[12px] text-zinc-400 mb-3">{t("handoverHint")}</p>
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div><label className={ui.label}>{t("handoverFrom")}</label><select value={hoFrom} onChange={(e) => setHoFrom(e.target.value)} className={ui.input}><option value="">—</option>{active.map((m) => <option key={m.username} value={m.username}>{personLabel(m.username, admins)}</option>)}</select></div>
          <div><label className={ui.label}>{t("handoverTo")}</label><select value={hoTo} onChange={(e) => setHoTo(e.target.value)} className={ui.input}><option value="">{t("handoverToLater")}</option>{candidates.filter((a) => a.username !== hoFrom).map((a) => <option key={a.username} value={a.username}>{personLabel(a.username, admins)}</option>)}</select></div>
          <button onClick={startHandover} disabled={!hoFrom} className={ui.primary}>{t("startHandover")}</button>
        </div>
        {handovers.map((h) => (
          <div key={h.id} className={`rounded-xl border px-4 py-3 mb-2 ${h.completed_at ? "border-zinc-100 opacity-70" : "border-amber-300 bg-amber-50/40"}`}>
            <p className="text-[12px] font-bold text-zinc-800">{personLabel(h.from_username, admins)} → {h.to_username ? personLabel(h.to_username, admins) : t("handoverToLater")} <span className="font-medium text-zinc-400">· {fmtDateTime(h.started_at, locale)}{h.completed_at ? ` · ${t("completed")}` : ""}</span></p>
            <ul className="mt-2 space-y-1">
              {h.checklist.map((s) => (
                <li key={s.key} className="flex items-start gap-2 text-[12px]">
                  <button type="button" disabled={!!h.completed_at} onClick={() => step(h, s.key, !s.done)} className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${s.done ? "bg-emerald-600 border-emerald-600 text-white" : "border-zinc-300"}`}>{s.done && <Check size={10} />}</button>
                  <span className={s.done ? "text-zinc-400 line-through" : "text-zinc-700"}>{s.label}{s.done && s.done_by ? <span className="no-underline text-[10px] text-zinc-400"> · {s.done_by}</span> : null}</span>
                </li>
              ))}
            </ul>
            {!h.completed_at && h.checklist.every((s) => s.done) && <button onClick={() => complete(h)} className={`${ui.primary} mt-2`}>{t("completeHandover")}</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
