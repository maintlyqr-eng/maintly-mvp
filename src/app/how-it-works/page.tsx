"use client";

import MarketingLayout from "@/components/MarketingLayout";
import { QrCode, Smartphone, Eye, UserCheck, ArrowRight } from "lucide-react";

const STEPS = [
  { icon: QrCode, title: "Attach the QR", sub: "Stick a tamper-proof MaintlyQR on the machine. Takes seconds, lasts for the life of the equipment." },
  { icon: Smartphone, title: "Anyone Scans It", sub: "No app, no login. Any phone camera opens the machine's full history instantly." },
  { icon: Eye, title: "History Is Visible", sub: "Every past service — dates, parts, notes, who did the work — right there for anyone to see." },
  { icon: UserCheck, title: "Maintlers Log New Work", sub: "Any logged-in Maintler adds new service records in seconds, building the permanent record." },
];

export default function HowItWorksPage() {
  return (
    <MarketingLayout
      eyebrow="How It Works"
      title="From sticker to full history in seconds."
      subtitle="No training, no setup, no manuals. If you can scan a QR code, you already know how to use MaintlyQR."
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
          <p className="text-[11px] font-black tracking-[0.2em] uppercase text-red-500 mb-2">Try it yourself</p>
          <h3 className="text-xl md:text-2xl font-black mb-1">Skip the sticker. See the result.</h3>
          <p className="text-zinc-400 text-[13px] max-w-md">Open a live example report — exactly what a scan looks like on a real machine.</p>
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
