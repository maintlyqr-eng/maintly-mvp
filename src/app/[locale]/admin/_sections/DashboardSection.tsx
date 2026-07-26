"use client";

// Facu (26 jul 2026): décima sección extraída del split del admin — mismo
// criterio que las anteriores (JSX movido tal cual, estado y lógica se
// quedan en page.tsx). UsageBar y TrendRow ya eran funciones a nivel de
// módulo en page.tsx (TrendRow ni siquiera cierra sobre nada del
// componente, tiene su propio useTranslations) así que solo hizo falta
// agregarles `export`. ActivityEvent vivía como tipo local dentro del
// componente — se movió a nivel de módulo para poder exportarlo (no
// cerraba sobre nada, el movimiento es seguro).

import { Users, Wrench, ShieldCheck, Box, QrCode, ClipboardList, ScanLine } from "lucide-react";
import {
  StatCard, SectionTitle, UsageBar, TrendRow, ASSET_ICONS, ASSET_COLORS, timeAgo,
  type UsageMetrics, type DayBucket, type AssetTypeCount, type ActivityEvent,
} from "../page";

type DashboardSectionProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;
  tAssetTypes: (key: string) => string;

  totalUsers: number;
  totalMechanicAccounts: number;
  totalVerifiedMechanics: number;
  totalAssets: number;
  assignedQR: number;
  totalQR: number;
  totalServices: number;
  scansToday: number;
  scansWeek: number;

  usageMetrics: UsageMetrics | null;

  newUserDays: DayBucket[];
  newMechanicDays: DayBucket[];
  newAssetDays: DayBucket[];
  newQrDays: DayBucket[];
  newServiceDays: DayBucket[];

  qrPct: number;
  assetTypes: AssetTypeCount[];
  maxAssetCount: number;

  activityRefreshedAt: string | null;
  recentActivityFeed: ActivityEvent[];
};

