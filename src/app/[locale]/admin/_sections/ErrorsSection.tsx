"use client";

// Facu (26 jul 2026): segunda sección extraída del split del admin —
// mismo criterio que AuditLogSection.tsx (ver el comentario ahí para el
// porqué): JSX movido tal cual, estado y lógica se quedan en page.tsx.

import { Fragment } from "react";
import { AlertTriangle, ShieldCheck, Bug, ChevronDown, ChevronRight } from "lucide-react";
import { formatDate, formatTime, Pill, type PlatformErrorLogRow } from "../page";

type ErrorsSectionProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;

  errorLogs: PlatformErrorLogRow[];
  errorLogsLoading: boolean;
  errorLogsTotal: number;
  errorLogsUnresolvedCount: number;
  errorLogsPage: number;
  errorLogsTotalPages: number;
  setErrorLogsPage: (updater: number | ((p: number) => number)) => void;

  errorLogSourceFilter: string;
  setErrorLogSourceFilter: (v: string) => void;
  errorLogSeverityFilter: string;
  setErrorLogSeverityFilter: (v: string) => void;
  errorLogResolvedFilter: "all" | "unresolved" | "resolved";
  setErrorLogResolvedFilter: (v: "all" | "unresolved" | "resolved") => void;

  expandedErrorLogId: string | null;
  setExpandedErrorLogId: (v: string | null) => void;

  errorLogBusyId: string | null;
  toggleErrorLogResolved: (log: PlatformErrorLogRow) => void | Promise<void>;

  handleErrorLogsTouchStart: (e: React.TouchEvent) => void;
  handleErrorLogsTouchEnd: (e: React.TouchEvent) => void;
};

