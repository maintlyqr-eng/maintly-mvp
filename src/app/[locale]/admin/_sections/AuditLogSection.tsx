"use client";

// Facu (26 jul 2026): "dale parti el admin" — primer paso de la
// reestructuración del panel admin (5681 líneas en un solo archivo). Esta
// es la sección "Registro de Auditoría", movida acá TAL CUAL estaba
// (mismo JSX, carácter por carácter salvo el reemplazo de nombres de
// variable sueltos por props) — a propósito NO se movió nada de estado ni
// de lógica (loadAuditLogs, los useState, el useEffect que dispara la
// carga) a este archivo. Eso sigue viviendo en page.tsx y llega acá como
// props. Es una extracción puramente mecánica: mismo comportamiento,
// mismo timing, cero hooks nuevos — solo se movió el texto del JSX a otro
// archivo, así page.tsx pierde ~180 líneas sin ningún riesgo de romper
// nada (no hay estado que reubicar, no hay reglas de hooks que violar).
//
// Por qué no se llevó también el estado: varias de las 15 secciones del
// admin (esta no es una de ellas) comparten estado entre sí (el cartelito
// de confirmación, el mensaje de "guardado", la carga masiva de datos) —
// mover TODO de una implicaría más riesgo del que vale la pena para esta
// primera tanda. Ver la respuesta en el chat del 26 jul 2026 para el plan
// completo.

import { Fragment } from "react";
import { Download, History, ChevronDown, ChevronRight } from "lucide-react";
import { formatDate, formatTime, Pill, type AdminAuditLogRow } from "../page";

type AuditLogSectionProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;

  auditLogs: AdminAuditLogRow[];
  auditLogsLoading: boolean;
  auditLogsTotal: number;
  auditLogsPage: number;
  auditLogTotalPages: number;
  setAuditLogsPage: (updater: number | ((p: number) => number)) => void;

  auditLogActionFilter: string;
  setAuditLogActionFilter: (v: string) => void;
  auditLogEntityFilter: string;
  setAuditLogEntityFilter: (v: string) => void;
  auditLogEntityIdFilter: string;
  setAuditLogEntityIdFilter: (v: string) => void;
  auditLogFrom: string;
  setAuditLogFrom: (v: string) => void;
  auditLogTo: string;
  setAuditLogTo: (v: string) => void;

  AUDIT_ACTION_LABEL: Record<string, string>;
  AUDIT_ENTITY_LABEL: Record<string, string>;

  expandedAuditLogId: string | null;
  setExpandedAuditLogId: (v: string | null) => void;

  auditExportBusy: boolean;
  handleExportAuditLogs: () => void | Promise<void>;

  handleAuditLogTouchStart: (e: React.TouchEvent) => void;
  handleAuditLogTouchEnd: (e: React.TouchEvent) => void;
};

