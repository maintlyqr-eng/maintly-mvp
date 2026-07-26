"use client";

// Facu (26 jul 2026): cuarta sección extraída del split del admin — mismo
// criterio que AuditLogSection.tsx / ErrorsSection.tsx / AnalyticsSection.tsx
// (JSX movido tal cual, estado y lógica se quedan en page.tsx).

import { Fragment } from "react";
import { Download, Flag, ChevronDown, ChevronRight, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  formatDate, formatTime, Pill,
  type ContentReportRow, type FlaggedMechanicRow,
} from "../page";

type ModerationSectionProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;

  moderationTab: "reports" | "suspicious";
  setModerationTab: (v: "reports" | "suspicious") => void;
  suspiciousActivitySummary: { flaggedTotal: number; scannedMechanics: number } | null;

  assetLabel: (a: { nickname: string | null; brand: string | null; model: string | null }) => string;

  REPORT_TYPE_LABEL: Record<string, string>;
  REPORT_STATUS_LABEL: Record<string, string>;
  REPORT_STATUS_TONE: Record<string, "amber" | "blue" | "emerald" | "zinc">;

  reportStatusFilter: string;
  setReportStatusFilter: (v: string) => void;
  reportTypeFilter: string;
  setReportTypeFilter: (v: string) => void;
  reportsPage: number;
  setReportsPage: (updater: number | ((p: number) => number)) => void;
  reportsTotal: number;
  reportsTotalPages: number;

  handleExportReports: () => void | Promise<void>;
  reportsExportBusy: boolean;

  reportsLoading: boolean;
  reports: ContentReportRow[];
  expandedReportId: string | null;
  setExpandedReportId: (v: string | null) => void;
  reportNotesDraft: Record<string, string>;
  setReportNotesDraft: (updater: Record<string, string> | ((p: Record<string, string>) => Record<string, string>)) => void;
  reportNotesSaving: string | null;
  handleReportStatusChange: (report: ContentReportRow, status: string) => void | Promise<void>;
  handleSaveReportNotes: (report: ContentReportRow) => void | Promise<void>;

  handleReportsTouchStart: (e: React.TouchEvent) => void;
  handleReportsTouchEnd: (e: React.TouchEvent) => void;

  suspiciousActivityLoading: boolean;
  suspiciousActivity: FlaggedMechanicRow[];
  openSuspiciousMechanicDetail: (mechanicId: string) => void;
};

