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

export default function TermsPage() {
  const t = useTranslations("TermsPage");

  return (
    <LegalLayout
      title={t("pageTitle")}
      subtitle={t("pageSubtitle")}
      docNumber="01"
      effectiveDate={t("effectiveDate")}
    >
      {/* Download link */}
      <div className="mb-8 flex items-center gap-4">
        <a
          href="/legal/MaintlyQR_01_Terms_of_Service.pdf"
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
        <p>{t("s1P2")}</p>
        <p>{t("s1P3")}</p>
      </Section>

      <Section heading={t("s2Heading")}>
        <p>{t("s2P1")}</p>
      </Section>

      <Section heading={t("s3Heading")}>
        <p>{t("s3Intro")}</p>
        <ul className="space-y-1 ml-1">
          <Bullet>{t("s3Bullet1")}</Bullet>
          <Bullet>{t("s3Bullet2")}</Bullet>
          <Bullet>{t("s3Bullet3")}</Bullet>
        </ul>
      </Section>

      <Section heading={t("s4Heading")}>
        <p>{t("s4Intro")}</p>
        <ul className="space-y-1 ml-1">
          <Bullet>{t("s4Bullet1")}</Bullet>
          <Bullet>{t("s4Bullet2")}</Bullet>
          <Bullet>{t("s4Bullet3")}</Bullet>
        </ul>
        <p>{t("s4P1")}</p>
      </Section>

      <Section heading={t("s5Heading")}>
        <p>{t("s5P1")}</p>
        <p>{t("s5P2")}</p>
        <p>{t("s5P3")}</p>
      </Section>

      <Section heading={t("s6Heading")}>
        <p>{t("s6Intro")}</p>
        <ul className="space-y-1 ml-1">
          <Bullet>{t("s6Bullet1")}</Bullet>
          <Bullet>{t("s6Bullet2")}</Bullet>
          <Bullet>{t("s6Bullet3")}</Bullet>
          <Bullet>{t("s6Bullet4")}</Bullet>
        </ul>
        <p>{t("s6P1")}</p>
      </Section>

      <Section heading={t("s7Heading")}>
        <p>{t("s7P1")}</p>
        <p>{t("s7P2")}</p>
      </Section>

      <Section heading={t("s8Heading")}>
        <p>{t("s8Intro")}</p>
        <ul className="space-y-1 ml-1">
          <Bullet>{t("s8Bullet1")}</Bullet>
          <Bullet>{t("s8Bullet2")}</Bullet>
          <Bullet>{t("s8Bullet3")}</Bullet>
          <Bullet>{t("s8Bullet4")}</Bullet>
          <Bullet>{t("s8Bullet5")}</Bullet>
          <Bullet>{t("s8Bullet6")}</Bullet>
          <Bullet>{t("s8Bullet7")}</Bullet>
        </ul>
        <p>{t("s8P1")}</p>
      </Section>

      <Section heading={t("s9Heading")}>
        <p>{t("s9P1")}</p>
        <p>{t("s9P2")}</p>
      </Section>

      <Section heading={t("s10Heading")}>
        <p>{t("s10Intro")}</p>
        <ul className="space-y-1 ml-1">
          <Bullet>{t("s10Bullet1")}</Bullet>
          <Bullet>{t("s10Bullet2")}</Bullet>
          <Bullet>{t("s10Bullet3")}</Bullet>
        </ul>
        <p>{t("s10P1")}</p>
      </Section>

      <Section heading={t("s11Heading")}>
        <p>{t("s11P1")}</p>
        <p>{t("s11P2")}</p>
      </Section>

      <Section heading={t("s12Heading")}>
        <p>{t("s12P1")}</p>
      </Section>

      <Section heading={t("s13Heading")}>
        <p>{t("s13P1")}</p>
      </Section>

      <Section heading={t("s14Heading")}>
        <p>{t("s14P1")}</p>
      </Section>

      <Section heading={t("s15Heading")}>
        <p>{t("s15P1")}</p>
        <p>{t("s15P2")}</p>
      </Section>

      <Section heading={t("s16Heading")}>
        <p>{t("s16P1")}</p>
      </Section>

      <Section heading={t("s17Heading")}>
        <p>{t("s17P1")}</p>
      </Section>

      <Section heading={t("s18Heading")}>
        <p>{t("s18P1")}</p>
      </Section>

      <Section heading={t("s19Heading")}>
        <p>
          {t("s19P1Prefix")}{" "}
          <a href="mailto:support@maintlyqr.com" className="text-red-600 hover:underline font-medium">
            support@maintlyqr.com
          </a>
          {" "}·{" "}
          <a href="https://www.maintlyqr.com" className="text-red-600 hover:underline font-medium">
            www.maintlyqr.com
          </a>
        </p>
      </Section>

      {/* Download banner */}
      <div className="mt-10 rounded-xl bg-zinc-950 text-white p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold">{t("bannerTitle")}</p>
          <p className="text-xs text-zinc-400 mt-0.5">{t("bannerDesc")}</p>
        </div>
        <a
          href="/legal/MaintlyQR_01_Terms_of_Service.pdf"
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
