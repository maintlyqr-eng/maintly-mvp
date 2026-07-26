"use client";

// Facu (26 jul 2026): tercera sección extraída del split del admin — mismo
// criterio que AuditLogSection.tsx / ErrorsSection.tsx (JSX movido tal
// cual, estado y lógica se quedan en page.tsx).

import {
  Users, Box, QrCode, TrendingUp, MapPin, Calendar, ClipboardList, ScanLine, Wrench,
} from "lucide-react";
import {
  StatCard, SectionTitle, ASSET_ICONS, PROFESSION_KEYS, INACTIVE_DAYS_THRESHOLD,
  type AnalyticsData,
} from "../page";

type AnalyticsSectionProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  tProfessionTypes: (key: string) => string;

  analyticsData: AnalyticsData | null;
  analyticsLoading: boolean;
  analyticsFrom: string;
  setAnalyticsFrom: (v: string) => void;
  analyticsTo: string;
  setAnalyticsTo: (v: string) => void;

  assetLabel: (a: { nickname: string | null; brand: string | null; model: string | null }) => string;
};

export default function AnalyticsSection({
  t, tProfessionTypes,
  analyticsData, analyticsLoading, analyticsFrom, setAnalyticsFrom, analyticsTo, setAnalyticsTo,
  assetLabel,
}: AnalyticsSectionProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-[12px] text-zinc-400 max-w-lg">{t("analyticsIntro")}</p>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("auditFilterFrom")}</label>
            <input
              type="date" value={analyticsFrom}
              onChange={(e) => setAnalyticsFrom(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("auditFilterTo")}</label>
            <input
              type="date" value={analyticsTo}
              onChange={(e) => setAnalyticsTo(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
            />
          </div>
        </div>
      </div>

      {analyticsLoading || !analyticsData ? (
        <p className="text-[13px] text-zinc-400 text-center py-16">{t("loading")}</p>
      ) : (
        <>
          {/* Incremento 15: cuántos Maintlers hay en total y de qué
              profesión — lo primero que Facu pidió poder ver acá,
              antes de "usuarios activos" (que mide otra cosa:
              actividad reciente, no composición de la base). */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <SectionTitle>{t("analyticsMaintlersTitle")}</SectionTitle>
              <span className="text-[22px] font-black text-zinc-900">{analyticsData.totalMaintlers.toLocaleString()}</span>
            </div>
            <p className="text-[10.5px] text-zinc-300 mb-4">{t("analyticsMaintlersSub")}</p>
            {analyticsData.professionBreakdown.length === 0 ? (
              <p className="text-[13px] text-zinc-300">{t("analyticsNoData")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
                {analyticsData.professionBreakdown.map((row) => {
                  const max = analyticsData.professionBreakdown[0].count;
                  const pct = max > 0 ? Math.round((row.count / max) * 100) : 0;
                  return (
                    <div key={row.profession} className="flex items-center gap-3">
                      <span className="text-[12px] font-semibold text-zinc-700 truncate flex-1">
                        {tProfessionTypes(PROFESSION_KEYS[row.profession] ?? "owner")}
                      </span>
                      <div className="w-20 h-1.5 bg-zinc-100 rounded-full overflow-hidden shrink-0">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] font-black text-zinc-900 w-8 text-right shrink-0">{row.count}</span>
                    </div>
                  );
                })}
                {analyticsData.noProfessionCount > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] font-semibold text-zinc-400 truncate flex-1">{t("analyticsNoProfession")}</span>
                    <div className="w-20 h-1.5 bg-zinc-100 rounded-full overflow-hidden shrink-0" />
                    <span className="text-[11px] font-black text-zinc-400 w-8 text-right shrink-0">{analyticsData.noProfessionCount}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <SectionTitle>{t("analyticsActiveUsersTitle")}</SectionTitle>
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mt-3">
              <StatCard label={t("analyticsActiveToday")} value={analyticsData.activeToday} icon={Users} accent="bg-blue-500" />
              <StatCard label={t("analyticsActiveWeek")} value={analyticsData.activeThisWeek} icon={Users} accent="bg-indigo-500" />
              <StatCard label={t("analyticsActiveMonth")} value={analyticsData.activeThisMonth} icon={Users} accent="bg-purple-500" />
              <StatCard label={t("analyticsReturning")} value={analyticsData.returningMechanics} icon={TrendingUp} accent="bg-emerald-500" sub={t("analyticsReturningSub")} />
              <StatCard label={t("analyticsInactive")} value={analyticsData.inactiveMechanics} icon={Users} accent="bg-amber-500" sub={t("analyticsInactiveSub", { days: INACTIVE_DAYS_THRESHOLD })} />
            </div>
          </div>

          <div>
            <SectionTitle>{t("analyticsHealthTitle")}</SectionTitle>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mt-3">
              <StatCard label={t("analyticsAvgRecordsPerAsset")} value={analyticsData.avgRecordsPerAsset.toFixed(1)} icon={ClipboardList} accent="bg-cyan-500" />
              <StatCard
                label={t("analyticsAvgDaysToFirst")}
                value={analyticsData.avgDaysToFirstMaintenance != null ? analyticsData.avgDaysToFirstMaintenance.toFixed(0) : "—"}
                icon={Calendar}
                accent="bg-orange-500"
              />
              <StatCard label={t("analyticsAssetsWithoutRecords")} value={analyticsData.assetsWithoutRecords} icon={Box} accent="bg-red-500" sub={t("analyticsOfTotal", { total: analyticsData.totalAssets })} />
              <StatCard label={t("analyticsQrNeverScanned")} value={analyticsData.qrNeverScanned} icon={QrCode} accent="bg-zinc-500" sub={t("analyticsOfTotal", { total: analyticsData.totalQrCodes })} />
            </div>
          </div>

          <div>
            <SectionTitle>{t("analyticsRangeActivityTitle")}</SectionTitle>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <StatCard
                label={t("analyticsScansInRange")}
                value={analyticsData.scansInRange.toLocaleString()}
                icon={ScanLine}
                accent="bg-pink-500"
                sub={analyticsData.scansInRangeTruncated ? t("analyticsSampleNote") : undefined}
              />
              <StatCard
                label={t("analyticsServicesInRange")}
                value={analyticsData.servicesInRange.toLocaleString()}
                icon={Wrench}
                accent="bg-teal-500"
                sub={analyticsData.servicesInRangeTruncated ? t("analyticsSampleNote") : undefined}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
              <SectionTitle>{t("analyticsTopScannedTitle")}</SectionTitle>
              {analyticsData.topScannedAssets.length === 0 ? (
                <p className="text-[13px] text-zinc-300 mt-4">{t("analyticsNoData")}</p>
              ) : (
                <div className="space-y-2.5 mt-4">
                  {analyticsData.topScannedAssets.map((r, i) => (
                    <div key={r.assetId} className="flex items-center gap-3">
                      <span className="text-[11px] font-black text-zinc-300 w-4 shrink-0">{i + 1}</span>
                      <span className="text-[15px] shrink-0">{r.asset ? ASSET_ICONS[r.asset.asset_type] ?? "🔧" : "🔧"}</span>
                      <span className="text-[12.5px] font-semibold text-zinc-700 truncate flex-1">{r.asset ? assetLabel(r.asset) : r.assetId}</span>
                      <span className="text-[12px] font-black text-zinc-900 shrink-0">{r.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
              <SectionTitle>{t("analyticsTopRecordsTitle")}</SectionTitle>
              {analyticsData.topAssetsByRecords.length === 0 ? (
                <p className="text-[13px] text-zinc-300 mt-4">{t("analyticsNoData")}</p>
              ) : (
                <div className="space-y-2.5 mt-4">
                  {analyticsData.topAssetsByRecords.map((r, i) => (
                    <div key={r.assetId} className="flex items-center gap-3">
                      <span className="text-[11px] font-black text-zinc-300 w-4 shrink-0">{i + 1}</span>
                      <span className="text-[15px] shrink-0">{r.asset ? ASSET_ICONS[r.asset.asset_type] ?? "🔧" : "🔧"}</span>
                      <span className="text-[12.5px] font-semibold text-zinc-700 truncate flex-1">{r.asset ? assetLabel(r.asset) : r.assetId}</span>
                      <span className="text-[12px] font-black text-zinc-900 shrink-0">{r.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={14} className="text-zinc-400" />
              <SectionTitle>{t("analyticsTopLocationsTitle")}</SectionTitle>
            </div>
            <p className="text-[10.5px] text-zinc-300 mb-4">{t("analyticsTopLocationsNote")}</p>
            {analyticsData.topLocations.length === 0 ? (
              <p className="text-[13px] text-zinc-300">{t("analyticsNoData")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
                {analyticsData.topLocations.map((loc) => {
                  const max = analyticsData.topLocations[0].count;
                  const pct = Math.round((loc.count / max) * 100);
                  return (
                    <div key={loc.location} className="flex items-center gap-3">
                      <span className="text-[12px] font-semibold text-zinc-700 truncate flex-1">{loc.location}</span>
                      <div className="w-20 h-1.5 bg-zinc-100 rounded-full overflow-hidden shrink-0">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] font-black text-zinc-900 w-6 text-right shrink-0">{loc.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
