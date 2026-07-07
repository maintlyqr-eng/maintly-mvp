"use client";

import MarketingLayout from "@/components/MarketingLayout";
import { FileText, LifeBuoy, BookOpen, Newspaper } from "lucide-react";

const RESOURCES = [
  { icon: FileText, title: "Legal Hub", sub: "Terms of service, privacy policy, and cookie policy.", href: "/legal", tag: null },
  { icon: LifeBuoy, title: "Support", sub: "Questions or issues? We reply personally.", href: "mailto:support@maintlyqr.com", tag: null },
  { icon: BookOpen, title: "Help Center", sub: "Guides and answers for every Maintler.", href: "#", tag: "Coming Soon" },
  { icon: Newspaper, title: "Blog", sub: "Updates and stories from the field.", href: "#", tag: "Coming Soon" },
];

export default function ResourcesPage() {
  return (
    <MarketingLayout
      eyebrow="Resources"
      title="Everything else, in one place."
      subtitle="Legal, support, and guides — simple to find, simple to use."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {RESOURCES.map(({ icon: Icon, title, sub, href, tag }) => (
          <a
            key={title}
            href={href}
            className="relative flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-red-200 transition-all"
          >
            {tag && (
              <span className="absolute top-3 right-3 text-[9px] font-black uppercase tracking-wide text-zinc-400 bg-zinc-100 px-2 py-1 rounded-full">{tag}</span>
            )}
            <div className="shrink-0 w-11 h-11 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
              <Icon size={20} />
            </div>
            <div>
              <h3 className="font-black text-zinc-900 text-[15px] mb-1">{title}</h3>
              <p className="text-zinc-500 text-[13px] leading-snug">{sub}</p>
            </div>
          </a>
        ))}
      </div>
    </MarketingLayout>
  );
}
