"use client";

// Facu (26 jul 2026): sexta sección extraída del split del admin — primera
// de la segunda tanda (secciones que usan el diálogo de confirmación
// compartido, confirmAction). Mismo criterio que las anteriores: el JSX se
// mueve tal cual, confirmAction y todo el resto del estado se quedan en
// page.tsx. Las funciones confirmRestoreX/confirmPermanentDeleteX de acá
// abajo internamente llaman a setConfirmAction — pero eso pasa en
// page.tsx, esta sección solo las recibe como props y las llama, igual
// que cualquier otro handler.

import { Trash, RotateCcw, Trash2 } from "lucide-react";
import {
  formatDate, formatTime, ASSET_ICONS, TYPE_COLORS,
  type TrashMechanicRow, type TrashAssetRow, type TrashServiceRow, type AccountRow,
} from "../page";

type TrashSectionProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;
  tAssetTypes: (key: string) => string;

  trashTab: "mechanics" | "assets" | "services";
  setTrashTab: (v: "mechanics" | "assets" | "services") => void;
  trashMechanics: TrashMechanicRow[];
  trashAssets: TrashAssetRow[];
  trashServices: TrashServiceRow[];
  trashLoading: boolean;

  trashFilterFrom: string;
  setTrashFilterFrom: (v: string) => void;
  trashFilterTo: string;
  setTrashFilterTo: (v: string) => void;

  visibleTrashMechanics: TrashMechanicRow[];
  visibleTrashAssets: TrashAssetRow[];
  visibleTrashServices: TrashServiceRow[];
  mechanicsById: Record<string, AccountRow>;

  assetLabel: (a: { nickname: string | null; brand: string | null; model: string | null }) => string;

  confirmRestoreAccount: (row: TrashMechanicRow) => void;
  confirmPermanentDeleteAccount: (row: TrashMechanicRow) => void;
  confirmRestoreAsset: (row: TrashAssetRow) => void;
  confirmPermanentDeleteAsset: (row: TrashAssetRow) => void;
  confirmRestoreService: (row: TrashServiceRow) => void;
  confirmPermanentDeleteService: (row: TrashServiceRow) => void;
};

