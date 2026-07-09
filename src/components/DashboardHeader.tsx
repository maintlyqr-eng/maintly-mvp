"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Menu, LogOut } from "lucide-react";
import HoverAvatar from "@/components/HoverAvatar";
import NotificationBell from "@/components/NotificationBell";
import { getInitials } from "@/lib/initials";

// Same duplication problem as DashboardSidebar (see that file's comment) —
// this exact header (mobile menu button, title/subtitle, notification bell,
// own-card avatar link, logout button) was hand-copy-pasted across all 12
// dashboard pages. Each page still owns its own title/subtitle text and its
// own auth/data state; this component just renders it consistently.
export default function DashboardHeader({
  title,
  subtitle,
  onOpenSidebar,
  mechanicId,
  unreadMessages,
  unreadMechanicMessages,
  photoUrl,
  name,
  email,
  maintlerCode,
  onLogout,
  className = "",
  extraHeaderContent,
}: {
  title: string;
  subtitle: string;
  onOpenSidebar: () => void;
  mechanicId: string;
  unreadMessages: number;
  unreadMechanicMessages: number;
  photoUrl: string;
  name: string;
  email: string;
  maintlerCode: string;
  onLogout: () => void;
  // Extra class(es) appended to the <header> — e.g. QR Codes' "no-print".
  // Empty by default, so every other page is completely unaffected.
  className?: string;
  // Slot rendered between the title block and the notification bell — e.g.
  // the Dashboard page's live search bar. undefined by default, so every
  // other page renders exactly as before.
  extraHeaderContent?: ReactNode;
}) {
  const initials = getInitials(name);

  return (
    <header className={`${className} flex items-center justify-between gap-3 px-4 md:px-7 py-4 bg-white border-b border-zinc-200`}>
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onOpenSidebar} className="md:hidden shrink-0 text-zinc-600 hover:text-zinc-900">
          <Menu size={22} />
        </button>
        <div className="min-w-0">
          <h1 className="text-[17px] md:text-[20px] font-black text-zinc-900 truncate">{title}</h1>
          <p className="hidden sm:block text-[12px] text-zinc-400 truncate">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        {extraHeaderContent}
        <NotificationBell mechanicId={mechanicId} unreadMessagesCount={unreadMessages} unreadMechanicCount={unreadMechanicMessages} />
        <div className="flex items-center gap-3 md:pl-3 md:border-l border-zinc-200">
          {/* Links to this Maintler's own public card, same on every
              dashboard page (round 2 of the Maintler QR card feature —
              Facu's own call: "prefiero que la foto y el nombre que hay
              en la derecha arriba te lleve a una linda tarjeta"). */}
          <Link href={maintlerCode ? `/maintler/${maintlerCode}` : "/dashboard/settings"} className="flex items-center gap-2.5 group">
            {photoUrl ? (
              <HoverAvatar src={photoUrl} size={36} className="shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[13px] shrink-0">{initials}</div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-[12px] font-bold text-zinc-800 leading-tight group-hover:text-red-600 transition-colors">{name || email}</p>
              <p className="text-[10px] text-zinc-400 leading-tight">Maintler</p>
            </div>
          </Link>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500 hover:text-red-600 hover:bg-red-50 border border-zinc-200 hover:border-red-200 px-3 py-2 rounded-xl transition-all"
          >
            <LogOut size={13} />
            <span className="hidden md:inline">Log out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
