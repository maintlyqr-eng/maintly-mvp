"use client";

import MarketingLayout from "@/components/MarketingLayout";
import { Check, ShieldCheck, Clock } from "lucide-react";

export default function PricingPage() {
  return (
    <MarketingLayout
      eyebrow="Pricing"
      title="Simple, honest profiles."
      subtitle="No tiers to compare, no hidden fees. Just two ways to use Maintly."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">

        {/* FREE */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm flex flex-col">
          <div className="w-11 h-11 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-4">
            <Clock size={20} />
          </div>
          <h3 className="font-black text-zinc-900 text-lg mb-1">Free</h3>
          <p className="text-3xl font-black text-zinc-900 mb-4">$0 <span className="text-sm font-semibold text-zinc-400">forever</span></p>
          <ul className="space-y-2.5 mb-6 flex-1">
            {[
              "Scan and view any machine's history — no account needed",
              "Free registration as a Maintly mechanic",
              "Log unlimited services",
              "Add machines to your workshop",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] text-zinc-600">
                <Check size={15} className="text-red-600 shrink-0 mt-0.5" /> {item}
              </li>
            ))}
          </ul>
          <a
            href="/register"
            className="text-center bg-zinc-950 hover:bg-zinc-800 text-white font-black tracking-wide rounded-xl transition-all uppercase px-6 py-3 text-[13px]"
          >
            Get Started Free
          </a>
        </div>

        {/* VERIFIED MECHANIC */}
        <div className="rounded-2xl border-2 border-red-200 bg-white p-7 shadow-sm flex flex-col relative overflow-hidden">
          <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-black uppercase tracking-wide px-3 py-1 rounded-bl-lg">Coming Soon</span>
          <div className="w-11 h-11 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-4">
            <ShieldCheck size={20} />
          </div>
          <h3 className="font-black text-zinc-900 text-lg mb-1">Verified Mechanic</h3>
          <p className="text-3xl font-black text-zinc-900 mb-4">Ask us</p>
          <ul className="space-y-2.5 mb-6 flex-1">
            {[
              "Everything in Free",
              "Verified badge on every service you log",
              "Extra credibility with customers",
              "Priority support",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] text-zinc-600">
                <Check size={15} className="text-red-600 shrink-0 mt-0.5" /> {item}
              </li>
            ))}
          </ul>
          <a
            href="mailto:support@maintlyqr.com?subject=Verified%20Mechanic"
            className="text-center border border-zinc-300 hover:border-zinc-400 text-zinc-700 font-black tracking-wide rounded-xl transition-all uppercase px-6 py-3 text-[13px]"
          >
            Get Notified
          </a>
        </div>
      </div>
    </MarketingLayout>
  );
}