export default function DashboardSection({
  t, locale, tAssetTypes,
  totalUsers, totalMechanicAccounts, totalVerifiedMechanics, totalAssets,
  assignedQR, totalQR, totalServices, scansToday, scansWeek,
  usageMetrics,
  newUserDays, newMechanicDays, newAssetDays, newQrDays, newServiceDays,
  qrPct, assetTypes, maxAssetCount,
  activityRefreshedAt, recentActivityFeed,
}: DashboardSectionProps) {
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label={t("usersRegistered")}   value={totalUsers}             icon={Users}     accent="bg-blue-500" />
        <StatCard label={t("mechanicAccounts")}   value={totalMechanicAccounts}  icon={Wrench}    accent="bg-orange-500" />
        <StatCard label={t("verifiedMechanics")}  value={totalVerifiedMechanics} icon={ShieldCheck} accent="bg-emerald-500" />
        <StatCard label={t("assetsRegistered")}   value={totalAssets}            icon={Box}       accent="bg-purple-500" />
        <StatCard label={t("qrAssigned")}         value={assignedQR}             icon={QrCode}    accent="bg-red-500" sub={t("qrAssignedSub", { total: totalQR })} />
        <StatCard label={t("servicesCreated")}    value={totalServices}          icon={ClipboardList} accent="bg-cyan-500" />
        <StatCard label={t("scansToday")}         value={scansToday}             icon={ScanLine}  accent="bg-pink-500" />
        <StatCard label={t("scansThisWeek")}     value={scansWeek}              icon={ScanLine}  accent="bg-indigo-500" />
      </div>

      {usageMetrics && (
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
          <SectionTitle>{t("platformUsageTitle")}</SectionTitle>
          <div className="mt-3">
            <UsageBar label={t("databaseLabel")} usedMB={usageMetrics.dbSizeMB} limitMB={usageMetrics.dbLimitMB} percent={usageMetrics.dbPercent} />
            <UsageBar label={t("storageLabel")} usedMB={usageMetrics.storageSizeMB} limitMB={usageMetrics.storageLimitMB} percent={usageMetrics.storagePercent} />
          </div>
          {(usageMetrics.dbPercent >= 70 || usageMetrics.storagePercent >= 70) && (
            <p className="mt-3 text-[11px] font-semibold text-amber-600">
              {t("approachingLimit")}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
          <SectionTitle>{t("growthTitle")}</SectionTitle>
          <div className="mt-2">
            <TrendRow label={t("newUsers")}      data={newUserDays}     color="bg-blue-500" />
            <TrendRow label={t("newMechanics")}  data={newMechanicDays} color="bg-orange-500" />
            <TrendRow label={t("newAssets")}     data={newAssetDays}    color="bg-purple-500" />
            <TrendRow label={t("qrActivated")}   data={newQrDays}       color="bg-red-500" />
            <TrendRow label={t("servicesCreatedTrend")} data={newServiceDays} color="bg-cyan-500" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <SectionTitle>{t("qrUtilizationTitle")}</SectionTitle>
              <span className="text-[20px] font-black text-zinc-900">{qrPct}%</span>
            </div>
            <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-700" style={{ width: `${qrPct}%` }} />
            </div>
            <div className="flex gap-5">
              <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <div>
                  <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">{t("linked")}</p>
                  <p className="text-[22px] font-black text-emerald-700 leading-none">{assignedQR}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 flex-1">
                <div className="w-2 h-2 rounded-full bg-zinc-300 shrink-0" />
                <div>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{t("free")}</p>
                  <p className="text-[22px] font-black text-zinc-500 leading-none">{totalQR - assignedQR}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
            <SectionTitle>{t("fleetBreakdownTitle")}</SectionTitle>
            {assetTypes.length === 0 ? (
              <p className="text-[13px] text-zinc-300 mt-4">{t("noAssetsYet")}</p>
            ) : (
              <div className="space-y-3 mt-4">
                {assetTypes.map(({ type, count }) => {
                  const pct = Math.round((count / maxAssetCount) * 100);
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-[17px] w-6 shrink-0">{ASSET_ICONS[type] ?? "🔧"}</span>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[12px] font-semibold text-zinc-700">{tAssetTypes(type)}</span>
                          <span className="text-[12px] font-bold text-zinc-900">{count}</span>
                        </div>
                        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div className={`h-full ${ASSET_COLORS[type] ?? "bg-zinc-500"} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actividad en tiempo real (item 1 del pedido + Fase 2 punto
          2) — mezcla cuentas/assets/servicios nuevos, escaneos de QR
          y acciones de admin en un solo feed, con un refresco
          automático cada 30s mientras esta pestaña está abierta. */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <SectionTitle>{t("dashboardActivityTitle")}</SectionTitle>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>
          {activityRefreshedAt && (
            <span className="text-[10px] font-medium text-zinc-300">{t("activityRefreshedAt", { time: timeAgo(activityRefreshedAt, locale) })}</span>
          )}
        </div>
        <p className="text-[11px] text-zinc-400 mb-4">{t("dashboardActivitySub")}</p>

        {recentActivityFeed.length === 0 ? (
          <p className="text-[13px] text-zinc-300 text-center py-8">{t("noRecentActivity")}</p>
        ) : (
          <div className="space-y-1 max-h-[420px] overflow-y-auto -mx-2 pr-1">
            {recentActivityFeed.map((ev) => (
              <div
                key={ev.id}
                onClick={ev.onClick}
                className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl transition-colors ${ev.onClick ? "hover:bg-zinc-50 cursor-pointer" : ""}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${ev.iconBg} bg-opacity-10`}>
                  <ev.icon size={13} className="opacity-80" />
                </div>
                <p className="flex-1 text-[12px] text-zinc-700 leading-snug min-w-0 truncate">{ev.text}</p>
                <span className="text-[10px] text-zinc-300 shrink-0 whitespace-nowrap">{timeAgo(ev.timestamp, locale)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
