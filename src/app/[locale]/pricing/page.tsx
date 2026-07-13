"use client";

import MarketingLayout from "@/components/MarketingLayout";
import { useTranslations } from "next-intl";
import { Check, ShieldCheck, Clock } from "lucide-react";

export default function PricingPage() {
  const t = useTranslations("PricingPage");

  const FREE_ITEMS = [t("freeItem1"), t("freeItem2"), t("freeItem3"), t("freeItem4")];
  const VERIFIED_ITEMS = [t("verifiedItem1"), t("verifiedItem2"), t("verifiedItem3"), t("verifiedItem4")];

  return (
    <MarketingLayout
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("subtitle")}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">

        {/* FREE */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm flex flex-col">
          <div className="w-11 h-11 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-4">
            <Clock size={20} />
          </div>
          <h3 className="font-black text-zinc-900 text-lg mb-1">{t("freeTitle")}</h3>
          <p className="text-3xl font-black text-zinc-900 mb-4">$0 <span className="text-sm font-semibold text-zinc-400">{t("freeForever")}</span></p>
          <ul className="space-y-2.5 mb-6 flex-1">
            {FREE_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] text-zinc-600">
                <Check size={15} className="text-red-600 shrink-0 mt-0.5" /> {item}
              </li>
            ))}
          </ul>
          <a
            href="/register"
            className="text-center bg-zinc-950 hover:bg-zinc-800 text-white font-black tracking-wide rounded-xl transition-all uppercase px-6 py-3 text-[13px]"
          >
            {t("getStartedFree")}
          </a>
        </div>

        {/* VERIFIED MECHANIC */}
        <div className="rounded-2xl border-2 border-red-200 bg-white p-7 shadow-sm flex flex-col relative overflow-hidden">
          <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-black uppercase tracking-wide px-3 py-1 rounded-bl-lg">{t("comingSoon")}</span>
          <div className="w-11 h-11 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-4">
            <ShieldCheck size={20} />
          </div>
          <h3 className="font-black text-zinc-900 text-lg mb-1">{t("verifiedTitle")}</h3>
          <p className="text-3xl font-black text-zinc-900 mb-4">{t("askUs")}</p>
          <ul className="space-y-2.5 mb-6 flex-1">
            {VERIFIED_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] text-zinc-600">
                <Check size={15} className="text-red-600 shrink-0 mt-0.5" /> {item}
              </li>
            ))}
          </ul>
          <a
            href="mailto:support@maintlyqr.com?subject=Verified%20Maintler"
            className="text-center border border-zinc-300 hover:border-zinc-400 text-zinc-700 font-black tracking-wide rounded-xl transition-all uppercase px-6 py-3 text-[13px]"
          >
            {t("getNotified")}
          </a>
        </div>
      </div>
    </MarketingLayout>
  );
}
