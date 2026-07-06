import Link from "next/link";

interface LegalLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  docNumber?: string;
  effectiveDate?: string;
}

export default function LegalLayout({ children, title, subtitle, docNumber, effectiveDate }: LegalLayoutProps) {
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
            <Link href="/legal" className="hover:text-red-600 transition-colors">Legal Hub</Link>
            <Link href="/terms" className="hover:text-red-600 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-red-600 transition-colors">Privacy</Link>
            <Link href="/cookies" className="hover:text-red-600 transition-colors">Cookies</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO HEADER ── */}
      <div className="bg-zinc-950 text-white py-14 px-6">
        <div className="max-w-5xl mx-auto">
          {docNumber && (
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-red-500 mb-3">
              Document {docNumber} of 10  ·  MaintlyQR Legal Package v1.1
            </p>
          )}
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-2">{title}</h1>
          {subtitle && <p className="text-zinc-400 text-sm mt-2 max-w-xl">{subtitle}</p>}
          {effectiveDate && (
            <p className="text-zinc-500 text-xs mt-4 font-medium tracking-wide uppercase">
              Effective {effectiveDate}  ·  Revised July 2, 2026
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
            <Link href="/legal" className="hover:text-red-600 transition-colors">Legal Hub</Link>
            <Link href="/terms" className="hover:text-red-600 transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-red-600 transition-colors">Privacy Policy</Link>
            <Link href="/cookies" className="hover:text-red-600 transition-colors">Cookie Policy</Link>
          </div>
          <p className="text-xs text-zinc-400">© 2026 MaintlyQR™ · Queensland, Australia</p>
        </div>
      </footer>

    </div>
  );
}
