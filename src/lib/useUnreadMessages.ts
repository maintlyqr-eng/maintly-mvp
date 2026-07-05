"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Small badge count for the "Messages" sidebar link, used across every
// dashboard page (they each manage their own auth/data, no shared layout).
// Counts unread customer inquiries ("messages" table) plus unread replies
// from the Control Center in the mechanic's own support thread.
export function useUnreadMessagesCount(mechanicId: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!mechanicId) return;
    let active = true;

    Promise.all([
      supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("mechanic_id", mechanicId)
        .eq("read", false),
      supabase
        .from("support_messages")
        .select("*", { count: "exact", head: true })
        .eq("mechanic_id", mechanicId)
        .eq("from_admin", true)
        .eq("read", false),
    ]).then(([inquiries, support]) => {
      if (active) setCount((inquiries.count ?? 0) + (support.count ?? 0));
    });

    return () => { active = false; };
  }, [mechanicId]);

  return count;
}
