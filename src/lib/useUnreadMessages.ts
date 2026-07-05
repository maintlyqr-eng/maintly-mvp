"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Small badge count for the "Messages" sidebar link, used across every
// dashboard page (they each manage their own auth/data, no shared layout).
// Counts unread customer inquiries only — admin support replies have their
// own separate badge on the "Contact Support" widget.
export function useUnreadMessagesCount(mechanicId: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!mechanicId) return;
    let active = true;

    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("mechanic_id", mechanicId)
      .eq("read", false)
      .then(({ count: c }) => { if (active) setCount(c ?? 0); });

    return () => { active = false; };
  }, [mechanicId]);

  return count;
}
