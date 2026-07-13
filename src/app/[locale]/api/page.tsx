"use client";

import MarketingLayout from "@/components/MarketingLayout";
import { useTranslations } from "next-intl";
import { Code2, Webhook, Boxes, ArrowRight } from "lucide-react";

export default function ApiPage() {
  const t = useTranslations("ApiPage");

  const FEATURES = [
    { icon: Code2, title: t("feature1Title"), sub: t("feature1Sub") },
    { icon: Webhook, title: t("feature2Title"), sub: t("feature2Sub") },
    { icon: Boxes, title: t("feature3Title"), sub: t("feature3Sub") },
  ];

  return (
    <MarketingLayout
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("subtitle")}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {FEATURES.map(({ icon: Icon, title, sub }) => (
          <div key={title} className="flex flex-col items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
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

      <div className="mt-8 rounded-2xl bg-zinc-950 text-white p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-5">
        <div>
          <p className="text-[11px] font-black tracking-[0.2em] uppercase text-red-500 mb-2">{t("comingSoon")}</p>
          <h3 className="text-xl md:text-2xl font-black mb-1">{t("openingGradually")}</h3>
          <p className="text-zinc-400 text-[13px] max-w-md">{t("wantInEarly")}</p>
        </div>
        <a
          href="mailto:support@maintlyqr.com?subject=API%20Early%20Access"
          className="shrink-0 inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-black tracking-wide rounded-xl transition-all shadow-md shadow-red-900/30 uppercase px-6 py-3 text-[13px] whitespace-nowrap"
        >
          {t("requestEarlyAccess")} <ArrowRight size={15} />
        </a>
      </div>
    </MarketingLayout>
  );
}
