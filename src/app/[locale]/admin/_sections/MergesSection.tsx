"use client";

// Fusión de historiales (21/10/2026, migración 046). Sección autocontenida:
// carga sus propios datos de /api/admin/asset-merges y maneja el "Deshacer"
// con confirmación inline (no reusa confirmAction de page.tsx a propósito,
// para no agregar más estado al archivo gigante). Pedido de Facu: ver quién
// fusionó qué, y poder acomodar las cosas si alguien hace una cagada.

import { useCallback, useEffect, useState } from "react";
import { GitMerge, Undo2, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { formatDate, formatTime, Pill } from "../page";
import type { AssetMergeRow } from "@/app/api/admin/asset-merges/route";

type MergesSectionProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;
  canUndo: boolean;
};

const PAGE_SIZE = 50;

export default function MergesSection({ t, locale, canUndo }: MergesSectionProps) {
  const [merges, setMerges] = useState<AssetMergeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/asset-merges?page=${page}&pageSize=${PAGE_SIZE}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setMerges(json.merges ?? []);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function undo(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/admin/asset-merges", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setConfirmId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[12px] text-zinc-400">{t("mergesIntro")}</p>
        <button onClick={load} disabled={loading} className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-900 disabled:opacity-50">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> {t("mergesRefresh")}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-[12px] rounded-xl px-4 py-3">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
        {loading && merges.length === 0 ? (
          <p className="text-[13px] text-zinc-400 text-center py-16">{t("loading")}</p>
        ) : merges.length === 0 ? (
          <div className="text-center py-16">
            <GitMerge size={28} className="mx-auto text-zinc-200 mb-2" />
            <p className="text-[13px] text-zinc-300 font-medium">{t("mergesEmpty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  {[t("auditColWhen"), t("mergesColBy"), t("mergesColPrimary"), t("mergesColDuplicate"), "VIN", t("mergesColMoved"), t("colStatus"), ""].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {merges.map((m) => {
                  const expanded = expandedId === m.id;
                  const undone = !!m.undone_at;
                  return (
                    <RowGroup key={m.id}>
                      <tr className="hover:bg-zinc-50/80 transition-colors">
                        <td className="px-5 py-4 text-[12px] text-zinc-500 whitespace-nowrap">
                          {formatDate(m.created_at)} · {formatTime(m.created_at, locale)}
                        </td>
                        <td className="px-5 py-4 text-[13px] font-bold text-zinc-900">{m.merged_by_name ?? "—"}</td>
                        <td className="px-5 py-4 text-[13px] text-zinc-900">{m.primary_label}</td>
                        <td className="px-5 py-4 text-[13px] text-zinc-500">{m.duplicate_label}</td>
                        <td className="px-5 py-4 text-[12px] font-mono text-zinc-600">{m.vin ?? "—"}</td>
                        <td className="px-5 py-4 text-[12px] text-zinc-600 whitespace-nowrap">
                          {t("mergesMovedSummary", { services: m.services_moved, qr: m.qr_codes_moved })}
                        </td>
                        <td className="px-5 py-4">
                          {undone
                            ? <Pill tone="zinc">{t("mergesStatusUndone")}</Pill>
                            : <Pill tone="emerald">{t("mergesStatusActive")}</Pill>}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <button onClick={() => setExpandedId(expanded ? null : m.id)} className="text-zinc-400 hover:text-zinc-700 align-middle mr-2">
                            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                          {canUndo && !undone && confirmId !== m.id && (
                            <button
                              onClick={() => setConfirmId(m.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold border border-zinc-200 text-zinc-700 hover:border-red-400 hover:text-red-600 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              <Undo2 size={12} /> {t("mergesUndo")}
                            </button>
                          )}
                          {canUndo && !undone && confirmId === m.id && (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[11px] text-zinc-500">{t("mergesUndoConfirm")}</span>
                              <button
                                onClick={() => undo(m.id)}
                                disabled={busyId === m.id}
                                className="text-[11px] font-bold bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white px-2.5 py-1 rounded-lg transition-colors"
                              >
                                {busyId === m.id ? t("mergesUndoing") : t("mergesUndoYes")}
                              </button>
                              <button onClick={() => setConfirmId(null)} disabled={busyId === m.id} className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900 px-1.5 py-1">
                                {t("cancel")}
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-zinc-50/60">
                          <td colSpan={8} className="px-5 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
                              <div>
                                <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("mergesColPrimary")}</div>
                                <div className="font-mono text-[11px] text-zinc-600 break-all">{m.primary_asset_id}</div>
                              </div>
                              <div>
                                <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("mergesColDuplicate")}</div>
                                <div className="font-mono text-[11px] text-zinc-600 break-all">{m.duplicate_asset_id}</div>
                              </div>
                              {undone && (
                                <div>
                                  <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("mergesStatusUndone")}</div>
                                  <div className="text-zinc-600">{m.undone_by ?? "—"} · {m.undone_at ? `${formatDate(m.undone_at)} ${formatTime(m.undone_at, locale)}` : ""}</div>
                                </div>
                              )}
                            </div>
                            <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-3 mb-1">{t("mergesSnapshot")}</div>
                            <pre className="text-[10px] bg-white border border-zinc-200 rounded-lg p-3 max-h-64 overflow-auto text-zinc-600">{JSON.stringify(m.snapshot, null, 2)}</pre>
                          </td>
                        </tr>
                      )}
                    </RowGroup>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 text-[12px] text-zinc-500">
            <span>{t("auditTotalCount", { count: total })}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading} className="font-bold disabled:opacity-40 hover:text-zinc-900">{t("auditPrevPage")}</button>
              <span>{t("auditPageOf", { page, totalPages })}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading} className="font-bold disabled:opacity-40 hover:text-zinc-900">{t("auditNextPage")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Fragment con key para agrupar la fila + su detalle expandible.
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
