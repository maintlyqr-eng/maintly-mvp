"use client";

// Espacio de Marketing (Facu, 21/10/2026: "hay que armarle un dashboard en
// el que ella pueda trabajar y ser productiva"). Lo ven el rol marketing y
// el Super Admin. Pestañas: Resumen, Cuentas (bóveda de redes con
// contraseñas cifradas), Contactos (mini CRM) y Consultas/feedback.
// API: /api/admin/marketing (un handler, ?resource=…).

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Pill } from "../page";

type Contact = { id: string; name: string; company: string | null; source: string | null; handle: string | null; status: "new" | "contacted" | "interested" | "customer" | "discarded"; next_action: string | null; next_action_at: string | null; notes: string | null; updated_at: string };
type Feedback = { id: string; created_at: string; source: string | null; author: string | null; kind: "question" | "praise" | "complaint" | "idea"; body: string; status: "pending" | "answered" | "escalated"; answer: string | null };

type Props = {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;
  flash: (text: string, tone?: "ok" | "error") => void;
  // 22/10/2026: este componente quedó embebido dentro del departamento de
  // Marketing (marketing/MarketingDept.tsx) solo para Contactos y Feedback.
  // Cuentas y Resumen pasaron allá (migración 061, permisos por persona).
  embedTab: "contacts" | "feedback";
};

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

export default function MarketingSection({ t, locale, flash, embedTab }: Props) {
  const tab = embedTab;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    try {
      const [c, f] = await Promise.all(
        (["contacts", "feedback"] as const).map((r) => fetch(`/api/admin/marketing?resource=${r}`).then((x) => x.json()).catch(() => ({})))
      );
      setContacts((c.items as Contact[]) ?? []);
      setFeedback((f.items as Feedback[]) ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { loadAll(); }, []);

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

  return (
    <div className="space-y-4">
      {loading ? <p className="text-[13px] text-zinc-400 text-center py-16">{t("loading")}</p> : (
        <>
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
