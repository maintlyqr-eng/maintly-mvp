"use client";

import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { useEffect } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import HoverAvatar from "@/components/HoverAvatar";
import ContactSupportWidgetIntl from "@/components/ContactSupportWidgetIntl";
import { navItems } from "@/lib/dashboardNav";
import { getInitials } from "@/lib/initials";
import { supabase } from "@/lib/supabase";

// The sidebar used by every dashboard page + admin now that the full
// Phase 2 i18n rollout is complete (see MAINTLYQR_FEATURE_BACKLOG.md). It
// used to exist as a twin of a plain (non-translated) DashboardSidebar,
// duplicated only because useTranslations() throws outside a
// NextIntlClientProvider and not every dashboard page was migrated yet.
// That old file has been deleted now that all 12 dashboard routes + admin
// are migrated — this is simply "the sidebar" going forward. Kept the
// "Intl" name rather than renaming, to avoid a churny rename across every
// consumer for no functional benefit.
//
// Two deliberate differences from the pre-i18n version, both fixing
// fragility that would otherwise break once labels are translated:
//   1. `activeHref` (compared against item.href) replaces `activeLabel`
//      (compared against item.label) for highlighting the current page —
//      href is stable across locales, a translated label is not.
//   2. The unread-badge checks compare item.key ("messages" / "teamChat")
//      instead of item.label === "Messages" / "Team Chat".
//
// Nav links now use next-intl's locale-aware Link — safe now that every
// dashboard route has a [locale] version, so no target 404s.
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

  // Stamps mechanics.last_active_at (migration 033) on every Dashboard page
  // load — this component renders on all 12 Dashboard pages, so it's the
  // one place that can track "still actually using the app" without
  // duplicating the same effect 12 times. Feeds "último acceso" in Gestión
  // de Maintlers (item 2 del pedido) and the active-user metrics in
  // Analytics (item 8). Fire-and-forget: a failed update here should never
  // block or visibly affect the page the mechanic is trying to use.
  useEffect(() => {
    if (!mechanicId) return;
    supabase.from("mechanics").update({ last_active_at: new Date().toISOString() }).eq("id", mechanicId)
      .then(({ error }) => { if (error) console.error("last_active_at stamp failed", error.message); });
  }, [mechanicId]);

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

        {/* Facu (16 jul 2026): this used to be `flex-1`, which forced the
            nav to stretch and fill all the leftover vertical space in the
            sidebar — pushing the support card + profile footer all the way
            down to the bottom edge with a big empty gap in between, even on
            a short nav list. Sized to content instead, so the support card
            sits right under the last nav item where there's actual room,
            not stranded at the bottom. `overflow-y-auto` stays as a safety
            net if the nav list ever grows past the viewport. */}
        <nav className="px-3 overflow-y-auto">
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

        {/* Facu (jul 2026): MaintlyQR is free for everyone, always -- no
            paid tier, ever. This used to be a "Go Premium / Upgrade Now"
            promo card here (never actually wired to anything -- the button
            had no onClick at all, it was pure mockup). Same call as the
            /pricing page rewrite: no UI anywhere should imply a future
            paywall. */}

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