export default function ModerationSection({
  t, locale,
  moderationTab, setModerationTab, suspiciousActivitySummary,
  assetLabel,
  REPORT_TYPE_LABEL, REPORT_STATUS_LABEL, REPORT_STATUS_TONE,
  reportStatusFilter, setReportStatusFilter, reportTypeFilter, setReportTypeFilter,
  reportsPage, setReportsPage, reportsTotal, reportsTotalPages,
  handleExportReports, reportsExportBusy,
  reportsLoading, reports, expandedReportId, setExpandedReportId,
  reportNotesDraft, setReportNotesDraft, reportNotesSaving,
  handleReportStatusChange, handleSaveReportNotes,
  handleReportsTouchStart, handleReportsTouchEnd,
  suspiciousActivityLoading, suspiciousActivity, openSuspiciousMechanicDetail,
}: ModerationSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-zinc-200/80">
        {([
          { id: "reports" as const, label: t("moderationTabReports") },
          { id: "suspicious" as const, label: t("moderationTabSuspicious") },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setModerationTab(tab.id)}
            className={`relative flex items-center gap-1.5 px-3.5 py-2.5 text-[12px] font-bold transition-colors ${
              moderationTab === tab.id ? "text-red-600" : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            {tab.label}
            {tab.id === "suspicious" && suspiciousActivitySummary && suspiciousActivitySummary.flaggedTotal > 0 && (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-white leading-none">
                {suspiciousActivitySummary.flaggedTotal}
              </span>
            )}
            {moderationTab === tab.id && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-red-600 rounded-full" />}
          </button>
        ))}
      </div>

      {moderationTab === "reports" && (
    <div className="space-y-4">
      <p className="text-[12px] text-zinc-400">{t("moderationIntro")}</p>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("moderationFilterStatus")}</label>
          <select
            value={reportStatusFilter}
            onChange={(e) => { setReportStatusFilter(e.target.value); setReportsPage(1); }}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
          >
            <option value="all">{t("auditFilterAll")}</option>
            {Object.entries(REPORT_STATUS_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("moderationFilterType")}</label>
          <select
            value={reportTypeFilter}
            onChange={(e) => { setReportTypeFilter(e.target.value); setReportsPage(1); }}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
          >
            <option value="all">{t("auditFilterAll")}</option>
            {Object.entries(REPORT_TYPE_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        {(reportStatusFilter !== "all" || reportTypeFilter !== "all") && (
          <button
            onClick={() => { setReportStatusFilter("all"); setReportTypeFilter("all"); setReportsPage(1); }}
            className="text-[11px] font-bold text-zinc-400 hover:text-red-600 transition-colors px-2 py-2"
          >
            {t("auditFilterClear")}
          </button>
        )}
        <button
          onClick={handleExportReports} disabled={reportsExportBusy}
          className="ml-auto flex items-center gap-2 bg-white border border-zinc-200 hover:bg-zinc-50 disabled:opacity-60 text-zinc-600 text-[12px] font-bold px-3.5 py-[9px] rounded-xl transition-colors"
        >
          <Download size={13} /> {reportsExportBusy ? t("exporting") : t("exportCsv")}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
        {reportsLoading ? (
          <p className="text-[13px] text-zinc-400 text-center py-16">{t("loading")}</p>
        ) : reports.length === 0 ? (
          <div className="text-center py-16">
            <Flag size={28} className="mx-auto text-zinc-200 mb-2" />
            <p className="text-[13px] text-zinc-300 font-medium">{t("moderationNoReports")}</p>
          </div>
        ) : (
          <>
            <div
              className="overflow-x-auto overscroll-x-contain touch-pan-y"
              onTouchStart={handleReportsTouchStart}
              onTouchEnd={handleReportsTouchEnd}
            >
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    {[t("moderationColWhen"), t("moderationColType"), t("moderationColStatus"), t("moderationColRelated"), ""].map((h) => (
                      <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {reports.map((report) => {
                    const isExpanded = expandedReportId === report.id;
                    const relatedLabel = report.asset
                      ? assetLabel(report.asset)
                      : (report.mechanic?.name ?? report.qr_code ?? "—");
                    return (
                      <Fragment key={report.id}>
                        <tr
                          className="hover:bg-zinc-50/80 transition-colors cursor-pointer"
                          onClick={() => {
                            setExpandedReportId(isExpanded ? null : report.id);
                            setReportNotesDraft((prev) => (report.id in prev ? prev : { ...prev, [report.id]: report.internal_notes ?? "" }));
                          }}
                        >
                          <td className="px-7 py-4 text-[12px] text-zinc-400 whitespace-nowrap">{formatDate(report.created_at)} · {formatTime(report.created_at, locale)}</td>
                          <td className="px-7 py-4 text-[12px] text-zinc-600 font-semibold">{REPORT_TYPE_LABEL[report.report_type] ?? report.report_type}</td>
                          <td className="px-7 py-4"><Pill tone={REPORT_STATUS_TONE[report.status] ?? "zinc"}>{REPORT_STATUS_LABEL[report.status] ?? report.status}</Pill></td>
                          <td className="px-7 py-4 text-[12px] text-zinc-500 truncate max-w-[220px]">{relatedLabel}</td>
                          <td className="px-7 py-4 text-right text-zinc-300">
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${report.id}-detail`} className="bg-zinc-50/60">
                            <td colSpan={5} className="px-7 py-5">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-[12px]">
                                <div className="sm:col-span-2">
                                  <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("moderationDetailMessage")}</p>
                                  <p className="whitespace-pre-wrap break-words bg-white border border-zinc-200 rounded-lg p-3 text-zinc-700">{report.message}</p>
                                </div>
                                {(report.reporter_name || report.reporter_contact) && (
                                  <div>
                                    <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("moderationDetailReporter")}</p>
                                    <p className="text-zinc-600">{report.reporter_name || t("moderationAnonymous")}{report.reporter_contact ? ` · ${report.reporter_contact}` : ""}</p>
                                  </div>
                                )}
                                {report.qr_code && (
                                  <div>
                                    <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("moderationDetailQrCode")}</p>
                                    <a href={`/asset/${report.qr_code}`} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:text-red-700 font-mono font-bold">
                                      {report.qr_code}
                                    </a>
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("moderationDetailStatus")}</p>
                                  <select
                                    value={report.status}
                                    onChange={(e) => handleReportStatusChange(report, e.target.value)}
                                    className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-red-400"
                                  >
                                    {Object.entries(REPORT_STATUS_LABEL).map(([key, label]) => (
                                      <option key={key} value={key}>{label}</option>
                                    ))}
                                  </select>
                                </div>
                                {report.resolved_at && (
                                  <div>
                                    <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("moderationDetailResolvedBy")}</p>
                                    <p className="text-zinc-600">{report.resolved_by ?? "—"} · {formatDate(report.resolved_at)}</p>
                                  </div>
                                )}
                                <div className="sm:col-span-2">
                                  <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("moderationDetailNotes")}</p>
                                  <textarea
                                    value={reportNotesDraft[report.id] ?? report.internal_notes ?? ""}
                                    onChange={(e) => setReportNotesDraft((prev) => ({ ...prev, [report.id]: e.target.value }))}
                                    placeholder={t("moderationNotesPlaceholder")}
                                    rows={2}
                                    className="w-full bg-white border border-zinc-200 focus:border-red-400 rounded-lg px-3 py-2 text-[12px] text-zinc-700 outline-none transition-all resize-none"
                                  />
                                  <button
                                    onClick={() => handleSaveReportNotes(report)}
                                    disabled={reportNotesSaving === report.id}
                                    className="mt-2 text-[11px] font-bold text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
                                  >
                                    {reportNotesSaving === report.id ? t("saving") : t("moderationSaveNotes")}
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-7 py-4 border-t border-zinc-100">
              <p className="text-[11px] text-zinc-400">{t("auditTotalCount", { count: reportsTotal })}</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setReportsPage((p) => Math.max(1, p - 1))}
                  disabled={reportsPage <= 1}
                  className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-30"
                >
                  {t("auditPrevPage")}
                </button>
                <span className="text-[11px] text-zinc-400">{t("auditPageOf", { page: reportsPage, totalPages: reportsTotalPages })}</span>
                <button
                  onClick={() => setReportsPage((p) => Math.min(reportsTotalPages, p + 1))}
                  disabled={reportsPage >= reportsTotalPages}
                  className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-30"
                >
                  {t("auditNextPage")}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
      )}

      {moderationTab === "suspicious" && (
        <div className="space-y-4">
          <p className="text-[12px] text-zinc-400">{t("suspiciousIntro")}</p>

          {suspiciousActivitySummary && (
            <p className="text-[11px] text-zinc-400">
              {t("suspiciousScanSummary", {
                flagged: suspiciousActivitySummary.flaggedTotal,
                scanned: suspiciousActivitySummary.scannedMechanics,
              })}
            </p>
          )}

          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
            {suspiciousActivityLoading ? (
              <p className="text-[13px] text-zinc-400 text-center py-16">{t("loading")}</p>
            ) : suspiciousActivity.length === 0 ? (
              <div className="text-center py-16">
                <ShieldCheck size={28} className="mx-auto text-zinc-200 mb-2" />
                <p className="text-[13px] text-zinc-300 font-medium">{t("suspiciousEmpty")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-100">
                      {[t("suspiciousColMaintler"), t("suspiciousColScore"), t("suspiciousColReasons"), t("suspiciousColSince"), ""].map((h) => (
                        <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {suspiciousActivity.map((entry) => (
                      <tr
                        key={entry.mechanicId}
                        className="hover:bg-zinc-50/80 transition-colors cursor-pointer"
                        onClick={() => openSuspiciousMechanicDetail(entry.mechanicId)}
                      >
                        <td className="px-7 py-4">
                          <p className="text-[13px] font-bold text-zinc-900">{entry.name || entry.email}</p>
                          <p className="text-[11px] text-zinc-400">{entry.email}</p>
                        </td>
                        <td className="px-7 py-4">
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-black text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
                            <AlertTriangle size={12} /> {entry.score}
                          </span>
                        </td>
                        <td className="px-7 py-4">
                          <div className="flex flex-wrap gap-1.5 max-w-[320px]">
                            {entry.reasons.map((reason, i) => (
                              <span key={i} className="text-[10.5px] font-semibold text-zinc-600 bg-zinc-100 rounded-full px-2 py-1 whitespace-nowrap">
                                {t(`suspiciousReason_${reason.key}`, { count: reason.count })}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-7 py-4 text-[12px] text-zinc-400 whitespace-nowrap">{formatDate(entry.createdAt)}</td>
                        <td className="px-7 py-4">
                          {entry.suspended
                            ? <Pill tone="red">{t("suspendedPill")}</Pill>
                            : <Pill tone="emerald">{t("activePill")}</Pill>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
