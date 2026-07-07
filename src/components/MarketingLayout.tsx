"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

interface MarketingLayoutProps {
  children: React.ReactNode;
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

const NAV_ITEMS: { label: string; href: string }[] = [
  { label: "Product", href: "#" },
  { label: "How It Works", href: "#" },
  { label: "Industries", href: "/industries" },
  { label: "Pricing", href: "#" },
  { label: "Resources", href: "#" },
  { label: "API", href: "#" },
  { label: "About", href: "#" },
];

export default function MarketingLayout({ children, eyebrow, title, subtitle }: MarketingLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col">

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-zinc-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/maintly-logo-full.png" alt="MaintlyQR" style={{ height: 44, width: "auto", objectFit: "contain" }} />
          </Link>
          <div className="hidden md:flex items-center gap-7">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-zinc-600 hover:text-red-600 font-medium text-[13px] transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="hidden md:block">
            <Link
              href="/login"
              className="flex items-center gap-2 text-zinc-700 hover:text-zinc-900 font-black tracking-wide rounded-xl transition-all border border-zinc-300 hover:border-zinc-400 uppercase px-4 py-2 text-[11px] shrink-0"
            >
              Login
            </Link>
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-zinc-700 hover:text-zinc-900 p-2"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-white border-t border-zinc-200 shadow-lg flex flex-col px-5 py-4 gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="text-zinc-700 hover:text-zinc-900 font-medium py-2 border-b border-zinc-100 last:border-0"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center gap-2 text-zinc-700 font-black tracking-wide rounded-xl transition-all border border-zinc-300 uppercase px-5 py-3 text-[13px] mt-3"
            >
              Login
            </Link>
          </div>
        )}
      </nav>

      {/* ── HERO HEADER ── */}
      <div className="bg-zinc-950 text-white py-16 px-6">
        <div className="max-w-6xl mx-auto text-center">
          {eyebrow && (
            <p className="text-xs font-black tracking-[0.25em] uppercase text-red-500 mb-3">{eyebrow}</p>
          )}
          <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase mb-4">{title}</h1>
          {subtitle && <p className="text-zinc-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">{subtitle}</p>}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 py-14 px-6">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="border-t border-zinc-100 bg-zinc-50 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/qr-gear-real.png" alt="" style={{ width: 28, height: 28, objectFit: "contain" }} />
            <span className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">MaintlyQR™</span>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-zinc-400">
            <Link href="/terms" className="hover:text-red-600 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-red-600 transition-colors">Privacy</Link>
            <Link href="/cookies" className="hover:text-red-600 transition-colors">Cookies</Link>
          </div>
          <p className="text-xs text-zinc-400">© 2026 MaintlyQR™</p>
        </div>
      </footer>

    </div>
  );
}
