"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Menu, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import HoverAvatar from "@/components/HoverAvatar";
import NotificationBellIntl from "@/components/NotificationBellIntl";
import { getInitials } from "@/lib/initials";

// Localized twin of src/components/DashboardHeader.tsx — same reasoning as
// DashboardSidebarIntl.tsx: kept as a separate file only so pages that
// haven't been migrated to src/app/[locale]/dashboard/... yet can keep
// importing the original, English-only header untouched. `title`/`subtitle`
// are still passed in as props (each page already translates those itself
// via its own namespace) — this component only localizes its own chrome
// (the "Log out" button and the "Maintler" caption under the avatar).
//
// The own-card avatar link keeps a plain next/link Link: one branch points
// at "/maintler/:code" (migrated) and the other, when there's no code yet,
// falls back to "/dashboard/settings" (not migrated yet) — per the
// established Link-swap-as-targets-migrate rule, it only becomes safe to
// swap to next-intl's locale-aware Link once BOTH branches point at
// migrated pages.
export default function DashboardHeaderIntl({
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
  className?: string;
  extraHeaderContent?: ReactNode;
}) {
  const t = useTranslations("DashboardHeader");
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
        <NotificationBellIntl mechanicId={mechanicId} unreadMessagesCount={unreadMessages} unreadMechanicCount={unreadMechanicMessages} />
        <div className="flex items-center gap-3 md:pl-3 md:border-l border-zinc-200">
          <Link href={maintlerCode ? `/maintler/${maintlerCode}` : "/dashboard/settings"} className="flex items-center gap-2.5 group">
            {photoUrl ? (
              <HoverAvatar src={photoUrl} size={36} className="shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[13px] shrink-0">{initials}</div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-[12px] font-bold text-zinc-800 leading-tight group-hover:text-red-600 transition-colors">{name || email}</p>
              <p className="text-[10px] text-zinc-400 leading-tight">{t("maintler")}</p>
            </div>
          </Link>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500 hover:text-red-600 hover:bg-red-50 border border-zinc-200 hover:border-red-200 px-3 py-2 rounded-xl transition-all"
          >
            <LogOut size={13} />
            <span className="hidden md:inline">{t("logOut")}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
