"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Mail, MessageCircle } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { supabase } from "@/lib/supabase";

// Localized twin of src/components/NotificationBell.tsx — same reasoning as
// the other Dashboard*Intl components. router.push() targets
// ("/dashboard/messages", "/dashboard/team-chat?with=...") stay as plain
// next/navigation pushes since not every dashboard route is migrated yet;
// see DashboardSidebarIntl.tsx's comment for the full rationale.
//
// Time labels: the original hardcoded "es-AR" for toLocaleTimeString
// regardless of what the mechanic was actually reading in. This localized
// copy maps the active next-intl locale to a real locale tag instead, so
// the preview list's timestamps match whichever language is showing.
const TIME_LOCALE: Record<string, string> = { en: "en-US", es: "es-AR", pt: "pt-BR" };

type Notification = {
  key: string;
  kind: "customer" | "team";
  title: string;
  body: string;
  createdAt: string;
  href: string;
};

export default function NotificationBellIntl({
  mechanicId,
  unreadMessagesCount,
  unreadMechanicCount,
}: {
  mechanicId: string;
  unreadMessagesCount: number;
  unreadMechanicCount: number;
}) {
  const t = useTranslations("NotificationBell");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number } | null>(null);

  function timeLabel(iso: string) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(TIME_LOCALE[locale] ?? "en-US", { hour: "2-digit", minute: "2-digit" });
  }

  function computePanelPosition() {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(320, window.innerWidth - margin * 2);
    let left = rect.right - width;
    left = Math.min(left, window.innerWidth - width - margin);
    left = Math.max(left, margin);
    setPanelStyle({ top: rect.bottom + 8, left, width });
  }

  const totalUnread = unreadMessagesCount + unreadMechanicCount;

  async function fetchNotifications() {
    if (!mechanicId) return;
    setLoading(true);

    const [{ data: customerRows }, { data: teamRows }] = await Promise.all([
      supabase
        .from("messages")
        .select("id, sender_name, body, created_at")
        .eq("mechanic_id", mechanicId)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("mechanic_messages")
        .select("id, sender_id, body, created_at")
        .eq("recipient_id", mechanicId)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const customerNotifs: Notification[] = (customerRows ?? []).map((m) => ({
      key: `customer-${m.id}`,
      kind: "customer",
      title: t("newMessageFromCustomer", { name: m.sender_name || t("aCustomer") }),
      body: m.body,
      createdAt: m.created_at,
      href: "/dashboard/messages",
    }));

    let teamNotifs: Notification[] = [];
    const teamMsgs = teamRows ?? [];
    if (teamMsgs.length > 0) {
      const senderIds = Array.from(new Set(teamMsgs.map((m) => m.sender_id)));
      const { data: senders } = await supabase
        .from("mechanics")
        .select("id, name, workshop_name, email")
        .in("id", senderIds)
        .is("deleted_at", null);
      const nameById: Record<string, string> = {};
      (senders ?? []).forEach((s) => { nameById[s.id] = s.workshop_name || s.name || s.email; });

      teamNotifs = teamMsgs.map((m) => ({
        key: `team-${m.id}`,
        kind: "team",
        title: t("newMessageFromMaintler", { name: nameById[m.sender_id] || t("aMaintler") }),
        body: m.body,
        createdAt: m.created_at,
        href: `/dashboard/team-chat?with=${m.sender_id}`,
      }));
    }

    const merged = [...customerNotifs, ...teamNotifs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);

    setItems(merged);
    setLoading(false);
  }

  useEffect(() => {
    if (!mechanicId) return;
    fetchNotifications();

    const channel = supabase
      .channel(`dashboard-notifications-${mechanicId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `mechanic_id=eq.${mechanicId}` },
        () => fetchNotifications()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mechanic_messages", filter: `recipient_id=eq.${mechanicId}` },
        () => fetchNotifications()
      )
      .subscribe();

    function onVisibilityChange() {
      if (document.visibilityState === "visible") { supabase.realtime.connect(); fetchNotifications(); }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", fetchNotifications);
    window.addEventListener("online", fetchNotifications);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", fetchNotifications);
      window.removeEventListener("online", fetchNotifications);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mechanicId]);

  useEffect(() => {
    if (!open) return;
    fetchNotifications();
    computePanelPosition();

    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onResize() { computePanelPosition(); }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function goTo(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className="relative text-zinc-500 hover:text-zinc-800 transition-colors"
      >
        <Bell size={19} />
        {totalUnread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {open && panelStyle && (
        <div
          style={{ position: "fixed", top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
          className="bg-white rounded-2xl border border-zinc-200 shadow-lg z-50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-zinc-100">
            <p className="text-[13px] font-bold text-zinc-800">{t("notifications")}</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 && (
              <p className="px-4 py-6 text-center text-[12px] text-zinc-400">{t("loading")}</p>
            )}
            {!loading && items.length === 0 && (
              <p className="px-4 py-6 text-center text-[12px] text-zinc-400">{t("noNewNotifications")}</p>
            )}
            {items.map((n) => (
              <button
                key={n.key}
                onClick={() => goTo(n.href)}
                className="w-full flex items-start gap-2.5 px-4 py-3 hover:bg-zinc-50 text-left border-b border-zinc-50 last:border-b-0"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${n.kind === "team" ? "bg-red-50" : "bg-blue-50"}`}>
                  {n.kind === "team" ? <MessageCircle size={13} className="text-red-500" /> : <Mail size={13} className="text-blue-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-zinc-800 truncate">{n.title}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{n.body}</p>
                </div>
                <span className="text-[10px] text-zinc-400 shrink-0 mt-0.5">{timeLabel(n.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
