"use client";

// Facu (26 jul 2026): octava sección extraída del split del admin — mismo
// criterio que las anteriores (JSX movido tal cual, estado y lógica se
// quedan en page.tsx).
//
// 21/10/2026 (Facu: "pensalo como empresa en la que empiece a tener
// empleados"): se sumó
//   - invitación por link (sin contraseña: la persona elige la suya),
//   - "Ver actividad" (log de auditoría filtrado por esa persona),
//   - mensajes internos de admin a admin,
//   - pestaña "Actividad del equipo": horas activas, sesiones y acciones
//     por persona en un período, con export CSV para liquidar tiempo.

import { useState } from "react";
import { UserCog, Copy, Check, MessageSquare, History, Link2, Download, Clock, X, Mail, Cake, IdCard } from "lucide-react";
import { formatDateDMY } from "@/lib/date";
import PasswordInput from "@/components/PasswordInput";
import { Pill, type AdminRole, type AdminUserRow, type AdminNoteRow, type TeamActivityRow, type AdminProfilePatch } from "../page";

type AdminsSectionProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;

  newAdminUsername: string;
  setNewAdminUsername: (v: string) => void;
  newAdminPassword: string;
  setNewAdminPassword: (v: string) => void;
  newAdminEmail: string;
  setNewAdminEmail: (v: string) => void;
  newAdminFirstName: string;
  setNewAdminFirstName: (v: string) => void;
  newAdminLastName: string;
  setNewAdminLastName: (v: string) => void;
  newAdminNickname: string;
  setNewAdminNickname: (v: string) => void;
  newAdminSalutation: "f" | "m" | "n";
  setNewAdminSalutation: (v: "f" | "m" | "n") => void;
  newAdminRole: AdminRole;
  setNewAdminRole: (v: AdminRole) => void;
  creatingAdmin: boolean;
  createAdmin: () => void | Promise<void>;

  adminsLoading: boolean;
  adminsList: AdminUserRow[];
  updateAdmin: (id: string, patch: { role?: AdminRole; active?: boolean }) => void | Promise<void>;
  saveAdminProfile: (id: string, profile: AdminProfilePatch) => Promise<boolean>;

  lastInviteLink: { username: string; link: string; emailSent?: string | null } | null;
  clearInviteLink: () => void;
  reinviteAdmin: (a: AdminUserRow, sendEmail?: boolean) => void | Promise<void>;
  viewAdminActivity: (username: string) => void;

  notesForAdmin: { admin: AdminUserRow; notes: AdminNoteRow[] } | null;
  openNotesFor: (a: AdminUserRow) => void | Promise<void>;
  closeNotes: () => void;
  sendNote: (a: AdminUserRow, body: string) => Promise<boolean>;

  teamActivity: TeamActivityRow[];
  teamActivityLoading: boolean;
  teamActivityRange: "week" | "month" | "custom";
  setTeamActivityRange: (v: "week" | "month" | "custom") => void;
  teamActivityFrom: string;
  setTeamActivityFrom: (v: string) => void;
  teamActivityTo: string;
  setTeamActivityTo: (v: string) => void;
  exportTeamActivity: () => void | Promise<void>;
  AUDIT_ACTION_LABEL: Record<string, string>;
};

// Días hasta el próximo cumpleaños (0 = hoy). null si no hay fecha.
function daysToBirthday(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < now) next = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - now.getTime()) / 86400000);
}

function minutesLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m.toString().padStart(2, "0")} min` : `${m} min`;
}

export default function AdminsSection({
  t, locale,
  newAdminUsername, setNewAdminUsername, newAdminPassword, setNewAdminPassword,
  newAdminEmail, setNewAdminEmail,
  newAdminFirstName, setNewAdminFirstName, newAdminLastName, setNewAdminLastName, newAdminNickname, setNewAdminNickname,
  newAdminSalutation, setNewAdminSalutation,
  newAdminRole, setNewAdminRole, creatingAdmin, createAdmin,
  adminsLoading, adminsList, updateAdmin, saveAdminProfile,
  lastInviteLink, clearInviteLink, reinviteAdmin, viewAdminActivity,
  notesForAdmin, openNotesFor, closeNotes, sendNote,
  teamActivity, teamActivityLoading, teamActivityRange, setTeamActivityRange,
  teamActivityFrom, setTeamActivityFrom, teamActivityTo, setTeamActivityTo, exportTeamActivity,
  AUDIT_ACTION_LABEL,
}: AdminsSectionProps) {
  const [tab, setTab] = useState<"people" | "activity">("people");
  const [copied, setCopied] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [sendingNote, setSendingNote] = useState(false);
  const [profileFor, setProfileFor] = useState<AdminUserRow | null>(null);
  const [profileDraft, setProfileDraft] = useState<AdminProfilePatch>({});
  const [savingProfile, setSavingProfile] = useState(false);

  function openProfile(a: AdminUserRow) {
    setProfileFor(a);
    setProfileDraft({
      firstName: a.first_name ?? a.display_name ?? "", lastName: a.last_name ?? "", nickname: a.nickname ?? "",
      salutation: a.salutation ?? "n", email: a.email ?? "",
      phone: a.phone ?? "", address: a.address ?? "", birthDate: a.birth_date ?? "", notes: a.notes ?? "",
    });
  }

  const roleLabel: Record<string, string> = {
    super_admin: t("roleSuperAdmin"),
    support_admin: t("roleSupportAdmin"),
    content_moderator: t("roleContentModerator"),
    analytics_viewer: t("roleAnalyticsViewer"),
    marketing: t("roleMarketing"),
  };

  async function copyLink() {
    if (!lastInviteLink) return;
    try { await navigator.clipboard.writeText(lastInviteLink.link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sin clipboard */ }
  }

  function whatsappHref(): string {
    if (!lastInviteLink) return "#";
    const target = adminsList.find((a) => a.username.toLowerCase() === lastInviteLink.username.toLowerCase());
    const role = target ? roleLabel[target.role] ?? target.role : "";
    // Nombre: el cargado al invitar; si no, "katia.damas" -> "Katia".
    const first = lastInviteLink.username.split(/[._\-\s]/)[0];
    const name = target?.nickname?.trim() || target?.first_name?.trim() || target?.display_name?.trim() || (first ? first.charAt(0).toUpperCase() + first.slice(1) : lastInviteLink.username);
    const welcome = t(target?.salutation === "f" ? "welcomeF" : target?.salutation === "m" ? "welcomeM" : "welcomeN");
    return `https://wa.me/?text=${encodeURIComponent(t("inviteWhatsappText", { name, role, link: lastInviteLink.link, welcome }))}`;
  }

  const canCreate = !!newAdminUsername.trim() && (newAdminPassword.length === 0 || newAdminPassword.length >= 8);

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-zinc-400">{t("adminsIntro")}</p>

      <div className="flex gap-2">
        {([["people", t("adminsTabPeople")], ["activity", t("adminsTabActivity")]] as const).map(([key, label]) => (
          <button
            key={key} onClick={() => setTab(key)}
            className={`text-[12px] font-bold px-3.5 py-2 rounded-xl border transition-colors ${tab === key ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "people" && (
        <>
          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-5 space-y-3">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">{t("adminsCreateTitle")}</p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("adminsUsername")}</label>
                <input
                  type="text" value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400 w-40"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("adminsRole")}</label>
                <select
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value as AdminRole)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
                >
                  <option value="support_admin">{t("roleSupportAdmin")}</option>
                  <option value="content_moderator">{t("roleContentModerator")}</option>
                  <option value="analytics_viewer">{t("roleAnalyticsViewer")}</option>
                  <option value="marketing">{t("roleMarketing")}</option>
                  <option value="super_admin">{t("roleSuperAdmin")}</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("adminsFirstName")}</label>
                <input type="text" value={newAdminFirstName} onChange={(e) => setNewAdminFirstName(e.target.value)} placeholder="Katia" className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400 w-32" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("adminsLastName")}</label>
                <input type="text" value={newAdminLastName} onChange={(e) => setNewAdminLastName(e.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400 w-32" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("adminsNickname")}</label>
                <input type="text" value={newAdminNickname} onChange={(e) => setNewAdminNickname(e.target.value)} placeholder={t("adminsNicknamePlaceholder")} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400 w-28" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("adminsSalutation")}</label>
                <select
                  value={newAdminSalutation}
                  onChange={(e) => setNewAdminSalutation(e.target.value as "f" | "m" | "n")}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
                >
                  <option value="f">{t("salutationF")}</option>
                  <option value="m">{t("salutationM")}</option>
                  <option value="n">{t("salutationN")}</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("adminsEmailOptional")}</label>
                <input
                  type="email" value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="nombre@ejemplo.com"
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400 w-52"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("adminsPasswordOptional")}</label>
                <PasswordInput
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder={t("adminsPasswordOptionalPlaceholder")}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400 w-48"
                />
              </div>
              <button
                onClick={createAdmin}
                disabled={creatingAdmin || !canCreate}
                className="text-[11px] font-bold px-4 py-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                {newAdminPassword.length === 0 && <Link2 size={13} />}
                {creatingAdmin ? t("creating") : newAdminPassword.length === 0 ? t("adminsInviteButton") : t("adminsCreateButton")}
              </button>
            </div>
            <p className="text-[11px] text-zinc-400">{t("adminsInviteHint")} {t("adminsEmailHint")}</p>
            {newAdminPassword.length > 0 && newAdminPassword.length < 8 && (
              <p className="text-[11px] text-amber-600">{t("adminsPasswordTooShort")}</p>
            )}
          </div>

          {lastInviteLink && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-bold text-emerald-800">{t("inviteReadyTitle", { user: lastInviteLink.username })}</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">{t("inviteReadyHint")}</p>
                </div>
                <button onClick={clearInviteLink} className="text-emerald-600 hover:text-emerald-900"><X size={16} /></button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input readOnly value={lastInviteLink.link} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-[260px] rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[12px] font-mono text-zinc-700 outline-none" />
                <button onClick={copyLink} className="text-[11px] font-bold px-3 py-2 rounded-xl bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-100 flex items-center gap-1.5">
                  {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? t("copied") : t("copyLink")}
                </button>
                <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold px-3 py-2 rounded-xl bg-[#25D366] text-white hover:brightness-95 flex items-center gap-1.5">
                  <MessageSquare size={13} /> {t("sendWhatsapp")}
                </a>
                {(() => {
                  const target = adminsList.find((a) => a.username.toLowerCase() === lastInviteLink.username.toLowerCase());
                  return target?.email ? (
                    <button onClick={() => reinviteAdmin(target, true)} className="text-[11px] font-bold px-3 py-2 rounded-xl bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-100 flex items-center gap-1.5">
                      <Mail size={13} /> {t("resendEmail")}
                    </button>
                  ) : null;
                })()}
              </div>
              {lastInviteLink.emailSent && (
                <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5"><Check size={12} /> {t("inviteEmailSent", { email: lastInviteLink.emailSent })}</p>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
            {adminsLoading ? (
              <p className="text-[13px] text-zinc-400 text-center py-16">{t("loading")}</p>
            ) : adminsList.length === 0 ? (
              <div className="text-center py-16">
                <UserCog size={28} className="mx-auto text-zinc-200 mb-2" />
                <p className="text-[13px] text-zinc-300 font-medium">{t("adminsEmpty")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-[920px]">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-100">
                      {[t("adminsUsername"), t("adminsRole"), t("colStatus"), t("adminsLastLogin"), ""].map((h, i) => (
                        <th key={i} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {adminsList.map((a) => (
                      <tr key={a.id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="px-7 py-4 text-[13px] font-bold text-zinc-900">
                          {(() => {
                            const full = [a.first_name ?? a.display_name, a.last_name].filter(Boolean).join(" ");
                            return full ? <>{full}{a.nickname ? <span className="text-zinc-500 font-medium"> “{a.nickname}”</span> : null} <span className="text-[11px] font-medium text-zinc-400">@{a.username}</span></> : a.username;
                          })()}
                          {a.email && <span className="block text-[11px] font-medium text-zinc-400">{a.email}</span>}
                          {(() => { const dd = daysToBirthday(a.birth_date); return dd !== null && dd <= 14 ? (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-pink-700 bg-pink-50 border border-pink-200 rounded-full px-2 py-0.5">
                              <Cake size={11} /> {dd === 0 ? t("birthdayToday") : dd === 1 ? t("birthdayTomorrow") : t("birthdayInDays", { days: dd })}
                            </span>
                          ) : null; })()}
                        </td>
                        <td className="px-7 py-4">
                          <select
                            value={a.role}
                            onChange={(e) => updateAdmin(a.id, { role: e.target.value as AdminRole })}
                            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[12px] outline-none focus:border-red-400"
                          >
                            <option value="support_admin">{t("roleSupportAdmin")}</option>
                            <option value="content_moderator">{t("roleContentModerator")}</option>
                            <option value="analytics_viewer">{t("roleAnalyticsViewer")}</option>
                            <option value="marketing">{t("roleMarketing")}</option>
                            <option value="super_admin">{t("roleSuperAdmin")}</option>
                          </select>
                        </td>
                        <td className="px-7 py-4">
                          {!a.active ? <Pill tone="zinc">{t("adminInactive")}</Pill>
                            : a.invite_pending ? <Pill tone="amber">{t("adminInvitePending")}</Pill>
                            : <Pill tone="emerald">{t("adminActive")}</Pill>}
                        </td>
                        <td className="px-7 py-4 text-[12px] text-zinc-400">
                          {a.last_login_at ? formatDateDMY(a.last_login_at) : <span className="text-zinc-300">{t("adminsNeverLoggedIn")}</span>}
                        </td>
                        <td className="px-7 py-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button onClick={() => openProfile(a)} title={t("adminProfile")} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 flex items-center gap-1">
                              <IdCard size={12} /> {t("adminProfile")}
                            </button>
                            <button onClick={() => viewAdminActivity(a.username)} title={t("adminViewActivity")} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 flex items-center gap-1">
                              <History size={12} /> {t("adminViewActivity")}
                            </button>
                            <button onClick={() => openNotesFor(a)} title={t("adminNotes")} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 flex items-center gap-1">
                              <MessageSquare size={12} /> {t("adminNotes")}
                            </button>
                            {a.active && (
                              <button onClick={() => reinviteAdmin(a)} title={t("adminReinviteHint")} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 flex items-center gap-1">
                                <Link2 size={12} /> {t("adminReinvite")}
                              </button>
                            )}
                            <button
                              onClick={() => updateAdmin(a.id, { active: !a.active })}
                              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
                                a.active ? "border-red-200 text-red-600 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              }`}
                            >
                              {a.active ? t("deactivate") : t("reactivate")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "activity" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex gap-1.5">
                {([["week", t("activityRangeWeek")], ["month", t("activityRangeMonth")], ["custom", t("activityRangeCustom")]] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setTeamActivityRange(key)} className={`text-[11px] font-bold px-3 py-2 rounded-xl border ${teamActivityRange === key ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50"}`}>{label}</button>
                ))}
              </div>
              {teamActivityRange === "custom" && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("auditFilterFrom")}</label>
                    <input type="date" value={teamActivityFrom} onChange={(e) => setTeamActivityFrom(e.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("auditFilterTo")}</label>
                    <input type="date" value={teamActivityTo} onChange={(e) => setTeamActivityTo(e.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400" />
                  </div>
                </>
              )}
              <button onClick={exportTeamActivity} className="ml-auto flex items-center gap-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 text-[12px] font-bold px-3.5 py-[9px] rounded-xl">
                <Download size={13} /> {t("exportCsv")}
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 mt-3">{t("activityHint")}</p>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
            {teamActivityLoading ? (
              <p className="text-[13px] text-zinc-400 text-center py-16">{t("loading")}</p>
            ) : teamActivity.length === 0 ? (
              <div className="text-center py-16">
                <Clock size={28} className="mx-auto text-zinc-200 mb-2" />
                <p className="text-[13px] text-zinc-300 font-medium">{t("activityEmpty")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-[880px]">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-100">
                      {[t("adminsUsername"), t("adminsRole"), t("activityHours"), t("activitySessions"), t("activityActions"), t("activityLastSeen"), ""].map((h, i) => (
                        <th key={i} className="px-6 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {teamActivity.map((r) => {
                      const top = Object.entries(r.actionsByType).sort((a, b) => b[1] - a[1]).slice(0, 3);
                      return (
                        <tr key={r.username} className="hover:bg-zinc-50/80 transition-colors align-top">
                          <td className="px-6 py-4 text-[13px] font-bold text-zinc-900">{r.username}{!r.active && <span className="ml-2 text-[10px] font-bold text-zinc-400">{t("adminInactive")}</span>}</td>
                          <td className="px-6 py-4 text-[12px] text-zinc-500">{r.role ? roleLabel[r.role] ?? r.role : "—"}</td>
                          <td className="px-6 py-4 text-[13px] font-bold text-zinc-900">{minutesLabel(r.activeMinutes)}</td>
                          <td className="px-6 py-4 text-[12px] text-zinc-600">{r.sessions}</td>
                          <td className="px-6 py-4 text-[12px] text-zinc-600">
                            <span className="font-bold text-zinc-900">{r.actions}</span>
                            {top.length > 0 && (
                              <span className="block text-[11px] text-zinc-400 mt-0.5">{top.map(([k, n]) => `${AUDIT_ACTION_LABEL[k] ?? k} ×${n}`).join(" · ")}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-[12px] text-zinc-400">{r.lastSeen ? new Date(r.lastSeen).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                          <td className="px-6 py-4">
                            <button onClick={() => viewAdminActivity(r.username)} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 flex items-center gap-1 whitespace-nowrap">
                              <History size={12} /> {t("adminViewActivity")}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {profileFor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setProfileFor(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div>
                <h2 className="text-[15px] font-black text-zinc-900">{t("profileTitle", { user: profileFor.username })}</h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">{t("profileHint")}</p>
              </div>
              <button onClick={() => setProfileFor(null)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>
            <form
              className="px-6 py-5 space-y-4"
              onSubmit={async (e) => { e.preventDefault(); if (!profileFor) return; setSavingProfile(true); const ok = await saveAdminProfile(profileFor.id, profileDraft); setSavingProfile(false); if (ok) setProfileFor(null); }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">{t("adminsFirstName")}</label>
                  <input type="text" value={profileDraft.firstName ?? ""} onChange={(e) => setProfileDraft({ ...profileDraft, firstName: e.target.value })} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">{t("adminsLastName")}</label>
                  <input type="text" value={profileDraft.lastName ?? ""} onChange={(e) => setProfileDraft({ ...profileDraft, lastName: e.target.value })} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">{t("adminsNickname")}</label>
                  <input type="text" value={profileDraft.nickname ?? ""} onChange={(e) => setProfileDraft({ ...profileDraft, nickname: e.target.value })} placeholder={t("adminsNicknamePlaceholder")} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                  <p className="text-[11px] text-zinc-400 mt-1">{t("adminsNicknameHint")}</p>
                </div>
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">{t("adminsSalutation")}</label>
                  <select value={profileDraft.salutation ?? "n"} onChange={(e) => setProfileDraft({ ...profileDraft, salutation: e.target.value as "f" | "m" | "n" })} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 bg-white">
                    <option value="f">{t("salutationF")}</option>
                    <option value="m">{t("salutationM")}</option>
                    <option value="n">{t("salutationN")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">{t("profileBirthDate")}</label>
                  <input type="date" value={profileDraft.birthDate ?? ""} onChange={(e) => setProfileDraft({ ...profileDraft, birthDate: e.target.value })} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-zinc-700">{t("profilePhone")}</label>
                  <input type="tel" value={profileDraft.phone ?? ""} onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })} placeholder="+61 4…" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[12px] font-bold text-zinc-700">Email</label>
                  <input type="email" value={profileDraft.email ?? ""} onChange={(e) => setProfileDraft({ ...profileDraft, email: e.target.value })} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[12px] font-bold text-zinc-700">{t("profileAddress")}</label>
                  <input type="text" value={profileDraft.address ?? ""} onChange={(e) => setProfileDraft({ ...profileDraft, address: e.target.value })} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[12px] font-bold text-zinc-700">{t("profileNotes")}</label>
                  <textarea rows={3} value={profileDraft.notes ?? ""} onChange={(e) => setProfileDraft({ ...profileDraft, notes: e.target.value })} placeholder={t("profileNotesPlaceholder")} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 resize-none" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setProfileFor(null)} className="text-[12px] font-bold px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50">{t("cancel")}</button>
                <button type="submit" disabled={savingProfile} className="text-[12px] font-bold px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40">{savingProfile ? t("saving") : t("save")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {notesForAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeNotes}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div>
                <h2 className="text-[15px] font-black text-zinc-900">{t("notesTitle", { user: notesForAdmin.admin.username })}</h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">{t("notesHint")}</p>
              </div>
              <button onClick={closeNotes} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 border-b border-zinc-100">
              <textarea
                value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3} maxLength={2000}
                placeholder={t("notesPlaceholder")}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-500 resize-none"
              />
              <div className="flex justify-end mt-2">
                <button
                  disabled={sendingNote || !noteDraft.trim()}
                  onClick={async () => { setSendingNote(true); const ok = await sendNote(notesForAdmin.admin, noteDraft.trim()); setSendingNote(false); if (ok) setNoteDraft(""); }}
                  className="text-[12px] font-bold px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40"
                >
                  {sendingNote ? t("sending") : t("notesSend")}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {notesForAdmin.notes.length === 0 ? (
                <p className="text-[12px] text-zinc-400 text-center py-6">{t("notesEmpty")}</p>
              ) : notesForAdmin.notes.map((n) => (
                <div key={n.id} className="rounded-xl border border-zinc-200 px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-zinc-500">{n.from_username} · {formatDateDMY(n.created_at)}</span>
                    {n.read_at
                      ? <span className="text-[10px] font-bold text-emerald-600">{t("noteRead", { when: formatDateDMY(n.read_at) })}</span>
                      : <span className="text-[10px] font-bold text-amber-600">{t("noteUnread")}</span>}
                  </div>
                  <p className="text-[13px] text-zinc-800 whitespace-pre-wrap mt-1">{n.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
