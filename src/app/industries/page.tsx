"use client";

import MarketingLayout from "@/components/MarketingLayout";
import { Car, Zap, Snowflake, HardHat, Factory, PlugZap, Tractor, Anchor, Plane, Building2 } from "lucide-react";

const INDUSTRIES = [
  { icon: Car, title: "Automotive", sub: "Cars, trucks, motorcycles and fleets." },
  { icon: Zap, title: "Electrical", sub: "Switchboards, installations, transformers, solar systems and inspections." },
  { icon: Snowflake, title: "HVAC & Refrigeration", sub: "Air conditioning, refrigeration, chillers and cooling systems." },
  { icon: HardHat, title: "Heavy Equipment", sub: "Excavators, loaders, cranes and construction equipment." },
  { icon: Factory, title: "Industrial", sub: "Pumps, compressors, conveyors and manufacturing assets." },
  { icon: PlugZap, title: "Power Generation", sub: "Generators, UPS systems and backup power." },
  { icon: Tractor, title: "Agriculture", sub: "Farm equipment and irrigation systems." },
  { icon: Anchor, title: "Marine", sub: "Marine engines and onboard systems." },
  { icon: Plane, title: "Aviation", sub: "Aircraft maintenance and support equipment." },
  { icon: Building2, title: "Facility Management", sub: "Buildings, elevators, lighting, pumps and infrastructure." },
];

export default function IndustriesPage() {
  return (
    <MarketingLayout
      eyebrow="Industries"
      title="Built for every maintenance professional."
      subtitle="If it requires maintenance, it belongs on Maintly."
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
          Get Started Free
        </a>
      </div>
    </MarketingLayout>
  );
}
