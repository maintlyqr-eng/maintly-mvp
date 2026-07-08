"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings, Bell, X, LogOut, Crown, Menu,
  MessageCircle, Search, Send, Trash2, ArrowLeft, Plus, UserCircle2,
  UserPlus, Check,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import HoverAvatar from "@/components/HoverAvatar";
import ContactSupportWidget from "@/components/ContactSupportWidget";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { useUnreadMechanicMessages } from "@/lib/useUnreadMechanicMessages";
import { formatDateDMY } from "@/lib/date";

// Mechanic-to-mechanic direct messaging — a second, independent inbox from
// the customer-facing "Messages" page. Mirrors ContactSupportWidget.tsx's
// bubble/soft-delete/mark-read conventions, but unlike that widget there's
// no fixed single counterparty ("the admin") to imply here, so this page
// adds a real conversation list plus a mechanic-search picker to start new
// threads (mechanics are publicly SELECT-able per the "mechanics: lectura
// pública" RLS policy, so the picker queries mechanics directly — no new
// API route needed).

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

// Maintler Connections — a curated, mutual "trusted network" list, separate
// from being able to message someone (any Maintler can message any other
// Maintler already, no gate). This is the foundation for Item 4 in the
// backlog: identity, belonging, a real community — and eventually the gate
// that decides who you're even allowed to offer an asset transfer to, so
// equipment only ever changes hands inside a relationship both sides agreed
// to, never with a stranger.
type ConnectionStatus = "pending" | "accepted" | "declined";

type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: string;
};

