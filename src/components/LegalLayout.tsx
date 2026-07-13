import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

// Like MarketingLayout.tsx, this is only used by the 4 legal pages
// (legal hub, terms, privacy, cookies) — all migrated together in this
// same rollout pass, so it's safe to use next-intl directly here.
//
// Facu's explicit call on scope (see MAINTLYQR_FEATURE_BACKLOG.md, Item 5):
// "Absolutamente todo, incluido Legal" — translate these on-platform HTML
// pages fully. The linked "Download PDF" documents (the official,
// generated Legal Package v1.1 PDFs) are a separate, much larger project
// (10 documents, reportlab-generated) and are OUT of scope here — they
// stay English-only regardless of locale, same PDF path in all 3
// languages. Worth flagging to Facu explicitly: a translated on-platform
// summary is not a substitute for professional legal review if these
// translations are ever relied on for actual legal effect in another
// language — same caveat given when this scope was first agreed.

interface LegalLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  docNumber?: string;
  effectiveDate?: string;
}

export default function LegalLayout({ children, title, subtitle, docNumber, effectiveDate }: LegalLayoutProps) {
  const t = useTranslations("LegalLayout");

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col">

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-zinc-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/maintly-logo-full.png" alt="MaintlyQR" style={{ height: 52, width: "auto", objectFit: "contain" }} />
          </Link>
          <div className="flex items-center gap-6 text-xs font-medium text-zinc-500 tracking-wide uppercase">
            <Link href="/legal" className="hover:text-red-600 transition-colors">{t("legalHub")}</Link>
            <Link href="/terms" className="hover:text-red-600 transition-colors">{t("terms")}</Link>
            <Link href="/privacy" className="hover:text-red-600 transition-colors">{t("privacy")}</Link>
            <Link href="/cookies" className="hover:text-red-600 transition-colors">{t("cookies")}</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO HEADER ── */}
      <div className="bg-zinc-950 text-white py-14 px-6">
        <div className="max-w-5xl mx-auto">
          {docNumber && (
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-red-500 mb-3">
              {t("documentXOf10", { num: docNumber })}
            </p>
          )}
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-2">{title}</h1>
          {subtitle && <p className="text-zinc-400 text-sm mt-2 max-w-xl">{subtitle}</p>}
          {effectiveDate && (
            <p className="text-zinc-500 text-xs mt-4 font-medium tracking-wide uppercase">
              {t("effectiveRevised", { date: effectiveDate })}
            </p>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 py-12 px-6">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="border-t border-zinc-100 bg-zinc-50 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/qr-gear-real.png" alt="" style={{ width: 28, height: 28, objectFit: "contain" }} />
            <span className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">MaintlyQR™</span>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-zinc-400">
            <Link href="/legal" className="hover:text-red-600 transition-colors">{t("legalHub")}</Link>
            <Link href="/terms" className="hover:text-red-600 transition-colors">{t("termsFull")}</Link>
            <Link href="/privacy" className="hover:text-red-600 transition-colors">{t("privacyFull")}</Link>
            <Link href="/cookies" className="hover:text-red-600 transition-colors">{t("cookiesFull")}</Link>
          </div>
          <p className="text-xs text-zinc-400">{t("copyrightLine")}</p>
        </div>
      </footer>

    </div>
  );
}
