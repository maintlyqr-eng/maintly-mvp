"use client";

import LegalLayout from "@/components/LegalLayout";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-black tracking-wide text-red-600 uppercase mb-3 pb-2 border-b border-red-50">
        {heading}
      </h2>
      <div className="text-sm text-zinc-700 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="text-red-400 mt-0.5 shrink-0">•</span>
      <span>{children}</span>
    </li>
  );
}

export default function CookiesPage() {
  const t = useTranslations("CookiesPage");

  return (
    <LegalLayout
      title={t("pageTitle")}
      subtitle={t("pageSubtitle")}
      docNumber="03"
      effectiveDate={t("effectiveDate")}
    >
      {/* Download link */}
      <div className="mb-8 flex items-center gap-4">
        <a
          href="/legal/MaintlyQR_03_Cookie_Policy.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-red-600 transition-colors rounded-lg px-4 py-2"
        >
          {t("downloadPdf")}
        </a>
        <Link href="/legal" className="text-xs text-zinc-400 hover:text-red-600 transition-colors">
          ← {t("allLegalDocuments")}
        </Link>
      </div>

      <Section heading={t("s1Heading")}>
        <p>{t("s1P1")}</p>
      </Section>

      <Section heading={t("s2Heading")}>
        <p>{t("s2P1")}</p>
        <p>{t("s2P2")}</p>
      </Section>

      <Section heading={t("s3Heading")}>
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600 uppercase tracking-wide">{t("tableColName")}</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600 uppercase tracking-wide">{t("tableColType")}</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600 uppercase tracking-wide">{t("tableColPurpose")}</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600 uppercase tracking-wide">{t("tableColDuration")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              <tr className="hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3 font-mono text-zinc-700">sb-access-token</td>
                <td className="px-4 py-3 text-zinc-500">{t("tableTypeEssential")}</td>
                <td className="px-4 py-3 text-zinc-600">{t("tableRow1Purpose")}</td>
                <td className="px-4 py-3 text-zinc-500">{t("tableDurationSession")}</td>
              </tr>
              <tr className="hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3 font-mono text-zinc-700">sb-refresh-token</td>
                <td className="px-4 py-3 text-zinc-500">{t("tableTypeEssential")}</td>
                <td className="px-4 py-3 text-zinc-600">{t("tableRow2Purpose")}</td>
                <td className="px-4 py-3 text-zinc-500">{t("tableDurationPersistent")}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-500">{t("s3Note")}</p>
      </Section>

      <Section heading={t("s4Heading")}>
        <p>{t("s4Intro")}</p>
        <ul className="space-y-1 ml-1">
          <Bullet>{t("s4Bullet1")}</Bullet>
          <Bullet>{t("s4Bullet2")}</Bullet>
          <Bullet>{t("s4Bullet3")}</Bullet>
          <Bullet>{t("s4Bullet4")}</Bullet>
          <Bullet>{t("s4Bullet5")}</Bullet>
        </ul>
      </Section>

      <Section heading={t("s5Heading")}>
        <p>{t("s5P1")}</p>
        <p>{t("s5P2")}</p>
      </Section>

      <Section heading={t("s6Heading")}>
        <p>
          {t("s6P1Prefix")}{" "}
          <a
            href="https://supabase.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-600 hover:underline font-medium"
          >
            supabase.com/privacy
          </a>. {t("s6P1Suffix")}
        </p>
      </Section>

      <Section heading={t("s7Heading")}>
        <p>{t("s7P1")}</p>
      </Section>

      <Section heading={t("s8Heading")}>
        <p>
          {t("s8P1Prefix")}{" "}
          <a href="mailto:support@maintlyqr.com" className="text-red-600 hover:underline font-medium">
            support@maintlyqr.com
          </a>
        </p>
        <p>
          {t("s8P2Prefix")}{" "}
          <Link href="/privacy" className="text-red-600 hover:underline font-medium">
            {t("s8P2LinkText")}
          </Link>.
        </p>
      </Section>

      {/* Download banner */}
      <div className="mt-10 rounded-xl bg-zinc-950 text-white p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold">{t("bannerTitle")}</p>
          <p className="text-xs text-zinc-400 mt-0.5">{t("bannerDesc")}</p>
        </div>
        <a
          href="/legal/MaintlyQR_03_Cookie_Policy.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors rounded-lg px-5 py-2.5"
        >
          {t("downloadPdf")} →
        </a>
      </div>
    </LegalLayout>
  );
}
