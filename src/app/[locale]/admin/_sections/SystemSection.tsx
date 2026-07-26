"use client";

// Facu (26 jul 2026): novena sección extraída del split del admin — mismo
// criterio que las anteriores (JSX movido tal cual, estado y lógica se
// quedan en page.tsx).

import { formatDateDMY } from "@/lib/date";
import { type SystemSettingsRow, type ChangelogEntry } from "../page";

type SystemSectionProps = {
  t: (key: string, values?: Record<string, string | number>) => string;

  systemSettingsLoading: boolean;
  systemSettingValue: <K extends keyof SystemSettingsRow>(key: K) => SystemSettingsRow[K] | undefined;
  setSystemSettingsDraft: (updater: (prev: Partial<SystemSettingsRow>) => Partial<SystemSettingsRow>) => void;
  systemSettingsDraft: Partial<SystemSettingsRow>;
  systemSettings: SystemSettingsRow | null;
  systemSettingsSaving: boolean;
  saveSystemSettings: () => void | Promise<void>;

  newChangelogVersion: string;
  setNewChangelogVersion: (v: string) => void;
  newChangelogNotes: string;
  setNewChangelogNotes: (v: string) => void;
  createChangelogEntry: () => void | Promise<void>;
  creatingChangelogEntry: boolean;

  changelogLoading: boolean;
  changelogEntries: ChangelogEntry[];
  deleteChangelogEntry: (id: string) => void | Promise<void>;
};

