"use client";

// Facu (26 jul 2026): octava sección extraída del split del admin — mismo
// criterio que las anteriores (JSX movido tal cual, estado y lógica se
// quedan en page.tsx).

import { UserCog } from "lucide-react";
import { formatDateDMY } from "@/lib/date";
import { Pill, type AdminRole, type AdminUserRow } from "../page";

type AdminsSectionProps = {
  t: (key: string, values?: Record<string, string | number>) => string;

  newAdminUsername: string;
  setNewAdminUsername: (v: string) => void;
  newAdminPassword: string;
  setNewAdminPassword: (v: string) => void;
  newAdminRole: AdminRole;
  setNewAdminRole: (v: AdminRole) => void;
  creatingAdmin: boolean;
  createAdmin: () => void | Promise<void>;

  adminsLoading: boolean;
  adminsList: AdminUserRow[];
  updateAdmin: (id: string, patch: { role?: AdminRole; active?: boolean }) => void | Promise<void>;
};

export default function AdminsSection({
  t,
  newAdminUsername, setNewAdminUsername, newAdminPassword, setNewAdminPassword,
  newAdminRole, setNewAdminRole, creatingAdmin, createAdmin,
  adminsLoading, adminsList, updateAdmin,
}: AdminsSectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-[12px] text-zinc-400">{t("adminsIntro")}</p>

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
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("adminsPassword")}</label>
            <input
              type="password" value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
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
              <option value="super_admin">{t("roleSuperAdmin")}</option>
            </select>
          </div>
          <button
            onClick={createAdmin}
            disabled={creatingAdmin || !newAdminUsername.trim() || newAdminPassword.length < 8}
            className="text-[11px] font-bold px-4 py-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            {creatingAdmin ? t("creating") : t("adminsCreateButton")}
          </button>
        </div>
        {newAdminPassword.length > 0 && newAdminPassword.length < 8 && (
          <p className="text-[11px] text-amber-600">{t("adminsPasswordTooShort")}</p>
        )}
      </div>

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
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  {[t("adminsUsername"), t("adminsRole"), t("colStatus"), t("adminsLastLogin"), ""].map((h) => (
                    <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {adminsList.map((a) => (
                  <tr key={a.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-7 py-4 text-[13px] font-bold text-zinc-900">{a.username}</td>
                    <td className="px-7 py-4">
                      <select
                        value={a.role}
                        onChange={(e) => updateAdmin(a.id, { role: e.target.value as AdminRole })}
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[12px] outline-none focus:border-red-400"
                      >
                        <option value="support_admin">{t("roleSupportAdmin")}</option>
                        <option value="content_moderator">{t("roleContentModerator")}</option>
                        <option value="analytics_viewer">{t("roleAnalyticsViewer")}</option>
                        <option value="super_admin">{t("roleSuperAdmin")}</option>
                      </select>
                    </td>
                    <td className="px-7 py-4">
                      {a.active ? <Pill tone="emerald">{t("adminActive")}</Pill> : <Pill tone="zinc">{t("adminInactive")}</Pill>}
                    </td>
                    <td className="px-7 py-4 text-[12px] text-zinc-400">
                      {a.last_login_at ? formatDateDMY(a.last_login_at) : <span className="text-zinc-300">{t("adminsNeverLoggedIn")}</span>}
                    </td>
                    <td className="px-7 py-4">
                      <button
                        onClick={() => updateAdmin(a.id, { active: !a.active })}
                        className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
                          a.active ? "border-red-200 text-red-600 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {a.active ? t("deactivate") : t("reactivate")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
