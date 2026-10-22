"use client";

// Cuentas y accesos (spec §3) y Biblioteca de marca (spec §7).

import { useRef, useState } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, Copy, Check, ExternalLink, Upload, Star, History, Download, AlertTriangle, Link2 } from "lucide-react";
import Modal from "./Modal";
import PasswordInput from "@/components/PasswordInput";
import { Pill } from "../../page";
import { type Account, type Actor, type AdminLite, type LibraryItem, type T, mkGet, mkPost, mkUpload, fileUrl, fmtSize, fmtDateTime, personLabel, PLATFORMS, ui } from "./shared";

type Common = { t: T; locale: string; actor: Actor; admins: AdminLite[]; flash: (m: string, tone?: "ok" | "error") => void; reload: () => void };

// ───────────────────────── Cuentas ─────────────────────────
export function AccountsTab({ t, locale, actor, admins, flash, reload, accounts, vaultOk }: Common & { accounts: Account[]; vaultOk: boolean }) {
  const canConn = actor.isSuper || actor.perms.connections;
  const canVault = actor.isSuper || actor.perms.vault;
  const [modal, setModal] = useState<(Partial<Account> & { password?: string; two_factor?: string; recovery?: string }) | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  async function reveal(id: string, field: "password" | "two_factor" | "recovery") {
    const key = `${id}:${field}`;
    if (revealed[key] !== undefined) { setRevealed((r) => { const n = { ...r }; delete n[key]; return n; }); return; }
    try { const j = await mkGet<{ value: string }>({ r: "reveal", id, field }); setRevealed((r) => ({ ...r, [key]: j.value })); }
    catch (e) { flash(e instanceof Error ? e.message : String(e), "error"); }
  }
  async function copy(id: string, field: "password" | "two_factor" | "recovery") {
    const key = `${id}:${field}`;
    let v = revealed[key];
    if (v === undefined) { try { v = (await mkGet<{ value: string }>({ r: "reveal", id, field })).value; } catch (e) { flash(e instanceof Error ? e.message : String(e), "error"); return; } }
    try { await navigator.clipboard.writeText(v); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* sin clipboard */ }
  }
  async function save() {
    if (!modal) return;
    const { id, has_password, has_two_factor, has_recovery, can_reveal, updated_at, updated_by, ...fields } = modal;
    const res = await mkPost<{ item: Account }>({ r: "accounts", id: id ?? null, ...fields });
    if (!res.ok) { flash(res.error === "vault_not_configured" ? t("vaultNotConfigured") : res.error || t("errorGeneric"), "error"); return; }
    setRevealed({}); setModal(null); reload(); flash(t("saved"));
  }
  async function remove(a: Account) {
    if (!confirm(t("confirmDelete", { name: a.label }))) return;
    const res = await mkPost({ r: "accounts", action: "delete", id: a.id });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    reload();
  }
  const connTone: Record<Account["connection_status"], "zinc" | "emerald" | "amber"> = { none: "zinc", connected: "emerald", needs_reconnect: "amber" };

  const SecretRow = ({ a, field, label, has }: { a: Account; field: "password" | "two_factor" | "recovery"; label: string; has: boolean }) => {
    const key = `${a.id}:${field}`;
    return (
      <div className="flex items-center gap-1 text-[11px]">
        <span className="text-zinc-400 w-24 shrink-0">{label}</span>
        {!has ? <span className="text-zinc-300">—</span> : !canVault ? <span className="text-zinc-400 italic">{t("restricted")}</span> : (
          <>
            <code className="font-mono bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 flex-1 truncate">{revealed[key] !== undefined ? revealed[key] || "(vacío)" : "••••••••••"}</code>
            <button onClick={() => reveal(a.id, field)} className={ui.icon}>{revealed[key] !== undefined ? <EyeOff size={13} /> : <Eye size={13} />}</button>
            <button onClick={() => copy(a.id, field)} className={ui.icon}>{copied === key ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}</button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {!vaultOk && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[12px] text-red-700"><AlertTriangle size={15} className="shrink-0 mt-0.5" /> {t("vaultNotConfigured")}</div>}
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] text-zinc-400 max-w-2xl">{t("accountsIntro")}</p>
        {canConn && <button onClick={() => setModal({ platform: "instagram", label: "", connection_status: "none", authorized_usernames: [], owner_username: actor.username })} className={`${ui.primary} shrink-0 flex items-center gap-1.5`}><Plus size={13} /> {t("addAccount")}</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.length === 0 && <p className={`${ui.card} md:col-span-2 text-[13px] text-zinc-300 text-center py-14`}>{t("noAccounts")}</p>}
        {accounts.map((a) => (
          <div key={a.id} className={`${ui.card} p-5 space-y-3`}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center text-[11px] font-black uppercase shrink-0">{a.platform.slice(0, 2)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-black text-zinc-900 flex items-center gap-2 truncate">{a.label}{a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-900"><ExternalLink size={12} /></a>}</p>
                <p className="text-[12px] text-zinc-500 truncate">{a.username ?? "—"}{a.business_email ? ` · ${a.business_email}` : ""}</p>
              </div>
              <Pill tone={connTone[a.connection_status]}>{t(`conn_${a.connection_status}`)}</Pill>
              {canConn && <><button onClick={() => setModal({ ...a, password: "", two_factor: "", recovery: "" })} className={ui.icon}><Pencil size={14} /></button><button onClick={() => remove(a)} className={`${ui.icon} hover:text-red-600`}><Trash2 size={14} /></button></>}
            </div>
            {a.connection_note && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">{a.connection_note}</p>}
            <div className="text-[11px] text-zinc-500 flex flex-wrap gap-x-3 gap-y-1">
              <span><span className="text-zinc-400">{t("owner")}:</span> <span className="font-bold text-zinc-700">{personLabel(a.owner_username, admins)}</span></span>
              <span><span className="text-zinc-400">{t("authorized")}:</span> {a.authorized_usernames.length ? a.authorized_usernames.map((u) => personLabel(u, admins)).join(", ") : "—"}</span>
              {a.recovery_email && <span><span className="text-zinc-400">{t("recoveryEmail")}:</span> {a.recovery_email}</span>}
            </div>
            <div className="space-y-1">
              <SecretRow a={a} field="password" label={t("password")} has={a.has_password} />
              <SecretRow a={a} field="two_factor" label="2FA" has={a.has_two_factor} />
              <SecretRow a={a} field="recovery" label={t("recoveryMethod")} has={a.has_recovery} />
            </div>
            {a.notes && <p className="text-[11px] text-zinc-400 whitespace-pre-wrap">{a.notes}</p>}
            <p className="text-[10px] text-zinc-300">{t("updatedBy", { user: a.updated_by ?? "—", when: fmtDateTime(a.updated_at, locale) })}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-zinc-400">{t("revealAudited")}</p>

      {modal && (
        <Modal title={modal.id ? t("editAccount") : t("addAccount")} subtitle={t("accountFormHint")} onClose={() => setModal(null)}>
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={ui.label}>{t("platform")}</label><select value={modal.platform ?? "other"} onChange={(e) => setModal({ ...modal, platform: e.target.value })} className={ui.input}>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
              <div><label className={ui.label}>{t("accountName")}</label><input required value={modal.label ?? ""} onChange={(e) => setModal({ ...modal, label: e.target.value })} placeholder="Instagram @maintlyqr" className={ui.input} /></div>
              <div><label className={ui.label}>{t("loginUser")}</label><input value={modal.username ?? ""} onChange={(e) => setModal({ ...modal, username: e.target.value })} className={ui.input} autoComplete="off" /></div>
              <div><label className={ui.label}>{t("profileUrl")}</label><input value={modal.url ?? ""} onChange={(e) => setModal({ ...modal, url: e.target.value })} placeholder="https://" className={ui.input} /></div>
              <div><label className={ui.label}>{t("businessEmail")}</label><input type="email" value={modal.business_email ?? ""} onChange={(e) => setModal({ ...modal, business_email: e.target.value })} placeholder="social@maintlyqr.com" className={ui.input} /></div>
              <div><label className={ui.label}>{t("recoveryEmail")}</label><input type="email" value={modal.recovery_email ?? ""} onChange={(e) => setModal({ ...modal, recovery_email: e.target.value })} className={ui.input} /></div>
              <div><label className={ui.label}>{t("owner")}</label><select value={modal.owner_username ?? ""} onChange={(e) => setModal({ ...modal, owner_username: e.target.value })} className={ui.input}><option value="">—</option>{admins.filter((x) => x.active).map((m) => <option key={m.username} value={m.username}>{personLabel(m.username, admins)} (@{m.username})</option>)}</select></div>
              <div><label className={ui.label}>{t("connectionStatus")}</label><select value={modal.connection_status ?? "none"} onChange={(e) => setModal({ ...modal, connection_status: e.target.value as Account["connection_status"] })} className={ui.input}><option value="none">{t("conn_none")}</option><option value="connected">{t("conn_connected")}</option><option value="needs_reconnect">{t("conn_needs_reconnect")}</option></select></div>
              <div className="sm:col-span-2"><label className={ui.label}>{t("authorized")}</label>
                <div className="flex flex-wrap gap-2 mt-1">{admins.filter((x) => x.active).map((m) => { const on = (modal.authorized_usernames ?? []).includes(m.username); return <button type="button" key={m.username} onClick={() => setModal({ ...modal, authorized_usernames: on ? (modal.authorized_usernames ?? []).filter((u) => u !== m.username) : [...(modal.authorized_usernames ?? []), m.username] })} className={ui.chip(on)}>{personLabel(m.username, admins)}</button>; })}</div>
              </div>
              <div className="sm:col-span-2"><label className={ui.label}>{t("connectionNote")}</label><input value={modal.connection_note ?? ""} onChange={(e) => setModal({ ...modal, connection_note: e.target.value })} placeholder={t("connectionNotePlaceholder")} className={ui.input} /></div>
            </div>
            {canVault ? (
              <div className="rounded-xl border border-zinc-200 p-3 space-y-3 bg-zinc-50/60">
                <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1"><Link2 size={11} /> {t("vaultSection")}</p>
                <p className="text-[11px] text-zinc-400">{t("vaultSectionHint")}</p>
                <div><label className={ui.label}>{t("password")}</label><PasswordInput value={modal.password ?? ""} onChange={(e) => setModal({ ...modal, password: e.target.value })} placeholder={modal.has_password ? t("keepSecret") : ""} wrapperClassName="mt-1" className="w-full rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 bg-white" autoComplete="new-password" /></div>
                <div><label className={ui.label}>2FA</label><PasswordInput value={modal.two_factor ?? ""} onChange={(e) => setModal({ ...modal, two_factor: e.target.value })} placeholder={modal.has_two_factor ? t("keepSecret") : t("twoFactorPlaceholder")} wrapperClassName="mt-1" className="w-full rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 bg-white" autoComplete="off" /></div>
                <div><label className={ui.label}>{t("recoveryMethod")}</label><PasswordInput value={modal.recovery ?? ""} onChange={(e) => setModal({ ...modal, recovery: e.target.value })} placeholder={modal.has_recovery ? t("keepSecret") : t("recoveryPlaceholder")} wrapperClassName="mt-1" className="w-full rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 bg-white" autoComplete="off" /></div>
              </div>
            ) : <p className="text-[11px] text-zinc-400 italic">{t("vaultNoPermission")}</p>}
            <div><label className={ui.label}>{t("notes")}</label><textarea rows={2} value={modal.notes ?? ""} onChange={(e) => setModal({ ...modal, notes: e.target.value })} className={`${ui.input} resize-none`} /></div>
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setModal(null)} className={ui.ghost}>{t("cancel")}</button><button type="submit" className={ui.primary}>{t("save")}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ───────────────────────── Biblioteca ─────────────────────────
const KINDS: LibraryItem["kind"][] = ["logo", "color", "font", "photo", "video", "template", "doc", "text"];

export function LibraryTab({ t, locale, actor, admins, flash, reload, items }: Common & { items: LibraryItem[] }) {
  const canEdit = actor.isSuper || actor.perms.content;
  const canApprove = actor.isSuper || actor.perms.approve;
  const [kind, setKind] = useState<"all" | LibraryItem["kind"]>("all");
  const [showOld, setShowOld] = useState(false);
  const [modal, setModal] = useState<{ base?: LibraryItem; kind: LibraryItem["kind"]; name: string; value: string; notes: string; is_official: boolean; file: File | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = items.filter((i) => (kind === "all" || i.kind === kind) && (showOld || i.is_current));
  const isFileKind = (k: LibraryItem["kind"]) => !["color", "font", "text"].includes(k);

  async function save() {
    if (!modal) return;
    setBusy(true);
    try {
      let storage: { storage_path?: string; mime?: string; size?: number } = {};
      if (isFileKind(modal.kind)) {
        if (modal.file) { const path = await mkUpload(modal.file, "library"); storage = { storage_path: path, mime: modal.file.type, size: modal.file.size }; }
        else if (!modal.base) { flash(t("fileRequired"), "error"); return; }
        else storage = { storage_path: modal.base.storage_path ?? undefined, mime: modal.base.mime ?? undefined, size: modal.base.size ?? undefined };
      }
      const res = await mkPost({ r: "library", action: modal.base ? "new_version" : "create", id: modal.base?.id ?? null, kind: modal.kind, name: modal.name, value: modal.value, notes: modal.notes, is_official: modal.is_official, ...storage });
      if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
      setModal(null); reload(); flash(t("saved"));
    } catch (e) { flash(e instanceof Error ? e.message : String(e), "error"); }
    finally { setBusy(false); }
  }
  async function setOfficial(i: LibraryItem) {
    const res = await mkPost({ r: "library", action: "set_official", id: i.id, is_official: !i.is_official });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    reload();
  }
  async function remove(i: LibraryItem) {
    if (!confirm(t("confirmDelete", { name: i.name }))) return;
    const res = await mkPost({ r: "library", action: "delete", id: i.id });
    if (!res.ok) { flash(res.error || t("errorGeneric"), "error"); return; }
    reload();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setKind("all")} className={ui.chip(kind === "all")}>{t("all")}</button>
        {KINDS.map((k) => <button key={k} onClick={() => setKind(k)} className={ui.chip(kind === k)}>{t(`kind_${k}`)}</button>)}
        <button onClick={() => setShowOld(!showOld)} className={`${ui.chip(showOld)} ml-2`}><History size={11} className="inline" /> {t("showOldVersions")}</button>
        {canEdit && <button onClick={() => setModal({ kind: kind === "all" ? "logo" : kind, name: "", value: "", notes: "", is_official: false, file: null })} className={`${ui.primary} ml-auto flex items-center gap-1.5`}><Plus size={13} /> {t("addToLibrary")}</button>}
      </div>
      <p className="text-[12px] text-zinc-400">{t("libraryIntro")}</p>
      {list.length === 0 ? <p className={`${ui.card} text-[13px] text-zinc-300 text-center py-14`}>{t("libraryEmpty")}</p> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {list.map((i) => (
            <div key={i.id} className={`${ui.card} overflow-hidden ${!i.is_current ? "opacity-60" : ""}`}>
              <div className="h-32 bg-zinc-50 flex items-center justify-center relative">
                {i.kind === "color" && <div className="w-full h-full" style={{ background: i.value ?? "#fff" }} />}
                {i.kind === "font" && <p className="text-[22px] font-black text-zinc-800 px-3 text-center" style={{ fontFamily: (i.value ?? "").split(" ")[0] }}>{i.value}</p>}
                {i.kind === "text" && <p className="text-[12px] text-zinc-700 px-3 line-clamp-5 whitespace-pre-wrap">{i.value}</p>}
                {isFileKind(i.kind) && i.storage_path && (i.mime?.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl("library", i.storage_path)} alt={i.name} className="max-h-full max-w-full object-contain p-2" />
                ) : <a href={fileUrl("library", i.storage_path)} target="_blank" rel="noopener noreferrer" className="text-[11px] text-zinc-500 flex flex-col items-center gap-1"><Download size={18} />{fmtSize(i.size)}</a>)}
                <div className="absolute top-1.5 left-1.5 flex gap-1">
                  {i.is_official ? <Pill tone="emerald">{t("official")}</Pill> : <Pill tone="zinc">{t("draftMaterial")}</Pill>}
                  {i.version > 1 && <Pill tone="blue">v{i.version}</Pill>}
                </div>
              </div>
              <div className="p-3">
                <p className="text-[12px] font-bold text-zinc-900 truncate">{i.name}</p>
                <p className="text-[10px] text-zinc-400">{t(`kind_${i.kind}`)} · {personLabel(i.created_by, admins)} · {fmtDateTime(i.created_at, locale)}</p>
                {i.notes && <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{i.notes}</p>}
                <div className="flex gap-1 mt-2">
                  {isFileKind(i.kind) && i.storage_path && <a href={fileUrl("library", i.storage_path)} target="_blank" rel="noopener noreferrer" className={ui.icon} title={t("download")}><Download size={13} /></a>}
                  {canEdit && i.is_current && <button onClick={() => setModal({ base: i, kind: i.kind, name: i.name, value: i.value ?? "", notes: "", is_official: false, file: null })} className={ui.icon} title={t("newVersion")}><Upload size={13} /></button>}
                  {canApprove && <button onClick={() => setOfficial(i)} className={`${ui.icon} ${i.is_official ? "text-emerald-600" : ""}`} title={t("toggleOfficial")}><Star size={13} /></button>}
                  {actor.isSuper && <button onClick={() => remove(i)} className={`${ui.icon} hover:text-red-600`}><Trash2 size={13} /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {modal && (
        <Modal title={modal.base ? t("newVersionOf", { name: modal.base.name }) : t("addToLibrary")} onClose={() => setModal(null)}>
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={ui.label}>{t("kind")}</label><select value={modal.kind} disabled={!!modal.base} onChange={(e) => setModal({ ...modal, kind: e.target.value as LibraryItem["kind"] })} className={ui.input}>{KINDS.map((k) => <option key={k} value={k}>{t(`kind_${k}`)}</option>)}</select></div>
              <div><label className={ui.label}>{t("name")}</label><input required value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} className={ui.input} /></div>
            </div>
            {isFileKind(modal.kind) ? (
              <div>
                <label className={ui.label}>{t("file")}</label>
                <input ref={fileRef} type="file" onChange={(e) => setModal({ ...modal, file: e.target.files?.[0] ?? null })} className="block mt-1 text-[12px]" />
                <p className="text-[11px] text-zinc-400 mt-1">{t("fileHint")}</p>
              </div>
            ) : modal.kind === "color" ? (
              <div><label className={ui.label}>{t("colorValue")}</label><div className="flex gap-2 mt-1"><input type="color" value={/^#[0-9a-f]{6}$/i.test(modal.value) ? modal.value : "#e0242b"} onChange={(e) => setModal({ ...modal, value: e.target.value })} className="w-12 h-10 rounded-lg border border-zinc-200" /><input value={modal.value} onChange={(e) => setModal({ ...modal, value: e.target.value })} placeholder="#E0242B" className={`${ui.input} !mt-0`} /></div></div>
            ) : modal.kind === "font" ? (
              <div><label className={ui.label}>{t("fontValue")}</label><input value={modal.value} onChange={(e) => setModal({ ...modal, value: e.target.value })} placeholder="Inter 800" className={ui.input} /></div>
            ) : (
              <div><label className={ui.label}>{t("textValue")}</label><textarea rows={5} value={modal.value} onChange={(e) => setModal({ ...modal, value: e.target.value })} className={`${ui.input} resize-y`} /></div>
            )}
            <div><label className={ui.label}>{t("notes")}</label><input value={modal.notes} onChange={(e) => setModal({ ...modal, notes: e.target.value })} placeholder={t("libraryNotesPlaceholder")} className={ui.input} /></div>
            {canApprove && <label className="flex items-center gap-2 text-[12px] text-zinc-700"><input type="checkbox" checked={modal.is_official} onChange={(e) => setModal({ ...modal, is_official: e.target.checked })} /> {t("markOfficial")}</label>}
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setModal(null)} className={ui.ghost}>{t("cancel")}</button><button type="submit" disabled={busy} className={ui.primary}>{busy ? t("saving") : t("save")}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
