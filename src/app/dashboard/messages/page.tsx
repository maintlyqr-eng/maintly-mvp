"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings, Bell, X, LogOut, Crown, Menu,
  Mailbox, Trash2, Wrench, Shield, LifeBuoy, Send,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import HoverAvatar from "@/components/HoverAvatar";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { formatDateDMY } from "@/lib/date";

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/dashboard" },
  { icon: FileText, label: "My Services", href: "/dashboard/services" },
  { icon: Bell, label: "Scheduled Services", href: "/dashboard/scheduled" },
  { icon: Box, label: "Assets", href: "/dashboard/assets" },
  { icon: QrCode, label: "QR Codes", href: "/dashboard/assets" },
  { icon: Users, label: "Customers", href: "#" },
  { icon: BarChart3, label: "Reports", href: "/dashboard/reports" },
  { icon: CalendarIcon, label: "Calendar", href: "/dashboard/calendar" },
  { icon: Mail, label: "Messages", href: "/dashboard/messages" },
  { icon: FolderOpen, label: "Document Library", href: "#" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

const assetTypeImg: Record<string, string> = {
  automotive: "/images/car.png",
  motorcycle: "/images/moto.png",
  generator: "/images/generador.png",
  machinery: "/images/excavator.png",
  marine: "/images/barco.png",
  aviation: "/images/avion.png",
};

type AssetInfo = { id: string; nickname: string | null; brand: string | null; model: string | null; asset_type: string };

type MessageRow = {
  id: string;
  asset_id: string | null;
  sender_name: string;
  sender_contact: string;
  body: string;
  read: boolean;
  created_at: string;
  from_admin: boolean;
  assets: AssetInfo | AssetInfo[] | null;
};

function getAsset(a: AssetInfo | AssetInfo[] | null): AssetInfo | null {
  if (!a) return null;
  return Array.isArray(a) ? a[0] ?? null : a;
}

function assetLabel(a: AssetInfo | null) {
  if (!a) return "Unknown asset";
  return a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || "Unnamed asset";
}

function looksLikeEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

type SupportMsgRow = {
  id: string;
  body: string;
  from_admin: boolean;
  read: boolean;
  created_at: string;
};

export default function MessagesPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mechanicId, setMechanicId] = useState("");
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicPhoto, setMechanicPhoto] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportThread, setSupportThread] = useState<SupportMsgRow[]>([]);
  const [supportThreadLoading, setSupportThreadLoading] = useState(false);
  const [supportBody, setSupportBody] = useState("");
  const [supportSaving, setSupportSaving] = useState(false);
  const [supportError, setSupportError] = useState("");

  const unreadCount = useUnreadMessagesCount(mechanicId);

  async function loadMessages(uid: string) {
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("id, asset_id, sender_name, sender_contact, body, read, created_at, from_admin, assets(id, nickname, brand, model, asset_type)")
      .eq("mechanic_id", uid)
      .order("created_at", { ascending: false });
    setMessages((data as unknown as MessageRow[]) ?? []);
    setLoading(false);
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

      await loadMessages(session.user.id);
      if (active) setCheckingAuth(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function openMessage(m: MessageRow) {
    setExpandedId(expandedId === m.id ? null : m.id);
    if (!m.read) {
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read: true } : x)));
      await supabase.from("messages").update({ read: true }).eq("id", m.id);
    }
  }

  async function handleDelete(m: MessageRow) {
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    await supabase.from("messages").delete().eq("id", m.id);
  }

  async function openSupportModal() {
    setSupportBody("");
    setSupportError("");
    setShowSupportModal(true);
    setSupportThreadLoading(true);

    const { data } = await supabase
      .from("support_messages")
      .select("id, body, from_admin, read, created_at")
      .eq("mechanic_id", mechanicId)
      .order("created_at", { ascending: true });
    const thread = (data as SupportMsgRow[]) ?? [];
    setSupportThread(thread);
    setSupportThreadLoading(false);

    const unreadIds = thread.filter((m) => m.from_admin && !m.read).map((m) => m.id);
    if (unreadIds.length > 0) {
      setSupportThread((prev) => prev.map((m) => (unreadIds.includes(m.id) ? { ...m, read: true } : m)));
      await supabase.from("support_messages").update({ read: true }).in("id", unreadIds);
    }
  }

  async function handleSendSupport() {
    if (!supportBody.trim()) return;
    const text = supportBody.trim();
    setSupportSaving(true);
    setSupportError("");
    const { data, error } = await supabase
      .from("support_messages")
      .insert({ mechanic_id: mechanicId, body: text, from_admin: false })
      .select("id, body, from_admin, read, created_at");
    setSupportSaving(false);
    if (error || !data || data.length === 0) {
      setSupportError("Couldn't send your message. Try again.");
      return;
    }
    setSupportThread((prev) => [...prev, data[0] as SupportMsgRow]);
    setSupportBody("");
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">Loading...</p>
      </div>
    );
  }

  const initials = mechanicName.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "ME";
  const visible = unreadOnly ? messages.filter((m) => !m.read) : messages;

  return (
    <div className="min-h-screen bg-zinc-50 flex relative">

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ════ SIDEBAR ════ */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-[230px] bg-white border-r border-zinc-200 flex flex-col shrink-0 transform transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-2">
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/qr-gear.png" alt="Maintly" style={{width: 72, height: 72, objectFit: "contain"}} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/Maintly.png" alt="" style={{width: 152, objectFit: "contain", marginLeft: -18}} />
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-400 hover:text-zinc-700 mr-2">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 -mt-4 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-[9px] rounded-lg mb-1 text-[13px] font-medium transition-colors ${
                item.label === "Messages"
                  ? "bg-red-50 text-red-600 border-l-[3px] border-red-600 -ml-[1px]"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <item.icon size={16} />
              {item.label}
              {item.label === "Messages" && unreadCount > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unreadCount}</span>
              )}
            </Link>
          ))}
        </nav>

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
            <p className="text-[10px] text-zinc-400 leading-tight">Maintly Mechanic</p>
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
              <h1 className="text-[17px] md:text-[20px] font-black text-zinc-900 truncate">Messages</h1>
              <p className="hidden sm:block text-[12px] text-zinc-400 truncate">Inquiries sent from your assets' public pages.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <button
              onClick={openSupportModal}
              className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-zinc-900 hover:bg-zinc-800 px-3 py-2 rounded-xl transition-all shadow-sm"
            >
              <LifeBuoy size={14} />
              <span className="hidden sm:inline">Contact Support</span>
            </button>
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
                  <p className="text-[10px] text-zinc-400 leading-tight">Mechanic</p>
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

        <div className="flex-1 overflow-y-auto p-4 md:p-7">

          <div className="flex items-center justify-between mb-4">
            <p className="text-[12px] text-zinc-400">
              {messages.length} message{messages.length !== 1 ? "s" : ""} · {messages.filter((m) => !m.read).length} unread
            </p>
            <button
              onClick={() => setUnreadOnly((v) => !v)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                unreadOnly ? "bg-red-600 text-white border-red-600" : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              }`}
            >
              Unread only
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
            {loading ? (
              <p className="text-[13px] text-zinc-400 text-center py-12">Loading messages...</p>
            ) : visible.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-zinc-100 bg-zinc-50 mb-3">
                  <Mailbox size={20} className="text-zinc-300" />
                </div>
                <p className="text-[13px] text-zinc-400 mb-1">{unreadOnly ? "No unread messages." : "No messages yet."}</p>
                <p className="text-[12px] text-zinc-300">Anyone who scans one of your assets' QR codes can send you a question from there.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {visible.map((m) => {
                  const asset = getAsset(m.assets);
                  const img = asset ? assetTypeImg[asset.asset_type] ?? "/images/car.png" : "/images/car.png";
                  const isExpanded = expandedId === m.id;
                  const contactHref = looksLikeEmail(m.sender_contact) ? `mailto:${m.sender_contact}` : `tel:${m.sender_contact.replace(/[^\d+]/g, "")}`;
                  return (
                    <div key={m.id} className={`px-5 py-4 ${!m.read ? (m.from_admin ? "bg-zinc-50" : "bg-red-50/30") : ""}`}>
                      <button className="w-full text-left" onClick={() => openMessage(m)}>
                        <div className="flex items-center gap-3">
                          {m.from_admin ? (
                            <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
                              <Shield size={18} className="text-white" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img} alt="" className="w-[26px] h-[26px] object-contain" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {!m.read && <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />}
                              {m.from_admin ? (
                                <span className="text-[10px] font-black uppercase tracking-wide text-white bg-zinc-900 px-1.5 py-0.5 rounded-full">Maintly Team</span>
                              ) : (
                                <>
                                  <p className="text-[13px] font-bold text-zinc-800 truncate">{m.sender_name}</p>
                                  <span className="text-[11px] text-zinc-400">on {assetLabel(asset)}</span>
                                </>
                              )}
                            </div>
                            <p className={`text-[12px] mt-0.5 ${isExpanded ? "text-zinc-700" : "text-zinc-400 truncate"}`}>{m.body}</p>
                          </div>
                          <span className="text-[11px] text-zinc-300 shrink-0">{formatDateDMY(m.created_at)}</span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="mt-3 ml-[52px] flex items-center gap-2 flex-wrap">
                          {m.from_admin ? (
                            <button
                              onClick={openSupportModal}
                              className="flex items-center gap-1.5 text-[12px] font-bold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <LifeBuoy size={12} /> Reply via Support
                            </button>
                          ) : (
                            <a
                              href={contactHref}
                              className="flex items-center gap-1.5 text-[12px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Reply to {m.sender_contact}
                            </a>
                          )}
                          {asset && (
                            <Link
                              href={`/dashboard/services?asset=${asset.id}`}
                              className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500 hover:text-zinc-800 bg-zinc-50 hover:bg-zinc-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Wrench size={12} /> View asset
                            </Link>
                          )}
                          <button
                            onClick={() => handleDelete(m)}
                            className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors ml-auto"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-zinc-400 mt-8">© 2026 Maintly. All rights reserved.</p>
        </div>
      </div>

      {/* ══ CONTACT SUPPORT MODAL (full conversation) ══ */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4" onClick={() => setShowSupportModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md h-[75vh] max-h-[560px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
              <div className="flex items-center gap-2">
                <LifeBuoy size={16} className="text-zinc-700" />
                <div>
                  <h2 className="text-[15px] font-black text-zinc-900 leading-tight">Contact Support</h2>
                  <p className="text-[11px] text-zinc-400 leading-tight">Maintly Team</p>
                </div>
              </div>
              <button onClick={() => setShowSupportModal(false)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5 bg-zinc-50/40">
              {supportThreadLoading ? (
                <p className="text-[12px] text-zinc-300 text-center py-8">Loading…</p>
              ) : supportThread.length === 0 ? (
                <p className="text-[12px] text-zinc-300 text-center py-8">Any question or issue — write it below and the team will reply right here.</p>
              ) : (
                supportThread.map((m) => (
                  <div key={m.id} className={`flex ${m.from_admin ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-snug ${
                      m.from_admin ? "bg-white border border-zinc-200 text-zinc-700 rounded-bl-sm" : "bg-zinc-900 text-white rounded-br-sm"
                    }`}>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`text-[9.5px] mt-1 ${m.from_admin ? "text-zinc-300" : "text-zinc-400"}`}>{formatDateDMY(m.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-3 border-t border-zinc-100 shrink-0 space-y-1.5">
              {supportError && <p className="text-[11px] text-red-600 px-1">{supportError}</p>}
              <div className="flex items-end gap-2">
                <textarea
                  value={supportBody}
                  onChange={(e) => setSupportBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendSupport(); } }}
                  placeholder="Type a message…"
                  rows={1}
                  autoFocus
                  className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-[13px] outline-none focus:border-red-400 resize-none"
                />
                <button
                  onClick={handleSendSupport}
                  disabled={supportSaving || !supportBody.trim()}
                  className="flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-[12px] transition-all shrink-0"
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