export default function SystemSection({
  t,
  systemSettingsLoading, systemSettingValue, setSystemSettingsDraft, systemSettingsDraft,
  systemSettings, systemSettingsSaving, saveSystemSettings,
  newChangelogVersion, setNewChangelogVersion, newChangelogNotes, setNewChangelogNotes,
  createChangelogEntry, creatingChangelogEntry,
  changelogLoading, changelogEntries, deleteChangelogEntry,
}: SystemSectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-[12px] text-zinc-400">{t("systemIntro")}</p>

      {systemSettingsLoading ? (
        <p className="text-[13px] text-zinc-400 text-center py-16">{t("loading")}</p>
      ) : (
        <>
          {/* Modo mantenimiento */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-zinc-900">{t("systemMaintenanceTitle")}</p>
                <p className="text-[11px] text-zinc-400">{t("systemMaintenanceDesc")}</p>
              </div>
              <button
                onClick={() => setSystemSettingsDraft((prev) => ({ ...prev, maintenance_mode: !systemSettingValue("maintenance_mode") }))}
                className={`text-[11px] font-bold px-3 py-2 rounded-xl border transition-colors shrink-0 ${
                  systemSettingValue("maintenance_mode") ? "border-red-200 text-red-600 hover:bg-red-50" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                {systemSettingValue("maintenance_mode") ? t("systemMaintenanceEnabled") : t("systemMaintenanceDisabled")}
              </button>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("systemMaintenanceMessageLabel")}</label>
              <textarea
                value={systemSettingValue("maintenance_message") ?? ""}
                onChange={(e) => setSystemSettingsDraft((prev) => ({ ...prev, maintenance_message: e.target.value }))}
                placeholder={t("systemMaintenanceMessagePlaceholder")}
                rows={2}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400 resize-none"
              />
            </div>
          </div>

          {/* Banner informativo */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-zinc-900">{t("systemBannerTitle")}</p>
                <p className="text-[11px] text-zinc-400">{t("systemBannerDesc")}</p>
              </div>
              <button
                onClick={() => setSystemSettingsDraft((prev) => ({ ...prev, banner_enabled: !systemSettingValue("banner_enabled") }))}
                className={`text-[11px] font-bold px-3 py-2 rounded-xl border transition-colors shrink-0 ${
                  systemSettingValue("banner_enabled") ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                {systemSettingValue("banner_enabled") ? t("systemBannerEnabled") : t("systemBannerDisabled")}
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("systemBannerTextLabel")}</label>
                <input
                  type="text"
                  value={systemSettingValue("banner_text") ?? ""}
                  onChange={(e) => setSystemSettingsDraft((prev) => ({ ...prev, banner_text: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("systemBannerSeverityLabel")}</label>
                <select
                  value={systemSettingValue("banner_severity") ?? "info"}
                  onChange={(e) => setSystemSettingsDraft((prev) => ({ ...prev, banner_severity: e.target.value as SystemSettingsRow["banner_severity"] }))}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400 w-full"
                >
                  <option value="info">{t("systemBannerSeverityInfo")}</option>
                  <option value="warning">{t("systemBannerSeverityWarning")}</option>
                  <option value="critical">{t("systemBannerSeverityCritical")}</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("systemBannerLinkLabel")}</label>
                <input
                  type="text"
                  value={systemSettingValue("banner_link_url") ?? ""}
                  onChange={(e) => setSystemSettingsDraft((prev) => ({ ...prev, banner_link_url: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
                />
              </div>
            </div>
          </div>

          {/* Límites de archivo */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-5 space-y-3">
            <div>
              <p className="text-[13px] font-bold text-zinc-900">{t("systemLimitsTitle")}</p>
              <p className="text-[11px] text-zinc-400">{t("systemLimitsDesc")}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("systemLimitsAssetPhoto")}</label>
                <input
                  type="number" min={1}
                  value={systemSettingValue("max_asset_photo_mb") ?? 8}
                  onChange={(e) => setSystemSettingsDraft((prev) => ({ ...prev, max_asset_photo_mb: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("systemLimitsDocument")}</label>
                <input
                  type="number" min={1}
                  value={systemSettingValue("max_document_mb") ?? 25}
                  onChange={(e) => setSystemSettingsDraft((prev) => ({ ...prev, max_document_mb: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("systemLimitsCertificate")}</label>
                <input
                  type="number" min={1}
                  value={systemSettingValue("max_certificate_mb") ?? 10}
                  onChange={(e) => setSystemSettingsDraft((prev) => ({ ...prev, max_certificate_mb: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
                />
              </div>
            </div>
          </div>

          {/* Guardar */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={saveSystemSettings}
              disabled={systemSettingsSaving || Object.keys(systemSettingsDraft).length === 0}
              className="text-[11px] font-bold px-4 py-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 transition-colors disabled:opacity-40"
            >
              {systemSettingsSaving ? t("systemSaving") : t("systemSaveButton")}
            </button>
            {Object.keys(systemSettingsDraft).length > 0 && (
              <p className="text-[11px] text-amber-600">{t("systemUnsavedNotice")}</p>
            )}
            {systemSettings?.updated_at && (
              <p className="text-[11px] text-zinc-300 ml-auto">{t("systemLastUpdated")}: {formatDateDMY(systemSettings.updated_at)}</p>
            )}
          </div>

          {/* Changelog */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-5 space-y-4">
            <div>
              <p className="text-[13px] font-bold text-zinc-900">{t("systemChangelogTitle")}</p>
              <p className="text-[11px] text-zinc-400">{t("systemChangelogDesc")}</p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("systemChangelogVersionLabel")}</label>
                <input
                  type="text" value={newChangelogVersion}
                  onChange={(e) => setNewChangelogVersion(e.target.value)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400 w-32"
                />
              </div>
              <div className="flex-1 min-w-[220px]">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("systemChangelogNotesLabel")}</label>
                <input
                  type="text" value={newChangelogNotes}
                  onChange={(e) => setNewChangelogNotes(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
                />
              </div>
              <button
                onClick={createChangelogEntry}
                disabled={creatingChangelogEntry || !newChangelogVersion.trim() || !newChangelogNotes.trim()}
                className="text-[11px] font-bold px-4 py-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 transition-colors disabled:opacity-40"
              >
                {creatingChangelogEntry ? t("creating") : t("systemChangelogCreateButton")}
              </button>
            </div>

            {changelogLoading ? (
              <p className="text-[13px] text-zinc-400 text-center py-8">{t("loading")}</p>
            ) : changelogEntries.length === 0 ? (
              <p className="text-[12px] text-zinc-300 text-center py-8">{t("systemChangelogEmpty")}</p>
            ) : (
              <div className="divide-y divide-zinc-50">
                {changelogEntries.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-zinc-900">
                        {entry.version_label} <span className="text-[11px] font-medium text-zinc-400">— {formatDateDMY(entry.published_at)}</span>
                      </p>
                      <p className="text-[12px] text-zinc-500 mt-0.5">{entry.notes}</p>
                    </div>
                    <button
                      onClick={() => deleteChangelogEntry(entry.id)}
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors shrink-0"
                    >
                      {t("systemChangelogDeleteButton")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
