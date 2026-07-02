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

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="The agreement that governs your use of the MaintlyQR Platform."
      docNumber="01"
      effectiveDate="July 2, 2026"
    >
      {/* Download link */}
      <div className="mb-8 flex items-center gap-4">
        <a
          href="/legal/MaintlyQR_01_Terms_of_Service.pdf"
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

      <Section heading="1. Introduction and Acceptance">
        <p>
          Welcome to MaintlyQR™ ("MaintlyQR", "we", "us", "our"). MaintlyQR is a technology platform
          providing QR-based digital identity and maintenance history tracking for physical assets.
          MaintlyQR is operated pending formal legal incorporation; upon incorporation, the operating
          entity will be MaintlyQR Pty Ltd (ACN pending), headquartered in Queensland, Australia.
          References to "MaintlyQR" apply equally to any successor legal entity.
        </p>
        <p>
          By accessing or using www.maintlyqr.com (the "Platform"), you agree to be bound by these
          Terms of Service ("Terms"). If you do not agree, do not use the Platform.
        </p>
        <p>These Terms apply to all users, including asset owners, mechanics, and visitors.</p>
      </Section>

      <Section heading="2. The Platform — Core Concept">
        <p>
          MaintlyQR enables users to create a permanent digital identity for physical assets via
          unique QR codes. Each QR code is linked to a Maintenance Ledger — a tamper-resistant,
          public record of that asset's service history. The Maintenance Ledger forms part of the
          asset's permanent digital identity and is intended to be a durable, publicly accessible
          record that persists independently of any individual user account.
        </p>
      </Section>

      <Section heading="3. Eligibility">
        <p>You must be at least 18 years old to use the Platform. By using MaintlyQR, you confirm that:</p>
        <ul className="space-y-1 ml-1">
          <Bullet>You are 18 or older (or the legal age of majority in your jurisdiction).</Bullet>
          <Bullet>You have the legal capacity to enter into a binding contract.</Bullet>
          <Bullet>You are using the Platform in compliance with all applicable laws.</Bullet>
        </ul>
      </Section>

      <Section heading="4. Account Registration">
        <p>To access certain features, you must create an account by providing accurate, current, and complete information. You are responsible for:</p>
        <ul className="space-y-1 ml-1">
          <Bullet>Keeping your login credentials confidential.</Bullet>
          <Bullet>All activity that occurs under your account.</Bullet>
          <Bullet>Notifying us immediately of any unauthorised access at support@maintlyqr.com.</Bullet>
        </ul>
        <p>We reserve the right to suspend or terminate accounts that violate these Terms.</p>
      </Section>

      <Section heading="5. QR Code Assignment and Ownership">
        <p>
          Each QR code issued by MaintlyQR is unique and assigned to a specific physical asset.
          QR codes remain the intellectual property of MaintlyQR. You are granted a non-exclusive,
          non-transferable licence to use the QR code in connection with your asset.
        </p>
        <p>
          Upon assignment, a QR code and its associated Maintenance Ledger form part of the asset's
          permanent digital identity. This digital identity is designed to persist even if the
          asset changes hands.
        </p>
        <p>Misuse of QR codes — including reassigning them to different assets — is strictly prohibited.</p>
      </Section>

      <Section heading="6. Maintenance Records and Public Ledger">
        <p>
          The Maintenance Ledger associated with each QR code is publicly visible to anyone who
          scans the QR code. By submitting maintenance records, you:
        </p>
        <ul className="space-y-1 ml-1">
          <Bullet>Confirm that all records submitted are accurate and truthful.</Bullet>
          <Bullet>Acknowledge that records are publicly accessible.</Bullet>
          <Bullet>Grant MaintlyQR a non-exclusive licence to store, display, and process your records.</Bullet>
          <Bullet>Accept responsibility for any inaccurate or misleading records.</Bullet>
        </ul>
        <p>
          Do not include sensitive personal information (e.g., full name, address, phone number)
          in public maintenance records.
        </p>
      </Section>

      <Section heading="7. Verified Mechanic Program">
        <p>
          MaintlyQR may offer a Verified Mechanic badge to qualified tradespeople. Verification
          is at MaintlyQR's sole discretion. A Verified Mechanic badge indicates identity
          verification only — it is not an endorsement, quality guarantee, or professional
          certification by MaintlyQR.
        </p>
        <p>Full program rules are in the Verified Mechanic Program Terms (Document 7).</p>
      </Section>

      <Section heading="8. Prohibited Conduct">
        <p>You agree not to:</p>
        <ul className="space-y-1 ml-1">
          <Bullet>Submit false, fraudulent, or misleading maintenance records.</Bullet>
          <Bullet>Use the Platform for any unlawful purpose.</Bullet>
          <Bullet>Attempt to reverse-engineer, scrape, or exploit the Platform.</Bullet>
          <Bullet>Interfere with the Platform's security or infrastructure.</Bullet>
          <Bullet>Harass, impersonate, or harm other users.</Bullet>
          <Bullet>Use automated tools to access or collect data without our written consent.</Bullet>
          <Bullet>Circumvent, disable, or tamper with any QR code, ledger, or security mechanism.</Bullet>
        </ul>
        <p>Full prohibited conduct details are in the Acceptable Use Policy (Document 4).</p>
      </Section>

      <Section heading="9. Intellectual Property">
        <p>
          All Platform content, branding, software, and design is the exclusive intellectual
          property of MaintlyQR. You retain ownership of original content you create, but grant
          MaintlyQR a licence to store and display it as part of the Platform.
        </p>
        <p>Full details are in the Intellectual Property Policy (Document 5).</p>
      </Section>

      <Section heading="10. Disclaimers">
        <p>
          The Platform is provided "as is" and "as available" without warranties of any kind,
          express or implied. MaintlyQR does not warrant that:
        </p>
        <ul className="space-y-1 ml-1">
          <Bullet>The Platform will be error-free, uninterrupted, or secure.</Bullet>
          <Bullet>Maintenance records submitted by users are accurate or complete.</Bullet>
          <Bullet>The Platform is fit for any particular purpose.</Bullet>
        </ul>
        <p>
          MaintlyQR does not verify the accuracy of any maintenance records submitted by users.
          Reliance on such records is at your own risk. We expressly disclaim all implied warranties
          to the maximum extent permitted by law.
        </p>
      </Section>

      <Section heading="11. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, MaintlyQR shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages arising out of your use of the
          Platform, including but not limited to loss of profits, data, goodwill, or business
          interruption, even if advised of the possibility of such damages.
        </p>
        <p>
          Our total liability for any claim arising from your use of the Platform shall not exceed
          the greater of AUD $100 or the total fees paid by you to MaintlyQR in the 12 months
          preceding the claim.
        </p>
      </Section>

      <Section heading="12. Indemnification">
        <p>
          You agree to indemnify, defend, and hold harmless MaintlyQR, its officers, employees,
          and agents from and against any claims, damages, losses, and expenses (including reasonable
          legal fees) arising out of your use of the Platform, your violation of these Terms, or
          your violation of any third party's rights.
        </p>
      </Section>

      <Section heading="13. Privacy">
        <p>
          Your use of the Platform is also governed by our Privacy Policy (Document 2) and Cookie
          Policy (Document 3), which are incorporated into these Terms by reference.
        </p>
      </Section>

      <Section heading="14. Changes to the Platform and Terms">
        <p>
          MaintlyQR reserves the right to modify, suspend, or discontinue any part of the Platform
          at any time. We may update these Terms from time to time. If we make material changes,
          we will notify registered users by email. Continued use of the Platform after changes
          take effect constitutes acceptance of the revised Terms.
        </p>
      </Section>

      <Section heading="15. Governing Law and Dispute Resolution">
        <p>
          These Terms are governed by the laws of Queensland, Australia. Any dispute arising out
          of or in connection with these Terms shall first be subject to good-faith negotiation.
          If unresolved within 30 days, disputes shall be submitted to binding arbitration or
          the courts of Queensland, Australia, at MaintlyQR's election.
        </p>
        <p>
          Users accessing the Platform from outside Australia agree to comply with their local
          laws and acknowledge that Australian law governs this agreement.
        </p>
      </Section>

      <Section heading="16. Force Majeure">
        <p>
          MaintlyQR shall not be liable for delays or failures in performance resulting from
          circumstances beyond our reasonable control, including natural disasters, government
          actions, power failures, internet outages, or third-party service provider failures.
        </p>
      </Section>

      <Section heading="17. Severability">
        <p>
          If any provision of these Terms is found to be invalid, illegal, or unenforceable, the
          remaining provisions shall continue in full force and effect.
        </p>
      </Section>

      <Section heading="18. Entire Agreement">
        <p>
          These Terms, together with all documents in the MaintlyQR Legal Package, constitute the
          entire agreement between you and MaintlyQR with respect to the Platform and supersede
          all prior agreements.
        </p>
      </Section>

      <Section heading="19. Contact">
        <p>
          For questions about these Terms:{" "}
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
          <p className="text-sm font-bold">Need the full document?</p>
          <p className="text-xs text-zinc-400 mt-0.5">Download the official PDF version of the Terms of Service.</p>
        </div>
        <a
          href="/legal/MaintlyQR_01_Terms_of_Service.pdf"
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
