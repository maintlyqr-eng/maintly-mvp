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

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mechanicId]);

  useEffect(() => {
    if (!open) return;
    fetchNotifications();
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function goTo(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
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

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl border border-zinc-200 shadow-lg z-50 overflow-hidden">
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
