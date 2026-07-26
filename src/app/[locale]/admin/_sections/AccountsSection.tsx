"use client";

// Facu (26 jul 2026): decimocuarta sección extraída del split del admin —
// la más densa de las "sueltas" que quedaban (Accounts). renderMaintlersTable
// vivía en page.tsx justo antes del `return` principal, cerrando sobre
// varias cosas del componente (t, tProfessionTypes, assetsByMechanic,
// openDetail) — se movió acá adentro tal cual, ahora cerrando sobre las
// props de esta sección en vez de sobre el estado de page.tsx directamente.
// Nada de eso cambia el comportamiento: sigue siendo la misma función,
// solo que ahora vive un nivel más abajo. openDetail es la misma función
// que usa el modal de detalle de cuenta (compartido con Support) — se
// pasa como prop, el modal en sí se queda en page.tsx.

import HoverAvatar from "@/components/HoverAvatar";
import { Search, Download, ShieldCheck } from "lucide-react";
import {
  formatDate, downloadCsv, PROFESSION_KEYS, Pill, SectionTitle,
  getInitials, getAvatarColor, isStaleActivity,
  type AccountRow,
} from "../page";

type AccountsSectionProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  tProfessionTypes: (key: string) => string;

  maintlersTab: "all" | "profession" | "verifications";
  setMaintlersTab: (v: "all" | "profession" | "verifications") => void;
  pendingVerifications: AccountRow[];

  accountSearch: string;
  setAccountSearch: (v: string) => void;
  visibleAccounts: AccountRow[];

  professionFilter: string;
  setProfessionFilter: (v: string) => void;
  accounts: AccountRow[];
  professionCounts: Record<string, number>;
  professionFilteredAccounts: AccountRow[];

  assetsByMechanic: Record<string, number>;
  openDetail: (a: AccountRow) => void;

  handleViewCertificate: (a: AccountRow) => void | Promise<void>;
  handleRejectVerification: (a: AccountRow) => void | Promise<void>;
  handleApproveVerification: (a: AccountRow) => void | Promise<void>;
  verificationBusyId: string | null;
};

