"use client";

import Link from "next/link";
import Image from "next/image";
import { X, Crown } from "lucide-react";
import HoverAvatar from "@/components/HoverAvatar";
import ContactSupportWidget from "@/components/ContactSupportWidget";
import { navItems } from "@/lib/dashboardNav";
import { getInitials } from "@/lib/initials";

// Previously this entire block (mobile overlay + logo + nav list + support
// widget + premium promo + footer avatar) was hand-copy-pasted at the top of
// all 12 dashboard pages — identical down to a verbatim 7-line comment in
// most of them. Centralizing it here means a future nav/branding change
// happens once instead of in 12 files, and the 12 pages can no longer
// silently drift out of sync with each other the way the nav array had
// already started to (see the codebase audit, July 9 2026).
//
// Each page keeps its own auth-check/data-fetching exactly as before — this
// component is purely presentational, driven by props the page already
// computes for itself (mechanicId, unread counts, photo/name/email).
export default function DashboardSidebar({
  activeLabel,
  sidebarOpen,
  onCloseSidebar,
  mechanicId,
  unreadMessages,
  unreadMechanicMessages,
  photoUrl,
  name,
  email,
  className = "",
  hideSupportWidget = false,
}: {
  activeLabel: string;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  mechanicId: string;
  unreadMessages: number;
  unreadMechanicMessages: number;
  photoUrl: string;
  name: string;
  email: string;
  // Extra class(es) appended to the <aside> — e.g. QR Codes' "no-print", so
  // the sidebar doesn't show up on its Print Sheet output. Empty by default,
  // so every other page is completely unaffected.
  className?: string;
  // Dashboard (the main page) renders ContactSupportWidget itself, inline in
  // its main content area (variant="inline") rather than in the sidebar —
  // set this to avoid rendering it twice on that one page. Every other page
  // leaves this false and gets the widget here, same as before.
  hideSupportWidget?: boolean;
}) {
  const initials = getInitials(name);

  return (
    <>
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={onCloseSidebar} />
      )}

      {/* ════ SIDEBAR ════ */}
      <aside className={`${className} fixed md:static inset-y-0 left-0 z-40 w-[230px] bg-white border-r border-zinc-200 flex flex-col shrink-0 transform transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-2">
          <Link href="/" className="flex items-center">
            <Image src="/images/maintly-logo-full.png" alt="MaintlyQR" width={244} height={72} priority style={{ objectFit: "contain" }} />
          </Link>
          <button onClick={onCloseSidebar} className="md:hidden text-zinc-400 hover:text-zinc-700 mr-2">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={onCloseSidebar}
              className={`flex items-center gap-3 px-3 py-[9px] rounded-lg mb-1 text-[13px] font-medium transition-colors ${
                item.label === activeLabel
                  ? "bg-red-50 text-red-600 border-l-[3px] border-red-600 -ml-[1px]"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <item.icon size={16} />
              {item.label}
              {item.label === "Messages" && unreadMessages > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unreadMessages}</span>
              )}
              {item.label === "Team Chat" && unreadMechanicMessages > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unreadMechanicMessages}</span>
              )}
            </Link>
          ))}
        </nav>

        {!hideSupportWidget && <ContactSupportWidget mechanicId={mechanicId} />}

        <div className="mx-3 mb-3 p-4 rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 border border-zinc-200">
          <div className="flex items-center gap-1.5 text-amber-500 mb-1">
            <Crown size={14} />
            <span className="text-[12px] font-bold text-zinc-800">Go Premium</span>
          </div>
          <p className="text-[10px] text-zinc-500 leading-relaxed mb-3">Unlock advanced reports, custom branding and more.</p>
          <button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-bold py-2 rounded-lg transition-colors">Upgrade Now</button>
        </div>

        <Link href="/dashboard/settings" className="flex items-center gap-2.5 px-4 py-3 border-t border-zinc-200 hover:bg-zinc-50 transition-colors">
          {photoUrl ? (
            <HoverAvatar src={photoUrl} size={32} className="shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[12px] shrink-0">{initials}</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-zinc-800 leading-tight truncate">{name || email}</p>
            <p className="text-[10px] text-zinc-400 leading-tight">Maintly Maintler</p>
          </div>
        </Link>
      </aside>
    </>
  );
}