export default function TrashSection({
  t, locale, tAssetTypes,
  trashTab, setTrashTab, trashMechanics, trashAssets, trashServices, trashLoading,
  trashFilterFrom, setTrashFilterFrom, trashFilterTo, setTrashFilterTo,
  visibleTrashMechanics, visibleTrashAssets, visibleTrashServices, mechanicsById,
  assetLabel,
  confirmRestoreAccount, confirmPermanentDeleteAccount,
  confirmRestoreAsset, confirmPermanentDeleteAsset,
  confirmRestoreService, confirmPermanentDeleteService,
}: TrashSectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-[12px] text-zinc-400">{t("trashIntro")}</p>

      <div className="flex flex-wrap gap-2">
        {([
          { id: "mechanics", label: t("trashTabMechanics"), count: trashMechanics.length },
          { id: "assets", label: t("trashTabAssets"), count: trashAssets.length },
          { id: "services", label: t("trashTabServices"), count: trashServices.length },
        ] as const).map((tab) => (
          <button key={tab.id} onClick={() => setTrashTab(tab.id)}
            className={`px-3.5 py-[7px] rounded-full text-[12px] font-bold transition-colors ${
              trashTab === tab.id ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
            }`}>
            {tab.label} {tab.count > 0 && <span className="opacity-60">· {tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Filtro por fecha de borrado (deleted_at) — pendiente desde
          el incremento 2 de Item 6, resuelto acá. */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("auditFilterFrom")}</label>
          <input
            type="date" value={trashFilterFrom}
            onChange={(e) => setTrashFilterFrom(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("auditFilterTo")}</label>
          <input
            type="date" value={trashFilterTo}
            onChange={(e) => setTrashFilterTo(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
          />
        </div>
        {(trashFilterFrom || trashFilterTo) && (
          <button
            onClick={() => { setTrashFilterFrom(""); setTrashFilterTo(""); }}
            className="text-[11px] font-bold text-zinc-400 hover:text-red-600 transition-colors px-2 py-2"
          >
            {t("auditFilterClear")}
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
        {trashLoading ? (
          <p className="text-[13px] text-zinc-400 text-center py-16">{t("loading")}</p>
        ) : trashTab === "mechanics" ? (
          visibleTrashMechanics.length === 0 ? (
            <div className="text-center py-16">
              <Trash size={28} className="mx-auto text-zinc-200 mb-2" />
              <p className="text-[13px] text-zinc-300 font-medium">{t("trashEmptyMechanics")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    {[t("colAccount"), t("colEmail"), t("trashColDeletedAt"), ""].map((h) => (
                      <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {visibleTrashMechanics.map((row) => (
                    <tr key={row.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-7 py-4 text-[13px] font-bold text-zinc-900">{row.name}</td>
                      <td className="px-7 py-4 text-[12px] text-zinc-500">{row.email}</td>
                      <td className="px-7 py-4 text-[12px] text-zinc-400 whitespace-nowrap">{formatDate(row.deleted_at)} · {formatTime(row.deleted_at, locale)}</td>
                      <td className="px-7 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => confirmRestoreAccount(row)} className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors" title={t("restoreTitle")}>
                            <RotateCcw size={13} /> {t("restoreTitle")}
                          </button>
                          <button onClick={() => confirmPermanentDeleteAccount(row)} className="text-zinc-300 hover:text-red-600 transition-colors" title={t("permanentDeleteTitle")}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : trashTab === "assets" ? (
          visibleTrashAssets.length === 0 ? (
            <div className="text-center py-16">
              <Trash size={28} className="mx-auto text-zinc-200 mb-2" />
              <p className="text-[13px] text-zinc-300 font-medium">{t("trashEmptyAssets")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    {[t("colAsset"), t("colType"), t("colOwner"), t("trashColDeletedAt"), ""].map((h) => (
                      <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {visibleTrashAssets.map((row) => {
                    const owner = row.created_by ? mechanicsById[row.created_by] : null;
                    return (
                      <tr key={row.id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="px-7 py-4">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[16px]">{ASSET_ICONS[row.asset_type] ?? "🔧"}</span>
                            <span className="text-[13px] font-bold text-zinc-900">{assetLabel(row)}</span>
                          </div>
                        </td>
                        <td className="px-7 py-4 text-[12px] text-zinc-500">{tAssetTypes(row.asset_type)}</td>
                        <td className="px-7 py-4 text-[12px] text-zinc-500">{owner?.name ?? "—"}</td>
                        <td className="px-7 py-4 text-[12px] text-zinc-400 whitespace-nowrap">{formatDate(row.deleted_at)} · {formatTime(row.deleted_at, locale)}</td>
                        <td className="px-7 py-4">
                          <div className="flex items-center justify-end gap-3">
                            <button onClick={() => confirmRestoreAsset(row)} className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors" title={t("restoreTitle")}>
                              <RotateCcw size={13} /> {t("restoreTitle")}
                            </button>
                            <button onClick={() => confirmPermanentDeleteAsset(row)} className="text-zinc-300 hover:text-red-600 transition-colors" title={t("permanentDeleteTitle")}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : visibleTrashServices.length === 0 ? (
          <div className="text-center py-16">
            <Trash size={28} className="mx-auto text-zinc-200 mb-2" />
            <p className="text-[13px] text-zinc-300 font-medium">{t("trashEmptyServices")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  {[t("colAsset"), t("colServiceType"), t("colMechanic"), t("colDate"), t("trashColDeletedAt"), ""].map((h) => (
                    <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {visibleTrashServices.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-7 py-4 text-[13px] font-bold text-zinc-900">{row.assets ? assetLabel(row.assets) : "—"}</td>
                    <td className="px-7 py-4">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${TYPE_COLORS[row.service_type] ?? "bg-zinc-100 text-zinc-500 border border-zinc-200"}`}>
                        {row.service_type}
                      </span>
                    </td>
                    <td className="px-7 py-4 text-[12px] text-zinc-500">{row.mechanics?.name ?? "—"}</td>
                    <td className="px-7 py-4 text-[12px] text-zinc-400">{formatDate(row.service_date)}</td>
                    <td className="px-7 py-4 text-[12px] text-zinc-400 whitespace-nowrap">{formatDate(row.deleted_at)} · {formatTime(row.deleted_at, locale)}</td>
                    <td className="px-7 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => confirmRestoreService(row)} className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors" title={t("restoreTitle")}>
                          <RotateCcw size={13} /> {t("restoreTitle")}
                        </button>
                        <button onClick={() => confirmPermanentDeleteService(row)} className="text-zinc-300 hover:text-red-600 transition-colors" title={t("permanentDeleteTitle")}>
                          <Trash2 size={14} />
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
    </div>
  );
}
