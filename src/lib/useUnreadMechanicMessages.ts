"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Small badge count for the "Team Chat" sidebar link, used across every
// dashboard page (mirrors useUnreadMessages.ts's pattern exactly). Counts
// unread mechanic-to-mechanic messages where the current mechanic is the
// recipient — separate from both the customer-inquiry "Messages" badge and
// the "Contact Support" widget's own admin-reply badge.
export function useUnreadMechanicMessages(mechanicId: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!mechanicId) return;
    let active = true;

    supabase
      .from("mechanic_messages")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", mechanicId)
      .eq("read", false)
      .then(({ count: c }) => { if (active) setCount(c ?? 0); });

    return () => { active = false; };
  }, [mechanicId]);

  return count;
}