export default function AuditLogSection({
  t, locale,
  auditLogs, auditLogsLoading, auditLogsTotal, auditLogsPage, auditLogTotalPages, setAuditLogsPage,
  auditLogActionFilter, setAuditLogActionFilter,
  auditLogEntityFilter, setAuditLogEntityFilter,
  auditLogEntityIdFilter, setAuditLogEntityIdFilter,
  auditLogFrom, setAuditLogFrom,
  auditLogTo, setAuditLogTo,
  AUDIT_ACTION_LABEL, AUDIT_ENTITY_LABEL,
  expandedAuditLogId, setExpandedAuditLogId,
  auditExportBusy, handleExportAuditLogs,
  handleAuditLogTouchStart, handleAuditLogTouchEnd,
}: AuditLogSectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-[12px] text-zinc-400">{t("auditLogIntro")}</p>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("auditFilterAction")}</label>
          <select
            value={auditLogActionFilter}
            onChange={(e) => { setAuditLogActionFilter(e.target.value); setAuditLogsPage(1); }}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
          >
            <option value="all">{t("auditFilterAll")}</option>
            {Object.entries(AUDIT_ACTION_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("auditFilterEntity")}</label>
          <select
            value={auditLogEntityFilter}
            onChange={(e) => { setAuditLogEntityFilter(e.target.value); setAuditLogsPage(1); }}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
          >
            <option value="all">{t("auditFilterAll")}</option>
            {Object.entries(AUDIT_ENTITY_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("auditFilterFrom")}</label>
          <input
            type="date" value={auditLogFrom}
            onChange={(e) => { setAuditLogFrom(e.target.value); setAuditLogsPage(1); }}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("auditFilterTo")}</label>
          <input
            type="date" value={auditLogTo}
            onChange={(e) => { setAuditLogTo(e.target.value); setAuditLogsPage(1); }}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("auditFilterEntityId")}</label>
          <input
            type="text" value={auditLogEntityIdFilter}
            onChange={(e) => { setAuditLogEntityIdFilter(e.target.value); setAuditLogsPage(1); }}
            placeholder={t("auditFilterEntityIdPlaceholder")}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] font-mono outline-none focus:border-red-400 w-[220px]"
          />
        </div>
        {(auditLogActionFilter !== "all" || auditLogEntityFilter !== "all" || auditLogEntityIdFilter || auditLogFrom || auditLogTo) && (
          <button
            onClick={() => { setAuditLogActionFilter("all"); setAuditLogEntityFilter("all"); setAuditLogEntityIdFilter(""); setAuditLogFrom(""); setAuditLogTo(""); setAuditLogsPage(1); }}
            className="text-[11px] font-bold text-zinc-400 hover:text-red-600 transition-colors px-2 py-2"
          >
            {t("auditFilterClear")}
          </button>
        )}
        <button
          onClick={handleExportAuditLogs} disabled={auditExportBusy}
          className="ml-auto flex items-center gap-2 bg-white border border-zinc-200 hover:bg-zinc-50 disabled:opacity-60 text-zinc-600 text-[12px] font-bold px-3.5 py-[9px] rounded-xl transition-colors"
        >
          <Download size={13} /> {auditExportBusy ? t("exporting") : t("exportCsv")}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
        {auditLogsLoading ? (
          <p className="text-[13px] text-zinc-400 text-center py-16">{t("loading")}</p>
        ) : auditLogs.length === 0 ? (
          <div className="text-center py-16">
            <History size={28} className="mx-auto text-zinc-200 mb-2" />
            <p className="text-[13px] text-zinc-300 font-medium">{t("auditNoLogs")}</p>
          </div>
        ) : (
          <>
            <div
              className="overflow-x-auto overscroll-x-contain touch-pan-y"
              onTouchStart={handleAuditLogTouchStart}
              onTouchEnd={handleAuditLogTouchEnd}
            >
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    {[t("auditColWhen"), t("auditColAdmin"), t("auditColAction"), t("auditColEntity"), t("auditColEntityId"), ""].map((h) => (
                      <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {auditLogs.map((log) => {
                    const isExpanded = expandedAuditLogId === log.id;
                    return (
                      <Fragment key={log.id}>
                        <tr
                          className="hover:bg-zinc-50/80 transition-colors cursor-pointer"
                          onClick={() => setExpandedAuditLogId(isExpanded ? null : log.id)}
                        >
                          <td className="px-7 py-4 text-[12px] text-zinc-400 whitespace-nowrap">{formatDate(log.created_at)} · {formatTime(log.created_at, locale)}</td>
                          <td className="px-7 py-4 text-[12px] font-semibold text-zinc-700">{log.admin_username}</td>
                          <td className="px-7 py-4"><Pill tone="blue">{AUDIT_ACTION_LABEL[log.action] ?? log.action}</Pill></td>
                          <td className="px-7 py-4 text-[12px] text-zinc-500">{log.entity_type ? (AUDIT_ENTITY_LABEL[log.entity_type] ?? log.entity_type) : "—"}</td>
                          <td className="px-7 py-4 text-[12px] font-mono text-zinc-400">{log.entity_id ?? "—"}</td>
                          <td className="px-7 py-4 text-right text-zinc-300">
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${log.id}-detail`} className="bg-zinc-50/60">
                            <td colSpan={6} className="px-7 py-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11.5px]">
                                <div>
                                  <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("auditDetailOldValue")}</p>
                                  <pre className="whitespace-pre-wrap break-words bg-white border border-zinc-200 rounded-lg p-2.5 text-zinc-600 font-mono text-[11px]">
                                    {log.old_value ? JSON.stringify(log.old_value, null, 2) : "—"}
                                  </pre>
                                </div>
                                <div>
                                  <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("auditDetailNewValue")}</p>
                                  <pre className="whitespace-pre-wrap break-words bg-white border border-zinc-200 rounded-lg p-2.5 text-zinc-600 font-mono text-[11px]">
                                    {log.new_value ? JSON.stringify(log.new_value, null, 2) : "—"}
                                  </pre>
                                </div>
                                {log.reason && (
                                  <div className="sm:col-span-2">
                                    <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("auditDetailReason")}</p>
                                    <p className="text-zinc-600">{log.reason}</p>
                                  </div>
                                )}
                                {log.ip_address && (
                                  <div className="sm:col-span-2">
                                    <p className="font-bold text-zinc-500 uppercase tracking-wide text-[9.5px] mb-1">{t("auditDetailIp")}</p>
                                    <p className="text-zinc-600 font-mono">{log.ip_address}</p>
                                  </div>
                                )}
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
              <p className="text-[11px] text-zinc-400">{t("auditTotalCount", { count: auditLogsTotal })}</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAuditLogsPage((p) => Math.max(1, p - 1))}
                  disabled={auditLogsPage <= 1}
                  className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-30"
                >
                  {t("auditPrevPage")}
                </button>
                <span className="text-[11px] text-zinc-400">{t("auditPageOf", { page: auditLogsPage, totalPages: auditLogTotalPages })}</span>
                <button
                  onClick={() => setAuditLogsPage((p) => Math.min(auditLogTotalPages, p + 1))}
                  disabled={auditLogsPage >= auditLogTotalPages}
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
