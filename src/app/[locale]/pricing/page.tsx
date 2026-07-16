"use client";

import MarketingLayout from "@/components/MarketingLayout";
import { useTranslations } from "next-intl";
import { Check, Clock, Heart } from "lucide-react";

// Facu's call (jul 2026): MaintlyQR is free for everyone, always -- no paid
// tier, ever. This page used to show a second "Verified Maintler" column
// priced "Ask us" with a "Coming Soon" badge, implying a future paid plan.
// That's gone now: verified badges are already a real, free feature (see
// ProfessionVerificationForm), so that column was actively misleading. This
// is a single "it's free" card plus a short, honest note about how the
// project might sustain itself down the road (advertising partnerships,
// not fees charged to Maintlers) -- so the page still answers "how do you
// make money" without promising or hinting at any future paywall.
export default function PricingPage() {
  const t = useTranslations("PricingPage");

  const FREE_ITEMS = [t("freeItem1"), t("freeItem2"), t("freeItem3"), t("freeItem4"), t("freeItem5")];

  return (
    <MarketingLayout
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("subtitle")}
    >
      <div className="max-w-md mx-auto">
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

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 flex gap-3">
          <Heart size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-[13px] font-black text-zinc-900 mb-1">{t("sustainabilityTitle")}</h4>
            <p className="text-[12.5px] text-zinc-500 leading-relaxed">{t("sustainabilityText")}</p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
