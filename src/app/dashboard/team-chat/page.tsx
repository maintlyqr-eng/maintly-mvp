"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings, Bell, X, LogOut, Crown, Menu,
  MessageCircle, Search, Send, Trash2, ArrowLeft, Plus, UserCircle2,
  Star, Ban, Flag,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import NotificationBell from "@/components/NotificationBell";
import HoverAvatar from "@/components/HoverAvatar";
import ContactSupportWidget from "@/components/ContactSupportWidget";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { formatDateDMY } from "@/lib/date";

// Mechanic-to-mechanic direct messaging — a second, independent inbox from
// the customer-facing "Messages" page. Mirrors ContactSupportWidget.tsx's
// bubble/soft-delete/mark-read conventions, but unlike that widget there's
// no fixed single counterparty ("the admin") to imply here, so this page
// adds a real conversation list plus a mechanic-search picker to start new
// threads (mechanics are publicly SELECT-able per RLS on public.mechanics,
// so the picker queries mechanics directly — no new API route needed).
//
// Messaging is deliberately OPEN — any Maintler can write to any other
// Maintler, no approval step. Facu's own words on why the first version
// (a mutual request/accept "Connections" model) was wrong: "uno tiene que
// primero enviarle solicitud para que se habilite el chat y eso no me
// gusta... deberia uno poder escribirle derecho nomas y poder agregarlo
// como amigo". So "saving" a Maintler is now a one-directional, instant
// bookmark (see maintler_saved_contacts, migration 022) — not a
// relationship the other person has to approve. The actual answer to "I
// don't want messages from this person" is Block (enforced for real at
// the database level, see the mechanic_messages insert policy in the same
// migration) and Report (flows into the Admin Control Center).

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/dashboard" },
  { icon: FileText, label: "My Services", href: "/dashboard/services" },
  { icon: Bell, label: "Scheduled Services", href: "/dashboard/scheduled" },
  { icon: Box, label: "Assets", href: "/dashboard/assets" },
  { icon: QrCode, label: "QR Codes", href: "/dashboard/qr-codes" },
  { icon: Users, label: "Customers", href: "/dashboard/customers" },
  { icon: BarChart3, label: "Reports", href: "/dashboard/reports" },
  { icon: CalendarIcon, label: "Calendar", href: "/dashboard/calendar" },
  { icon: Mail, label: "Messages", href: "/dashboard/messages" },
  { icon: MessageCircle, label: "Team Chat", href: "/dashboard/team-chat" },
  { icon: FolderOpen, label: "Document Library", href: "/dashboard/documents" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

type MechanicInfo = {
  id: string;
  name: string;
  email: string;
  workshop_name: string | null;
  photo_url: string | null;
};

type MsgRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read: boolean;
  created_at: string;
};

type ConversationSummary = {
  counterparty: MechanicInfo;
  lastBody: string;
  lastAt: string;
  lastFromMe: boolean;
  unread: number;
};

type SavedContactRow = {
  id: string;
  owner_id: string;
  saved_id: string;
  created_at: string;
};

