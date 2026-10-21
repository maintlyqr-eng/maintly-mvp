"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import HoverAvatar from "@/components/HoverAvatar";
import ContactSupportWidgetIntl from "@/components/ContactSupportWidgetIntl";
import { navItems } from "@/lib/dashboardNav";
import { getInitials } from "@/lib/initials";
import { supabase } from "@/lib/supabase";
import { PROFESSION_KEYS } from "@/components/ProfessionVerificationFormIntl";

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
  const tProfessionTypes = useTranslations("ProfessionTypes");
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

  // Facu (17 jul 2026): "ahí debería decir Maintler Mecánico, dueño,
  // electricista, etc." — the footer used to always show the generic
  // "Maintler de MaintlyQR" tagline regardless of who was logged in. Fetches
  // this mechanic's own `profession` (same enum ProfessionVerificationForm
  // writes: Owner/Mechanic/Electrician/...) and shows the real role instead.
  // A plain SELECT here rather than threading a new prop through all 12
  // dashboard pages that render this sidebar — mechanicId is already
  // available, so this stays self-contained like the last_active_at stamp
  // above.
  const [profession, setProfession] = useState<string | null>(null);
  useEffect(() => {
    if (!mechanicId) return;
    let active = true;
    supabase.from("mechanics").select("profession").eq("id", mechanicId).single()
      .then(({ data }) => { if (active) setProfession((data as { profession: string | null } | null)?.profession ?? null); });
    return () => { active = false; };
  }, [mechanicId]);

  const professionLabel = profession && PROFESSION_KEYS[profession]
    ? t("maintlerWithProfession", { profession: tProfessionTypes(PROFESSION_KEYS[profession]) })
    : t("maintlyMaintler");

  return (
    <>
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={onCloseSidebar} />
      )}

      {/* ════ SIDEBAR ════ */}
      {/* Rediseño 21/10/2026: sidebar grafito (la pared de la oficina
          Maintly) con el engranaje rojo y el wordmark MAINTLYQR +
          "MAINTENANCE · TRACKED". Ítem activo con halo rojo tipo LED. */}
      <aside className={`${className} fixed md:static inset-y-0 left-0 z-40 w-[248px] bg-graphite flex flex-col shrink-0 transform transition-transform duration-200 md:translate-x-0 relative overflow-hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* engranaje marca de agua */}
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="0.8" className="pointer-events-none absolute -left-[120px] -bottom-[110px] w-[320px] h-[320px] opacity-[0.05]"><circle cx="12" cy="12" r="3.2"></circle><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"></path><circle cx="12" cy="12" r="7"></circle></svg>
        <div className="relative flex items-center justify-between px-5 pt-6 pb-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-[38px] h-[38px] rounded-full bg-graphite-2 flex items-center justify-center shrink-0 shadow-[inset_0_0_0_1px_#3A3F47,0_0_18px_rgba(224,36,43,0.25)]">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E0242B" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"></path><circle cx="12" cy="12" r="6.5"></circle></svg>
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[17px] font-extrabold tracking-[-0.02em] text-white">MAINTLY<span className="text-brand">QR</span></span>
              <span className="text-[9px] font-semibold tracking-[0.18em] text-steel mt-[3px]">MAINTENANCE · TRACKED</span>
            </span>
          </Link>
          <button onClick={onCloseSidebar} className="md:hidden text-steel-2 hover:text-white">
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
        <nav className="relative px-3 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              onClick={onCloseSidebar}
              className={`flex items-center gap-3 px-3 py-[10px] rounded-xl mb-0.5 text-[13.5px] transition-all ${
                item.href === activeHref
                  ? "bg-brand/15 text-white font-semibold shadow-[inset_0_0_0_1px_rgba(224,36,43,0.35),0_0_18px_rgba(224,36,43,0.22)]"
                  : "text-steel-2 font-medium hover:bg-graphite-2 hover:text-white"
              }`}
            >
              <item.icon size={17} className={item.href === activeHref ? "text-brand-glow" : ""} />
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

        <Link href="/dashboard/settings" className="relative mt-auto flex items-center gap-2.5 px-4 py-3 border-t border-graphite-line hover:bg-graphite-2 transition-colors">
          {photoUrl ? (
            <HoverAvatar src={photoUrl} size={32} className="shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-graphite-2 shadow-[inset_0_0_0_1px_#3A3F47] flex items-center justify-center text-white font-bold text-[12px] shrink-0">{initials}</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-semibold text-white leading-tight truncate">{name || email}</p>
            <p className="text-[10.5px] text-steel leading-tight">{professionLabel}</p>
          </div>
        </Link>
      </aside>
    </>
  );
}