export default function ErrorsSection({
  t, locale,
  errorLogs, errorLogsLoading, errorLogsTotal, errorLogsUnresolvedCount, errorLogsPage, errorLogsTotalPages, setErrorLogsPage,
  errorLogSourceFilter, setErrorLogSourceFilter,
  errorLogSeverityFilter, setErrorLogSeverityFilter,
  errorLogResolvedFilter, setErrorLogResolvedFilter,
  expandedErrorLogId, setExpandedErrorLogId,
  errorLogBusyId, toggleErrorLogResolved,
  handleErrorLogsTouchStart, handleErrorLogsTouchEnd,
}: ErrorsSectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-[12px] text-zinc-400">{t("errorsIntro")}</p>

      <div className="flex flex-wrap items-center gap-3">
        <div className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 ${
          errorLogsUnresolvedCount > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"
        }`}>
          {errorLogsUnresolvedCount > 0 ? (
            <AlertTriangle size={14} className="text-amber-600" />
          ) : (
            <ShieldCheck size={14} className="text-emerald-600" />
          )}
          <p className={`text-[12px] font-bold ${errorLogsUnresolvedCount > 0 ? "text-amber-800" : "text-emerald-800"}`}>
            {t("errorsUnresolvedSummary", { count: errorLogsUnresolvedCount })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("errorsFilterSource")}</label>
          <select
            value={errorLogSourceFilter}
            onChange={(e) => { setErrorLogSourceFilter(e.target.value); setErrorLogsPage(1); }}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
          >
            <option value="all">{t("auditFilterAll")}</option>
            <option value="client">{t("errorsSourceClient")}</option>
            <option value="server">{t("errorsSourceServer")}</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("errorsFilterSeverity")}</label>
          <select
            value={errorLogSeverityFilter}
            onChange={(e) => { setErrorLogSeverityFilter(e.target.value); setErrorLogsPage(1); }}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
          >
            <option value="all">{t("auditFilterAll")}</option>
            <option value="error">{t("errorsSeverityError")}</option>
            <option value="warning">{t("errorsSeverityWarning")}</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("errorsFilterStatus")}</label>
          <select
            value={errorLogResolvedFilter}
            onChange={(e) => { setErrorLogResolvedFilter(e.target.value as "all" | "unresolved" | "resolved"); setErrorLogsPage(1); }}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
          >
            <option value="unresolved">{t("errorsStatusUnresolved")}</option>
            <option value="resolved">{t("errorsStatusResolved")}</option>
            <option value="all">{t("auditFilterAll")}</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
        {errorLogsLoading ? (
          <p className="text-[13px] text-zinc-400 text-center py-16">{t("loading")}</p>
        ) : errorLogs.length === 0 ? (
          <div className="text-center py-16">
            <Bug size={28} className="mx-auto text-zinc-200 mb-2" />
            <p className="text-[13px] text-zinc-300 font-medium">{t("errorsEmpty")}</p>
          </div>
        ) : (
          <>
            <div
              className="overflow-x-auto overscroll-x-contain touch-pan-y"
              onTouchStart={handleErrorLogsTouchStart}
              onTouchEnd={handleErrorLogsTouchEnd}
            >
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    {[t("auditColWhen"), t("errorsColSource"), t("errorsColSeverity"), t("errorsColMessage"), t("errorsColRoute"), t("colStatus"), ""].map((h) => (
                      <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {errorLogs.map((log) => {
                    const isExpanded = expandedErrorLogId === log.id;
                    return (
                      <Fragment key={log.id}>
                        <tr
                          className="hover:bg-zinc-50/80 transition-colors cursor-pointer"
                          onClick={() => setExpandedErrorLogId(isExpanded ? null : log.id)}
                        >
                          <td className="px-7 py-4 text-[12px] text-zinc-400 whitespace-nowrap">{formatDate(log.created_at)} · {formatTime(log.created_at, locale)}</td>
                          <td className="px-7 py-4 text-[12px] font-semibold text-zinc-600">
                            {log.source === "client" ? t("errorsSourceClient") : t("errorsSourceServer")}
                          </td>
                          <td className="px-7 py-4">
                            {log.severity === "warning"
                              ? <Pill tone="amber">{t("errorsSeverityWarning")}</Pill>
                              : <Pill tone="red">{t("errorsSeverityError")}</Pill>}
                          </td>
                          <td className="px-7 py-4 text-[12px] text-zinc-700 max-w-[360px] truncate">{log.message}</td>
                          <td className="px-7 py-4 text-[12px] font-mono text-zinc-400">{log.route ?? "—"}</td>
                          <td className="px-7 py-4">
                            {log.resolved
                              ? <Pill tone="emerald">{t("errorsStatusResolved")}</Pill>
                              : <Pill tone="zinc">{t("errorsStatusUnresolved")}</Pill>}
                          </td>
                          <td className="px-7 py-4 text-right text-zinc-300">
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${log.id}-detail`} className="bg-zinc-50/60">
                            <td colSpan={7} className="px-7 py-4">
                              <div className="space-y-3 text-[11.5px]">
                                <div>
                                  <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("errorsDetailMessage")}</p>
                                  <p className="whitespace-pre-wrap break-words bg-white border border-zinc-200 rounded-lg p-2.5 text-zinc-700">{log.message}</p>
                                </div>
                                {log.stack && (
                                  <div>
                                    <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("errorsDetailStack")}</p>
                                    <pre className="whitespace-pre-wrap break-words bg-white border border-zinc-200 rounded-lg p-2.5 text-zinc-600 font-mono text-[11px] max-h-64 overflow-y-auto">
                                      {log.stack}
                                    </pre>
                                  </div>
                                )}
                                {log.context != null && (
                                  <div>
                                    <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("errorsDetailContext")}</p>
                                    <pre className="whitespace-pre-wrap break-words bg-white border border-zinc-200 rounded-lg p-2.5 text-zinc-600 font-mono text-[11px]">
                                      {JSON.stringify(log.context, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {log.user_agent && (
                                    <div>
                                      <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("errorsDetailUserAgent")}</p>
                                      <p className="text-zinc-600 break-words">{log.user_agent}</p>
                                    </div>
                                  )}
                                  {log.ip_address && (
                                    <div>
                                      <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("auditDetailIp")}</p>
                                      <p className="text-zinc-600 font-mono">{log.ip_address}</p>
                                    </div>
                                  )}
                                  {log.resolved && log.resolved_by && (
                                    <div>
                                      <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("errorsDetailResolvedBy")}</p>
                                      <p className="text-zinc-600">{log.resolved_by} · {log.resolved_at ? formatDate(log.resolved_at) : ""}</p>
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleErrorLogResolved(log); }}
                                  disabled={errorLogBusyId === log.id}
                                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                                    log.resolved ? "border-zinc-200 text-zinc-600 hover:bg-zinc-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                  }`}
                                >
                                  {log.resolved ? t("errorsReopenButton") : t("errorsResolveButton")}
                                </button>
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
              <p className="text-[11px] text-zinc-400">{t("auditTotalCount", { count: errorLogsTotal })}</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setErrorLogsPage((p) => Math.max(1, p - 1))}
                  disabled={errorLogsPage <= 1}
                  className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-30"
                >
                  {t("auditPrevPage")}
                </button>
                <span className="text-[11px] text-zinc-400">
                  {t("auditPageOf", { page: errorLogsPage, totalPages: errorLogsTotalPages })}
                </span>
                <button
                  onClick={() => setErrorLogsPage((p) => Math.min(errorLogsTotalPages, p + 1))}
                  disabled={errorLogsPage >= errorLogsTotalPages}
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
  );
}
