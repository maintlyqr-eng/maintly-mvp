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

export default function CookiesPage() {
  return (
    <LegalLayout
      title="Cookie Policy"
      subtitle="What cookies MaintlyQR uses and why — essential only, nothing more."
      docNumber="03"
      effectiveDate="July 2, 2026"
    >
      {/* Download link */}
      <div className="mb-8 flex items-center gap-4">
        <a
          href="/legal/MaintlyQR_03_Cookie_Policy.pdf"
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

      <Section heading="1. What Are Cookies">
        <p>
          Cookies are small text files placed on your device by a website when you visit it.
          They are widely used to make websites work efficiently, provide functionality, and
          give site owners information about how their sites are used.
        </p>
      </Section>

      <Section heading="2. How MaintlyQR Uses Cookies">
        <p>
          MaintlyQR uses essential cookies only. We do not use advertising cookies, tracking
          pixels, social media cookies, or third-party analytics cookies.
        </p>
        <p>
          Our approach is minimal by design: we collect only what is necessary to operate the
          Platform and provide you with a secure, functional experience.
        </p>
      </Section>

      <Section heading="3. Cookies We Use">
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600 uppercase tracking-wide">Cookie Name</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600 uppercase tracking-wide">Purpose</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600 uppercase tracking-wide">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              <tr className="hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3 font-mono text-zinc-700">sb-access-token</td>
                <td className="px-4 py-3 text-zinc-500">Essential</td>
                <td className="px-4 py-3 text-zinc-600">Maintains your authenticated session (Supabase Auth)</td>
                <td className="px-4 py-3 text-zinc-500">Session</td>
              </tr>
              <tr className="hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3 font-mono text-zinc-700">sb-refresh-token</td>
                <td className="px-4 py-3 text-zinc-500">Essential</td>
                <td className="px-4 py-3 text-zinc-600">Keeps you signed in across browser sessions (Supabase Auth)</td>
                <td className="px-4 py-3 text-zinc-500">Persistent</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          These cookies are set by Supabase, our authentication provider. Without them, you cannot
          log in or remain signed in to the Platform.
        </p>
      </Section>

      <Section heading="4. What We Do NOT Use">
        <p>MaintlyQR does not use:</p>
        <ul className="space-y-1 ml-1">
          <Bullet>Google Analytics, Meta Pixel, or any third-party tracking scripts</Bullet>
          <Bullet>Advertising or retargeting cookies</Bullet>
          <Bullet>Social media cookies or share buttons that track you</Bullet>
          <Bullet>Cross-site tracking or fingerprinting technologies</Bullet>
          <Bullet>Cookies that collect personal data beyond what is needed for authentication</Bullet>
        </ul>
      </Section>

      <Section heading="5. Your Choices">
        <p>
          Because we use only essential cookies, blocking or deleting them will prevent you from
          logging in to the Platform. You can manage cookies through your browser settings, but
          note that disabling essential cookies will break authentication.
        </p>
        <p>
          If you access public QR pages without logging in, no cookies are required and none
          are set.
        </p>
      </Section>

      <Section heading="6. Third-Party Providers">
        <p>
          Our authentication cookies are managed by Supabase. Supabase's privacy policy is
          available at{" "}
          <a
            href="https://supabase.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-600 hover:underline font-medium"
          >
            supabase.com/privacy
          </a>. We host the Platform via Vercel, which may set technical cookies for load balancing
          and performance purposes.
        </p>
      </Section>

      <Section heading="7. Changes to This Policy">
        <p>
          We may update this Cookie Policy from time to time. If we introduce any new types of
          cookies, we will update this policy and notify registered users. Continued use of the
          Platform after changes take effect constitutes acceptance.
        </p>
      </Section>

      <Section heading="8. Contact">
        <p>
          Questions about our use of cookies:{" "}
          <a href="mailto:support@maintlyqr.com" className="text-red-600 hover:underline font-medium">
            support@maintlyqr.com
          </a>
        </p>
        <p>
          For a broader view of our privacy practices, see the{" "}
          <Link href="/privacy" className="text-red-600 hover:underline font-medium">
            Privacy Policy (Document 2)
          </Link>.
        </p>
      </Section>

      {/* Download banner */}
      <div className="mt-10 rounded-xl bg-zinc-950 text-white p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold">Need the full document?</p>
          <p className="text-xs text-zinc-400 mt-0.5">Download the official PDF version of the Cookie Policy.</p>
        </div>
        <a
          href="/legal/MaintlyQR_03_Cookie_Policy.pdf"
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