type SavedContact = {
  id: string;
  contact: MechanicInfo;
  createdAt: string;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function initialsOf(name: string | null | undefined, fallback: string) {
  const n = (name && name.trim()) || fallback;
  return n.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "ME";
}

function displayName(m: MechanicInfo) {
  return m.workshop_name || m.name || m.email;
}

function TeamChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mechanicId, setMechanicId] = useState("");
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicPhoto, setMechanicPhoto] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [maintlerCode, setMaintlerCode] = useState("");

  const unreadMessages = useUnreadMessagesCount(mechanicId);
  // No useUnreadMechanicMessages() call on this page — unlike the other 11
  // dashboard pages, Team Chat already tracks a race-free unread count of
  // its own (`totalUnread`, derived from `conversations` below), so it uses
  // that everywhere instead. See the comment by the "Team Chat" nav badge
  // further down for why.

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<MechanicInfo | null>(null);
  const [thread, setThread] = useState<MsgRow[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [confirmDeleteThread, setConfirmDeleteThread] = useState(false);

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<MechanicInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [activeTab, setActiveTab] = useState<"chats" | "network">("chats");
  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([]);
  const [savedContactsLoading, setSavedContactsLoading] = useState(true);
  const [savedActionError, setSavedActionError] = useState("");

  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blockActionError, setBlockActionError] = useState("");

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState("");

  // Realtime message-event callbacks are registered once (see the
  // subscription effect below) and would otherwise close over stale state
  // from whichever render they were created in. A ref always reads the
  // latest selected conversation without re-subscribing on every click.
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // Same idea, for the visibility-regain catch-up effect further down,
  // which needs the *full* MechanicInfo (not just the id) to re-open the
  // conversation via openConversation().
  const selectedInfoRef = useRef<MechanicInfo | null>(null);
  useEffect(() => { selectedInfoRef.current = selectedInfo; }, [selectedInfo]);

  // Guards the tab-refocus resync effect further down against running
  // twice at once — visibilitychange and focus routinely fire back-to-back
  // (practically simultaneously) when a browser tab regains focus, which
  // used to fire two full resync() passes concurrently. See that effect's
  // comment for the actual bug this was tangled up in.
  const resyncInFlightRef = useRef(false);

  // Now that the thread pane scrolls internally instead of the whole page
  // (see the h-dvh layout fix above), it needs to actually land on the
  // newest message on its own — otherwise opening a conversation would
  // show you the *oldest* messages first, which is arguably worse than
  // the old scroll-the-whole-page behavior.
  //
  // This went through two earlier cuts that both still left Facu having
  // to scroll manually sometimes: scrollIntoView() on a sentinel div (too
  // unreliable about which ancestor it decides to scroll), then a plain
  // scrollTop = scrollHeight in a useLayoutEffect (fixed the manual-click
  // case, but arriving via the notification bell — a fresh page load —
  // still needed a scroll). The bell case's remaining gap: right after
  // the thread first renders, things like the counterparty's avatar image
  // in the header are still loading over the network, and when they
  // finish they can shift the page's layout — including the message
  // container's scrollable height — *after* this effect already set
  // scrollTop once. A plain effect has no way to know content grew later.
  //
  // A ResizeObserver on the actual message content (not the scroll
  // container itself, whose own box size is fixed by the flex layout —
  // it's the inner content that grows) re-applies the same scroll
  // whenever the content's real height changes, for any reason, at any
  // time — not just once, right after this effect runs. `stickToBottomRef`
  // keeps this from fighting a Maintler who's deliberately scrolled up to
  // read older messages: it's reset to "yes, stay pinned" whenever a
  // different conversation is opened or a message is sent, and cleared as
  // soon as a scroll away from the bottom is detected.
  const threadContainerRef = useRef<HTMLDivElement>(null);
  const threadContentRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  function scrollThreadToBottom() {
    const el = threadContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  // Opening a (possibly different) conversation should always start
  // pinned to its latest message, regardless of where a previous
  // conversation was left scrolled.
  useLayoutEffect(() => {
    stickToBottomRef.current = true;
  }, [selectedId]);

  useLayoutEffect(() => {
    if (stickToBottomRef.current) scrollThreadToBottom();
  }, [thread, selectedId, threadLoading]);

  useEffect(() => {
    const contentEl = threadContentRef.current;
    if (!contentEl) return;
    const ro = new ResizeObserver(() => {
      if (stickToBottomRef.current) scrollThreadToBottom();
    });
    ro.observe(contentEl);
    return () => ro.disconnect();
  }, [selectedId]);

  function handleThreadScroll() {
    const el = threadContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  }

  async function loadConversations(myId: string) {
    setConversationsLoading(true);
    const { data } = await supabase
      .from("mechanic_messages")
      .select("id, sender_id, recipient_id, body, read, created_at")
      .or(`and(sender_id.eq.${myId},hidden_for_sender.eq.false),and(recipient_id.eq.${myId},hidden_for_recipient.eq.false)`)
      .order("created_at", { ascending: false });

    const rows = (data as MsgRow[]) ?? [];

    // Rows arrive newest-first, so the first row seen per counterparty is
    // already their latest message — no extra sort needed to find it.
    const agg = new Map<string, { lastBody: string; lastAt: string; lastFromMe: boolean; unread: number }>();
    for (const m of rows) {
      const counterpartyId = m.sender_id === myId ? m.recipient_id : m.sender_id;
      const existing = agg.get(counterpartyId);
      const isUnreadForMe = m.recipient_id === myId && !m.read;
      if (!existing) {
        agg.set(counterpartyId, {
          lastBody: m.body,
          lastAt: m.created_at,
          lastFromMe: m.sender_id === myId,
          unread: isUnreadForMe ? 1 : 0,
        });
      } else if (isUnreadForMe) {
        existing.unread += 1;
      }
    }

    const ids = Array.from(agg.keys());
    if (ids.length === 0) {
      setConversations([]);
      setConversationsLoading(false);
      return;
    }

    const { data: mechanicsData } = await supabase
      .from("mechanics")
      .select("id, name, email, workshop_name, photo_url")
      .in("id", ids);

    const infoById = new Map((mechanicsData as MechanicInfo[] ?? []).map((mm) => [mm.id, mm]));

    const list = ids
      .map((id) => {
        const info = infoById.get(id);
        const a = agg.get(id)!;
        if (!info) return null;
        // A conversation that's actively open on screen should never come
        // back from this fetch showing as unread, no matter what the
        // database's `read` flag says at the exact instant this query ran.
        // Marking a thread's messages read (see openConversation below) is
        // a separate async write that can still be in flight — and this
        // function itself gets re-run from the tab-refocus resync effect
        // further down, which fires on every alt-tab, app switch, or phone
        // unlock. Facu's report: "aunque este en el chat a veces aparece
        // la notificacion... esto pasa en la compu y en el celu" — exactly
        // that race, on both platforms, since both trigger the same
        // focus/visibilitychange listeners. Deriving unread straight from
        // selectedIdRef here means the result is correct regardless of
        // whether this fetch or the read-marking write lands first.
        const unread = id === selectedIdRef.current ? 0 : a.unread;
        return { counterparty: info, ...a, unread };
      })
      .filter((x): x is ConversationSummary => !!x)
      .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));

    setConversations(list);
    setConversationsLoading(false);
  }

  async function loadSavedContacts(myId: string) {
    setSavedContactsLoading(true);
    const { data } = await supabase
      .from("maintler_saved_contacts")
      .select("id, owner_id, saved_id, created_at")
      .eq("owner_id", myId)
      .order("created_at", { ascending: false });

    const rows = (data as SavedContactRow[]) ?? [];
    const ids = rows.map((r) => r.saved_id);

    if (ids.length === 0) {
      setSavedContacts([]);
      setSavedContactsLoading(false);
      return;
    }

    const { data: mechanicsData } = await supabase
      .from("mechanics")
      .select("id, name, email, workshop_name, photo_url")
      .in("id", ids);

    const infoById = new Map((mechanicsData as MechanicInfo[] ?? []).map((mm) => [mm.id, mm]));

    const list = rows
      .map((r) => {
        const info = infoById.get(r.saved_id);
        return info ? { id: r.id, contact: info, createdAt: r.created_at } : null;
      })
      .filter((x): x is SavedContact => !!x);

    setSavedContacts(list);
    setSavedContactsLoading(false);
  }

  async function loadBlocks(myId: string) {
    const { data } = await supabase
      .from("maintler_blocks")
      .select("blocked_id")
      .eq("blocker_id", myId);
    setBlockedIds(new Set(((data as { blocked_id: string }[]) ?? []).map((r) => r.blocked_id)));
  }

  function isSaved(id: string) {
    return savedContacts.some((c) => c.contact.id === id);
  }

  async function saveContact(target: MechanicInfo) {
    setSavedActionError("");
    const { data, error: err } = await supabase
      .from("maintler_saved_contacts")
      .insert({ owner_id: mechanicId, saved_id: target.id })
      .select("id, owner_id, saved_id, created_at");
    if (err || !data || data.length === 0) {
      setSavedActionError("Couldn't save this Maintler. Try again.");
      return;
    }
    const row = data[0] as SavedContactRow;
    setSavedContacts((prev) => [{ id: row.id, contact: target, createdAt: row.created_at }, ...prev]);
  }

  async function unsaveContactByTargetId(targetId: string) {
    const existing = savedContacts.find((c) => c.contact.id === targetId);
    setSavedContacts((prev) => prev.filter((c) => c.contact.id !== targetId));
    if (existing) {
      await supabase.from("maintler_saved_contacts").delete().eq("id", existing.id);
    } else {
      await supabase.from("maintler_saved_contacts").delete().eq("owner_id", mechanicId).eq("saved_id", targetId);
    }
  }

  async function toggleSaved(target: MechanicInfo) {
    if (isSaved(target.id)) {
      await unsaveContactByTargetId(target.id);
    } else {
      await saveContact(target);
    }
  }

  async function handleBlock(targetId: string) {
    setBlockActionError("");
    setConfirmBlock(false);
    const { error: err } = await supabase.from("maintler_blocks").insert({ blocker_id: mechanicId, blocked_id: targetId });
    if (err) {
      setBlockActionError("Couldn't block this Maintler. Try again.");
      return;
    }
    setBlockedIds((prev) => new Set(prev).add(targetId));
  }

  async function handleUnblock(targetId: string) {
    setBlockActionError("");
    setBlockedIds((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
    await supabase.from("maintler_blocks").delete().eq("blocker_id", mechanicId).eq("blocked_id", targetId);
  }

  async function handleSubmitReport() {
    if (!selectedId) return;
    setReportSending(true);
    setReportError("");
    const { error: err } = await supabase
      .from("mechanic_reports")
      .insert({ reporter_id: mechanicId, reported_id: selectedId, reason: reportReason.trim() || null });
    setReportSending(false);
    if (err) {
      setReportError("Couldn't send the report. Try again.");
      return;
    }
    setReportOpen(false);
    setReportReason("");
    setReportSent(true);
    setTimeout(() => setReportSent(false), 4000);
  }

  useEffect(() => {
    let active = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      if (!active) return;

      setMechanicId(session.user.id);
      setMechanicEmail(session.user.email ?? "");

      const { data: mechanic } = await supabase
        .from("mechanics").select("name, photo_url, maintler_code").eq("id", session.user.id).single();
      if (active && mechanic) { setMechanicName(mechanic.name); setMechanicPhoto(mechanic.photo_url ?? ""); setMaintlerCode(mechanic.maintler_code ?? ""); }

      await loadConversations(session.user.id);
      await loadSavedContacts(session.user.id);
      await loadBlocks(session.user.id);
      if (active) setCheckingAuth(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [router]);

  // Deep link from the notification bell (or anywhere else) —
  // /dashboard/team-chat?with=<mechanicId> should open straight into that
  // conversation. This used to live inline inside the auth-init effect
  // above, which only ever runs once on mount — so if you were *already*
  // sitting on this page and clicked a new notification, router.push()
  // updated the URL but nothing re-ran to open the matching thread, and
  // you stayed wherever you were ("me manda afuera de la conversación en
  // vez de adentro"). Keying a dedicated effect on searchParams instead
  // means it fires every time `with` changes, not just on first load.
  // router.replace() afterwards clears the query param so re-clicking the
  // same notification later (or a stale bookmarked link) still triggers a
  // real change next time instead of silently no-op'ing.
  //
  // Also waits for `!conversationsLoading` before opening anything — Facu's
  // next report: the unread "1" badge on the conversation (and on the
  // "Chats" tab) stayed stuck even after opening the thread from a
  // notification. openConversation() clears a conversation's unread count
  // by updating it inside the *existing* `conversations` array in local
  // state; on a fresh page load, this effect and loadConversations() (in
  // the auth-init effect above) both kick off around the same time, and if
  // openConversation() ran first it was zeroing out a row that didn't
  // exist yet in `conversations` — a no-op — and loadConversations()'s own
  // fetch then overwrote state with the still-unread count it had already
  // read from the database moments earlier. Waiting for the initial list
  // load to finish first means the row genuinely exists by the time it
  // needs zeroing, and nothing runs afterward to stomp on it.
  //
  // Also waits for `!checkingAuth` — Facu's next-next report: arriving via
  // the bell still landed in the right conversation, but not scrolled to
  // the latest message like a manual click does. conversationsLoading
  // flips to false *before* checkingAuth does (loadConversations runs,
  // then loadSavedContacts/loadBlocks, then checkingAuth is cleared), so
  // this effect was calling openConversation() while the component was
  // still rendering its "Loading…" placeholder — the real thread panel,
  // and the scrollable message container the auto-scroll effect depends
  // on, didn't exist in the DOM yet. The thread loaded correctly, but the
  // scroll-to-bottom effect ran against a `null` ref and never got a
  // second chance to fire once the real panel finally mounted, since none
  // of its own dependencies changed again afterward. Waiting for the page
  // to actually finish loading before opening anything means the message
  // container is already there when openConversation() sets the thread.
  useEffect(() => {
    const withId = searchParams.get("with");
    if (!withId || !mechanicId || withId === mechanicId || withId === selectedId) return;
    if (conversationsLoading || checkingAuth) return;

    let active = true;
    (async () => {
      const { data: info } = await supabase
        .from("mechanics")
        .select("id, name, email, workshop_name, photo_url")
        .eq("id", withId)
        .single();
      if (active && info) {
        openConversation(info as MechanicInfo);
        router.replace("/dashboard/team-chat", { scroll: false });
      }
    })();

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, mechanicId, conversationsLoading, checkingAuth]);

  // Live delivery — Facu's feedback: Team Chat felt dead, needing a manual
  // refresh to see anything new. This subscribes to Supabase Realtime for
  // messages landing in MY inbox: if the sender is the conversation
  // currently open, append it straight into the thread and mark it read
  // immediately (the thread is visibly open, so there's nothing to leave
  // unread); otherwise bump that conversation's unread count and preview
  // (or add a brand-new conversation entry if this is the first message
  // from someone who isn't in the list yet).
  useEffect(() => {
    if (!mechanicId) return;

    const channel = supabase
      .channel(`team-chat-incoming-${mechanicId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mechanic_messages", filter: `recipient_id=eq.${mechanicId}` },
        (payload) => {
          const m = payload.new as MsgRow;
          const threadIsOpen = selectedIdRef.current === m.sender_id;

          if (threadIsOpen) {
            setThread((prev) => [...prev, { ...m, read: true }]);
            supabase.from("mechanic_messages").update({ read: true }).eq("id", m.id);
          }

          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.counterparty.id === m.sender_id);
            if (idx === -1) {
              // First message ever from this person — fetch their info
              // async and splice them into the list once it resolves.
              supabase
                .from("mechanics")
                .select("id, name, email, workshop_name, photo_url")
                .eq("id", m.sender_id)
                .single()
                .then(({ data: info }) => {
                  if (!info) return;
                  setConversations((p2) => {
                    if (p2.some((c) => c.counterparty.id === m.sender_id)) return p2;
                    return [{
                      counterparty: info as MechanicInfo,
                      lastBody: m.body,
                      lastAt: m.created_at,
                      lastFromMe: false,
                      unread: threadIsOpen ? 0 : 1,
                    }, ...p2];
                  });
                });
              return prev;
            }
            const next = [...prev];
            const [moved] = next.splice(idx, 1);
            return [{
              ...moved,
              lastBody: m.body,
              lastAt: m.created_at,
              lastFromMe: false,
              unread: threadIsOpen ? 0 : moved.unread + 1,
            }, ...next];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [mechanicId]);

  // Mobile follow-up, same day: "en la compu perfecto en el celu... a
  // veces no llega al toque el msj sino q tengo q refrescar... y salgo de
  // la conversacion y ahi me aparece la notificacion en la campanita."
  // Mobile browsers routinely suspend or heavily throttle a background
  // tab's JavaScript — locking the screen, switching apps, even just the
  // OS deciding to deprioritize an inactive tab — and a long-lived
  // WebSocket like Supabase Realtime's can go quietly stale during that
  // time. It usually reconnects on its own, but not always immediately,
  // which explains both halves of the report: a message sent while the
  // connection was stale doesn't show up until something forces a fresh
  // fetch (a manual page reload), and by the time Facu left Team Chat for
  // another page, the connection (or that page's own separate fetch) had
  // caught up, so the bell finally showed it there instead.
  //
  // Rather than trying to detect and repair the WebSocket's internal
  // state, this uses the standard fix for exactly this class of problem:
  // re-sync straight from the database whenever the tab becomes the
  // active one again, so a stale realtime connection can never leave
  // Facu looking at outdated data for longer than it takes to switch back
  // to the tab. `supabase.realtime.connect()` additionally nudges the
  // socket to reconnect right away rather than waiting for its own
  // internal retry timer.
  // Follow-up bug found after the mobile resync fix above shipped: "hay
  // algun tema con las notificaciones xq aunque este en el chat a veces
  // aparece la notificacion o a veces salgo del chat y me aparece
  // notificacion de algun msj q ya vi... esto pasa en la compu y en el
  // celu." Root cause was actually introduced by this very effect: resync()
  // fired loadConversations() (a fresh, authoritative read straight from
  // the database) and openConversation() (which re-marks the open thread's
  // messages as read) at the same time, without waiting for either to
  // finish. Whichever of the two happened to resolve LAST won the final
  // setConversations() call — and if a message had arrived only moments
  // before the resync (visibilitychange + focus fire on essentially every
  // alt-tab, app switch, or screen unlock, on both desktop and mobile), the
  // read-marking write might not have committed to the database yet, so
  // loadConversations() would legitimately still see it as unread. If that
  // stale read landed after openConversation()'s corrective zero, the
  // badge would flash back on for a conversation Facu was already looking
  // at — explaining both halves of the report (still inside the chat, or
  // just having stepped out of it) on both platforms, since both trigger
  // the exact same listeners here.
  //
  // Fixed at the source in loadConversations() itself (see the `unread =
  // id === selectedIdRef.current ? 0 : a.unread` line above) — it no
  // longer trusts the database's read flag at all for whichever
  // conversation is currently open, so the result is correct regardless of
  // which of these two calls finishes first. Sequencing them here too
  // (await one, then the other) and guarding against the visibilitychange
  // + focus double-fire with resyncInFlightRef just avoids doing the same
  // network round-trips twice for no reason — belt and suspenders, not
  // load-bearing for correctness anymore.
  useEffect(() => {
    if (!mechanicId) return;

    async function resync() {
      if (resyncInFlightRef.current) return;
      resyncInFlightRef.current = true;
      try {
        supabase.realtime.connect();
        await loadConversations(mechanicId);
        if (selectedInfoRef.current) await openConversation(selectedInfoRef.current);
      } finally {
        resyncInFlightRef.current = false;
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") resync();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", resync);
    window.addEventListener("online", resync);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", resync);
      window.removeEventListener("online", resync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mechanicId]);

  // Maintler search for starting a new conversation, debounced. Guards
  // against special characters (",", "(", ")", "*") in the term breaking
  // the PostgREST .or() filter string.
  //
  // IMPORTANT: inside a PostgREST .or()/.and() combinator string, the
  // wildcard for ilike/like must be written as "*", NOT "%" — "%" is what
  // you use for a plain single-column .ilike() call, but embedded in the
  // or= filter tree PostgREST reads "*" as the wildcard instead (this is
  // documented PostgREST behavior, not a supabase-js quirk). Using "%"
  // here silently searched for literal percent signs and never matched
  // anything.
  //
  // No "browse everyone with an empty box" — tried that right after fixing
  // the RLS read issue, but Facu's own follow-up feedback was that dumping
  // every Maintler on the platform the moment the modal opens doesn't
  // scale once there are hundreds/thousands of them. Requires a minimum
  // length before querying at all.
  const MIN_SEARCH_LENGTH = 3;

  useEffect(() => {
    if (!newChatOpen) return;
    const term = searchTerm.trim().replace(/[,()*]/g, "");
    if (term.length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setSearching(false);
      setSearchError("");
      return;
    }

    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data, error: searchErr } = await supabase
        .from("mechanics")
        .select("id, name, email, workshop_name, photo_url")
        .neq("id", mechanicId)
        .or(`name.ilike.*${term}*,email.ilike.*${term}*,workshop_name.ilike.*${term}*`)
        .limit(8);

      if (active) {
        if (searchErr) {
          console.error("[team-chat] mechanic search error:", searchErr);
          setSearchError(searchErr.message || "Search failed — check the browser console for details.");
        } else {
          setSearchError("");
        }
        setSearchResults((data as MechanicInfo[]) ?? []);
        setSearching(false);
      }
    }, 300);

    return () => { active = false; clearTimeout(t); };
  }, [searchTerm, newChatOpen, mechanicId]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function openConversation(info: MechanicInfo) {
    setSelectedInfo(info);
    setSelectedId(info.id);
    setThreadLoading(true);
    setComposeError("");
    setConfirmDeleteThread(false);
    setConfirmBlock(false);
    setReportOpen(false);
    setReportReason("");
    setReportError("");

    const { data } = await supabase
      .from("mechanic_messages")
      .select("id, sender_id, recipient_id, body, read, created_at")
      .or(
        `and(sender_id.eq.${mechanicId},recipient_id.eq.${info.id},hidden_for_sender.eq.false),` +
        `and(sender_id.eq.${info.id},recipient_id.eq.${mechanicId},hidden_for_recipient.eq.false)`
      )
      .order("created_at", { ascending: true });

    const rows = (data as MsgRow[]) ?? [];
    setThread(rows);
    setThreadLoading(false);

    const unreadIds = rows.filter((m) => m.recipient_id === mechanicId && !m.read).map((m) => m.id);
    if (unreadIds.length > 0) {
      setThread((prev) => prev.map((m) => (unreadIds.includes(m.id) ? { ...m, read: true } : m)));
      setConversations((prev) => prev.map((c) => (c.counterparty.id === info.id ? { ...c, unread: 0 } : c)));
      await supabase.from("mechanic_messages").update({ read: true }).in("id", unreadIds);
    }
  }

  function startNewConversation(info: MechanicInfo) {
    setNewChatOpen(false);
    setSearchTerm("");
    setSearchResults([]);
    openConversation(info);
  }

  function backToList() {
    setSelectedId(null);
    setSelectedInfo(null);
    setThread([]);
  }

  async function handleSend() {
    if (!body.trim() || !selectedId) return;
    const text = body.trim();
    setSending(true);
    setComposeError("");
    // Sending should always land you on your own new message, even if
    // you'd scrolled up to read older ones first — same as WhatsApp.
    stickToBottomRef.current = true;
    const { data, error: err } = await supabase
      .from("mechanic_messages")
      .insert({ sender_id: mechanicId, recipient_id: selectedId, body: text })
      .select("id, sender_id, recipient_id, body, read, created_at");
    setSending(false);
    if (err || !data || data.length === 0) {
      // A blocked pair fails this insert at the RLS level (see migration
      // 022) — the raw Postgrest error is a generic policy-violation
      // message, so show something a Maintler would actually understand
      // instead of the SQL wording.
      setComposeError(
        err && /row-level security|policy/i.test(err.message ?? "")
          ? "This message couldn't be delivered."
          : "Couldn't send your message. Try again."
      );
      return;
    }
    const newMsg = data[0] as MsgRow;
    setThread((prev) => [...prev, newMsg]);
    setBody("");

    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.counterparty.id === selectedId);
      const patch = { lastBody: text, lastAt: newMsg.created_at, lastFromMe: true, unread: 0 };
      if (idx === -1) {
        if (!selectedInfo) return prev;
        return [{ counterparty: selectedInfo, ...patch }, ...prev];
      }
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      return [{ ...moved, ...patch }, ...next];
    });
  }

  async function handleDeleteThread() {
    if (!selectedId) return;
    const counterpartyId = selectedId;
    setThread([]);
    setConversations((prev) => prev.filter((c) => c.counterparty.id !== counterpartyId));
    backToList();
    await supabase.from("mechanic_messages").update({ hidden_for_sender: true }).eq("sender_id", mechanicId).eq("recipient_id", counterpartyId);
    await supabase.from("mechanic_messages").update({ hidden_for_recipient: true }).eq("recipient_id", mechanicId).eq("sender_id", counterpartyId);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">Loading...</p>
      </div>
    );
  }

  const initials = initialsOf(mechanicName, mechanicEmail) || "ME";
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);
  const selectedIsBlocked = !!(selectedId && blockedIds.has(selectedId));

  return (
    // Every other dashboard page uses min-h-screen (the whole page scrolls
    // naturally, which is fine for lists/forms). Team Chat is the one page
    // that needs the WhatsApp-style app-shell layout Facu asked for: "cada
    // vez q escribo tengo q escrolear para ir a la barrita de escritura,
    // esa deberia estar siempre fija." min-h-screen only sets a *minimum*
    // height — it doesn't cap the page at the viewport, so once a
    // conversation grew past one screen's worth of messages the whole
    // page (not just the message list) got taller than the viewport, and
    // reaching the compose bar meant scrolling the entire browser window.
    //
    // h-dvh (not h-screen) on purpose: h-screen is `height: 100vh`, and on
    // mobile browsers 100vh is measured against the *largest* possible
    // viewport — the one you get once the address bar auto-hides. Right
    // after loading the page, with the address bar still showing, the
    // real visible area is shorter than 100vh, so the bottom of an
    // h-screen layout (the compose bar) sits partly under that bar until
    // the page is nudged and the browser collapses it — exactly what Facu
    // reported: "hay que mover un poco la pantalla para arriba para
    // llegar a la barrita." h-dvh uses the *dynamic* viewport height
    // instead, which tracks the address bar's real state, so the compose
    // bar is fully visible immediately, no nudge needed.
    <div className="h-dvh bg-zinc-50 flex relative overflow-hidden">

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ════ SIDEBAR ════ */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-[230px] bg-white border-r border-zinc-200 flex flex-col shrink-0 transform transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-2">
          <Link href="/" className="flex items-center">
            <Image src="/images/maintly-logo-full.png" alt="MaintlyQR" width={244} height={72} priority style={{ objectFit: "contain" }} />
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-400 hover:text-zinc-700 mr-2">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 min-h-0 px-3 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-[9px] rounded-lg mb-1 text-[13px] font-medium transition-colors ${
                item.label === "Team Chat"
                  ? "bg-red-50 text-red-600 border-l-[3px] border-red-600 -ml-[1px]"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <item.icon size={16} />
              {item.label}
              {item.label === "Messages" && unreadMessages > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unreadMessages}</span>
              )}
              {/* Uses totalUnread (derived from this page's own `conversations`
                  state), not the useUnreadMechanicMessages() hook every
                  other dashboard page uses for this badge — Facu's report:
                  sitting inside a conversation and getting a
                  new message from that same person still briefly flashed
                  "1" here (and on the bell) even though the message was
                  visibly right there on screen. The hook increments
                  optimistically the instant the INSERT event arrives and
                  only corrects itself once a separate follow-up UPDATE
                  (marking the message read) round-trips back — a real gap
                  where the count is momentarily wrong. `totalUnread` has no
                  such gap: the realtime handler that builds `conversations`
                  already knows synchronously, in the same event, whether
                  the message's thread is the one currently open, and never
                  counts it as unread in the first place. Only this page has
                  that context, so this substitution is local to Team Chat —
                  the other 11 pages keep using the hook, which is correct
                  there (no open conversation to exclude). */}
              {item.label === "Team Chat" && totalUnread > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{totalUnread}</span>
              )}
            </Link>
          ))}
        </nav>

        <ContactSupportWidget mechanicId={mechanicId} />

        <div className="mx-3 mb-3 p-4 rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 border border-zinc-200">
          <div className="flex items-center gap-1.5 text-amber-500 mb-1">
            <Crown size={14} />
            <span className="text-[12px] font-bold text-zinc-800">Go Premium</span>
          </div>
          <p className="text-[10px] text-zinc-500 leading-relaxed mb-3">Unlock advanced reports, custom branding and more.</p>
          <button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-bold py-2 rounded-lg transition-colors">Upgrade Now</button>
        </div>

        <div className="flex items-center gap-2.5 px-4 py-3 border-t border-zinc-200">
          <Link href="/dashboard/settings" className="shrink-0">
            {mechanicPhoto ? (
              <HoverAvatar src={mechanicPhoto} size={32} />
            ) : (
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[12px]">{initials}</div>
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-zinc-800 leading-tight truncate">{mechanicName || mechanicEmail}</p>
            <p className="text-[10px] text-zinc-400 leading-tight">Maintly Maintler</p>
          </div>
        </div>
      </aside>

      {/* ════ MAIN ════ */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

        <header className="flex items-center justify-between gap-3 px-4 md:px-7 py-4 bg-white border-b border-zinc-200">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden shrink-0 text-zinc-600 hover:text-zinc-900">
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="text-[17px] md:text-[20px] font-black text-zinc-900 truncate">Team Chat</h1>
              <p className="hidden sm:block text-[12px] text-zinc-400 truncate">Message other Maintlers on MaintlyQR directly.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {/* unreadMechanicCount uses totalUnread here too, same reasoning
                as the sidebar badge above — avoids the bell flashing "1"
                for a message that just arrived in the conversation you're
                already looking at. */}
            <NotificationBell mechanicId={mechanicId} unreadMessagesCount={unreadMessages} unreadMechanicCount={totalUnread} />
            <div className="flex items-center gap-3 md:pl-3 md:border-l border-zinc-200">
              {/* Links to this Maintler's own public card (/maintler/<code>)
                  instead of Settings — Facu's own ask: Settings is already
                  one click away via the sidebar nav, so this top-right
                  identity spot is freed up to jump straight to "how the
                  world sees me" instead of duplicating that sidebar link.
                  Falls back to Settings if maintlerCode hasn't loaded yet
                  (e.g. migration 024 not run yet on this database). */}
              <Link href={maintlerCode ? `/maintler/${maintlerCode}` : "/dashboard/settings"} className="flex items-center gap-2.5 group">
                {mechanicPhoto ? (
                  <HoverAvatar src={mechanicPhoto} size={36} />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[13px]">{initials}</div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-[12px] font-bold text-zinc-800 leading-tight group-hover:text-red-600 transition-colors">{mechanicName || mechanicEmail}</p>
                  <p className="text-[10px] text-zinc-400 leading-tight">Maintler</p>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500 hover:text-red-600 hover:bg-red-50 border border-zinc-200 hover:border-red-200 px-3 py-2 rounded-xl transition-all"
              >
                <LogOut size={13} />
                <span className="hidden md:inline">Log out</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex min-h-0 p-4 md:p-7 gap-4">

          {/* ── Conversation list / Saved Maintlers ── */}
          <div className={`${selectedId ? "hidden md:flex" : "flex"} w-full md:w-[320px] shrink-0 flex-col bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden min-h-0`}>
            <div className="flex items-center gap-1 px-3 pt-3 shrink-0">
              <button
                onClick={() => setActiveTab("chats")}
                className={`flex-1 flex items-center justify-center gap-1.5 text-[12px] font-bold py-2 rounded-lg transition-colors ${
                  activeTab === "chats" ? "bg-red-50 text-red-600" : "text-zinc-400 hover:bg-zinc-50"
                }`}
              >
                <MessageCircle size={13} /> Chats
                {totalUnread > 0 && (
                  <span className="bg-red-600 text-white text-[9px] font-black rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-1">{totalUnread}</span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("network")}
                className={`flex-1 flex items-center justify-center gap-1.5 text-[12px] font-bold py-2 rounded-lg transition-colors ${
                  activeTab === "network" ? "bg-red-50 text-red-600" : "text-zinc-400 hover:bg-zinc-50"
                }`}
              >
                <Star size={13} /> My Maintlers
              </button>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 shrink-0">
              <p className="text-[11.5px] text-zinc-400">
                {activeTab === "chats"
                  ? `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}`
                  : `${savedContacts.length} saved Maintler${savedContacts.length !== 1 ? "s" : ""}`}
              </p>
              <button
                onClick={() => setNewChatOpen(true)}
                className="flex items-center gap-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={13} /> Find a Maintler
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {activeTab === "chats" ? (
                conversationsLoading ? (
                  <p className="text-[12px] text-zinc-300 text-center py-10">Loading…</p>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-12 px-5">
                    <div className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-zinc-100 bg-zinc-50 mb-3">
                      <MessageCircle size={18} className="text-zinc-300" />
                    </div>
                    <p className="text-[12px] text-zinc-400 mb-1">No conversations yet.</p>
                    <p className="text-[11px] text-zinc-300">Search for a Maintler to start one.</p>
                  </div>
                ) : (
                  conversations.map((c) => (
                    <button
                      key={c.counterparty.id}
                      onClick={() => openConversation(c.counterparty)}
                      className={`w-full text-left flex items-center gap-3 px-4 py-3 border-b border-zinc-50 transition-colors ${
                        selectedId === c.counterparty.id ? "bg-red-50/60" : c.unread > 0 ? "bg-red-50/20 hover:bg-zinc-50" : "hover:bg-zinc-50"
                      }`}
                    >
                      {c.counterparty.photo_url ? (
                        <HoverAvatar src={c.counterparty.photo_url} size={36} />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-[11px] shrink-0">
                          {initialsOf(c.counterparty.name, c.counterparty.email)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {c.unread > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />}
                          <p className="text-[12.5px] font-bold text-zinc-800 truncate">{displayName(c.counterparty)}</p>
                          {isSaved(c.counterparty.id) && <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />}
                        </div>
                        <p className={`text-[11.5px] truncate ${c.unread > 0 ? "text-zinc-600 font-medium" : "text-zinc-400"}`}>
                          {c.lastFromMe ? "You: " : ""}{c.lastBody}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] text-zinc-300">{formatDateDMY(c.lastAt)}</span>
                        {c.unread > 0 && (
                          <span className="bg-red-600 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{c.unread}</span>
                        )}
                      </div>
                    </button>
                  ))
                )
              ) : savedContactsLoading ? (
                <p className="text-[12px] text-zinc-300 text-center py-10">Loading…</p>
              ) : savedContacts.length === 0 ? (
                <div className="text-center py-12 px-5">
                  <div className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-zinc-100 bg-zinc-50 mb-3">
                    <Star size={18} className="text-zinc-300" />
                  </div>
                  <p className="text-[12px] text-zinc-400 mb-1">No Maintlers saved yet.</p>
                  <p className="text-[11px] text-zinc-300">Find a Maintler above and save them — your saved Maintlers are who you'll be able to hand off equipment to later.</p>
                </div>
              ) : (
                savedContacts.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-zinc-50">
                    {c.contact.photo_url ? (
                      <HoverAvatar src={c.contact.photo_url} size={34} />
                    ) : (
                      <div className="w-[34px] h-[34px] rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-[11px] shrink-0">
                        {initialsOf(c.contact.name, c.contact.email)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-bold text-zinc-800 truncate">{displayName(c.contact)}</p>
                      <p className="text-[10.5px] text-zinc-400 truncate">{c.contact.email}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setActiveTab("chats"); openConversation(c.contact); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-500 transition-colors"
                        title="Message"
                      >
                        <Send size={12} />
                      </button>
                      <button
                        onClick={() => unsaveContactByTargetId(c.contact.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-amber-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Remove from saved Maintlers"
                      >
                        <Star size={14} className="fill-current" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Thread ── */}
          <div className={`${selectedId ? "flex" : "hidden md:flex"} flex-1 flex-col bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden min-w-0 min-h-0`}>
            {!selectedInfo ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-zinc-100 bg-zinc-50 mb-4">
                  <MessageCircle size={22} className="text-zinc-300" />
                </div>
                <p className="text-[13px] text-zinc-400 mb-1">Select a conversation, or start a new one.</p>
                <p className="text-[12px] text-zinc-300">Any Maintler on MaintlyQR can be reached here.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-zinc-100 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button onClick={backToList} className="md:hidden text-zinc-400 hover:text-zinc-700 shrink-0">
                      <ArrowLeft size={18} />
                    </button>
                    {selectedInfo.photo_url ? (
                      <HoverAvatar src={selectedInfo.photo_url} size={34} />
                    ) : (
                      <div className="w-[34px] h-[34px] rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-[11px] shrink-0">
                        {initialsOf(selectedInfo.name, selectedInfo.email)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-black text-zinc-900 leading-tight truncate">{displayName(selectedInfo)}</p>
                      <p className="text-[11px] text-zinc-400 leading-tight truncate">{selectedInfo.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleSaved(selectedInfo)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                        isSaved(selectedInfo.id) ? "text-amber-400 hover:text-amber-500 hover:bg-amber-50" : "text-zinc-300 hover:text-amber-400 hover:bg-amber-50"
                      }`}
                      title={isSaved(selectedInfo.id) ? "Remove from saved Maintlers" : "Save as a Maintler"}
                    >
                      <Star size={16} className={isSaved(selectedInfo.id) ? "fill-current" : ""} />
                    </button>
                    <button
                      onClick={() => { setReportOpen((v) => !v); setConfirmBlock(false); setConfirmDeleteThread(false); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-300 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      title="Report to MaintlyQR support"
                    >
                      <Flag size={15} />
                    </button>
                    {selectedIsBlocked ? (
                      <button
                        onClick={() => handleUnblock(selectedInfo.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                        title="Unblock"
                      >
                        <Ban size={15} />
                      </button>
                    ) : (
                      <button
                        onClick={() => { setConfirmBlock(true); setReportOpen(false); setConfirmDeleteThread(false); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Block"
                      >
                        <Ban size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => { setConfirmDeleteThread(true); setReportOpen(false); setConfirmBlock(false); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Clear conversation (only from your side)"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {reportSent && (
                  <div className="px-5 py-2 bg-emerald-50 border-b border-emerald-100 shrink-0">
                    <p className="text-[11px] text-emerald-700 font-medium">Reported to the MaintlyQR team. Thanks for flagging it.</p>
                  </div>
                )}

                {reportOpen && (
                  <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 shrink-0 space-y-2">
                    <p className="text-[11px] text-amber-800 font-medium">Report {displayName(selectedInfo)} to the MaintlyQR team.</p>
                    <textarea
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      placeholder="What happened? (optional, but helps us look into it)"
                      rows={2}
                      className="w-full rounded-lg border border-amber-200 px-3 py-2 text-[12px] outline-none focus:border-amber-400 resize-none bg-white"
                    />
                    {reportError && <p className="text-[11px] text-red-600">{reportError}</p>}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleSubmitReport}
                        disabled={reportSending}
                        className="text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Send report
                      </button>
                      <button onClick={() => { setReportOpen(false); setReportReason(""); }} className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-700 px-1.5">Cancel</button>
                    </div>
                  </div>
                )}

                {confirmBlock && (
                  <div className="flex items-center justify-between gap-2 px-5 py-2.5 bg-red-50 border-b border-red-100 shrink-0">
                    <span className="text-[11px] text-red-700 font-medium">Block {displayName(selectedInfo)}? Neither of you will be able to message the other anymore.</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => handleBlock(selectedInfo.id)} className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 px-2.5 py-1 rounded-lg transition-colors">Block</button>
                      <button onClick={() => setConfirmBlock(false)} className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 px-1.5">Cancel</button>
                    </div>
                  </div>
                )}

                {blockActionError && (
                  <div className="px-5 py-2 bg-red-50 border-b border-red-100 shrink-0">
                    <p className="text-[11px] text-red-600">{blockActionError}</p>
                  </div>
                )}

                {confirmDeleteThread && (
                  <div className="flex items-center justify-between gap-2 px-5 py-2.5 bg-red-50 border-b border-red-100 shrink-0">
                    <span className="text-[11px] text-red-700 font-medium">Clear this conversation from your side only?</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={handleDeleteThread} className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 px-2.5 py-1 rounded-lg transition-colors">Confirm</button>
                      <button onClick={() => setConfirmDeleteThread(false)} className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 px-1.5">Cancel</button>
                    </div>
                  </div>
                )}

                {selectedIsBlocked && (
                  <div className="px-5 py-2.5 bg-zinc-50 border-b border-zinc-100 shrink-0">
                    <p className="text-[11px] text-zinc-500">
                      You've blocked {displayName(selectedInfo)} — neither of you can send new messages here.{" "}
                      <button onClick={() => handleUnblock(selectedInfo.id)} className="text-red-600 font-bold hover:underline">Unblock</button>
                    </p>
                  </div>
                )}

                <div
                  ref={threadContainerRef}
                  onScroll={handleThreadScroll}
                  className="flex-1 min-h-0 overflow-y-auto px-5 py-4 bg-zinc-50/40"
                >
                  <div ref={threadContentRef} className="space-y-2.5">
                    {threadLoading ? (
                      <p className="text-[12px] text-zinc-300 text-center py-8">Loading…</p>
                    ) : thread.length === 0 ? (
                      <p className="text-[12px] text-zinc-300 text-center py-8">No messages yet — say hi!</p>
                    ) : (
                      thread.map((m, i) => {
                        const fromMe = m.sender_id === mechanicId;
                        const prev = thread[i - 1];
                        const showLabel = !prev || (prev.sender_id === mechanicId) !== fromMe;
                        return (
                          <div key={m.id} className={`flex flex-col ${fromMe ? "items-end" : "items-start"}`}>
                            {showLabel && (
                              <p className={`text-[10px] font-black uppercase tracking-wide mb-1 px-1 ${fromMe ? "text-zinc-500" : "text-zinc-400"}`}>
                                {fromMe ? "You" : displayName(selectedInfo)}
                              </p>
                            )}
                            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-snug ${
                              fromMe ? "bg-blue-600 text-white rounded-br-sm" : "bg-white border border-zinc-200 text-zinc-700 rounded-bl-sm"
                            }`}>
                              <p className="whitespace-pre-wrap break-words">{m.body}</p>
                              <p className={`text-[9.5px] mt-1 ${fromMe ? "text-blue-100" : "text-zinc-300"}`}>{formatDateDMY(m.created_at)} · {formatTime(m.created_at)}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {selectedIsBlocked ? (
                  <div className="px-4 py-4 border-t border-zinc-100 shrink-0 text-center">
                    <p className="text-[11.5px] text-zinc-400">You can't send messages while this Maintler is blocked.</p>
                  </div>
                ) : (
                  <div className="px-4 py-3 border-t border-zinc-100 shrink-0 space-y-1.5">
                    {composeError && <p className="text-[11px] text-red-600 px-1">{composeError}</p>}
                    <div className="flex items-end gap-2">
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="Type a message…"
                        rows={1}
                        className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-[13px] outline-none focus:border-red-400 resize-none"
                      />
                      <button
                        onClick={handleSend}
                        disabled={sending || !body.trim()}
                        className="flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-[12px] transition-all shrink-0"
                      >
                        <Send size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ════ NEW CONVERSATION MODAL ════ */}
      {newChatOpen && (
        <div
          className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4"
          onClick={() => { setNewChatOpen(false); setSearchTerm(""); setSearchResults([]); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 shrink-0">
              <h2 className="text-[15px] font-black text-zinc-900">Find a Maintler</h2>
              <button onClick={() => { setNewChatOpen(false); setSearchTerm(""); setSearchResults([]); }} className="text-zinc-400 hover:text-zinc-700">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-3 border-b border-zinc-100 shrink-0 space-y-1.5">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, workshop or email…"
                  className="w-full rounded-xl border border-zinc-200 pl-9 pr-3 py-2.5 text-[13px] outline-none focus:border-red-400"
                />
              </div>
              {savedActionError && <p className="text-[11px] text-red-600 px-1">{savedActionError}</p>}
              {searchError && <p className="text-[11px] text-red-600 px-1">{searchError}</p>}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto py-2">
              {searchTerm.trim().length < MIN_SEARCH_LENGTH ? (
                <p className="text-[12px] text-zinc-300 text-center py-10 px-5">Type at least {MIN_SEARCH_LENGTH} letters of a name, workshop or email to find a Maintler.</p>
              ) : searching ? (
                <p className="text-[12px] text-zinc-300 text-center py-10">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="text-[12px] text-zinc-300 text-center py-10 px-5">No Maintlers found.</p>
              ) : (
                searchResults.map((m) => {
                  const saved = isSaved(m.id);
                  return (
                    <div key={m.id} className="flex items-center gap-2 px-5 py-2 hover:bg-zinc-50 transition-colors">
                      <button
                        onClick={() => startNewConversation(m)}
                        className="flex-1 flex items-center gap-3 text-left min-w-0 py-0.5"
                        title="Message"
                      >
                        {m.photo_url ? (
                          <HoverAvatar src={m.photo_url} size={34} />
                        ) : (
                          <div className="w-[34px] h-[34px] rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-[11px] shrink-0">
                            {initialsOf(m.name, m.email)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-zinc-800 truncate flex items-center gap-1.5">
                            <UserCircle2 size={13} className="text-zinc-300 shrink-0" /> {displayName(m)}
                          </p>
                          <p className="text-[11px] text-zinc-400 truncate">{m.email}</p>
                        </div>
                      </button>
                      <button
                        onClick={() => toggleSaved(m)}
                        className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors shrink-0 ${
                          saved
                            ? "text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100"
                            : "text-zinc-500 border-zinc-200 hover:bg-zinc-50"
                        }`}
                        title={saved ? "Remove from saved Maintlers" : "Save as a Maintler"}
                      >
                        <Star size={12} className={saved ? "fill-current" : ""} /> {saved ? "Saved" : "Save"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// useSearchParams() (used above for the ?with=<mechanicId> deep link from
// the notification bell) opts the page out of static rendering unless
// wrapped in a Suspense boundary — same pattern already used by
// src/app/login/page.tsx for its own ?redirect= param.
export default function TeamChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TeamChatPageInner />
    </Suspense>
  );
}
