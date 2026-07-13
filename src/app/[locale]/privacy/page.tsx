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

export default function PrivacyPage() {
  const t = useTranslations("PrivacyPage");

  return (
    <LegalLayout
      title={t("pageTitle")}
      subtitle={t("pageSubtitle")}
      docNumber="02"
      effectiveDate={t("effectiveDate")}
    >
      {/* Download link */}
      <div className="mb-8 flex items-center gap-4">
        <a
          href="/legal/MaintlyQR_02_Privacy_Policy.pdf"
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
      </Section>

      <Section heading={t("s2Heading")}>
        <p>{t("s2Intro1")}</p>
        <ul className="space-y-1 ml-1">
          <Bullet>{t("s2Bullet1")}</Bullet>
          <Bullet>{t("s2Bullet2")}</Bullet>
          <Bullet>{t("s2Bullet3")}</Bullet>
          <Bullet>{t("s2Bullet4")}</Bullet>
          <Bullet>{t("s2Bullet5")}</Bullet>
          <Bullet>{t("s2Bullet6")}</Bullet>
        </ul>
        <p>{t("s2Intro2")}</p>
        <ul className="space-y-1 ml-1">
          <Bullet>{t("s2Bullet7")}</Bullet>
          <Bullet>{t("s2Bullet8")}</Bullet>
          <Bullet>{t("s2Bullet9")}</Bullet>
          <Bullet>{t("s2Bullet10")}</Bullet>
        </ul>
      </Section>

      <Section heading={t("s3Heading")}>
        <p>{t("s3Intro")}</p>
        <ul className="space-y-1 ml-1">
          <Bullet>{t("s3Bullet1")}</Bullet>
          <Bullet>{t("s3Bullet2")}</Bullet>
          <Bullet>{t("s3Bullet3")}</Bullet>
          <Bullet>{t("s3Bullet4")}</Bullet>
          <Bullet>{t("s3Bullet5")}</Bullet>
          <Bullet>{t("s3Bullet6")}</Bullet>
          <Bullet>{t("s3Bullet7")}</Bullet>
          <Bullet>{t("s3Bullet8")}</Bullet>
        </ul>
        <p className="font-semibold text-zinc-900">{t("s3NoSale")}</p>
      </Section>

      <Section heading={t("s4Heading")}>
        <p>{t("s4P1")}</p>
        <p>{t("s4P2")}</p>
      </Section>

      <Section heading={t("s5Heading")}>
        <p>{t("s5Intro")}</p>
        <ul className="space-y-1 ml-1">
          <Bullet>{t("s5Bullet1")}</Bullet>
          <Bullet>{t("s5Bullet2")}</Bullet>
          <Bullet>{t("s5Bullet3")}</Bullet>
        </ul>
        <p>{t("s5P1")}</p>
      </Section>

      <Section heading={t("s6Heading")}>
        <p>{t("s6Intro")}</p>
        <ul className="space-y-1 ml-1">
          <Bullet>{t("s6Bullet1")}</Bullet>
          <Bullet>{t("s6Bullet2")}</Bullet>
          <Bullet>{t("s6Bullet3")}</Bullet>
        </ul>
        <p>{t("s6P1")}</p>
      </Section>

      <Section heading={t("s7Heading")}>
        <p>{t("s7P1")}</p>
      </Section>

      <Section heading={t("s8Heading")}>
        <p>{t("s8P1")}</p>
        <p>{t("s8P2")}</p>
      </Section>

      <Section heading={t("s9Heading")}>
        <p>{t("s9Intro")}</p>
        <ul className="space-y-1 ml-1">
          <Bullet>{t("s9Bullet1")}</Bullet>
          <Bullet>{t("s9Bullet2")}</Bullet>
          <Bullet>{t("s9Bullet3")}</Bullet>
          <Bullet>{t("s9Bullet4")}</Bullet>
          <Bullet>{t("s9Bullet5")}</Bullet>
          <Bullet>{t("s9Bullet6")}</Bullet>
        </ul>
        <p>
          {t("s9ContactPrefix")}{" "}
          <a href="mailto:support@maintlyqr.com" className="text-red-600 hover:underline font-medium">
            support@maintlyqr.com
          </a>. {t("s9ContactSuffix")}
        </p>
        <p>{t("s9AuLine")}</p>
        <p>{t("s9EuLine")}</p>
      </Section>

      <Section heading={t("s10Heading")}>
        <p>{t("s10P1")}</p>
        <p>
          {t("s10P2Prefix")}{" "}
          <Link href="/cookies" className="text-red-600 hover:underline font-medium">
            {t("s10P2LinkText")}
          </Link>.
        </p>
      </Section>

      <Section heading={t("s11Heading")}>
        <p>{t("s11P1")}</p>
      </Section>

      <Section heading={t("s12Heading")}>
        <p>{t("s12P1")}</p>
      </Section>

      <Section heading={t("s13Heading")}>
        <p>{t("s13P1")}</p>
      </Section>

      <Section heading={t("s14Heading")}>
        <p>
          {t("s14P1Prefix")}{" "}
          <a href="mailto:support@maintlyqr.com" className="text-red-600 hover:underline font-medium">
            support@maintlyqr.com
          </a>
        </p>
        <p>
          {t("s14P2Prefix")}{" "}
          <a href="https://www.oaic.gov.au" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline font-medium">
            www.oaic.gov.au
          </a>
          {t("s14P2Suffix")}
        </p>
      </Section>

      {/* Download banner */}
      <div className="mt-10 rounded-xl bg-zinc-950 text-white p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold">{t("bannerTitle")}</p>
          <p className="text-xs text-zinc-400 mt-0.5">{t("bannerDesc")}</p>
        </div>
        <a
          href="/legal/MaintlyQR_02_Privacy_Policy.pdf"
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
