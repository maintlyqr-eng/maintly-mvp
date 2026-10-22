"use client";

// Editor de publicación + circuito de aprobación (spec §5). Un solo modal
// para crear/editar, enviar a revisión, aprobar, pedir cambios, programar,
// marcar publicado por red (manual, con enlace) o fallido, cancelar.
// Los botones se muestran según el permiso del actor, pero el servidor
// vuelve a verificar cada acción.

import { useEffect, useRef, useState } from "react";
import { Paperclip, Trash2, Send, Check, Undo2, CalendarClock, Link2, AlertTriangle, MessageSquare, ExternalLink } from "lucide-react";
import Modal from "./Modal";
import { Pill } from "../../page";
import { type Account, type Actor, type Campaign, type Comment, type Media, type Post, type PostStatus, type Target, type T, mkGet, mkPost, mkUpload, fileUrl, fmtSize, fmtDateTime, STATUS_TONE, ui } from "./shared";

type Snapshot = { post: Post; targets: Target[]; media: Media[]; comments?: Comment[] };

type Props = {
  t: T; locale: string; actor: Actor; accounts: Account[]; campaigns: Campaign[]; settings: { require_approval: boolean; default_timezone: string } | null;
  postId: string | null;               // null = nueva
  initialDate?: string | null;         // "YYYY-MM-DDTHH:mm" sugerida (desde el calendario)
  onClose: () => void;
  onChanged: () => void;               // recargar lista/calendario
  flash: (text: string, tone?: "ok" | "error") => void;
};

const TIMEZONES = ["Australia/Brisbane", "Australia/Sydney", "Australia/Perth", "America/Argentina/Buenos_Aires", "America/Sao_Paulo", "Europe/Madrid", "Europe/Rome", "America/New_York", "UTC"];

function toLocalInput(iso: string | null, tz: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
    const g = (k: string) => parts.find((p) => p.type === k)?.value ?? "00";
    return `${g("year")}-${g("month")}-${g("day")}T${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`;
  } catch { return iso.slice(0, 16); }
}

// "YYYY-MM-DDTHH:mm" en la zona tz → ISO UTC (sin librerías: se calcula el
// desfase de tz en esa fecha con Intl).
function fromLocalInput(local: string, tz: string): string | null {
  if (!local) return null;
  const [date, time] = local.split("T");
  const [y, m, d] = date.split("-").map(Number); const [hh, mm] = (time ?? "00:00").split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(asUtc));
    const g = (k: string) => Number(parts.find((p) => p.type === k)?.value ?? 0);
    const tzAsUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") === 24 ? 0 : g("hour"), g("minute"));
    return new Date(asUtc - (tzAsUtc - asUtc)).toISOString();
  } catch { return new Date(asUtc).toISOString(); }
}

