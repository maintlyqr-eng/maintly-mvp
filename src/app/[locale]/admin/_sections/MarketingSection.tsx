"use client";

// Espacio de Marketing (Facu, 21/10/2026: "hay que armarle un dashboard en
// el que ella pueda trabajar y ser productiva"). Lo ven el rol marketing y
// el Super Admin. Pestañas: Resumen, Cuentas (bóveda de redes con
// contraseñas cifradas), Contactos (mini CRM) y Consultas/feedback.
// API: /api/admin/marketing (un handler, ?resource=…).

import { useEffect, useState } from "react";
import { KeyRound, Users, MessageSquareText, LayoutGrid, Plus, Pencil, Trash2, Eye, EyeOff, Copy, Check, ExternalLink, X, AlertTriangle, CalendarClock } from "lucide-react";
import PasswordInput from "@/components/PasswordInput";
import { Pill } from "../page";

type Account = { id: string; platform: string; label: string; username: string | null; recovery_email: string | null; two_factor: string | null; url: string | null; notes: string | null; has_password: boolean; updated_at: string; updated_by: string | null };
type Contact = { id: string; name: string; company: string | null; source: string | null; handle: string | null; status: "new" | "contacted" | "interested" | "customer" | "discarded"; next_action: string | null; next_action_at: string | null; notes: string | null; updated_at: string };
type Feedback = { id: string; created_at: string; source: string | null; author: string | null; kind: "question" | "praise" | "complaint" | "idea"; body: string; status: "pending" | "answered" | "escalated"; answer: string | null };

type Props = {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;
  flash: (text: string, tone?: "ok" | "error") => void;
};

const PLATFORMS = ["instagram", "facebook", "tiktok", "linkedin", "x", "youtube", "google", "canva", "other"];
const SOURCES = ["instagram", "facebook", "tiktok", "linkedin", "whatsapp", "web", "email", "event", "other"];

async function api(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
  const r = await fetch("/api/admin/marketing", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && !j.error, data: j, error: j.error as string | undefined };
}

