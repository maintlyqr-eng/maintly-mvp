"use client";

// Facu (26 jul 2026): séptima sección extraída del split del admin —
// mismo criterio que TrashSection.tsx (usa confirmAction vía props,
// el diálogo en sí se queda en page.tsx).

import { Undo2, CheckCircle2, X } from "lucide-react";
import {
  formatDate, formatTime, TYPE_COLORS,
  type DeleteRequestRow,
} from "../page";

type DeleteRequestsSectionProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;

  deleteRequestsLoading: boolean;
  deleteRequests: DeleteRequestRow[];

  assetLabel: (a: { nickname: string | null; brand: string | null; model: string | null }) => string;

  confirmApproveDeleteRequest: (row: DeleteRequestRow) => void;
  confirmRejectDeleteRequest: (row: DeleteRequestRow) => void;
};

export default function DeleteRequestsSection({
  t, locale,
  deleteRequestsLoading, deleteRequests,
  assetLabel,
  confirmApproveDeleteRequest, confirmRejectDeleteRequest,
}: DeleteRequestsSectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-[12px] text-zinc-400">{t("deleteRequestsIntro")}</p>

      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
        {deleteRequestsLoading ? (
          <p className="text-[13px] text-zinc-400 text-center py-16">{t("loading")}</p>
        ) : deleteRequests.length === 0 ? (
          <div className="text-center py-16">
            <Undo2 size={28} className="mx-auto text-zinc-200 mb-2" />
            <p className="text-[13px] text-zinc-300 font-medium">{t("deleteRequestsEmpty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  {[t("colAsset"), t("colServiceType"), t("colDate"), t("colRequestedBy"), t("colReason"), t("colRequestedAt"), ""].map((h) => (
                    <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {deleteRequests.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-7 py-4 text-[13px] font-bold text-zinc-900">
                      {row.service_records?.assets ? assetLabel(row.service_records.assets) : t("unnamedAsset")}
                    </td>
                    <td className="px-7 py-4">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${TYPE_COLORS[row.service_records?.service_type ?? ""] ?? "bg-zinc-100 text-zinc-500 border border-zinc-200"}`}>
                        {row.service_records?.service_type ?? "—"}
                      </span>
                    </td>
                    <td className="px-7 py-4 text-[12px] text-zinc-400">{row.service_records ? formatDate(row.service_records.service_date) : "—"}</td>
                    <td className="px-7 py-4 text-[12px] text-zinc-500">
                      <div className="font-bold text-zinc-700">{row.mechanics?.name ?? "—"}</div>
                      <div className="text-zinc-400">{row.mechanics?.email ?? ""}</div>
                    </td>
                    <td className="px-7 py-4 text-[12px] text-zinc-500 max-w-[220px]">{row.reason || <span className="text-zinc-300">{t("noReasonGiven")}</span>}</td>
                    <td className="px-7 py-4 text-[12px] text-zinc-400 whitespace-nowrap">{formatDate(row.requested_at)} · {formatTime(row.requested_at, locale)}</td>
                    <td className="px-7 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => confirmApproveDeleteRequest(row)} className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors" title={t("approveDeleteRequestTitle")}>
                          <CheckCircle2 size={13} /> {t("approveDeleteRequestTitle")}
                        </button>
                        <button onClick={() => confirmRejectDeleteRequest(row)} className="text-zinc-300 hover:text-red-600 transition-colors" title={t("rejectDeleteRequestTitle")}>
                          <X size={14} />
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
