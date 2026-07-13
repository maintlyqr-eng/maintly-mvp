"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Small "EN / ES / PT" picker for the localized part of the site. Lives in
// the navbar (desktop) and mobile menu of every page under
// src/app/[locale]/. Switching keeps the visitor on the same page, just in
// the other language — e.g. /es/asset/ABC123 -> /pt/asset/ABC123 (default
// locale "en" has no prefix at all, see src/i18n/routing.ts).
const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
};

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("LanguageSwitcher");
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function switchTo(nextLocale: string) {
    setOpen(false);
    if (nextLocale === locale) return;
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 transition-colors font-semibold"
        style={{ fontSize: "clamp(10px,0.75vw,12px)" }}
        aria-label={t("changeLanguage")}
      >
        <Globe size={13} /> {LOCALE_LABELS[locale] ?? locale.toUpperCase()}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-36 bg-white border border-zinc-200 rounded-xl shadow-lg py-1 z-50">
          {routing.locales.map((l) => (
            <button
              key={l}
              onClick={() => switchTo(l)}
              className={`w-full text-left px-3 py-2 text-[13px] hover:bg-zinc-50 transition-colors ${
                l === locale ? "font-bold text-red-600" : "text-zinc-700"
              }`}
            >
              {LOCALE_LABELS[l] ?? l.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