export default function AccountsSection({
  t, tProfessionTypes,
  maintlersTab, setMaintlersTab, pendingVerifications,
  accountSearch, setAccountSearch, visibleAccounts,
  professionFilter, setProfessionFilter, accounts, professionCounts, professionFilteredAccounts,
  assetsByMechanic, openDetail,
  handleViewCertificate, handleRejectVerification, handleApproveVerification, verificationBusyId,
}: AccountsSectionProps) {
  function renderMaintlersTable(rows: AccountRow[], emptyMessage: string, countLabel: string) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
        <div className="px-7 py-5 border-b border-zinc-100">
          <SectionTitle>{countLabel}</SectionTitle>
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {[t("colAccount"), t("colProfession"), t("colRoles"), t("colStatus"), t("colLastActive"), t("colJoined"), ""].map((h) => (
                  <th key={h} className="px-7 py-3 text-left text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {rows.map((a) => {
                const owner = (assetsByMechanic[a.id] ?? 0) > 0;
                return (
                  <tr key={a.id} className="hover:bg-zinc-50/80 transition-colors cursor-pointer" onClick={() => openDetail(a)}>
                    <td className="px-7 py-4">
                      <div className="flex items-center gap-3">
                        {a.photo_url ? (
                          <HoverAvatar src={a.photo_url} size={36} className="shrink-0" />
                        ) : (
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-black shrink-0 ${getAvatarColor(a.name)}`}>
                            {getInitials(a.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-zinc-900 truncate">{a.name}</p>
                          <p className="text-[11px] text-zinc-400 truncate">{a.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-7 py-4">
                      {a.profession
                        ? <Pill tone="zinc">{tProfessionTypes(PROFESSION_KEYS[a.profession] ?? "owner")}</Pill>
                        : <span className="text-zinc-300 text-[12px]">{t("notSet")}</span>}
                    </td>
                    <td className="px-7 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {owner && <Pill tone="zinc">{t("ownerPill")}</Pill>}
                        {a.is_mechanic && <Pill tone="blue">{t("mechanicPill")}</Pill>}
                        {a.is_mechanic && a.verified && <Pill tone="emerald">{t("verifiedPill")}</Pill>}
                      </div>
                    </td>
                    <td className="px-7 py-4">
                      {a.suspended
                        ? <Pill tone="red">{t("suspendedPill")}</Pill>
                        : <Pill tone="emerald">{t("activePill")}</Pill>}
                    </td>
                    <td className="px-7 py-4 text-[12px]">
                      {a.last_active_at ? (
                        <span className={isStaleActivity(a.last_active_at) ? "text-amber-600 font-semibold" : "text-zinc-400"}>
                          {formatDate(a.last_active_at)}
                        </span>
                      ) : (
                        <span className="text-zinc-300">{t("neverActive")}</span>
                      )}
                    </td>
                    <td className="px-7 py-4 text-[12px] text-zinc-400">{formatDate(a.created_at)}</td>
                    <td className="px-7 py-4 text-right">
                      <span className="text-[11px] font-bold text-zinc-400">{t("viewArrow")}</span>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-7 py-16 text-center text-[13px] text-zinc-300">{emptyMessage}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-zinc-200/80">
        {([
          { id: "all" as const, label: t("maintlersTabAll") },
          { id: "profession" as const, label: t("maintlersTabProfession") },
          { id: "verifications" as const, label: t("maintlersTabVerifications") },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMaintlersTab(tab.id)}
            className={`relative flex items-center gap-1.5 px-3.5 py-2.5 text-[12px] font-bold transition-colors ${
              maintlersTab === tab.id ? "text-red-600" : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            {tab.label}
            {tab.id === "verifications" && pendingVerifications.length > 0 && (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-white leading-none">
                {pendingVerifications.length}
              </span>
            )}
            {maintlersTab === tab.id && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-red-600 rounded-full" />}
          </button>
        ))}
      </div>

      {maintlersTab === "all" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-md flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text" value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)}
                placeholder={t("searchAccountsPlaceholder")}
                className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400 transition-colors"
              />
            </div>
            <button
              onClick={() => downloadCsv(
                `maintlyqr-maintlers-${new Date().toISOString().slice(0, 10)}.csv`,
                [t("colAccount"), "email", t("colProfession"), t("colRoles"), t("colStatus"), t("colLastActive"), t("colJoined")],
                visibleAccounts.map((a) => [
                  a.name, a.email,
                  a.profession ? tProfessionTypes(PROFESSION_KEYS[a.profession] ?? "owner") : "",
                  [a.is_mechanic ? t("mechanicPill") : "", a.is_mechanic && a.verified ? t("verifiedPill") : ""].filter(Boolean).join(" / "),
                  a.suspended ? t("suspendedPill") : t("activePill"),
                  a.last_active_at ? formatDate(a.last_active_at) : t("neverActive"),
                  formatDate(a.created_at),
                ])
              )}
              className="flex items-center gap-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 text-[12px] font-bold px-3.5 py-[9px] rounded-xl transition-colors"
            >
              <Download size={13} /> {t("exportCsv")}
            </button>
          </div>
          {renderMaintlersTable(visibleAccounts, t("noAccountsMatch"), t("accountsCount", { count: visibleAccounts.length }))}
        </>
      )}

      {maintlersTab === "profession" && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setProfessionFilter("all")}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                professionFilter === "all" ? "bg-red-600 text-white border-red-600" : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              }`}
            >
              {t("professionFilterAll")} · {accounts.length}
            </button>
            {Object.keys(PROFESSION_KEYS).map((profession) => (
              <button
                key={profession}
                onClick={() => setProfessionFilter(profession)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                  professionFilter === profession ? "bg-red-600 text-white border-red-600" : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                {tProfessionTypes(PROFESSION_KEYS[profession])} · {professionCounts[profession] ?? 0}
              </button>
            ))}
          </div>
          {renderMaintlersTable(professionFilteredAccounts, t("noAccountsMatch"), t("accountsCount", { count: professionFilteredAccounts.length }))}
        </>
      )}

      {maintlersTab === "verifications" && (
        <>
          <SectionTitle>{t("pendingRequestsCount", { count: pendingVerifications.length })}</SectionTitle>

          {pendingVerifications.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center">
              <ShieldCheck size={28} className="text-zinc-200 mx-auto mb-3" />
              <p className="text-[13px] text-zinc-300">{t("noPendingRequests")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingVerifications.map((a) => (
                <div key={a.id} className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {a.photo_url ? (
                      <HoverAvatar src={a.photo_url} size={40} className="shrink-0" />
                    ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-black shrink-0 ${getAvatarColor(a.name)}`}>
                        {getInitials(a.name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-zinc-900 truncate">{a.name}</p>
                      <p className="text-[11px] text-zinc-400 truncate">{a.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Pill tone="amber">{a.profession ? tProfessionTypes(PROFESSION_KEYS[a.profession] ?? "owner") : ""}</Pill>
                        {a.verification_requested_at && (
                          <span className="text-[10px] text-zinc-400">{t("requestedOn", { date: formatDate(a.verification_requested_at) })}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleViewCertificate(a)}
                      disabled={!a.certificate_path}
                      className="text-[11px] font-bold px-3 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-40"
                    >
                      {t("viewCertificate")}
                    </button>
                    <button
                      onClick={() => handleRejectVerification(a)}
                      disabled={verificationBusyId === a.id}
                      className="text-[11px] font-bold px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      {t("reject")}
                    </button>
                    <button
                      onClick={() => handleApproveVerification(a)}
                      disabled={verificationBusyId === a.id}
                      className="text-[11px] font-bold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40"
                    >
                      {verificationBusyId === a.id ? t("working") : t("approve")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
