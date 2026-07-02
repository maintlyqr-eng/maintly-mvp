import LegalLayout from "@/components/LegalLayout";
import Link from "next/link";

const docs = [
  {
    num: "01",
    title: "Terms of Service",
    desc: "The full agreement governing your use of MaintlyQR.",
    href: "/terms",
    pdf: "/legal/MaintlyQR_01_Terms_of_Service.pdf",
  },
  {
    num: "02",
    title: "Privacy Policy",
    desc: "How we collect, use, and protect your personal information.",
    href: "/privacy",
    pdf: "/legal/MaintlyQR_02_Privacy_Policy.pdf",
  },
  {
    num: "03",
    title: "Cookie Policy",
    desc: "What cookies we use and why — essential only.",
    href: "/cookies",
    pdf: "/legal/MaintlyQR_03_Cookie_Policy.pdf",
  },
  {
    num: "04",
    title: "Acceptable Use Policy",
    desc: "Rules for acceptable conduct on the Platform.",
    href: null,
    pdf: "/legal/MaintlyQR_04_Acceptable_Use_Policy.pdf",
  },
  {
    num: "05",
    title: "Intellectual Property Policy",
    desc: "What MaintlyQR owns, what you own, and how to report infringement.",
    href: null,
    pdf: "/legal/MaintlyQR_05_Intellectual_Property_Policy.pdf",
  },
  {
    num: "06",
    title: "QR Assignment System",
    desc: "How QR codes are assigned to assets and what that means.",
    href: null,
    pdf: "/legal/MaintlyQR_06_QR_Assignment_System.pdf",
  },
  {
    num: "07",
    title: "Verified Mechanic Program",
    desc: "Rules, eligibility, and conduct for Verified Mechanics.",
    href: null,
    pdf: "/legal/MaintlyQR_07_Verified_Mechanic.pdf",
  },
  {
    num: "08",
    title: "Asset Ownership & Transfer",
    desc: "How ownership is handled when assets change hands.",
    href: null,
    pdf: "/legal/MaintlyQR_08_Asset_Ownership_Transfer.pdf",
  },
  {
    num: "09",
    title: "API Terms of Use",
    desc: "Terms governing programmatic access to the MaintlyQR Platform.",
    href: null,
    pdf: "/legal/MaintlyQR_09_API_Terms_of_Use.pdf",
  },
  {
    num: "10",
    title: "Trademark & Brand Guidelines",
    desc: "How MaintlyQR's name, trademark, and visual identity may be used.",
    href: null,
    pdf: "/legal/MaintlyQR_10_Trademark_Brand_Guidelines.pdf",
  },
];

export default function LegalHubPage() {
  return (
    <LegalLayout
      title="Legal Centre"
      subtitle="MaintlyQR's complete legal framework — transparent, thorough, and built to protect you."
    >
      {/* Intro */}
      <div className="mb-10 pb-8 border-b border-zinc-100">
        <p className="text-zinc-600 text-sm leading-relaxed max-w-2xl">
          The documents below form the MaintlyQR Legal Package v1.1, effective July 2, 2026.
          All documents operate together; Document 01 (Terms of Service) is the master agreement
          and the others supplement it. For any legal questions, contact{" "}
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
                  <span className="text-xs font-black tracking-widest text-red-500 uppercase">Doc {doc.num}</span>
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
                  Read online →
                </Link>
              )}
              <a
                href={doc.pdf}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-white bg-zinc-900 hover:bg-red-600 transition-colors rounded-lg px-3 py-1.5"
              >
                Download PDF
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Version note */}
      <div className="mt-10 pt-8 border-t border-zinc-100">
        <p className="text-xs text-zinc-400 text-center tracking-wide">
          MaintlyQR Legal Package v1.1 · Effective July 2, 2026 · Operated by MaintlyQR (pending incorporation as MaintlyQR Pty Ltd, Queensland, Australia)
        </p>
      </div>
    </LegalLayout>
  );
}
