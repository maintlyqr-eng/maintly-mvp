import LegalLayout from "@/components/LegalLayout";
import Link from "next/link";

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
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How MaintlyQR collects, uses, stores, and protects your personal information."
      docNumber="02"
      effectiveDate="July 2, 2026"
    >
      {/* Download link */}
      <div className="mb-8 flex items-center gap-4">
        <a
          href="/legal/MaintlyQR_02_Privacy_Policy.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-red-600 transition-colors rounded-lg px-4 py-2"
        >
          Download PDF
        </a>
        <Link href="/legal" className="text-xs text-zinc-400 hover:text-red-600 transition-colors">
          ← All Legal Documents
        </Link>
      </div>

      <Section heading="1. Who We Are">
        <p>
          MaintlyQR™ ("MaintlyQR", "we", "us", "our") is a technology platform providing QR-based
          digital identity and maintenance history tracking for physical assets. MaintlyQR is
          operated pending formal legal incorporation; upon incorporation, the operating entity
          will be MaintlyQR Pty Ltd (ACN pending), headquartered in Queensland, Australia.
          References to "MaintlyQR" apply equally to any successor legal entity.
        </p>
        <p>
          This Privacy Policy explains how we handle personal information collected through
          www.maintlyqr.com (the Platform). We comply with the Australian Privacy Act 1988,
          the Australian Privacy Principles (APPs), and where applicable, the EU General Data
          Protection Regulation (GDPR) and UK GDPR.
        </p>
      </Section>

      <Section heading="2. Information We Collect">
        <p>Information you provide directly:</p>
        <ul className="space-y-1 ml-1">
          <Bullet>Name and email address (at registration)</Bullet>
          <Bullet>Professional details (mechanic or business name, trade registration number)</Bullet>
          <Bullet>Asset information (type, make, model, serial number, location)</Bullet>
          <Bullet>Maintenance and service records (dates, descriptions, mileage, hours, parts used)</Bullet>
          <Bullet>Photos of assets and service records (optional)</Bullet>
          <Bullet>Communications you send to support@maintlyqr.com</Bullet>
        </ul>
        <p>Information collected automatically:</p>
        <ul className="space-y-1 ml-1">
          <Bullet>IP address and approximate geographic location</Bullet>
          <Bullet>Browser type, device type, and operating system</Bullet>
          <Bullet>Pages visited, features used, and session duration</Bullet>
          <Bullet>Authentication tokens and session identifiers</Bullet>
        </ul>
      </Section>

      <Section heading="3. How We Use Your Information">
        <p>We use your information to:</p>
        <ul className="space-y-1 ml-1">
          <Bullet>Create and manage your account</Bullet>
          <Bullet>Display maintenance history on public QR pages</Bullet>
          <Bullet>Generate PDF service reports</Bullet>
          <Bullet>Operate, maintain, and improve the Platform</Bullet>
          <Bullet>Send essential service communications (security alerts, account updates, policy changes)</Bullet>
          <Bullet>Process Verified Mechanic applications</Bullet>
          <Bullet>Comply with legal obligations</Bullet>
          <Bullet>In anonymised or aggregated form: improve AI features and analyse Platform usage</Bullet>
        </ul>
        <p className="font-semibold text-zinc-900">We do not sell your personal information to third parties. Ever.</p>
      </Section>

      <Section heading="4. Public Information">
        <p>
          The maintenance records you add to any asset's Maintenance Ledger are publicly visible
          to anyone who scans the associated QR code — this is a core feature of MaintlyQR.
        </p>
        <p>
          By adding records, you acknowledge this information is publicly accessible. Do not
          include sensitive personal information in service records or asset descriptions.
        </p>
      </Section>

      <Section heading="5. Third-Party Providers">
        <p>We share your information only with:</p>
        <ul className="space-y-1 ml-1">
          <Bullet>Supabase — database, authentication, and storage provider (data encrypted in transit and at rest)</Bullet>
          <Bullet>Vercel — hosting and content delivery provider</Bullet>
          <Bullet>Legal and regulatory authorities, when required by law</Bullet>
        </ul>
        <p>
          We do not use third-party advertising networks, tracking pixels, or data brokers.
          All providers are bound by their own privacy policies and are selected for their
          high security standards.
        </p>
      </Section>

      <Section heading="6. Data Storage and Security">
        <p>Your data is stored using Supabase, which provides:</p>
        <ul className="space-y-1 ml-1">
          <Bullet>Encryption in transit (TLS/SSL)</Bullet>
          <Bullet>Encryption at rest (AES-256)</Bullet>
          <Bullet>Row-level security ensuring users can only access their own data</Bullet>
        </ul>
        <p>
          We apply industry-standard security practices. No system is 100% secure. In the event
          of a data breach affecting your rights, we will notify you as required by applicable law.
        </p>
      </Section>

      <Section heading="7. Artificial Intelligence">
        <p>
          MaintlyQR may use AI to analyse patterns in anonymised, aggregated maintenance data to
          improve Platform features. Your personally identifiable information is not used to train
          external AI models. If AI features are applied directly to your records, you will be informed.
        </p>
      </Section>

      <Section heading="8. Retention">
        <p>
          We retain your account data for as long as your account is active. Upon account deletion,
          we delete your personal information within 30 days, except where retention is legally required.
        </p>
        <p>Public QR maintenance records remain accessible until the asset owner removes them.</p>
      </Section>

      <Section heading="9. Your Rights">
        <p>Depending on your location, you may have the right to:</p>
        <ul className="space-y-1 ml-1">
          <Bullet>Access the personal information we hold about you</Bullet>
          <Bullet>Correct inaccurate information</Bullet>
          <Bullet>Request deletion of your data</Bullet>
          <Bullet>Object to or restrict how we process your data</Bullet>
          <Bullet>Export your data in a portable format (JSON, CSV, or PDF)</Bullet>
          <Bullet>Withdraw consent at any time where processing is consent-based</Bullet>
        </ul>
        <p>
          To exercise any right, contact{" "}
          <a href="mailto:support@maintlyqr.com" className="text-red-600 hover:underline font-medium">
            support@maintlyqr.com
          </a>. We will respond within 30 days.
        </p>
        <p>Australian users: rights under the Privacy Act 1988 and Australian Privacy Principles.</p>
        <p>
          EU/UK users: rights under the GDPR/UK GDPR, including the right to lodge a complaint
          with your supervisory authority.
        </p>
      </Section>

      <Section heading="10. Cookies">
        <p>
          We use essential cookies only: to maintain your login session and enable core Platform
          functionality. We do not use advertising cookies, tracking pixels, or third-party
          analytics cookies.
        </p>
        <p>
          Full details are in the{" "}
          <Link href="/cookies" className="text-red-600 hover:underline font-medium">
            Cookie Policy (Document 3)
          </Link>.
        </p>
      </Section>

      <Section heading="11. Children's Privacy">
        <p>
          MaintlyQR is not intended for anyone under 18. We do not knowingly collect personal
          information from minors. If you believe a minor has registered, contact us immediately
          and we will delete their account.
        </p>
      </Section>

      <Section heading="12. International Transfers">
        <p>
          MaintlyQR serves users globally. Your data may be stored on servers located outside
          your country of residence. Where we transfer personal data internationally, we ensure
          appropriate safeguards are in place in compliance with applicable law.
        </p>
      </Section>

      <Section heading="13. Changes to This Policy">
        <p>
          We may update this Policy from time to time. We will notify registered users by email
          of significant changes. Continued use constitutes acceptance.
        </p>
      </Section>

      <Section heading="14. Contact and Complaints">
        <p>
          For privacy questions, requests, or complaints:{" "}
          <a href="mailto:support@maintlyqr.com" className="text-red-600 hover:underline font-medium">
            support@maintlyqr.com
          </a>
        </p>
        <p>
          If you are not satisfied with our response, you may escalate to the Office of the
          Australian Information Commissioner (OAIC) at{" "}
          <a href="https://www.oaic.gov.au" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline font-medium">
            www.oaic.gov.au
          </a>
          , or to your national data protection authority.
        </p>
      </Section>

      {/* Download banner */}
      <div className="mt-10 rounded-xl bg-zinc-950 text-white p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold">Need the full document?</p>
          <p className="text-xs text-zinc-400 mt-0.5">Download the official PDF version of the Privacy Policy.</p>
        </div>
        <a
          href="/legal/MaintlyQR_02_Privacy_Policy.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors rounded-lg px-5 py-2.5"
        >
          Download PDF →
        </a>
      </div>
    </LegalLayout>
  );
}
