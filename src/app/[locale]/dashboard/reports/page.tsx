"use client";

import Image from "next/image";
// Assets isn't migrated yet — keep this one plain next/link.
import Link from "next/link";
import { useEffect, useState } from "react";
// Login is migrated and every router.push()/replace() call on this page
// targets it — safe to use next-intl's locale-aware router.
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  Search, ExternalLink, ClipboardList, History,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import DashboardSidebarIntl from "@/components/DashboardSidebarIntl";
import DashboardHeaderIntl from "@/components/DashboardHeaderIntl";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { useUnreadMechanicMessages } from "@/lib/useUnreadMechanicMessages";
import { formatDateDMY } from "@/lib/date";

const assetTypeImg: Record<string, string> = {
  automotive: "/images/car.png",
  motorcycle: "/images/moto.png",
  generator: "/images/generador.png",
  machinery: "/images/excavator.png",
  marine: "/images/barco.png",
  aviation: "/images/avion.png",
};

type ReportAsset = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  asset_type: string;
  qrCode: string | null;
  totalServices: number;
  lastServiceDate: string | null;
};

export default function ReportsPage() {
  const t = useTranslations("DashboardReportsPage");
  // Asset-type values are DB enums (e.g. "automotive") also read by other
  // pages — reusing the existing "AssetTypes" namespace instead of a
  // page-local map, same pattern established for the Report/Maintler pages.
  const tAssetTypes = useTranslations("AssetTypes");
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mechanicId, setMechanicId] = useState("");
  const unreadMessages = useUnreadMessagesCount(mechanicId);
  const unreadMechanicMessages = useUnreadMechanicMessages(mechanicId);
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicPhoto, setMechanicPhoto] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [maintlerCode, setMaintlerCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [reportAssets, setReportAssets] = useState<ReportAsset[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    let active = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      if (!active) return;

      setMechanicId(session.user.id);
      setMechanicEmail(session.user.email ?? "");

      setLoading(true);

      // Facu (26 jul 2026, revisión de rendimiento): el perfil propio se
      // pedía antes que assetRows/svcRows, en fila — ninguna de las 3
      // depende de otra, así que ahora las 3 van en la misma tanda.
      const [{ data: mechanic }, { data: assetRows }, { data: svcRows }] = await Promise.all([
        supabase
          .from("mechanics").select("name, photo_url, maintler_code").eq("id", session.user.id).maybeSingle(),
        supabase
          .from("mechanic_assets")
          .select("assets(id, nickname, brand, model, asset_type, qr_codes(code))")
          .eq("mechanic_id", session.user.id),
        supabase
          .from("service_records")
          .select("asset_id, service_date")
          .eq("mechanic_id", session.user.id)
          .is("deleted_at", null),
      ]);
      if (active && mechanic) { setMechanicName(mechanic.name); setMechanicPhoto(mechanic.photo_url ?? ""); setMaintlerCode(mechanic.maintler_code ?? ""); }

      const statsByAsset: Record<string, { count: number; lastDate: string | null }> = {};
      for (const s of (svcRows ?? []) as any[]) {
        const cur = statsByAsset[s.asset_id] ?? { count: 0, lastDate: null };
        cur.count += 1;
        if (!cur.lastDate || s.service_date > cur.lastDate) cur.lastDate = s.service_date;
        statsByAsset[s.asset_id] = cur;
      }

      const list: ReportAsset[] = ((assetRows ?? []) as any[])
        .map((r) => {
          const a = Array.isArray(r.assets) ? r.assets[0] : r.assets;
          if (!a) return null;
          const qr = Array.isArray(a.qr_codes) ? a.qr_codes[0]?.code : a.qr_codes?.code;
          const stats = statsByAsset[a.id] ?? { count: 0, lastDate: null };
          return {
            id: a.id,
            name: a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || t("unknownAsset"),
            brand: a.brand ?? null,
            model: a.model ?? null,
            asset_type: a.asset_type,
            qrCode: qr ?? null,
            totalServices: stats.count,
            lastServiceDate: stats.lastDate,
          };
        })
        .filter(Boolean) as ReportAsset[];

      list.sort((x, y) => x.name.localeCompare(y.name));

      if (active) setReportAssets(list);
      if (active) setLoading(false);
      if (active) setCheckingAuth(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => { active = false; listener.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">{t("loadingAuth")}</p>
      </div>
    );
  }

  const availableTypes = Array.from(new Set(reportAssets.map((a) => a.asset_type)));

  const totalReports = reportAssets.length;
  const totalServicesLogged = reportAssets.reduce((sum, a) => sum + a.totalServices, 0);
  const withoutQr = reportAssets.filter((a) => !a.qrCode).length;

  const visibleReports = reportAssets.filter((a) => {
    if (typeFilter !== "all" && a.asset_type !== typeFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const haystack = [a.name, a.brand, a.model, a.qrCode].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q);
  });

  return (
    <div className="h-dvh bg-zinc-50 flex relative overflow-hidden">

      <DashboardSidebarIntl
        activeHref="/dashboard/reports"
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        mechanicId={mechanicId}
        unreadMessages={unreadMessages}
        unreadMechanicMessages={unreadMechanicMessages}
        photoUrl={mechanicPhoto}
        name={mechanicName}
        email={mechanicEmail}
      />

      {/* ════ MAIN ════ */}
      <div className="flex-1 flex flex-col min-w-0">

        <DashboardHeaderIntl
          title={t("title")}
          subtitle={t("subtitle")}
          onOpenSidebar={() => setSidebarOpen(true)}
          mechanicId={mechanicId}
          unreadMessages={unreadMessages}
          unreadMechanicMessages={unreadMechanicMessages}
          photoUrl={mechanicPhoto}
          name={mechanicName}
          email={mechanicEmail}
          maintlerCode={maintlerCode}
          onLogout={handleLogout}
        />

        <div className="flex-1 overflow-y-auto px-3 md:px-4 pt-1.5 md:pt-2 pb-3 md:pb-4">

          {/* ── SUMMARY CARDS ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{t("totalReports")}</p>
              <p className="text-[26px] font-black text-zinc-900 mt-1">{totalReports}</p>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{t("servicesLogged")}</p>
              <p className="text-[26px] font-black text-zinc-900 mt-1">{totalServicesLogged}</p>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{t("missingQrCode")}</p>
              <p className="text-[26px] font-black text-zinc-900 mt-1">{withoutQr}</p>
            </div>
          </div>

          {/* ── SEARCH + FILTER ── */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400 transition-colors"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto overscroll-x-contain">
              <button
                onClick={() => setTypeFilter("all")}
                className={`shrink-0 px-3 py-[7px] rounded-full text-[12px] font-bold transition-colors ${typeFilter === "all" ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}
              >
                {t("allTypes")}
              </button>
              {availableTypes.map((ty) => (
                <button
                  key={ty}
                  onClick={() => setTypeFilter(typeFilter === ty ? "all" : ty)}
                  className={`shrink-0 px-3 py-[7px] rounded-full text-[12px] font-bold transition-colors ${typeFilter === ty ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}
                >
                  {tAssetTypes(ty)}
                </button>
              ))}
            </div>
          </div>

          {/* ── LIST ── */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
            {loading ? (
              <p className="text-[13px] text-zinc-400 text-center py-12">{t("loadingReports")}</p>
            ) : visibleReports.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-zinc-100 bg-zinc-50 mb-3">
                  <ClipboardList size={20} className="text-zinc-300" />
                </div>
                <p className="text-[13px] text-zinc-400 mb-1">
                  {reportAssets.length === 0 ? t("noReportsYet") : t("noReportsMatch")}
                </p>
                {reportAssets.length === 0 && (
                  <p className="text-[12px] text-zinc-300">
                    {t("addAssetHintPrefix")}{" "}
                    <Link href="/dashboard/assets" className="font-bold text-red-500 hover:text-red-600">{t("assetsLinkLabel")}</Link>{" "}
                    {t("addAssetHintSuffix")}
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {/* header row (desktop) */}
                <div className="hidden md:flex items-center gap-3 px-5 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                  <div className="w-10 shrink-0" />
                  <div className="flex-1 min-w-0">{t("columnAsset")}</div>
                  <div className="w-28 shrink-0">{t("columnType")}</div>
                  <div className="w-24 shrink-0 text-center">{t("columnServices")}</div>
                  <div className="w-32 shrink-0">{t("columnLastService")}</div>
                  <div className="w-36 shrink-0 text-right">{t("columnReport")}</div>
                </div>

                {visibleReports.map((a) => {
                  const img = assetTypeImg[a.asset_type] ?? "/images/car.png";
                  return (
                    <div key={a.id} className="flex flex-wrap md:flex-nowrap items-center gap-3 px-5 py-4">
                      <div className="w-10 h-10 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                        <Image src={img} alt={a.name} width={26} height={26} className="object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-zinc-800 leading-tight truncate">{a.name}</p>
                        <p className="text-[11px] text-zinc-400 truncate">{a.qrCode ? a.qrCode : t("noQrLinked")}</p>
                      </div>
                      <div className="w-28 shrink-0 text-[12px] text-zinc-500">{tAssetTypes(a.asset_type)}</div>
                      <div className="w-24 shrink-0 text-center">
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-zinc-700">
                          <History size={11} className="text-zinc-400" /> {a.totalServices}
                        </span>
                      </div>
                      <div className="w-32 shrink-0 text-[12px] text-zinc-500">
                        {a.lastServiceDate ? formatDateDMY(a.lastServiceDate) : "—"}
                      </div>
                      <div className="w-36 shrink-0 flex justify-end">
                        {a.qrCode ? (
                          <a
                            href={`/asset/${a.qrCode}/report`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50 px-3 py-[7px] rounded-lg transition-colors"
                          >
                            {t("viewReport")} <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-[11px] text-zinc-300">{t("noQrCode")}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-zinc-400 mt-8">{t("copyright")}</p>
        </div>
      </div>
    </div>
  );
}
