"use client";

import MarketingLayout from "@/components/MarketingLayout";
import { QrCode, Clock, ShieldCheck, Globe, UserCheck, Layers, ArrowRight } from "lucide-react";

const FEATURES = [
  { icon: QrCode, title: "One QR Per Machine", sub: "Stick it once. Every scan pulls up the complete, permanent history — no app to install." },
  { icon: Clock, title: "Full Service History", sub: "Every inspection, repair, and part change — logged with dates, notes, and who did the work." },
  { icon: ShieldCheck, title: "Verified Maintlers", sub: "Services logged by verified Maintlers carry a Verified badge, building trust automatically." },
  { icon: Globe, title: "No Login to View", sub: "Anyone can scan and see the history instantly. Free, worldwide, no account needed." },
  { icon: UserCheck, title: "Free for Every Maintler", sub: "Registering and logging services is free. Verified professional status is optional, for extra credibility." },
  { icon: Layers, title: "Built for Every Machine", sub: "Cars, generators, HVAC, boats, aircraft and more — one system for everything you maintain." },
];

export default function ProductPage() {
  return (
    <MarketingLayout
      eyebrow="Product"
      title="One QR. The complete story."
      subtitle="Everything you need to track, prove, and share the maintenance history of any machine — nothing you don't."
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
          <p className="text-[11px] font-black tracking-[0.2em] uppercase text-red-500 mb-2">See it in action</p>
          <h3 className="text-xl md:text-2xl font-black mb-1">This isn&apos;t a mockup. It&apos;s a real report.</h3>
          <p className="text-zinc-400 text-[13px] max-w-md">Open a live example — the same page anyone gets when they scan a real Maintly QR.</p>
        </div>
        <a
          href="/asset/demogen001"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-black tracking-wide rounded-xl transition-all shadow-md shadow-red-900/30 uppercase px-6 py-3 text-[13px] whitespace-nowrap"
        >
          View Live Example <ArrowRight size={15} />
        </a>
      </div>

      <div className="mt-10 text-center">
        <a
          href="/register"
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-black tracking-wide rounded-xl transition-all shadow-md shadow-red-900/20 uppercase px-6 py-3 text-[13px]"
        >
          Get Started Free
        </a>
      </div>
    </MarketingLayout>
  );
}
