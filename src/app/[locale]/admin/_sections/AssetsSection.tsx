"use client";

// Facu (26 jul 2026): undécima sección extraída del split del admin —
// primera de las 5 más pesadas/acopladas (Accounts/Assets/Services/QR/
// Support). Mismo criterio de siempre: openEditAsset/viewHistory/
// confirmDeleteAsset se pasan como props — el modal de edición y el
// diálogo de confirmación que abren se quedan renderizados en page.tsx,
// esta sección no los toca.

import { Search, Download, Pencil, History, Trash2 } from "lucide-react";
import {
  formatDate, downloadCsv, ASSET_ICONS,
  SectionTitle,
  type AssetRow, type AccountRow,
} from "../page";

type AssetsSectionProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  tAssetTypes: (key: string) => string;

  assetSearch: string;
  setAssetSearch: (v: string) => void;

  visibleAssets: AssetRow[];
  mechanicsById: Record<string, AccountRow>;
  servicesByAsset: Record<string, number>;
  qrCodesByAssetId: Record<string, string[]>;

  assetLabel: (a: { nickname: string | null; brand: string | null; model: string | null }) => string;

  openEditAsset: (a: AssetRow) => void;
  viewHistory: (entityType: string, entityId: string) => void;
  confirmDeleteAsset: (a: AssetRow) => void;
};

export default function AssetsSection({
  t, tAssetTypes,
  assetSearch, setAssetSearch,
  visibleAssets, mechanicsById, servicesByAsset, qrCodesByAssetId,
  assetLabel,
  openEditAsset, viewHistory, confirmDeleteAsset,
}: AssetsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text" value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)}
            placeholder={t("searchAssetsPlaceholder")}
            className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400 transition-colors"
          />
        </div>
        <button
          onClick={() => downloadCsv(
            `maintlyqr-assets-${new Date().toISOString().slice(0, 10)}.csv`,
            [t("colAsset"), t("colType"), t("colVin"), t("colOwner"), t("colServices"), t("colRegistered"), "asset_id", "qr_code"],
            visibleAssets.map((a) => [
              assetLabel(a), tAssetTypes(a.asset_type), a.vin_serial || a.plate || "",
              (a.created_by ? mechanicsById[a.created_by]?.name : "") ?? "",
              servicesByAsset[a.id] ?? 0, formatDate(a.created_at),
              a.id, (qrCodesByAssetId[a.id] ?? []).join(", "),
            ])
          )}
          className="flex items-center gap-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 text-[12px] font-bold px-3.5 py-[9px] rounded-xl transition-colors"
        >
          <Download size={13} /> {t("exportCsv")}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
        <div className="px-7 py-5 border-b border-zinc-100">
          <SectionTitle>{t("assetsCount", { count: visibleAssets.length })}</SectionTitle>
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {[t("colAsset"), t("colType"), t("colVin"), t("colOwner"), t("colServices"), t("colRegistered"), ""].map((h) => (
                  <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {visibleAssets.map((a) => {
                const label = assetLabel(a);
                const owner = a.created_by ? mechanicsById[a.created_by] : null;
                return (
                  <tr key={a.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-7 py-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[16px]">{ASSET_ICONS[a.asset_type] ?? "🔧"}</span>
                        <span className="text-[13px] font-bold text-zinc-900">{label}</span>
                      </div>
                    </td>
                    <td className="px-7 py-4 text-[12px] text-zinc-500">{tAssetTypes(a.asset_type)}</td>
                    <td className="px-7 py-4 text-[12px] text-zinc-500 font-mono">{a.vin_serial || a.plate || "—"}</td>
                    <td className="px-7 py-4 text-[12px] text-zinc-500">{owner?.name ?? "—"}</td>
                    <td className="px-7 py-4 text-[12px] text-zinc-500">{servicesByAsset[a.id] ?? 0}</td>
                    <td className="px-7 py-4 text-[12px] text-zinc-400">{formatDate(a.created_at)}</td>
                    <td className="px-7 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => openEditAsset(a)} className="text-zinc-300 hover:text-zinc-700 transition-colors" title={t("editTitle")}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => viewHistory("asset", a.id)} className="text-zinc-300 hover:text-blue-600 transition-colors" title={t("viewHistoryTitle")}>
                          <History size={14} />
                        </button>
                        <button onClick={() => confirmDeleteAsset(a)} className="text-zinc-300 hover:text-red-600 transition-colors" title={t("deleteTitle")}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleAssets.length === 0 && (
                <tr><td colSpan={7} className="px-7 py-16 text-center text-[13px] text-zinc-300">{t("noAssetsMatch")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
