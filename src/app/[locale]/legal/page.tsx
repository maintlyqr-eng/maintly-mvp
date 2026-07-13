"use client";

import LegalLayout from "@/components/LegalLayout";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

// Docs 4–10 only exist as PDFs (no on-platform HTML page for them, hence
// href: null) — same as the original English page. Doc numbers/pdf paths
// don't change per locale; only title/desc are translated. See
// LegalLayout.tsx's file comment for why the PDFs themselves stay
// English-only.
const DOC_PDFS: Record<string, string> = {
  "01": "/legal/MaintlyQR_01_Terms_of_Service.pdf",
  "02": "/legal/MaintlyQR_02_Privacy_Policy.pdf",
  "03": "/legal/MaintlyQR_03_Cookie_Policy.pdf",
  "04": "/legal/MaintlyQR_04_Acceptable_Use_Policy.pdf",
  "05": "/legal/MaintlyQR_05_Intellectual_Property_Policy.pdf",
  "06": "/legal/MaintlyQR_06_QR_Assignment_System.pdf",
  "07": "/legal/MaintlyQR_07_Verified_Mechanic.pdf",
  "08": "/legal/MaintlyQR_08_Asset_Ownership_Transfer.pdf",
  "09": "/legal/MaintlyQR_09_API_Terms_of_Use.pdf",
  "10": "/legal/MaintlyQR_10_Trademark_Brand_Guidelines.pdf",
};
const DOC_HREFS: Record<string, string | null> = {
  "01": "/terms", "02": "/privacy", "03": "/cookies",
  "04": null, "05": null, "06": null, "07": null, "08": null, "09": null, "10": null,
};

export default function LegalHubPage() {
  const t = useTranslations("LegalHubPage");

  const docs = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"].map((num) => ({
    num,
    title: t(`doc${num}Title`),
    desc: t(`doc${num}Desc`),
    href: DOC_HREFS[num],
    pdf: DOC_PDFS[num],
  }));

  return (
    <LegalLayout
      title={t("pageTitle")}
      subtitle={t("pageSubtitle")}
    >
      {/* Intro */}
      <div className="mb-10 pb-8 border-b border-zinc-100">
        <p className="text-zinc-600 text-sm leading-relaxed max-w-2xl">
          {t("introText")}{" "}
          <a href="mailto:support@maintlyqr.com" className="text-red-600 hover:underline font-medium">
            support@maintlyqr.com
          </a>.
        </p>
      </div>

      {/* Document grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {docs.map((doc) => (
          <div
            key={doc.num}
            className="group border border-zinc-200 rounded-xl p-5 hover:border-red-200 hover:shadow-md transition-all bg-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-black tracking-widest text-red-500 uppercase">{t("docLabel", { num: doc.num })}</span>
                </div>
                <h3 className="font-bold text-zinc-900 text-sm mb-1 leading-snug">{doc.title}</h3>
                <p className="text-zinc-500 text-xs leading-relaxed">{doc.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              {doc.href && (
                <Link
                  href={doc.href}
                  className="text-xs font-semibold text-zinc-700 hover:text-red-600 transition-colors border border-zinc-200 rounded-lg px-3 py-1.5 hover:border-red-300"
                >
                  {t("readOnline")} →
                </Link>
              )}
              <a
                href={doc.pdf}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-white bg-zinc-900 hover:bg-red-600 transition-colors rounded-lg px-3 py-1.5"
              >
                {t("downloadPdf")}
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Version note */}
      <div className="mt-10 pt-8 border-t border-zinc-100">
        <p className="text-xs text-zinc-400 text-center tracking-wide">
          {t("versionNote")}
        </p>
      </div>
    </LegalLayout>
  );
}
