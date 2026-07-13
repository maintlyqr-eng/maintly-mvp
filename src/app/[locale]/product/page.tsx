"use client";

import MarketingLayout from "@/components/MarketingLayout";
import { useTranslations } from "next-intl";
import { QrCode, Clock, ShieldCheck, Globe, UserCheck, Layers, ArrowRight } from "lucide-react";

export default function ProductPage() {
  const t = useTranslations("ProductPage");

  const FEATURES = [
    { icon: QrCode, title: t("feature1Title"), sub: t("feature1Sub") },
    { icon: Clock, title: t("feature2Title"), sub: t("feature2Sub") },
    { icon: ShieldCheck, title: t("feature3Title"), sub: t("feature3Sub") },
    { icon: Globe, title: t("feature4Title"), sub: t("feature4Sub") },
    { icon: UserCheck, title: t("feature5Title"), sub: t("feature5Sub") },
    { icon: Layers, title: t("feature6Title"), sub: t("feature6Sub") },
  ];

  return (
    <MarketingLayout
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("subtitle")}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map(({ icon: Icon, title, sub }) => (
          <div
            key={title}
            className="flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-red-200 transition-all"
          >
            <div className="shrink-0 w-11 h-11 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
              <Icon size={20} />
            </div>
            <div>
              <h3 className="font-black text-zinc-900 text-[15px] mb-1">{title}</h3>
              <p className="text-zinc-500 text-[13px] leading-snug">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── LIVE EXAMPLE CALLOUT ── */}
      <div className="mt-8 rounded-2xl bg-zinc-950 text-white p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-5">
        <div>
          <p className="text-[11px] font-black tracking-[0.2em] uppercase text-red-500 mb-2">{t("seeItInAction")}</p>
          <h3 className="text-xl md:text-2xl font-black mb-1">{t("liveExampleTitle")}</h3>
          <p className="text-zinc-400 text-[13px] max-w-md">{t("liveExampleDesc")}</p>
        </div>
        <a
          href="/asset/demogen001"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-black tracking-wide rounded-xl transition-all shadow-md shadow-red-900/30 uppercase px-6 py-3 text-[13px] whitespace-nowrap"
        >
          {t("viewLiveExample")} <ArrowRight size={15} />
        </a>
      </div>

      <div className="mt-10 text-center">
        <a
          href="/register"
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-black tracking-wide rounded-xl transition-all shadow-md shadow-red-900/20 uppercase px-6 py-3 text-[13px]"
        >
          {t("getStartedFree")}
        </a>
      </div>
    </MarketingLayout>
  );
}
