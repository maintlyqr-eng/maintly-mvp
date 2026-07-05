"use client";

import { useEffect, useState } from "react";
import { LifeBuoy, X, Send, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDateDMY } from "@/lib/date";

// Persistent "Contact Support" entry for the mechanic sidebar — dropped into
// every dashboard page so a mechanic can reach the Maintly Team from
// anywhere, not just from the Messages page. Self-contained: manages its own
// unread count, thread, and compose state, independent of whatever page it's
// rendered on.

type SupportMsgRow = {
  id: string;
  body: string;
  from_admin: boolean;
  read: boolean;
  created_at: string;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export default function ContactSupportWidget({ mechanicId, variant = "sidebar" }: { mechanicId: string; variant?: "sidebar" | "inline" }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<SupportMsgRow[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!mechanicId) return;
    let active = true;
    supabase
      .from("support_messages")
      .select("*", { count: "exact", head: true })
      .eq("mechanic_id", mechanicId)
      .eq("from_admin", true)
      .eq("read", false)
      .then(({ count }) => { if (active) setUnreadCount(count ?? 0); });
    return () => { active = false; };
  }, [mechanicId]);

  async function openWidget() {
    setBody("");
    setError("");
    setConfirmClear(false);
    setOpen(true);
    setThreadLoading(true);

    const { data } = await supabase
      .from("support_messages")
      .select("id, body, from_admin, read, created_at")
      .eq("mechanic_id", mechanicId)
      .eq("hidden_for_mechanic", false)
      .order("created_at", { ascending: true });
    const rows = (data as SupportMsgRow[]) ?? [];
    setThread(rows);
    setThreadLoading(false);

    const unreadIds = rows.filter((m) => m.from_admin && !m.read).map((m) => m.id);
    if (unreadIds.length > 0) {
      setThread((prev) => prev.map((m) => (unreadIds.includes(m.id) ? { ...m, read: true } : m)));
      setUnreadCount(0);
      await supabase.from("support_messages").update({ read: true }).in("id", unreadIds);
    }
  }

  async function handleSend() {
    if (!body.trim()) return;
    const text = body.trim();
    setSaving(true);
    setError("");
    const { data, error: err } = await supabase
      .from("support_messages")
      .insert({ mechanic_id: mechanicId, body: text, from_admin: false })
      .select("id, body, from_admin, read, created_at");
    setSaving(false);
    if (err || !data || data.length === 0) {
      setError("Couldn't send your message. Try again.");
      return;
    }
    setThread((prev) => [...prev, data[0] as SupportMsgRow]);
    setBody("");
  }

  async function handleClear() {
    setThread([]);
    setConfirmClear(false);
    await supabase.from("support_messages").update({ hidden_for_mechanic: true }).eq("mechanic_id", mechanicId);
  }

  const isInline = variant === "inline";

  return (
    <>
      <button
        onClick={openWidget}
        className={
          isInline
            ? "relative flex items-center gap-2 border border-zinc-200 bg-gradient-to-br from-zinc-100 via-white to-zinc-200 hover:to-zinc-300 active:scale-[0.98] transition-all text-zinc-700 text-[13px] font-bold px-4 py-[10px] rounded-xl shadow-sm"
            : "relative w-[calc(100%-24px)] mx-3 mb-3 flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-gradient-to-br from-zinc-100 via-white to-zinc-200 hover:to-zinc-300 border border-zinc-200/80 text-zinc-800 text-[13px] font-bold transition-all shadow-sm"
        }
      >
        <div className={`rounded-lg bg-red-600 flex items-center justify-center shrink-0 ${isInline ? "w-5 h-5" : "w-7 h-7"}`}>
          <LifeBuoy size={isInline ? 11 : 14} className="text-white" />
        </div>
        Contact Support
        {unreadCount > 0 && (
          <span className={`bg-red-600 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 ${isInline ? "" : "ml-auto"}`}>{unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md h-[75vh] max-h-[560px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
              <div className="flex items-center gap-2">
                <LifeBuoy size={16} className="text-zinc-700" />
                <div>
                  <h2 className="text-[15px] font-black text-zinc-900 leading-tight">Contact Support</h2>
                  <p className="text-[11px] text-zinc-400 leading-tight">Maintly Team</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setConfirmClear(true)}
                  className="text-zinc-300 hover:text-red-600 transition-colors"
                  title="Clear conversation (only from your side)"
                >
                  <Trash2 size={15} />
                </button>
                <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
              </div>
            </div>

            {confirmClear && (
              <div className="flex items-center justify-between gap-2 px-5 py-2.5 bg-red-50 border-b border-red-100 shrink-0">
                <span className="text-[11px] text-red-700 font-medium">Clear this conversation from your side only?</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={handleClear} className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 px-2.5 py-1 rounded-lg transition-colors">Confirm</button>
                  <button onClick={() => setConfirmClear(false)} className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 px-1.5">Cancel</button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5 bg-zinc-50/40">
              {threadLoading ? (
                <p className="text-[12px] text-zinc-300 text-center py-8">Loading…</p>
              ) : thread.length === 0 ? (
                <p className="text-[12px] text-zinc-300 text-center py-8">Any question or issue — write it below and the team will reply right here.</p>
              ) : (
                thread.map((m, i) => {
                  const prev = thread[i - 1];
                  const showLabel = !prev || prev.from_admin !== m.from_admin;
                  return (
                    <div key={m.id} className={`flex flex-col ${m.from_admin ? "items-start" : "items-end"}`}>
                      {showLabel && (
                        <p className={`text-[10px] font-black uppercase tracking-wide mb-1 px-1 ${m.from_admin ? "text-zinc-400" : "text-zinc-500"}`}>
                          {m.from_admin ? "Maintly Team" : "You"}
                        </p>
                      )}
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-snug ${
                        m.from_admin ? "bg-white border border-zinc-200 text-zinc-700 rounded-bl-sm" : "bg-blue-600 text-white rounded-br-sm"
                      }`}>
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`text-[9.5px] mt-1 ${m.from_admin ? "text-zinc-300" : "text-blue-100"}`}>{formatDateDMY(m.created_at)} · {formatTime(m.created_at)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-4 py-3 border-t border-zinc-100 shrink-0 space-y-1.5">
              {error && <p className="text-[11px] text-red-600 px-1">{error}</p>}
              <div className="flex items-end gap-2">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Type a message…"
                  rows={1}
                  autoFocus
                  className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-[13px] outline-none focus:border-red-400 resize-none"
                />
                <button
                  onClick={handleSend}
                  disabled={saving || !body.trim()}
                  className="flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-[12px] transition-all shrink-0"
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
