"use client";

import MarketingLayout from "@/components/MarketingLayout";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { FileText, LifeBuoy, BookOpen, Newspaper } from "lucide-react";

export default function ResourcesPage() {
  const t = useTranslations("ResourcesPage");

  // Legal Hub ("/legal") is migrated — rendered via next-intl's <Link>
  // below (see isInternal check). The other three (mailto: and "#"
  // coming-soon placeholders) stay plain <a>.
  const RESOURCES = [
    { icon: FileText, title: t("legalHubTitle"), sub: t("legalHubSub"), href: "/legal", tag: null as string | null },
    { icon: LifeBuoy, title: t("supportTitle"), sub: t("supportSub"), href: "mailto:support@maintlyqr.com", tag: null as string | null },
    { icon: BookOpen, title: t("helpCenterTitle"), sub: t("helpCenterSub"), href: "#", tag: t("comingSoon") },
    { icon: Newspaper, title: t("blogTitle"), sub: t("blogSub"), href: "#", tag: t("comingSoon") },
  ];

  return (
    <MarketingLayout
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("subtitle")}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {RESOURCES.map(({ icon: Icon, title, sub, href, tag }) => {
          const cardClass = "relative flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-red-200 transition-all";
          const inner = (
            <>
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
            </>
          );
          return href === "/legal" ? (
            <Link key={title} href={href} className={cardClass}>{inner}</Link>
          ) : (
            <a key={title} href={href} className={cardClass}>{inner}</a>
          );
        })}
      </div>
    </MarketingLayout>
  );
}
