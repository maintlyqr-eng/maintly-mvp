"use client";

import MarketingLayout from "@/components/MarketingLayout";
import { useTranslations } from "next-intl";
import { AlertCircle, Target, Users, Mail } from "lucide-react";

export default function AboutPage() {
  const t = useTranslations("AboutPage");

  const SECTIONS = [
    { icon: AlertCircle, title: t("section1Title"), sub: t("section1Sub") },
    { icon: Target, title: t("section2Title"), sub: t("section2Sub") },
    { icon: Users, title: t("section3Title"), sub: t("section3Sub") },
  ];

  return (
    <MarketingLayout
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("subtitle")}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {SECTIONS.map(({ icon: Icon, title, sub }) => (
          <div key={title} className="flex flex-col items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="shrink-0 w-11 h-11 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
              <Icon size={20} />
            </div>
            <h3 className="font-black text-zinc-900 text-[16px]">{title}</h3>
            <p className="text-zinc-500 text-[13px] leading-relaxed">{sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-col items-center text-center gap-3">
        <div className="w-11 h-11 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
          <Mail size={18} />
        </div>
        <p className="text-zinc-500 text-[13px]">{t("questionsPrompt")}</p>
        <a href="mailto:support@maintlyqr.com" className="font-black text-red-600 hover:text-red-700 text-[14px]">
          support@maintlyqr.com
        </a>
      </div>
    </MarketingLayout>
  );
}
