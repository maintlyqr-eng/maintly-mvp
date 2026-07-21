"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
// Login is migrated and every router.push()/replace() call on this page
// targets it — so this page can safely use next-intl's locale-aware router
// (see the established Link-swap-as-targets-migrate rule).
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  Mailbox, Trash2, Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import DashboardSidebarIntl from "@/components/DashboardSidebarIntl";
import DashboardHeaderIntl from "@/components/DashboardHeaderIntl";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { useUnreadMechanicMessages } from "@/lib/useUnreadMechanicMessages";
import { formatDateDMY } from "@/lib/date";

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
  assets: AssetInfo | AssetInfo[] | null;
};

function getAsset(a: AssetInfo | AssetInfo[] | null): AssetInfo | null {
  if (!a) return null;
  return Array.isArray(a) ? a[0] ?? null : a;
}

function looksLikeEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default function MessagesPage() {
  const t = useTranslations("DashboardMessagesPage");
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mechanicId, setMechanicId] = useState("");
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicPhoto, setMechanicPhoto] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [maintlerCode, setMaintlerCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const unreadCount = useUnreadMessagesCount(mechanicId);

  const unreadMechanicMessages = useUnreadMechanicMessages(mechanicId);

  function assetLabel(a: AssetInfo | null) {
    if (!a) return t("unknownAsset");
    return a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || t("unnamedAsset");
  }

  async function loadMessages(uid: string) {
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("id, asset_id, sender_name, sender_contact, body, read, created_at, assets(id, nickname, brand, model, asset_type)")
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
        .from("mechanics").select("name, photo_url, maintler_code").eq("id", session.user.id).single();
      if (active && mechanic) { setMechanicName(mechanic.name); setMechanicPhoto(mechanic.photo_url ?? ""); setMaintlerCode(mechanic.maintler_code ?? ""); }

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
      setActionError("");
      const { error } = await supabase.from("messages").update({ read: true }).eq("id", m.id);
      if (error) {
        setActionError(t("errorMarkRead"));
        return;
      }
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read: true } : x)));
    }
  }

  async function handleDelete(m: MessageRow) {
    setActionError("");
    const { error } = await supabase.from("messages").delete().eq("id", m.id);
    if (error) {
      setActionError(t("errorDelete"));
      return;
    }
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">{t("loadingAuth")}</p>
      </div>
    );
  }

  const visible = unreadOnly ? messages.filter((m) => !m.read) : messages;

  return (
    <div className="h-dvh bg-zinc-50 flex relative overflow-hidden">

      <DashboardSidebarIntl
        activeHref="/dashboard/messages"
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        mechanicId={mechanicId}
        unreadMessages={unreadCount}
        unreadMechanicMessages={unreadMechanicMessages}
        photoUrl={mechanicPhoto}
        name={mechanicName}
        email={mechanicEmail}
      />

      {/* ════ MAIN ════ */}
      <div className="flex-1 flex flex-col min-w-0">

        <DashboardHeaderIntl
          title={t("title")}
          subtitle={t("subtitle")}
          onOpenSidebar={() => setSidebarOpen(true)}
          mechanicId={mechanicId}
          unreadMessages={unreadCount}
          unreadMechanicMessages={unreadMechanicMessages}
          photoUrl={mechanicPhoto}
          name={mechanicName}
          email={mechanicEmail}
          maintlerCode={maintlerCode}
          onLogout={handleLogout}
        />

        <div className="flex-1 overflow-y-auto px-3 md:px-4 pt-1.5 md:pt-2 pb-3 md:pb-4">

          <div className="flex items-center justify-between mb-4">
            <p className="text-[12px] text-zinc-400">
              {messages.length} {messages.length === 1 ? t("messageSingular") : t("messagesPlural")} · {messages.filter((m) => !m.read).length} {t("unread")}
            </p>
            <button
              onClick={() => setUnreadOnly((v) => !v)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                unreadOnly ? "bg-red-600 text-white border-red-600" : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              }`}
            >
              {t("unreadOnly")}
            </button>
          </div>

          {actionError && (
            <p className="text-[12px] text-red-600 mb-4">{actionError}</p>
          )}

          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
            {loading ? (
              <p className="text-[13px] text-zinc-400 text-center py-12">{t("loadingMessages")}</p>
            ) : visible.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-zinc-100 bg-zinc-50 mb-3">
                  <Mailbox size={20} className="text-zinc-300" />
                </div>
                <p className="text-[13px] text-zinc-400 mb-1">{unreadOnly ? t("noUnreadMessages") : t("noMessagesYet")}</p>
                <p className="text-[12px] text-zinc-300">{t("qrHint")}</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {visible.map((m) => {
                  const asset = getAsset(m.assets);
                  const img = asset ? assetTypeImg[asset.asset_type] ?? "/images/car.png" : "/images/car.png";
                  const isExpanded = expandedId === m.id;
                  const contactHref = looksLikeEmail(m.sender_contact) ? `mailto:${m.sender_contact}` : `tel:${m.sender_contact.replace(/[^\d+]/g, "")}`;
                  return (
                    <div key={m.id} className={`px-5 py-4 ${!m.read ? "bg-red-50/30" : ""}`}>
                      <button className="w-full text-left" onClick={() => openMessage(m)}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt="" className="w-[26px] h-[26px] object-contain" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {!m.read && <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />}
                              <p className="text-[13px] font-bold text-zinc-800 truncate">{m.sender_name}</p>
                              <span className="text-[11px] text-zinc-400">{t("onAsset", { asset: assetLabel(asset) })}</span>
                            </div>
                            <p className={`text-[12px] mt-0.5 ${isExpanded ? "text-zinc-700" : "text-zinc-400 truncate"}`}>{m.body}</p>
                          </div>
                          <span className="text-[11px] text-zinc-300 shrink-0">{formatDateDMY(m.created_at)}</span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="mt-3 ml-[52px] flex items-center gap-2 flex-wrap">
                          <a
                            href={contactHref}
                            className="flex items-center gap-1.5 text-[12px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            {t("replyTo", { contact: m.sender_contact })}
                          </a>
                          {asset && (
                            <Link
                              href={`/dashboard/services?asset=${asset.id}`}
                              className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500 hover:text-zinc-800 bg-zinc-50 hover:bg-zinc-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Wrench size={12} /> {t("viewAsset")}
                            </Link>
                          )}
                          <button
                            onClick={() => handleDelete(m)}
                            className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors ml-auto"
                          >
                            <Trash2 size={12} /> {t("delete")}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-zinc-400 mt-8">{t("copyright")}</p>
        </div>
      </div>
    </div>
  );
}