export default function PostEditor({ t, locale, actor, accounts, campaigns, settings, postId, initialDate, onClose, onChanged, flash }: Props) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(!!postId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [campaignId, setCampaignId] = useState<string>("");
  const [tz, setTz] = useState(settings?.default_timezone ?? "Australia/Brisbane");
  const [when, setWhen] = useState(initialDate ?? "");
  const [targets, setTargets] = useState<Record<string, { on: boolean; adapted: string }>>({});
  const [adaptOpen, setAdaptOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  const [resultFor, setResultFor] = useState<{ target: Target; kind: "manual" | "failed" } | null>(null);
  const [resultUrl, setResultUrl] = useState("");
  const [resultErr, setResultErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const canContent = actor.isSuper || actor.perms.content;
  const canApprove = actor.isSuper || actor.perms.approve;
  const canPublish = actor.isSuper || actor.perms.publish;

  async function load(id: string) {
    setLoading(true);
    try {
      const s = await mkGet<Snapshot>({ r: "post", id });
      setSnap(s);
      setTitle(s.post.title); setBody(s.post.body ?? ""); setCampaignId(s.post.campaign_id ?? ""); setTz(s.post.timezone);
      setWhen(toLocalInput(s.post.scheduled_at, s.post.timezone));
      const map: Record<string, { on: boolean; adapted: string }> = {};
      for (const tg of s.targets) map[tg.account_id] = { on: true, adapted: tg.adapted_body ?? "" };
      setTargets(map);
    } catch (e) { flash(e instanceof Error ? e.message : String(e), "error"); onClose(); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (postId) load(postId); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const post = snap?.post ?? null;
  const status: PostStatus = post?.status ?? "draft";
  const closed = status === "published" || status === "cancelled";
  const editable = canContent && !closed;
  const dirty = post ? (title !== post.title || body !== (post.body ?? "") || campaignId !== (post.campaign_id ?? "") || tz !== post.timezone || when !== toLocalInput(post.scheduled_at, post.timezone)
    || JSON.stringify(Object.entries(targets).filter(([, v]) => v.on).map(([k, v]) => [k, v.adapted]).sort()) !== JSON.stringify(snap!.targets.map((x) => [x.account_id, x.adapted_body ?? ""]).sort())) : true;

  async function save(): Promise<string | null> {
    if (!title.trim()) { flash(t("postTitleRequired"), "error"); return null; }
    setSaving(true);
    try {
      const res = await mkPost<Snapshot>({
        r: "posts", action: "save", id: post?.id ?? null, title: title.trim(), body, campaign_id: campaignId || null,
        scheduled_at: fromLocalInput(when, tz), timezone: tz,
        targets: Object.entries(targets).filter(([, v]) => v.on).map(([account_id, v]) => ({ account_id, adapted_body: v.adapted || null })),
      });
      if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return null; }
      setSnap(res.data); onChanged();
      if (res.data.post.status === "review" && post && (post.status === "approved" || post.status === "scheduled")) flash(t("postBackToReview"));
      else flash(t("saved"));
      return res.data.post.id;
    } finally { setSaving(false); }
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    let id = post?.id ?? null;
    if (!id || (dirty && !closed)) { id = await save(); if (!id) return; }
    setSaving(true);
    try {
      const res = await mkPost<Snapshot>({ r: "posts", action, id, ...extra });
      if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
      setSnap(res.data); onChanged();
      flash(t(`postAct_${action}_done`));
    } finally { setSaving(false); }
  }

  async function upload(file: File) {
    let id = post?.id ?? null;
    if (!id) { id = await save(); if (!id) return; }
    setUploading(true);
    try {
      const path = await mkUpload(file, "media");
      const res = await mkPost({ r: "media", post_id: id, storage_path: path, name: file.name, mime: file.type, size: file.size });
      if (!res.ok) throw new Error(res.error);
      await load(id); onChanged();
    } catch (e) { flash(e instanceof Error ? e.message : String(e), "error"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function removeMedia(m: Media) {
    if (!confirm(t("confirmDelete", { name: m.name }))) return;
    const res = await mkPost({ r: "media", action: "delete", id: m.id });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    if (post) await load(post.id);
  }

  async function addComment() {
    if (!post || !comment.trim()) return;
    const res = await mkPost<{ item: Comment }>({ r: "comments", entity_type: "post", entity_id: post.id, body: comment.trim() });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    setSnap((s) => s ? { ...s, comments: [...(s.comments ?? []), res.data.item] } : s); setComment("");
  }

  const accountOf = (id: string) => accounts.find((a) => a.id === id);

  return (
    <Modal title={post ? post.title : t("newPost")} subtitle={post ? `${t("status")}: ${t(`postStatus_${status}`)} · ${t("createdBy", { user: post.created_by ?? "—" })}` : t("newPostHint")} onClose={onClose} wide>
      {loading ? <p className="text-[13px] text-zinc-400 py-10 text-center">{t("loading")}</p> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna principal */}
          <div className="lg:col-span-2 space-y-4">
            {post?.change_request_note && status === "draft" && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[12px] text-amber-800"><Undo2 size={14} className="shrink-0 mt-0.5" /><div><span className="font-bold">{t("changesRequestedBy", { user: post.change_requested_by ?? "" })}:</span> {post.change_request_note}</div></div>
            )}
            {status === "cancelled" && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[12px] text-red-700">{t("cancelledBy", { user: post?.cancelled_by ?? "" })}{post?.cancelled_reason ? `: ${post.cancelled_reason}` : ""}</div>}
            <div>
              <label className={ui.label}>{t("postTitle")}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editable} className={ui.input} placeholder={t("postTitlePlaceholder")} />
            </div>
            <div>
              <label className={ui.label}>{t("postBody")}</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={!editable} rows={7} className={`${ui.input} resize-y`} placeholder={t("postBodyPlaceholder")} />
              <p className="text-[11px] text-zinc-400 mt-1">{t("charCount", { n: body.length })}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={ui.label}>{t("dateTime")}</label>
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} disabled={!editable} className={ui.input} />
              </div>
              <div>
                <label className={ui.label}>{t("timezone")}</label>
                <select value={tz} onChange={(e) => setTz(e.target.value)} disabled={!editable} className={ui.input}>{[tz, ...TIMEZONES.filter((z) => z !== tz)].map((z) => <option key={z} value={z}>{z}</option>)}</select>
              </div>
              <div>
                <label className={ui.label}>{t("campaign")}</label>
                <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} disabled={!editable} className={ui.input}><option value="">—</option>{campaigns.filter((c) => c.status === "active" || c.id === campaignId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </div>
            </div>

            {/* Destinos */}
            <div>
              <label className={ui.label}>{t("targets")}</label>
              <p className="text-[11px] text-zinc-400 mb-2">{t("targetsHint")}</p>
              {accounts.length === 0 ? <p className="text-[12px] text-zinc-300">{t("noAccountsYet")}</p> : (
                <div className="space-y-2">
                  {accounts.map((a) => {
                    const tg = targets[a.id]; const on = !!tg?.on;
                    const result = snap?.targets.find((x) => x.account_id === a.id);
                    return (
                      <div key={a.id} className={`rounded-xl border ${on ? "border-zinc-300" : "border-zinc-100"} px-3 py-2`}>
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={on} disabled={!editable} onChange={(e) => setTargets({ ...targets, [a.id]: { on: e.target.checked, adapted: tg?.adapted ?? "" } })} />
                          <span className="w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-[10px] font-black uppercase">{a.platform.slice(0, 2)}</span>
                          <span className="text-[13px] font-bold text-zinc-800 flex-1">{a.label} <span className="text-[11px] font-medium text-zinc-400">{a.username ?? ""}</span></span>
                          {result && result.result_status !== "pending" && (
                            <Pill tone={result.result_status === "failed" ? "red" : "emerald"}>{t(`result_${result.result_status}`)}</Pill>
                          )}
                          {on && editable && <button type="button" onClick={() => setAdaptOpen(adaptOpen === a.id ? null : a.id)} className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900">{t("adaptText")}</button>}
                          {result?.result_url && <a href={result.result_url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-900"><ExternalLink size={13} /></a>}
                        </div>
                        {on && adaptOpen === a.id && (
                          <textarea value={tg?.adapted ?? ""} onChange={(e) => setTargets({ ...targets, [a.id]: { on: true, adapted: e.target.value } })} rows={3} placeholder={t("adaptPlaceholder")} className={`${ui.input} resize-y`} />
                        )}
                        {result && result.result_status === "failed" && result.result_error && <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1"><AlertTriangle size={11} /> {result.result_error}</p>}
                        {result && (status === "approved" || status === "scheduled" || status === "published") && canPublish && result.result_status !== "manual" && result.result_status !== "published" && (
                          <div className="flex gap-2 mt-2">
                            <button type="button" onClick={() => { setResultFor({ target: result, kind: "manual" }); setResultUrl(""); }} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1"><Link2 size={11} /> {t("markPublishedManual")}</button>
                            <button type="button" onClick={() => { setResultFor({ target: result, kind: "failed" }); setResultErr(""); }} className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">{t("markFailed")}</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Medios */}
            <div>
              <div className="flex items-center justify-between">
                <label className={ui.label}>{t("media")}</label>
                {editable && <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={`${ui.ghost} flex items-center gap-1.5`}><Paperclip size={13} /> {uploading ? t("uploading") : t("attach")}</button>}
                <input ref={fileRef} type="file" className="hidden" accept="image/*,video/mp4,video/quicktime,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
              </div>
              {(snap?.media ?? []).length === 0 ? <p className="text-[12px] text-zinc-300 mt-1">{t("noMedia")}</p> : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                  {snap!.media.map((m) => (
                    <div key={m.id} className="relative rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50">
                      {m.mime?.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a href={fileUrl("media", m.storage_path)} target="_blank" rel="noopener noreferrer"><img src={fileUrl("media", m.storage_path)} alt={m.name} className="w-full h-24 object-cover" /></a>
                      ) : (
                        <a href={fileUrl("media", m.storage_path)} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-24 text-[11px] text-zinc-500 px-2 text-center">{m.name}<span className="text-zinc-300">{fmtSize(m.size)}</span></a>
                      )}
                      {editable && <button type="button" onClick={() => removeMedia(m)} className="absolute top-1 right-1 bg-white/90 rounded-lg p-1 text-zinc-500 hover:text-red-600"><Trash2 size={12} /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Columna lateral: acciones + historial */}
          <div className="space-y-4">
            <div className={`${ui.card} p-4 space-y-2`}>
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">{t("actions")}</p>
              {editable && <button type="button" onClick={save} disabled={saving} className={`${ui.ghost} w-full`}>{saving ? t("saving") : t("saveDraft")}</button>}
              {(status === "draft") && canContent && (
                <button type="button" onClick={() => act("submit")} disabled={saving} className={`${ui.primary} w-full flex items-center justify-center gap-1.5`}><Send size={13} /> {settings?.require_approval === false || canApprove ? t("approveAndContinue") : t("sendForApproval")}</button>
              )}
              {status === "review" && canApprove && (
                <>
                  <button type="button" onClick={() => act("approve")} disabled={saving} className={`${ui.primary} w-full flex items-center justify-center gap-1.5 !bg-emerald-600 hover:!bg-emerald-700`}><Check size={13} /> {t("approve")}</button>
                  <div>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t("changeNotePlaceholder")} className={`${ui.input} resize-none`} />
                    <button type="button" onClick={() => act("request_changes", { note })} disabled={saving} className={`${ui.ghost} w-full mt-1 flex items-center justify-center gap-1.5`}><Undo2 size={13} /> {t("requestChanges")}</button>
                  </div>
                </>
              )}
              {status === "review" && !canApprove && <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{t("waitingApproval")}</p>}
              {status === "approved" && canPublish && (
                <button type="button" onClick={() => act("schedule")} disabled={saving || !when} className={`${ui.primary} w-full flex items-center justify-center gap-1.5`}><CalendarClock size={13} /> {t("markScheduled")}</button>
              )}
              {(status === "approved" || status === "scheduled") && <p className="text-[11px] text-zinc-400">{t("publishHint")}</p>}
              {!closed && post && (canApprove || (canContent && post.created_by?.toLowerCase() === actor.username.toLowerCase())) && (
                <button type="button" onClick={() => { const reason = prompt(t("cancelReasonPrompt")) ?? ""; act("cancel", { reason }); }} disabled={saving} className="w-full text-[12px] font-bold text-red-600 hover:underline">{t("cancelPost")}</button>
              )}
              {status === "cancelled" && canContent && <button type="button" onClick={() => act("reopen")} className={`${ui.ghost} w-full`}>{t("reopen")}</button>}
            </div>

            {post && (
              <div className={`${ui.card} p-4`}>
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{t("history")}</p>
                <ul className="text-[11px] text-zinc-500 space-y-1">
                  <li>{t("hist_created", { user: post.created_by ?? "—", when: fmtDateTime(post.created_at, locale) })}</li>
                  {post.submitted_at && <li>{t("hist_submitted", { user: post.submitted_by ?? "—", when: fmtDateTime(post.submitted_at, locale) })}</li>}
                  {post.approved_at && <li>{t("hist_approved", { user: post.approved_by ?? "—", when: fmtDateTime(post.approved_at, locale) })}</li>}
                  {snap?.targets.filter((x) => x.published_at).map((x) => <li key={x.id}>{t("hist_published", { account: accountOf(x.account_id)?.label ?? "", user: x.published_by ?? "—", when: fmtDateTime(x.published_at, locale) })}</li>)}
                </ul>
                <div className="mt-3 pt-3 border-t border-zinc-100">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1"><MessageSquare size={11} /> {t("comments")}</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(snap?.comments ?? []).map((c) => <div key={c.id} className="text-[12px]"><span className="font-bold text-zinc-700">{c.author_username}</span> <span className="text-zinc-400">{fmtDateTime(c.created_at, locale)}</span><p className="text-zinc-700 whitespace-pre-wrap">{c.body}</p></div>)}
                  </div>
                  <div className="flex gap-1 mt-2">
                    <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addComment(); } }} placeholder={t("commentPlaceholder")} className="flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-[12px] outline-none focus:border-red-500" />
                    <button type="button" onClick={addComment} className={ui.icon}><Send size={14} /></button>
                  </div>
                </div>
              </div>
            )}
            <div className="text-[11px] text-zinc-400 flex items-center gap-2"><Pill tone={STATUS_TONE[status]}>{t(`postStatus_${status}`)}</Pill>{post?.scheduled_at && <span>{fmtDateTime(post.scheduled_at, locale, post.timezone)} ({post.timezone})</span>}</div>
          </div>
        </div>
      )}

      {resultFor && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setResultFor(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[14px] font-black text-zinc-900">{resultFor.kind === "manual" ? t("markPublishedManual") : t("markFailed")} · {accountOf(resultFor.target.account_id)?.label}</h3>
            {resultFor.kind === "manual" ? (
              <div><label className={ui.label}>{t("postUrl")}</label><input value={resultUrl} onChange={(e) => setResultUrl(e.target.value)} placeholder="https://www.instagram.com/p/…" className={ui.input} /></div>
            ) : (
              <div><label className={ui.label}>{t("errorDescription")}</label><input value={resultErr} onChange={(e) => setResultErr(e.target.value)} className={ui.input} /></div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setResultFor(null)} className={ui.ghost}>{t("cancel")}</button>
              <button type="button" onClick={async () => { const r = resultFor; setResultFor(null); await act("target_result", { target_id: r.target.id, result: r.kind, url: resultUrl, error: resultErr }); }} className={ui.primary}>{t("confirm")}</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
