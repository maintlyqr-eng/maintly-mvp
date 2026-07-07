"use client";

import MarketingLayout from "@/components/MarketingLayout";
import { AlertCircle, Target, Users, Mail } from "lucide-react";

const SECTIONS = [
  {
    icon: AlertCircle,
    title: "The Problem",
    sub: "Maintenance history gets lost. It lives in notebooks, group chats, and someone's memory — and disappears the moment a machine changes hands or a mechanic moves on.",
  },
  {
    icon: Target,
    title: "Our Mission",
    sub: "Give every machine a permanent, verifiable maintenance record — tied to the machine itself, accessible with a single scan, anywhere in the world. Every Maintler helps preserve the story of an asset.",
  },
  {
    icon: Users,
    title: "Who We're For",
    sub: "Mechanics, electricians, HVAC technicians, fleet managers, inspectors, and every owner who wants proof of the work — anyone who maintains an asset is a Maintler.",
  },
];

export default function AboutPage() {
  return (
    <MarketingLayout
      eyebrow="About"
      title="Every machine deserves a memory."
      subtitle="MaintlyQR is a global, QR-based maintenance history for any machine — practical, simple, and built to last as long as the equipment does."
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
        <p className="text-zinc-500 text-[13px]">Questions, ideas, or just want to say hi?</p>
        <a href="mailto:support@maintlyqr.com" className="font-black text-red-600 hover:text-red-700 text-[14px]">
          support@maintlyqr.com
        </a>
      </div>
    </MarketingLayout>
  );
}
