"use client";

import MarketingLayout from "@/components/MarketingLayout";
import { Code2, Webhook, Boxes, ArrowRight } from "lucide-react";

const FEATURES = [
  { icon: Code2, title: "Pull Service Records", sub: "Query any machine's full history directly from your own systems." },
  { icon: Webhook, title: "Sync Automatically", sub: "Keep your fleet or ERP software updated the moment a new service is logged." },
  { icon: Boxes, title: "Built for Integrators", sub: "Designed to plug into fleet management, ERPs, and internal tools." },
];

export default function ApiPage() {
  return (
    <MarketingLayout
      eyebrow="Connect Your Software"
      title="Your systems, our history."
      subtitle="Bring Maintly's maintenance records into the tools you already use — without changing how your team works."
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
          <p className="text-[11px] font-black tracking-[0.2em] uppercase text-red-500 mb-2">Coming Soon</p>
          <h3 className="text-xl md:text-2xl font-black mb-1">We&apos;re opening API access gradually.</h3>
          <p className="text-zinc-400 text-[13px] max-w-md">Want in early? Tell us about your use case and we&apos;ll reach out.</p>
        </div>
        <a
          href="mailto:support@maintlyqr.com?subject=API%20Early%20Access"
          className="shrink-0 inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-black tracking-wide rounded-xl transition-all shadow-md shadow-red-900/30 uppercase px-6 py-3 text-[13px] whitespace-nowrap"
        >
          Request Early Access <ArrowRight size={15} />
        </a>
      </div>
    </MarketingLayout>
  );
}