type ConnectionSummary = {
  id: string;
  otherParty: MechanicInfo;
  direction: "incoming" | "outgoing";
  status: ConnectionStatus;
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

export default function TeamChatPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mechanicId, setMechanicId] = useState("");
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicPhoto, setMechanicPhoto] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");

  const unreadMessages = useUnreadMessagesCount(mechanicId);
  const unreadMechanicMessages = useUnreadMechanicMessages(mechanicId);

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

  const [activeTab, setActiveTab] = useState<"chats" | "network">("chats");
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [connectionActionError, setConnectionActionError] = useState("");

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
        return info ? { counterparty: info, ...a } : null;
      })
      .filter((x): x is ConversationSummary => !!x)
      .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));

    setConversations(list);
    setConversationsLoading(false);
  }

  async function loadConnections(myId: string) {
    setConnectionsLoading(true);
    const { data } = await supabase
      .from("maintler_connections")
      .select("id, requester_id, addressee_id, status, created_at")
      .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`)
      .order("created_at", { ascending: false });

    const rows = (data as ConnectionRow[]) ?? [];
    const ids = Array.from(new Set(rows.map((r) => (r.requester_id === myId ? r.addressee_id : r.requester_id))));

    if (ids.length === 0) {
      setConnections([]);
      setConnectionsLoading(false);
      return;
    }

    const { data: mechanicsData } = await supabase
      .from("mechanics")
      .select("id, name, email, workshop_name, photo_url")
      .in("id", ids);

    const infoById = new Map((mechanicsData as MechanicInfo[] ?? []).map((mm) => [mm.id, mm]));

    const list = rows
      .map((r) => {
        const otherId = r.requester_id === myId ? r.addressee_id : r.requester_id;
        const info = infoById.get(otherId);
        if (!info) return null;
        return {
          id: r.id,
          otherParty: info,
          direction: (r.requester_id === myId ? "outgoing" : "incoming") as "incoming" | "outgoing",
          status: r.status,
          createdAt: r.created_at,
        };
      })
      .filter((x): x is ConnectionSummary => !!x);

    setConnections(list);
    setConnectionsLoading(false);
  }

  function connectionFor(id: string): ConnectionSummary | undefined {
    return connections.find((c) => c.otherParty.id === id);
  }

  async function sendConnectionRequest(target: MechanicInfo) {
    setConnectionActionError("");
    const { data, error: err } = await supabase
      .from("maintler_connections")
      .insert({ requester_id: mechanicId, addressee_id: target.id, status: "pending" })
      .select("id, requester_id, addressee_id, status, created_at");
    if (err || !data || data.length === 0) {
      setConnectionActionError("Couldn't send the connection request. Try again.");
      return;
    }
    const row = data[0] as ConnectionRow;
    setConnections((prev) => [{ id: row.id, otherParty: target, direction: "outgoing", status: "pending", createdAt: row.created_at }, ...prev]);
  }

  async function respondToConnection(conn: ConnectionSummary, accept: boolean) {
    const newStatus: ConnectionStatus = accept ? "accepted" : "declined";
    setConnections((prev) =>
      accept ? prev.map((c) => (c.id === conn.id ? { ...c, status: newStatus } : c)) : prev.filter((c) => c.id !== conn.id)
    );
    await supabase.from("maintler_connections").update({ status: newStatus, responded_at: new Date().toISOString() }).eq("id", conn.id);
  }

  async function removeConnection(conn: ConnectionSummary) {
    setConnections((prev) => prev.filter((c) => c.id !== conn.id));
    await supabase.from("maintler_connections").delete().eq("id", conn.id);
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
        .from("mechanics").select("name, photo_url").eq("id", session.user.id).single();
      if (active && mechanic) { setMechanicName(mechanic.name); setMechanicPhoto(mechanic.photo_url ?? ""); }

      await loadConversations(session.user.id);
      await loadConnections(session.user.id);
      if (active) setCheckingAuth(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [router]);

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
  // anything, which is why the picker always showed "No Maintlers found."
  // no matter what was typed, even an exact known email.
  useEffect(() => {
    if (!newChatOpen) return;
    const term = searchTerm.trim().replace(/[,()*]/g, "");
    // A single letter is enough to start suggesting matches — per Facu's
    // feedback, waiting for 2+ characters felt like the picker was empty
    // for no reason.
    if (term.length < 1) { setSearchResults([]); setSearching(false); return; }

    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("mechanics")
        .select("id, name, email, workshop_name, photo_url")
        .neq("id", mechanicId)
        .or(`name.ilike.*${term}*,email.ilike.*${term}*,workshop_name.ilike.*${term}*`)
        .limit(8);
      if (active) { setSearchResults((data as MechanicInfo[]) ?? []); setSearching(false); }
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
    const { data, error: err } = await supabase
      .from("mechanic_messages")
      .insert({ sender_id: mechanicId, recipient_id: selectedId, body: text })
      .select("id, sender_id, recipient_id, body, read, created_at");
    setSending(false);
    if (err || !data || data.length === 0) {
      setComposeError("Couldn't send your message. Try again.");
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
  const incomingPending = connections.filter((c) => c.direction === "incoming" && c.status === "pending");
  const outgoingPending = connections.filter((c) => c.direction === "outgoing" && c.status === "pending");
  const acceptedConnections = connections.filter((c) => c.status === "accepted");

  return (
    <div className="min-h-screen bg-zinc-50 flex relative">

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

        <nav className="flex-1 px-3 overflow-y-auto">
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
              {item.label === "Team Chat" && unreadMechanicMessages > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unreadMechanicMessages}</span>
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
      <div className="flex-1 flex flex-col min-w-0">

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
            <button className="relative text-zinc-500 hover:text-zinc-800 transition-colors"><Bell size={19} /></button>
            <div className="flex items-center gap-3 md:pl-3 md:border-l border-zinc-200">
              <div className="flex items-center gap-2.5">
                <Link href="/dashboard/settings" className="shrink-0">
                  {mechanicPhoto ? (
                    <HoverAvatar src={mechanicPhoto} size={36} />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[13px]">{initials}</div>
                  )}
                </Link>
                <div className="hidden sm:block text-left">
                  <p className="text-[12px] font-bold text-zinc-800 leading-tight">{mechanicName || mechanicEmail}</p>
                  <p className="text-[10px] text-zinc-400 leading-tight">Maintler</p>
                </div>
              </div>
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

          {/* ── Conversation list / Network ── */}
          <div className={`${selectedId ? "hidden md:flex" : "flex"} w-full md:w-[320px] shrink-0 flex-col bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden`}>
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
                <Users size={13} /> My Network
                {incomingPending.length > 0 && (
                  <span className="bg-red-600 text-white text-[9px] font-black rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-1">{incomingPending.length}</span>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 shrink-0">
              <p className="text-[11.5px] text-zinc-400">
                {activeTab === "chats"
                  ? `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}`
                  : `${acceptedConnections.length} connected Maintler${acceptedConnections.length !== 1 ? "s" : ""}`}
              </p>
              <button
                onClick={() => setNewChatOpen(true)}
                className="flex items-center gap-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={13} /> Find a Maintler
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
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
              ) : connectionsLoading ? (
                <p className="text-[12px] text-zinc-300 text-center py-10">Loading…</p>
              ) : incomingPending.length === 0 && acceptedConnections.length === 0 && outgoingPending.length === 0 ? (
                <div className="text-center py-12 px-5">
                  <div className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-zinc-100 bg-zinc-50 mb-3">
                    <Users size={18} className="text-zinc-300" />
                  </div>
                  <p className="text-[12px] text-zinc-400 mb-1">No Maintlers in your network yet.</p>
                  <p className="text-[11px] text-zinc-300">Find a Maintler above and connect — your network is who you'll be able to hand off equipment to.</p>
                </div>
              ) : (
                <>
                  {incomingPending.length > 0 && (
                    <div className="px-4 pt-3 pb-1">
                      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">Requests</p>
                    </div>
                  )}
                  {incomingPending.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-zinc-50">
                      {c.otherParty.photo_url ? (
                        <HoverAvatar src={c.otherParty.photo_url} size={34} />
                      ) : (
                        <div className="w-[34px] h-[34px] rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-[11px] shrink-0">
                          {initialsOf(c.otherParty.name, c.otherParty.email)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-bold text-zinc-800 truncate">{displayName(c.otherParty)}</p>
                        <p className="text-[10.5px] text-zinc-400 truncate">wants to connect</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => respondToConnection(c, true)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors" title="Accept">
                          <Check size={14} />
                        </button>
                        <button onClick={() => respondToConnection(c, false)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-500 transition-colors" title="Decline">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {acceptedConnections.length > 0 && (
                    <div className="px-4 pt-3 pb-1">
                      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">My Maintlers</p>
                    </div>
                  )}
                  {acceptedConnections.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-zinc-50">
                      {c.otherParty.photo_url ? (
                        <HoverAvatar src={c.otherParty.photo_url} size={34} />
                      ) : (
                        <div className="w-[34px] h-[34px] rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-[11px] shrink-0">
                          {initialsOf(c.otherParty.name, c.otherParty.email)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-bold text-zinc-800 truncate">{displayName(c.otherParty)}</p>
                        <p className="text-[10.5px] text-zinc-400 truncate">{c.otherParty.email}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setActiveTab("chats"); openConversation(c.otherParty); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-500 transition-colors"
                          title="Message"
                        >
                          <Send size={12} />
                        </button>
                        <button
                          onClick={() => removeConnection(c)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Remove from network"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {outgoingPending.length > 0 && (
                    <div className="px-4 pt-3 pb-1">
                      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">Sent</p>
                    </div>
                  )}
                  {outgoingPending.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-zinc-50">
                      {c.otherParty.photo_url ? (
                        <HoverAvatar src={c.otherParty.photo_url} size={34} />
                      ) : (
                        <div className="w-[34px] h-[34px] rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-[11px] shrink-0">
                          {initialsOf(c.otherParty.name, c.otherParty.email)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-bold text-zinc-800 truncate">{displayName(c.otherParty)}</p>
                        <p className="text-[10.5px] text-zinc-400 truncate">Request sent</p>
                      </div>
                      <button onClick={() => removeConnection(c)} className="text-[11px] font-semibold text-zinc-400 hover:text-red-600 shrink-0">Cancel</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* ── Thread ── */}
          <div className={`${selectedId ? "flex" : "hidden md:flex"} flex-1 flex-col bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden min-w-0`}>
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
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 shrink-0">
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
                  <button
                    onClick={() => setConfirmDeleteThread(true)}
                    className="text-zinc-300 hover:text-red-600 transition-colors shrink-0"
                    title="Clear conversation (only from your side)"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {confirmDeleteThread && (
                  <div className="flex items-center justify-between gap-2 px-5 py-2.5 bg-red-50 border-b border-red-100 shrink-0">
                    <span className="text-[11px] text-red-700 font-medium">Clear this conversation from your side only?</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={handleDeleteThread} className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 px-2.5 py-1 rounded-lg transition-colors">Confirm</button>
                      <button onClick={() => setConfirmDeleteThread(false)} className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 px-1.5">Cancel</button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5 bg-zinc-50/40">
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
              {connectionActionError && <p className="text-[11px] text-red-600 px-1">{connectionActionError}</p>}
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {searchTerm.trim().length < 1 ? (
                <p className="text-[12px] text-zinc-300 text-center py-10 px-5">Start typing a name, workshop or email to find a Maintler.</p>
              ) : searching ? (
                <p className="text-[12px] text-zinc-300 text-center py-10">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="text-[12px] text-zinc-300 text-center py-10 px-5">No Maintlers found.</p>
              ) : (
                searchResults.map((m) => {
                  const conn = connectionFor(m.id);
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
                      <div className="shrink-0">
                        {!conn && (
                          <button
                            onClick={() => sendConnectionRequest(m)}
                            className="flex items-center gap-1 text-[11px] font-bold text-red-600 border border-red-200 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            <UserPlus size={12} /> Connect
                          </button>
                        )}
                        {conn?.status === "pending" && conn.direction === "outgoing" && (
                          <span className="text-[10.5px] text-zinc-400 font-semibold px-1.5">Pending</span>
                        )}
                        {conn?.status === "pending" && conn.direction === "incoming" && (
                          <span className="text-[10.5px] text-zinc-400 font-semibold px-1.5">Wants to connect</span>
                        )}
                        {conn?.status === "accepted" && (
                          <span className="flex items-center gap-1 text-[10.5px] text-emerald-600 font-bold px-1.5">
                            <Check size={12} /> Connected
                          </span>
                        )}
                      </div>
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
