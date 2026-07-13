"use client";

import MarketingLayout from "@/components/MarketingLayout";
import { useTranslations } from "next-intl";
import { Car, Zap, Snowflake, HardHat, Factory, PlugZap, Tractor, Anchor, Plane, Building2 } from "lucide-react";

export default function IndustriesPage() {
  const t = useTranslations("IndustriesPage");

  const INDUSTRIES = [
    { icon: Car, title: t("industry1Title"), sub: t("industry1Sub") },
    { icon: Zap, title: t("industry2Title"), sub: t("industry2Sub") },
    { icon: Snowflake, title: t("industry3Title"), sub: t("industry3Sub") },
    { icon: HardHat, title: t("industry4Title"), sub: t("industry4Sub") },
    { icon: Factory, title: t("industry5Title"), sub: t("industry5Sub") },
    { icon: PlugZap, title: t("industry6Title"), sub: t("industry6Sub") },
    { icon: Tractor, title: t("industry7Title"), sub: t("industry7Sub") },
    { icon: Anchor, title: t("industry8Title"), sub: t("industry8Sub") },
    { icon: Plane, title: t("industry9Title"), sub: t("industry9Sub") },
    { icon: Building2, title: t("industry10Title"), sub: t("industry10Sub") },
  ];

  return (
    <MarketingLayout
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("subtitle")}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {INDUSTRIES.map(({ icon: Icon, title, sub }) => (
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

      <div className="mt-12 text-center">
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
