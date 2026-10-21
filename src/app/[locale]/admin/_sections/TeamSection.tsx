"use client";

// Chat interno del equipo (Facu, 21/10/2026: "un chat interno así le puedo
// pasar fotos o info para subir o ella compartirme ideas creativas").
// Conversaciones 1 a 1 entre personas del equipo, con adjuntos (fotos,
// PDF, video corto). Los archivos suben directo del navegador a Supabase
// Storage con una URL firmada que entrega /api/admin/chat (las rutas de
// Vercel no aceptan cuerpos > 4,5 MB); el servidor guarda el mensaje.
// Se refresca solo cada 8 s mientras la charla está abierta.

import { useEffect, useRef, useState } from "react";
import { Send, Paperclip, ArrowLeft, FileText, Image as ImageIcon, Download, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

export type ChatPerson = { username: string; displayName: string | null; role: string | null; unread: number; lastAt: string | null };
export type ChatMessage = {
  id: string; created_at: string; from_username: string; to_username: string; body: string;
  attachment_path: string | null; attachment_name: string | null; attachment_type: string | null; attachment_size: number | null; read_at: string | null;
};

type Props = {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;
  me: string;
  people: ChatPerson[];
  reloadPeople: () => void | Promise<void>;
  roleLabel: Record<string, string>;
};

const BUCKET = "admin-chat";

function fmtTime(iso: string, locale: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : d.toLocaleString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtSize(n: number | null): string {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TeamSection({ t, locale, me, people, reloadPeople, roleLabel }: Props) {
  const [withUser, setWithUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load(user: string, initial: boolean) {
    if (initial) setLoading(true);
    try {
      const r = await fetch(`/api/admin/chat?with=${encodeURIComponent(user)}`);
      const j = await r.json().catch(() => ({}));
      if (Array.isArray(j.messages)) setMessages(j.messages as ChatMessage[]);
    } finally {
      if (initial) setLoading(false);
    }
  }

  useEffect(() => {
    if (!withUser) return;
    setMessages([]);
    load(withUser, true).then(() => reloadPeople());
    const timer = setInterval(() => load(withUser, false), 8000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withUser]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  async function send() {
    if (!withUser || sending) return;
    const body = draft.trim();
    if (!body && !file) return;
    setSending(true); setError(null);
    try {
      let attachment: { path: string; name: string; type: string; size: number } | null = null;
      if (file) {
        const r1 = await fetch("/api/admin/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "upload-url", name: file.name, type: file.type || "application/octet-stream", size: file.size }) });
        const j1 = await r1.json().catch(() => ({}));
        if (!r1.ok || !j1?.path) throw new Error(j1?.error || t("chatUploadFailed"));
        const { error: upErr } = await supabase.storage.from(BUCKET).uploadToSignedUrl(j1.path, j1.token, file, { contentType: file.type || "application/octet-stream" });
        if (upErr) throw new Error(upErr.message);
        attachment = { path: j1.path, name: file.name, type: file.type || "application/octet-stream", size: file.size };
      }
      const r2 = await fetch("/api/admin/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: withUser, body, attachment }) });
      const j2 = await r2.json().catch(() => ({}));
      if (!r2.ok || !j2?.message) throw new Error(j2?.error || t("chatSendFailed"));
      setMessages((prev) => [...prev, j2.message as ChatMessage]);
      setDraft(""); setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      reloadPeople();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  const current = people.find((p) => p.username.toLowerCase() === (withUser ?? "").toLowerCase());
  const nameOf = (p: ChatPerson) => p.displayName || p.username;

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden flex" style={{ height: "calc(100vh - 180px)", minHeight: 420 }}>
      {/* Lista de personas */}
      <aside className={`w-full md:w-72 md:border-r border-zinc-100 flex-col ${withUser ? "hidden md:flex" : "flex"}`}>
        <div className="px-5 py-4 border-b border-zinc-100">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">{t("chatPeople")}</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {people.length === 0 ? (
            <div className="text-center py-16 px-6">
              <Users size={26} className="mx-auto text-zinc-200 mb-2" />
              <p className="text-[12px] text-zinc-300">{t("chatNoPeople")}</p>
            </div>
          ) : people.map((p) => (
            <button
              key={p.username} onClick={() => setWithUser(p.username)}
              className={`w-full text-left px-5 py-3.5 flex items-center gap-3 border-b border-zinc-50 hover:bg-zinc-50 transition-colors ${withUser?.toLowerCase() === p.username.toLowerCase() ? "bg-zinc-50" : ""}`}
            >
              <div className="w-9 h-9 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[13px] font-black shrink-0">{nameOf(p).charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-zinc-900 truncate">{nameOf(p)}</p>
                <p className="text-[11px] text-zinc-400 truncate">{p.role ? roleLabel[p.role] ?? p.role : ""}</p>
              </div>
              {p.unread > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">{p.unread}</span>}
            </button>
          ))}
        </div>
      </aside>

      {/* Conversación */}
      <section className={`flex-1 flex-col min-w-0 ${withUser ? "flex" : "hidden md:flex"}`}>
        {!withUser ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-zinc-300">{t("chatPickPerson")}</div>
        ) : (
          <>
            <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-3">
              <button onClick={() => setWithUser(null)} className="md:hidden text-zinc-400 hover:text-zinc-700"><ArrowLeft size={18} /></button>
              <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[12px] font-black">{(current ? nameOf(current) : withUser).charAt(0).toUpperCase()}</div>
              <div>
                <p className="text-[13px] font-bold text-zinc-900">{current ? nameOf(current) : withUser}</p>
                <p className="text-[11px] text-zinc-400">{current?.role ? roleLabel[current.role] ?? current.role : ""}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-zinc-50/60">
              {loading ? (
                <p className="text-[12px] text-zinc-400 text-center py-10">{t("loading")}</p>
              ) : messages.length === 0 ? (
                <p className="text-[12px] text-zinc-300 text-center py-10">{t("chatEmpty")}</p>
              ) : messages.map((m) => {
                const mine = m.from_username.toLowerCase() === me.toLowerCase();
                const isImage = !!m.attachment_type && m.attachment_type.startsWith("image/");
                const fileUrl = m.attachment_path ? `/api/admin/chat?file=${encodeURIComponent(m.id)}` : null;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug ${mine ? "bg-zinc-900 text-white rounded-br-md" : "bg-white border border-zinc-200 text-zinc-800 rounded-bl-md"}`}>
                      {fileUrl && isImage && (
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block mb-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={fileUrl} alt={m.attachment_name ?? ""} className="rounded-xl max-h-64 object-cover" />
                        </a>
                      )}
                      {fileUrl && !isImage && (
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 rounded-xl px-2.5 py-2 mb-1.5 ${mine ? "bg-white/10" : "bg-zinc-100"}`}>
                          <FileText size={16} className="shrink-0" />
                          <span className="truncate text-[12px] font-bold">{m.attachment_name}</span>
                          <span className="text-[10px] opacity-70 shrink-0">{fmtSize(m.attachment_size)}</span>
                          <Download size={13} className="shrink-0 opacity-70" />
                        </a>
                      )}
                      {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                      <p className={`text-[10px] mt-1 ${mine ? "text-white/50" : "text-zinc-400"}`}>
                        {fmtTime(m.created_at, locale)}{mine && m.read_at ? ` · ${t("chatSeen")}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-zinc-100 px-4 py-3">
              {file && (
                <div className="flex items-center gap-2 text-[11px] text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 mb-2">
                  {file.type.startsWith("image/") ? <ImageIcon size={13} /> : <FileText size={13} />}
                  <span className="truncate flex-1">{file.name}</span>
                  <span className="text-zinc-400">{fmtSize(file.size)}</span>
                  <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-zinc-400 hover:text-red-600 font-bold">×</button>
                </div>
              )}
              {error && <p className="text-[11px] text-red-600 mb-2">{error}</p>}
              <div className="flex items-end gap-2">
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*,application/pdf,video/mp4,video/quicktime,audio/*,.docx,.xlsx,.pptx,.zip,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <button type="button" onClick={() => fileInputRef.current?.click()} title={t("chatAttach")} className="shrink-0 w-10 h-10 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 flex items-center justify-center"><Paperclip size={16} /></button>
                <textarea
                  value={draft} onChange={(e) => setDraft(e.target.value)} rows={1}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={t("chatPlaceholder")}
                  className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-[13px] outline-none focus:border-red-500 resize-none max-h-32"
                />
                <button type="button" onClick={send} disabled={sending || (!draft.trim() && !file)} className="shrink-0 w-10 h-10 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white flex items-center justify-center"><Send size={16} /></button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
