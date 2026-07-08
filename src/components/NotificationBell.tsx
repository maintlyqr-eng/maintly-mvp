"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Mail, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

// The dashboard header's bell, used across every dashboard page (same
// no-shared-layout convention as everything else here — each page owns its
// header, this component just gets dropped into all of them). Before this
// it was a purely decorative <Bell/> button with no badge and no dropdown.
// Facu's ask: "en la campanita del dashboard uno deberia ver q tiene un
// nuevo msj como notificacion" — this aggregates the two things that can
// actually notify a Maintler today: unread customer inquiries (the
// "Messages" nav item) and unread Team Chat messages from other Maintlers
// (the "Team Chat" nav item, which already carries its own sidebar badge —
// this is the second place Facu asked for the same signal to show up).
//
// The numeric badge count is passed in as props rather than computed here,
// because every page that renders this already calls
// useUnreadMessagesCount()/useUnreadMechanicMessages() for the sidebar nav
// badges — recomputing the same counts with a second pair of hook
// instances would mean duplicate queries and duplicate realtime
// subscriptions for no benefit. The dropdown's message *previews* (sender
// name + snippet), on the other hand, aren't something those count-only
// hooks expose, so this component does its own lightweight fetch for
// those, refetched whenever the dropdown opens or a relevant realtime
// event fires — kept intentionally simple (limit 8 each, refetch-on-event
// rather than hand-splicing state) since this is a preview list, not the
// source of truth for any page.
type Notification = {
  key: string;
  kind: "customer" | "team";
  title: string;
  body: string;
  createdAt: string;
  href: string;
};

function timeLabel(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export default function NotificationBell({
  mechanicId,
  unreadMessagesCount,
  unreadMechanicCount,
}: {
  mechanicId: string;
  unreadMessagesCount: number;
  unreadMechanicCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // The dropdown used to be positioned with plain Tailwind (`absolute
  // right-0 w-80`), anchored purely to this component's own little
  // `relative` wrapper. That looks right on desktop, where the wrapper
  // sits comfortably inside the header, but on a narrow phone screen the
  // 320px-wide panel can extend past the edge of the viewport — Facu's
  // report: "en la compu se ve bien pero en el celu queda fuera de
  // pantalla." Fixed positioning computed from the button's actual
  // on-screen position sidesteps that (and any per-page header layout
  // differences) instead of guessing a breakpoint-specific class.
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number } | null>(null);

  function computePanelPosition() {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(320, window.innerWidth - margin * 2);
    let left = rect.right - width; // align the panel's right edge under the bell, like before
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
      title: `New message from ${m.sender_name || "a customer"}`,
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
        .in("id", senderIds);
      const nameById: Record<string, string> = {};
      (senders ?? []).forEach((s) => { nameById[s.id] = s.workshop_name || s.name || s.email; });

      teamNotifs = teamMsgs.map((m) => ({
        key: `team-${m.id}`,
        kind: "team",
        title: `New message from ${nameById[m.sender_id] || "a Maintler"}`,
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

  // Fetch once up front so the dropdown isn't empty for a beat the first
  // time it's opened, then keep it live: any new unread customer message or
  // Team Chat message triggers a refetch. Simple refetch-on-event instead
  // of manually merging payloads into state — this is only ever an 8-item
  // preview list, not worth the stale-closure bookkeeping Team Chat's full
  // conversation list needs.
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

    // Mobile browsers can suspend a background tab's realtime connection
    // (screen lock, app switch); refetching whenever the tab becomes
    // active again means the preview list can't stay stale for longer
    // than it takes to glance back at it, regardless of the socket's own
    // reconnect timing. supabase.realtime.connect() nudges it along too.
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

  // Note on the "clicking a Team Chat notification sends me outside the
  // conversation" bug Facu reported: the actual fix lives in Team Chat's
  // own page, not here. router.push() to /dashboard/team-chat?with=<id>
  // does update the URL correctly even when you're already sitting on that
  // route with a different (or no) thread open — but the page's effect
  // that reads `with` and opens the matching thread only ran once on
  // mount, so a same-page query-string change was silently ignored. Team
  // Chat now has a dedicated effect keyed on useSearchParams() so it
  // reacts every time `with` changes, not just on first load.
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
            <p className="text-[13px] font-bold text-zinc-800">Notifications</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 && (
              <p className="px-4 py-6 text-center text-[12px] text-zinc-400">Loading…</p>
            )}
            {!loading && items.length === 0 && (
              <p className="px-4 py-6 text-center text-[12px] text-zinc-400">No new notifications</p>
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
