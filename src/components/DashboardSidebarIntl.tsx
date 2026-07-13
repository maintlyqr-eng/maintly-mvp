"use client";

import Link from "next/link";
import Image from "next/image";
import { X, Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import HoverAvatar from "@/components/HoverAvatar";
import ContactSupportWidgetIntl from "@/components/ContactSupportWidgetIntl";
import { navItems } from "@/lib/dashboardNav";
import { getInitials } from "@/lib/initials";

// Localized twin of src/components/DashboardSidebar.tsx — see that file's
// comment for the general "why one shared sidebar" history. This copy
// exists ONLY because useTranslations() throws when rendered outside a
// NextIntlClientProvider, and not every dashboard page is migrated to
// src/app/[locale]/dashboard/... yet (see MAINTLYQR_FEATURE_BACKLOG.md,
// Phase 2 rollout order). Each dashboard page switches its import from
// "@/components/DashboardSidebar" to "@/components/DashboardSidebarIntl"
// exactly when IT gets migrated — the old file keeps serving the
// not-yet-migrated pages untouched in the meantime. Once every dashboard
// page + admin has moved over, this becomes the only sidebar and the old
// one gets deleted (see the "Final cleanup" task in the backlog).
//
// Two deliberate differences from the original, both fixing fragility that
// would otherwise break once labels are translated:
//   1. `activeHref` (compared against item.href) replaces `activeLabel`
//      (compared against item.label) for highlighting the current page —
//      href is stable across locales, a translated label is not.
//   2. The unread-badge checks compare item.key ("messages" / "teamChat")
//      instead of item.label === "Messages" / "Team Chat".
//
// Nav links stay plain next/link (not next-intl's locale-aware Link) on
// purpose: this sidebar's nav visits all 12 dashboard routes, and until
// every one of them is migrated, a locale-aware Link here would 404 on
// whichever route isn't ready yet. All 12 get swapped to locale-aware Link
// together, in one pass, once the last one lands — see the "Final cleanup"
// backlog task. Until then, clicking a nav item to a not-yet-migrated page
// intentionally lands you on that page's plain English version, same as
// the established pattern used for the Maintler page's un-migrated targets.
export default function DashboardSidebarIntl({
  activeHref,
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
  activeHref: string;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  mechanicId: string;
  unreadMessages: number;
  unreadMechanicMessages: number;
  photoUrl: string;
  name: string;
  email: string;
  className?: string;
  hideSupportWidget?: boolean;
}) {
  const t = useTranslations("DashboardSidebar");
  const tNav = useTranslations("DashboardNav");
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
              key={item.key}
              href={item.href}
              onClick={onCloseSidebar}
              className={`flex items-center gap-3 px-3 py-[9px] rounded-lg mb-1 text-[13px] font-medium transition-colors ${
                item.href === activeHref
                  ? "bg-red-50 text-red-600 border-l-[3px] border-red-600 -ml-[1px]"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <item.icon size={16} />
              {tNav(item.key)}
              {item.key === "messages" && unreadMessages > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unreadMessages}</span>
              )}
              {item.key === "teamChat" && unreadMechanicMessages > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unreadMechanicMessages}</span>
              )}
            </Link>
          ))}
        </nav>

        {!hideSupportWidget && <ContactSupportWidgetIntl mechanicId={mechanicId} />}

        <div className="mx-3 mb-3 p-4 rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 border border-zinc-200">
          <div className="flex items-center gap-1.5 text-amber-500 mb-1">
            <Crown size={14} />
            <span className="text-[12px] font-bold text-zinc-800">{t("goPremium")}</span>
          </div>
          <p className="text-[10px] text-zinc-500 leading-relaxed mb-3">{t("goPremiumDesc")}</p>
          <button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-bold py-2 rounded-lg transition-colors">{t("upgradeNow")}</button>
        </div>

        <Link href="/dashboard/settings" className="flex items-center gap-2.5 px-4 py-3 border-t border-zinc-200 hover:bg-zinc-50 transition-colors">
          {photoUrl ? (
            <HoverAvatar src={photoUrl} size={32} className="shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[12px] shrink-0">{initials}</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-zinc-800 leading-tight truncate">{name || email}</p>
            <p className="text-[10px] text-zinc-400 leading-tight">{t("maintlyMaintler")}</p>
          </div>
        </Link>
      </aside>
    </>
  );
}