const inputCls = "w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 bg-white";
const labelCls = "text-[12px] font-bold text-zinc-700";
const btnPrimary = "text-[12px] font-bold px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40";
const btnGhost = "text-[12px] font-bold px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50";
const btnIcon = "p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h2 className="text-[15px] font-black text-zinc-900">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export default function MarketingSection({ t, locale, flash }: Props) {
  const [tab, setTab] = useState<"summary" | "accounts" | "contacts" | "feedback">("summary");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [vaultOk, setVaultOk] = useState(true);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    try {
      const [a, c, f] = await Promise.all(
        (["accounts", "contacts", "feedback"] as const).map((r) => fetch(`/api/admin/marketing?resource=${r}`).then((x) => x.json()).catch(() => ({})))
      );
      setAccounts((a.items as Account[]) ?? []); setVaultOk(a.vaultConfigured !== false);
      setContacts((c.items as Contact[]) ?? []);
      setFeedback((f.items as Feedback[]) ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { loadAll(); }, []);

  // ── Cuentas ──
  const [accModal, setAccModal] = useState<Partial<Account> & { password?: string } | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function reveal(id: string) {
    if (revealed[id] !== undefined) { setRevealed((r) => { const n = { ...r }; delete n[id]; return n; }); return; }
    const r = await fetch(`/api/admin/marketing?resource=accounts&reveal=${encodeURIComponent(id)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { flash(j.error || t("mkVaultError"), "error"); return; }
    setRevealed((x) => ({ ...x, [id]: j.password ?? "" }));
  }
  async function copyPassword(id: string) {
    let pw = revealed[id];
    if (pw === undefined) {
      const r = await fetch(`/api/admin/marketing?resource=accounts&reveal=${encodeURIComponent(id)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { flash(j.error || t("mkVaultError"), "error"); return; }
      pw = j.password ?? "";
    }
    try { await navigator.clipboard.writeText(pw); setCopiedId(id); setTimeout(() => setCopiedId(null), 1500); } catch { /* sin clipboard */ }
  }
  async function saveAccount() {
    if (!accModal) return;
    const { id, password, has_password, updated_at, updated_by, ...fields } = accModal;
    const res = id
      ? await api("PATCH", { resource: "accounts", id, ...fields, password: password ?? "" })
      : await api("POST", { resource: "accounts", ...fields, password: password ?? "" });
    if (!res.ok) { flash(res.error === "vault_not_configured" ? t("mkVaultNotConfigured") : res.error || t("errorGeneric"), "error"); return; }
    const item = res.data.item as Account;
    setAccounts((prev) => (id ? prev.map((a) => (a.id === id ? item : a)) : [item, ...prev]));
    setRevealed((r) => { const n = { ...r }; if (id) delete n[id]; return n; });
    setAccModal(null); flash(t("saved"));
  }
  async function deleteAccount(a: Account) {
    if (!confirm(t("mkDeleteConfirm", { name: a.label }))) return;
    const res = await api("DELETE", { resource: "accounts", id: a.id });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    setAccounts((prev) => prev.filter((x) => x.id !== a.id));
  }

  // ── Contactos ──
  const [contactModal, setContactModal] = useState<Partial<Contact> | null>(null);
  const [contactFilter, setContactFilter] = useState<"all" | Contact["status"]>("all");
  async function saveContact() {
    if (!contactModal) return;
    const { id, updated_at, ...fields } = contactModal;
    const res = id ? await api("PATCH", { resource: "contacts", id, ...fields }) : await api("POST", { resource: "contacts", ...fields });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    const item = res.data.item as Contact;
    setContacts((prev) => (id ? prev.map((c) => (c.id === id ? item : c)) : [item, ...prev]));
    setContactModal(null); flash(t("saved"));
  }
  async function setContactStatus(c: Contact, status: Contact["status"]) {
    const res = await api("PATCH", { resource: "contacts", id: c.id, status });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, status } : x)));
  }
  async function deleteContact(c: Contact) {
    if (!confirm(t("mkDeleteConfirm", { name: c.name }))) return;
    const res = await api("DELETE", { resource: "contacts", id: c.id });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    setContacts((prev) => prev.filter((x) => x.id !== c.id));
  }

  // ── Feedback ──
  const [fbModal, setFbModal] = useState<Partial<Feedback> | null>(null);
  const [fbFilter, setFbFilter] = useState<"all" | Feedback["status"]>("all");
  async function saveFeedback() {
    if (!fbModal) return;
    const { id, created_at, ...fields } = fbModal;
    const res = id ? await api("PATCH", { resource: "feedback", id, ...fields }) : await api("POST", { resource: "feedback", ...fields });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    const item = res.data.item as Feedback;
    setFeedback((prev) => (id ? prev.map((f) => (f.id === id ? item : f)) : [item, ...prev]));
    setFbModal(null); flash(t("saved"));
  }
  async function deleteFeedback(f: Feedback) {
    if (!confirm(t("mkDeleteConfirm", { name: f.body.slice(0, 40) }))) return;
    const res = await api("DELETE", { resource: "feedback", id: f.id });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    setFeedback((prev) => prev.filter((x) => x.id !== f.id));
  }

  const statusTone: Record<Contact["status"], "zinc" | "blue" | "amber" | "emerald" | "red"> = { new: "zinc", contacted: "blue", interested: "amber", customer: "emerald", discarded: "red" };
  const kindTone: Record<Feedback["kind"], "blue" | "emerald" | "red" | "amber"> = { question: "blue", praise: "emerald", complaint: "red", idea: "amber" };
  const fbStatusTone: Record<Feedback["status"], "amber" | "emerald" | "red"> = { pending: "amber", answered: "emerald", escalated: "red" };

  const today = new Date().toISOString().slice(0, 10);
  const dueContacts = contacts.filter((c) => c.next_action_at && c.next_action_at <= today && c.status !== "customer" && c.status !== "discarded");
  const pendingFb = feedback.filter((f) => f.status === "pending");

  const TABS = [
    ["summary", t("mkTabSummary"), LayoutGrid],
    ["accounts", t("mkTabAccounts"), KeyRound],
    ["contacts", t("mkTabContacts"), Users],
    ["feedback", t("mkTabFeedback"), MessageSquareText],
  ] as const;

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-zinc-400">{t("mkIntro")}</p>
      <div className="flex gap-2 flex-wrap">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`text-[12px] font-bold px-3.5 py-2 rounded-xl border flex items-center gap-1.5 ${tab === key ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50"}`}>
            <Icon size={13} /> {label}
            {key === "contacts" && dueContacts.length > 0 && <span className="ml-1 text-[10px] font-black px-1.5 rounded-full bg-red-600 text-white">{dueContacts.length}</span>}
            {key === "feedback" && pendingFb.length > 0 && <span className="ml-1 text-[10px] font-black px-1.5 rounded-full bg-red-600 text-white">{pendingFb.length}</span>}
          </button>
        ))}
      </div>

      {loading ? <p className="text-[13px] text-zinc-400 text-center py-16">{t("loading")}</p> : (
        <>
          {tab === "summary" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-5">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">{t("mkTabAccounts")}</p>
                <p className="text-[28px] font-black text-zinc-900 mt-1">{accounts.length}</p>
                <p className="text-[12px] text-zinc-400">{t("mkSummaryAccounts")}</p>
              </div>
              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-5">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">{t("mkTabContacts")}</p>
                <p className="text-[28px] font-black text-zinc-900 mt-1">{contacts.filter((c) => c.status !== "discarded").length}</p>
                <p className="text-[12px] text-zinc-400">{t("mkSummaryContacts", { due: dueContacts.length, customers: contacts.filter((c) => c.status === "customer").length })}</p>
              </div>
              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-5">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">{t("mkTabFeedback")}</p>
                <p className="text-[28px] font-black text-zinc-900 mt-1">{pendingFb.length}</p>
                <p className="text-[12px] text-zinc-400">{t("mkSummaryFeedback")}</p>
              </div>
              {dueContacts.length > 0 && (
                <div className="md:col-span-3 bg-amber-50 border border-amber-200 rounded-2xl p-5">
                  <p className="text-[12px] font-bold text-amber-800 flex items-center gap-2 mb-2"><CalendarClock size={14} /> {t("mkDueTitle")}</p>
                  <ul className="space-y-1">
                    {dueContacts.slice(0, 8).map((c) => (
                      <li key={c.id} className="text-[12px] text-amber-900"><span className="font-bold">{c.name}</span>{c.company ? ` · ${c.company}` : ""} — {c.next_action ?? t("mkFollowUp")} ({c.next_action_at})</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="md:col-span-3 bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-5">
                <p className="text-[12px] font-bold text-zinc-700 mb-1">{t("mkStatsHint")}</p>
                <p className="text-[12px] text-zinc-400">{t("mkStatsHintBody")}</p>
              </div>
            </div>
          )}

          {tab === "accounts" && (
            <div className="space-y-3">
              {!vaultOk && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[12px] text-red-700"><AlertTriangle size={15} className="shrink-0 mt-0.5" /> {t("mkVaultNotConfigured")}</div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-zinc-400">{t("mkAccountsHint")}</p>
                <button onClick={() => setAccModal({ platform: "instagram", label: "", password: "" })} className={`${btnPrimary} flex items-center gap-1.5`}><Plus size={13} /> {t("mkAddAccount")}</button>
              </div>
              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                {accounts.length === 0 ? <p className="text-[13px] text-zinc-300 text-center py-16">{t("mkNoAccounts")}</p> : (
                  <div className="divide-y divide-zinc-50">
                    {accounts.map((a) => (
                      <div key={a.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center text-[11px] font-black uppercase shrink-0">{a.platform.slice(0, 2)}</div>
                        <div className="flex-1 min-w-[200px]">
                          <p className="text-[13px] font-bold text-zinc-900 flex items-center gap-2">{a.label}{a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-900"><ExternalLink size={12} /></a>}</p>
                          <p className="text-[12px] text-zinc-500">{a.username ?? "—"}{a.recovery_email ? ` · ${a.recovery_email}` : ""}{a.two_factor ? ` · 2FA: ${a.two_factor}` : ""}</p>
                          {a.notes && <p className="text-[11px] text-zinc-400 mt-0.5 whitespace-pre-wrap">{a.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1 min-w-[220px]">
                          <code className="text-[12px] font-mono bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 flex-1 truncate">{a.has_password ? (revealed[a.id] !== undefined ? revealed[a.id] || "(vacía)" : "••••••••••") : <span className="text-zinc-300">{t("mkNoPassword")}</span>}</code>
                          {a.has_password && (
                            <>
                              <button onClick={() => reveal(a.id)} className={btnIcon} title={t("mkReveal")}>{revealed[a.id] !== undefined ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                              <button onClick={() => copyPassword(a.id)} className={btnIcon} title={t("copyLink")}>{copiedId === a.id ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}</button>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setAccModal({ ...a, password: "" })} className={btnIcon}><Pencil size={15} /></button>
                          <button onClick={() => deleteAccount(a)} className={`${btnIcon} hover:text-red-600`}><Trash2 size={15} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">{t("mkRevealAudited")}</p>
            </div>
          )}

          {tab === "contacts" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-1.5 flex-wrap">
                  {(["all", "new", "contacted", "interested", "customer", "discarded"] as const).map((s) => (
                    <button key={s} onClick={() => setContactFilter(s)} className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border ${contactFilter === s ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200"}`}>{s === "all" ? t("all") : t(`mkStatus_${s}`)}</button>
                  ))}
                </div>
                <button onClick={() => setContactModal({ name: "", status: "new", source: "instagram" })} className={`${btnPrimary} flex items-center gap-1.5`}><Plus size={13} /> {t("mkAddContact")}</button>
              </div>
              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                {contacts.length === 0 ? <p className="text-[13px] text-zinc-300 text-center py-16">{t("mkNoContacts")}</p> : (
                  <div className="overflow-x-auto"><table className="w-full min-w-[820px]">
                    <thead><tr className="bg-zinc-50 border-b border-zinc-100">{[t("mkContactName"), t("mkSource"), t("colStatus"), t("mkNextAction"), ""].map((h, i) => <th key={i} className="px-5 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-zinc-50">
                      {contacts.filter((c) => contactFilter === "all" || c.status === contactFilter).map((c) => {
                        const due = c.next_action_at && c.next_action_at <= today && c.status !== "customer" && c.status !== "discarded";
                        return (
                          <tr key={c.id} className="hover:bg-zinc-50/80 align-top">
                            <td className="px-5 py-3.5"><p className="text-[13px] font-bold text-zinc-900">{c.name}</p><p className="text-[11px] text-zinc-400">{[c.company, c.handle].filter(Boolean).join(" · ")}</p>{c.notes && <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{c.notes}</p>}</td>
                            <td className="px-5 py-3.5 text-[12px] text-zinc-600 capitalize">{c.source ?? "—"}</td>
                            <td className="px-5 py-3.5">
                              <select value={c.status} onChange={(e) => setContactStatus(c, e.target.value as Contact["status"])} className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[12px]">
                                {(["new", "contacted", "interested", "customer", "discarded"] as const).map((s) => <option key={s} value={s}>{t(`mkStatus_${s}`)}</option>)}
                              </select>
                            </td>
                            <td className="px-5 py-3.5 text-[12px]">{c.next_action_at ? <span className={due ? "text-red-600 font-bold" : "text-zinc-600"}>{c.next_action_at}{c.next_action ? ` · ${c.next_action}` : ""}</span> : <span className="text-zinc-300">—</span>}</td>
                            <td className="px-5 py-3.5"><div className="flex gap-1"><button onClick={() => setContactModal(c)} className={btnIcon}><Pencil size={15} /></button><button onClick={() => deleteContact(c)} className={`${btnIcon} hover:text-red-600`}><Trash2 size={15} /></button></div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table></div>
                )}
              </div>
            </div>
          )}

          {tab === "feedback" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-1.5 flex-wrap">
                  {(["all", "pending", "answered", "escalated"] as const).map((s) => (
                    <button key={s} onClick={() => setFbFilter(s)} className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border ${fbFilter === s ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200"}`}>{s === "all" ? t("all") : t(`mkFb_${s}`)}</button>
                  ))}
                </div>
                <button onClick={() => setFbModal({ kind: "question", status: "pending", source: "instagram", body: "" })} className={`${btnPrimary} flex items-center gap-1.5`}><Plus size={13} /> {t("mkAddFeedback")}</button>
              </div>
              <div className="space-y-2">
                {feedback.length === 0 ? <p className="text-[13px] text-zinc-300 text-center py-16 bg-white rounded-2xl border border-zinc-200/80">{t("mkNoFeedback")}</p> :
                  feedback.filter((f) => fbFilter === "all" || f.status === fbFilter).map((f) => (
                    <div key={f.id} className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Pill tone={kindTone[f.kind]}>{t(`mkKind_${f.kind}`)}</Pill>
                        <Pill tone={fbStatusTone[f.status]}>{t(`mkFb_${f.status}`)}</Pill>
                        <span className="text-[11px] text-zinc-400">{[f.source, f.author].filter(Boolean).join(" · ")} · {new Date(f.created_at).toLocaleDateString(locale)}</span>
                        <div className="ml-auto flex gap-1"><button onClick={() => setFbModal(f)} className={btnIcon}><Pencil size={15} /></button><button onClick={() => deleteFeedback(f)} className={`${btnIcon} hover:text-red-600`}><Trash2 size={15} /></button></div>
                      </div>
                      <p className="text-[13px] text-zinc-800 whitespace-pre-wrap mt-2">{f.body}</p>
                      {f.answer && <p className="text-[12px] text-zinc-500 whitespace-pre-wrap mt-2 border-l-2 border-emerald-300 pl-3">{f.answer}</p>}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {accModal && (
        <Modal title={accModal.id ? t("mkEditAccount") : t("mkAddAccount")} onClose={() => setAccModal(null)}>
          <form onSubmit={(e) => { e.preventDefault(); saveAccount(); }} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>{t("mkPlatform")}</label>
                <select value={accModal.platform ?? "other"} onChange={(e) => setAccModal({ ...accModal, platform: e.target.value })} className={inputCls}>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
              <div><label className={labelCls}>{t("mkLabel")}</label><input required value={accModal.label ?? ""} onChange={(e) => setAccModal({ ...accModal, label: e.target.value })} placeholder="Instagram @maintlyqr" className={inputCls} /></div>
              <div><label className={labelCls}>{t("mkUsername")}</label><input value={accModal.username ?? ""} onChange={(e) => setAccModal({ ...accModal, username: e.target.value })} className={inputCls} autoComplete="off" /></div>
              <div><label className={labelCls}>{t("mkPassword")}</label><PasswordInput value={accModal.password ?? ""} onChange={(e) => setAccModal({ ...accModal, password: e.target.value })} placeholder={accModal.has_password ? t("mkPasswordKeep") : ""} wrapperClassName="mt-1" className="w-full rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 bg-white" autoComplete="new-password" /></div>
              <div><label className={labelCls}>{t("mkRecoveryEmail")}</label><input value={accModal.recovery_email ?? ""} onChange={(e) => setAccModal({ ...accModal, recovery_email: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>{t("mkTwoFactor")}</label><input value={accModal.two_factor ?? ""} onChange={(e) => setAccModal({ ...accModal, two_factor: e.target.value })} placeholder={t("mkTwoFactorPlaceholder")} className={inputCls} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>URL</label><input value={accModal.url ?? ""} onChange={(e) => setAccModal({ ...accModal, url: e.target.value })} placeholder="https://" className={inputCls} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>{t("profileNotes")}</label><textarea rows={2} value={accModal.notes ?? ""} onChange={(e) => setAccModal({ ...accModal, notes: e.target.value })} className={`${inputCls} resize-none`} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setAccModal(null)} className={btnGhost}>{t("cancel")}</button><button type="submit" className={btnPrimary}>{t("save")}</button></div>
          </form>
        </Modal>
      )}

      {contactModal && (
        <Modal title={contactModal.id ? t("mkEditContact") : t("mkAddContact")} onClose={() => setContactModal(null)}>
          <form onSubmit={(e) => { e.preventDefault(); saveContact(); }} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>{t("mkContactName")}</label><input required value={contactModal.name ?? ""} onChange={(e) => setContactModal({ ...contactModal, name: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>{t("mkCompany")}</label><input value={contactModal.company ?? ""} onChange={(e) => setContactModal({ ...contactModal, company: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>{t("mkSource")}</label>
                <select value={contactModal.source ?? "other"} onChange={(e) => setContactModal({ ...contactModal, source: e.target.value })} className={inputCls}>{SOURCES.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
              <div><label className={labelCls}>{t("mkHandle")}</label><input value={contactModal.handle ?? ""} onChange={(e) => setContactModal({ ...contactModal, handle: e.target.value })} placeholder="@usuario / tel / email" className={inputCls} /></div>
              <div><label className={labelCls}>{t("colStatus")}</label>
                <select value={contactModal.status ?? "new"} onChange={(e) => setContactModal({ ...contactModal, status: e.target.value as Contact["status"] })} className={inputCls}>{(["new", "contacted", "interested", "customer", "discarded"] as const).map((s) => <option key={s} value={s}>{t(`mkStatus_${s}`)}</option>)}</select></div>
              <div><label className={labelCls}>{t("mkNextActionDate")}</label><input type="date" value={contactModal.next_action_at ?? ""} onChange={(e) => setContactModal({ ...contactModal, next_action_at: e.target.value })} className={inputCls} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>{t("mkNextAction")}</label><input value={contactModal.next_action ?? ""} onChange={(e) => setContactModal({ ...contactModal, next_action: e.target.value })} placeholder={t("mkNextActionPlaceholder")} className={inputCls} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>{t("profileNotes")}</label><textarea rows={3} value={contactModal.notes ?? ""} onChange={(e) => setContactModal({ ...contactModal, notes: e.target.value })} className={`${inputCls} resize-none`} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setContactModal(null)} className={btnGhost}>{t("cancel")}</button><button type="submit" className={btnPrimary}>{t("save")}</button></div>
          </form>
        </Modal>
      )}

      {fbModal && (
        <Modal title={fbModal.id ? t("mkEditFeedback") : t("mkAddFeedback")} onClose={() => setFbModal(null)}>
          <form onSubmit={(e) => { e.preventDefault(); saveFeedback(); }} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>{t("mkKind")}</label>
                <select value={fbModal.kind ?? "question"} onChange={(e) => setFbModal({ ...fbModal, kind: e.target.value as Feedback["kind"] })} className={inputCls}>{(["question", "praise", "complaint", "idea"] as const).map((k) => <option key={k} value={k}>{t(`mkKind_${k}`)}</option>)}</select></div>
              <div><label className={labelCls}>{t("colStatus")}</label>
                <select value={fbModal.status ?? "pending"} onChange={(e) => setFbModal({ ...fbModal, status: e.target.value as Feedback["status"] })} className={inputCls}>{(["pending", "answered", "escalated"] as const).map((k) => <option key={k} value={k}>{t(`mkFb_${k}`)}</option>)}</select></div>
              <div><label className={labelCls}>{t("mkSource")}</label>
                <select value={fbModal.source ?? "other"} onChange={(e) => setFbModal({ ...fbModal, source: e.target.value })} className={inputCls}>{SOURCES.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
              <div><label className={labelCls}>{t("mkAuthor")}</label><input value={fbModal.author ?? ""} onChange={(e) => setFbModal({ ...fbModal, author: e.target.value })} placeholder="@usuario" className={inputCls} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>{t("mkFeedbackBody")}</label><textarea required rows={3} value={fbModal.body ?? ""} onChange={(e) => setFbModal({ ...fbModal, body: e.target.value })} className={`${inputCls} resize-none`} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>{t("mkAnswer")}</label><textarea rows={2} value={fbModal.answer ?? ""} onChange={(e) => setFbModal({ ...fbModal, answer: e.target.value })} className={`${inputCls} resize-none`} /></div>
            </div>
            <p className="text-[11px] text-zinc-400">{t("mkEscalateHint")}</p>
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setFbModal(null)} className={btnGhost}>{t("cancel")}</button><button type="submit" className={btnPrimary}>{t("save")}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
