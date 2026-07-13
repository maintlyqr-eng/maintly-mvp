"use client";

import MarketingLayout from "@/components/MarketingLayout";
import { useTranslations } from "next-intl";
import { QrCode, Smartphone, Eye, UserCheck, ArrowRight } from "lucide-react";

export default function HowItWorksPage() {
  const t = useTranslations("HowItWorksPage");

  const STEPS = [
    { icon: QrCode, title: t("step1Title"), sub: t("step1Sub") },
    { icon: Smartphone, title: t("step2Title"), sub: t("step2Sub") },
    { icon: Eye, title: t("step3Title"), sub: t("step3Sub") },
    { icon: UserCheck, title: t("step4Title"), sub: t("step4Sub") },
  ];

  return (
    <MarketingLayout
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("subtitle")}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {STEPS.map(({ icon: Icon, title, sub }, i) => (
          <div key={title} className="relative flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="shrink-0 w-12 h-12 rounded-full bg-zinc-950 flex items-center justify-center text-white relative">
              <Icon size={20} />
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">{i + 1}</span>
            </div>
            <div>
              <h3 className="font-black text-zinc-900 text-[16px] mb-1">{title}</h3>
              <p className="text-zinc-500 text-[13px] leading-relaxed">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── LIVE EXAMPLE CALLOUT ── */}
      <div className="mt-8 rounded-2xl bg-zinc-950 text-white p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-5">
        <div>
          <p className="text-[11px] font-black tracking-[0.2em] uppercase text-red-500 mb-2">{t("tryItYourself")}</p>
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
