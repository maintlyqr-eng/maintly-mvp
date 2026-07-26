"use client";

// Facu (26 jul 2026): duodécima sección extraída del split del admin —
// mismo criterio que AssetsSection.tsx (confirmDeleteService/viewHistory
// se pasan como props, el diálogo de confirmación y el modal de historial
// se quedan en page.tsx).

import { Download, History, Trash2 } from "lucide-react";
import {
  formatDate, downloadCsv, TYPE_COLORS, SectionTitle,
  type ServiceRow, type AccountRow,
} from "../page";

type ServicesSectionProps = {
  t: (key: string, values?: Record<string, string | number>) => string;

  totalServices: number;
  totalMechanicAccounts: number;
  visibleServices: ServiceRow[];

  svcMechanicFilter: string;
  setSvcMechanicFilter: (v: string) => void;
  svcTypeFilter: string;
  setSvcTypeFilter: (v: string) => void;

  accounts: AccountRow[];
  serviceTypeOptions: string[];

  viewHistory: (entityType: string, entityId: string) => void;
  confirmDeleteService: (s: ServiceRow) => void;
};

export default function ServicesSection({
  t,
  totalServices, totalMechanicAccounts, visibleServices,
  svcMechanicFilter, setSvcMechanicFilter, svcTypeFilter, setSvcTypeFilter,
  accounts, serviceTypeOptions,
  viewHistory, confirmDeleteService,
}: ServicesSectionProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t("totalServices"), value: totalServices, color: "text-zinc-900" },
          { label: t("shownFiltered"), value: visibleServices.length, color: "text-emerald-600" },
          { label: t("avgPerMechanic"), value: totalMechanicAccounts > 0 ? (totalServices / totalMechanicAccounts).toFixed(1) : "—", color: "text-zinc-900" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{label}</p>
            <p className={`text-[36px] font-black leading-none ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={svcMechanicFilter} onChange={(e) => setSvcMechanicFilter(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400">
          <option value="all">{t("allMechanics")}</option>
          {accounts.filter((a) => a.is_mechanic).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={svcTypeFilter} onChange={(e) => setSvcTypeFilter(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400">
          <option value="all">{t("allTypes")}</option>
          {serviceTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <button
          onClick={() => downloadCsv(
            `maintlyqr-services-${new Date().toISOString().slice(0, 10)}.csv`,
            [t("colAsset"), t("colServiceType"), t("colMechanic"), t("colCustomer"), t("colDate")],
            visibleServices.map((s) => [s.asset_label, s.service_type, s.mechanic_name, s.customer_name, formatDate(s.service_date)])
          )}
          className="ml-auto flex items-center gap-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 text-[12px] font-bold px-3.5 py-[9px] rounded-xl transition-colors"
        >
          <Download size={13} /> {t("exportCsv")}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
        <div className="px-7 py-5 border-b border-zinc-100">
          <SectionTitle>{t("serviceHistoryTitle")}</SectionTitle>
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {[t("colAsset"), t("colServiceType"), t("colMechanic"), t("colCustomer"), t("colDate"), ""].map(h => (
                  <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {visibleServices.slice(0, 200).map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="px-7 py-4 text-[13px] font-bold text-zinc-900">{s.asset_label}</td>
                  <td className="px-7 py-4">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${TYPE_COLORS[s.service_type] ?? "bg-zinc-100 text-zinc-500 border border-zinc-200"}`}>
                      {s.service_type}
                    </span>
                  </td>
                  <td className="px-7 py-4 text-[12px] text-zinc-500">{s.mechanic_name}</td>
                  <td className="px-7 py-4 text-[12px] text-zinc-500">{s.customer_name}</td>
                  <td className="px-7 py-4 text-[12px] text-zinc-400">{formatDate(s.service_date)}</td>
                  <td className="px-7 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => viewHistory("service_record", s.id)} className="text-zinc-300 hover:text-blue-600 transition-colors" title={t("viewHistoryTitle")}>
                        <History size={14} />
                      </button>
                      <button onClick={() => confirmDeleteService(s)} className="text-zinc-300 hover:text-red-600 transition-colors" title={t("deleteTitle")}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleServices.length === 0 && (
                <tr><td colSpan={6} className="px-7 py-16 text-center text-[13px] text-zinc-300">{t("noServicesMatch")}</td></tr>
              )}
            </tbody>
          </table>
          {visibleServices.length > 200 && (
            <p className="text-center text-[11px] text-zinc-300 py-4">{t("showingFirstOf", { shown: 200, total: visibleServices.length })}</p>
          )}
        </div>
      </div>
    </div>
  );
}
