"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Small badge count for the "Team Chat" sidebar link, used across every
// dashboard page (mirrors useUnreadMessages.ts's pattern exactly). Counts
// unread mechanic-to-mechanic messages where the current mechanic is the
// recipient — separate from both the customer-inquiry "Messages" badge and
// the "Contact Support" widget's own admin-reply badge.
//
// Live, not just a one-time fetch: this badge was one of the "I have to
// refresh all the time" spots Facu called out — a message can arrive while
// looking at any dashboard page, not just Team Chat itself, so the count
// needs to update on its own via Supabase Realtime rather than only being
// correct right after a page load. Requires mechanic_messages to have
// REPLICA IDENTITY FULL and be in the supabase_realtime publication (see
// migration 022_maintler_saved_contacts_blocks_reports.sql) — without
// that, the UPDATE payload's `old` value wouldn't reliably carry the
// previous `read` value needed to detect "this just became read".
export function useUnreadMechanicMessages(mechanicId: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!mechanicId) return;
    let active = true;

    function refetchCount() {
      supabase
        .from("mechanic_messages")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", mechanicId)
        .eq("read", false)
        .then(({ count: c }) => { if (active) setCount(c ?? 0); });
    }

    refetchCount();

    const channel = supabase
      .channel(`unread-mechanic-messages-${mechanicId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mechanic_messages", filter: `recipient_id=eq.${mechanicId}` },
        () => { if (active) setCount((c) => c + 1); }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mechanic_messages", filter: `recipient_id=eq.${mechanicId}` },
        (payload) => {
          const wasUnread = (payload.old as { read?: boolean } | null)?.read === false;
          const isNowRead = (payload.new as { read?: boolean } | null)?.read === true;
          if (active && wasUnread && isNowRead) setCount((c) => Math.max(0, c - 1));
        }
      )
      .subscribe();

    // Mobile browsers can suspend a background tab's WebSocket (screen
    // lock, switching apps), leaving this count stale until something
    // forces a fresh read. Re-querying the true count whenever the tab
    // becomes active again (rather than trusting the +1/-1 realtime math
    // to have kept up) means this badge is never more than a glance away
    // from correct, even if the connection dropped out entirely while
    // backgrounded. supabase.realtime.connect() additionally nudges a
    // stale socket to reconnect right away instead of waiting on its own
    // retry timer.
    function onVisibilityChange() {
      if (document.visibilityState === "visible") { supabase.realtime.connect(); refetchCount(); }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", refetchCount);
    window.addEventListener("online", refetchCount);

    return () => {
      active = false;
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", refetchCount);
      window.removeEventListener("online", refetchCount);
    };
  }, [mechanicId]);

  return count;
}
