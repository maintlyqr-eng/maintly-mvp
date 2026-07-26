"use client";

// Facu (26 jul 2026): decimotercera sección extraída del split del admin
// — mismo criterio de siempre. setShowGenerateModal(true) abre un modal
// que se queda renderizado en page.tsx (no forma parte de este bloque de
// JSX), y confirmUnlinkQr se pasa como prop igual que las otras funciones
// que internamente llaman a setConfirmAction.

import { Search, Download, Plus, Link2Off } from "lucide-react";
import {
  formatDate, downloadCsv, Pill,
  type QrRow, type AssetRow,
} from "../page";

type QrSectionProps = {
  t: (key: string, values?: Record<string, string | number>) => string;

  totalQR: number;
  assignedQR: number;

  qrSearch: string;
  setQrSearch: (v: string) => void;
  qrStatusFilter: "all" | "available" | "assigned";
  setQrStatusFilter: (v: "all" | "available" | "assigned") => void;

  visibleQr: QrRow[];
  assetsById: Record<string, AssetRow>;
  assets: AssetRow[];

  assetLabel: (a: { nickname: string | null; brand: string | null; model: string | null }) => string;

  setShowGenerateModal: (v: boolean) => void;
  confirmUnlinkQr: (q: QrRow) => void;
};

export default function QrSection({
  t,
  totalQR, assignedQR,
  qrSearch, setQrSearch, qrStatusFilter, setQrStatusFilter,
  visibleQr, assetsById, assets,
  assetLabel,
  setShowGenerateModal, confirmUnlinkQr,
}: QrSectionProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t("totalQrCodes"), value: totalQR, color: "text-zinc-900" },
          { label: t("linkedToAssets"), value: assignedQR, color: "text-emerald-600" },
          { label: t("available"), value: totalQR - assignedQR, color: "text-zinc-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{label}</p>
            <p className={`text-[36px] font-black leading-none ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text" value={qrSearch} onChange={(e) => setQrSearch(e.target.value)}
            placeholder={t("searchCodePlaceholder")}
            className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400 transition-colors"
          />
        </div>
        {(["all", "available", "assigned"] as const).map((f) => (
          <button key={f} onClick={() => setQrStatusFilter(f)}
            className={`px-3 py-[7px] rounded-full text-[12px] font-bold transition-colors ${qrStatusFilter === f ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
            {f === "all" ? t("filterAll") : f === "available" ? t("filterAvailable") : t("filterAssigned")}
          </button>
        ))}
        <button
          onClick={() => downloadCsv(
            `maintlyqr-qr-codes-${new Date().toISOString().slice(0, 10)}.csv`,
            [t("colCode"), t("colStatus"), t("colAsset"), t("colCreated")],
            visibleQr.map((q) => {
              const asset = q.asset_id ? assetsById[q.asset_id] : null;
              return [q.code, q.asset_id ? t("assignedPill") : t("availablePill"), asset ? assetLabel(asset) : "", formatDate(q.created_at)];
            })
          )}
          className="ml-auto flex items-center gap-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 text-[12px] font-bold px-3.5 py-[9px] rounded-xl transition-colors"
        >
          <Download size={13} /> {t("exportCsv")}
        </button>
        <button onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-[12px] font-bold px-4 py-[9px] rounded-xl transition-all shadow-sm">
          <Plus size={14} /> {t("generateBatch")}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {[t("colCode"), t("colStatus"), t("colAsset"), t("colCreated"), ""].map((h) => (
                  <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {visibleQr.slice(0, 200).map((q) => {
                const asset = assets.find((a) => a.id === q.asset_id);
                const label = asset ? (asset.nickname || [asset.brand, asset.model].filter(Boolean).join(" ") || t("unnamedAsset")) : null;
                return (
                  <tr key={q.code} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-7 py-4 text-[12px] font-mono font-bold text-zinc-800">{q.code}</td>
                    <td className="px-7 py-4">
                      {q.asset_id ? <Pill tone="blue">{t("assignedPill")}</Pill> : <Pill tone="emerald">{t("availablePill")}</Pill>}
                    </td>
                    <td className="px-7 py-4 text-[12px] text-zinc-500">{label ?? "—"}</td>
                    <td className="px-7 py-4 text-[12px] text-zinc-400">{formatDate(q.created_at)}</td>
                    <td className="px-7 py-4 text-right">
                      {q.asset_id && (
                        <button onClick={() => confirmUnlinkQr(q)} className="text-zinc-300 hover:text-red-600 transition-colors" title={t("unlinkTitle")}>
                          <Link2Off size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visibleQr.length === 0 && (
                <tr><td colSpan={5} className="px-7 py-16 text-center text-[13px] text-zinc-300">{t("noQrMatch")}</td></tr>
              )}
            </tbody>
          </table>
          {visibleQr.length > 200 && (
            <p className="text-center text-[11px] text-zinc-300 py-4">{t("showingFirstOf", { shown: 200, total: visibleQr.length })}</p>
          )}
        </div>
      </div>
    </div>
  );
}
