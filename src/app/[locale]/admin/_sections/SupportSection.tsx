"use client";

// Facu (26 jul 2026): decimoquinta y última sección extraída del split del
// admin — mismo criterio de siempre. La referencia cruzada con Accounts
// (Accounts puede mandar un mensaje directo que termina en esta misma
// bandeja de Support) vive en las funciones handleSendThreadReply /
// openThread, que se quedan en page.tsx sin cambios — acá solo se pasan
// como props, igual que en el resto de las secciones.

import { Search, MessageCircle, X, Trash2, Send } from "lucide-react";
import {
  formatDate, formatTime,
  type SupportConversation, type SupportThreadState,
} from "../page";

type SupportSectionProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;

  supportLoading: boolean;
  supportConversations: SupportConversation[];

  supportSearch: string;
  setSupportSearch: (v: string) => void;
  supportStatusFilter: "all" | "open" | "closed";
  setSupportStatusFilter: (v: "all" | "open" | "closed") => void;
  supportPriorityFilter: "all" | "low" | "normal" | "high";
  setSupportPriorityFilter: (v: "all" | "low" | "normal" | "high") => void;

  visibleSupportConversations: SupportConversation[];
  supportThreadStates: Record<string, SupportThreadState>;
  defaultThreadState: (mechanicId: string) => SupportThreadState;
  selectedThreadMechanic: string | null;
  openThread: (mechanicId: string) => void | Promise<void>;

  activeThread: SupportConversation | null;
  setSelectedThreadMechanic: (v: string | null) => void;
  confirmClearThread: boolean;
  setConfirmClearThread: (v: boolean) => void;
  handleClearThread: (mechanicId: string) => void | Promise<void>;

  handleToggleSupportStatus: (mechanicId: string) => void | Promise<void>;
  supportStateSaving: boolean;
  handleChangeSupportPriority: (mechanicId: string, priority: SupportThreadState["priority"]) => void | Promise<void>;

  supportNotesDraft: string;
  setSupportNotesDraft: (v: string) => void;
  handleSaveSupportNotes: (mechanicId: string) => void | Promise<void>;

  threadDraft: string;
  setThreadDraft: (v: string) => void;
  handleSendThreadReply: () => void | Promise<void>;
  threadSending: boolean;
};

export default function SupportSection({
  t, locale,
  supportLoading, supportConversations,
  supportSearch, setSupportSearch,
  supportStatusFilter, setSupportStatusFilter,
  supportPriorityFilter, setSupportPriorityFilter,
  visibleSupportConversations, supportThreadStates, defaultThreadState,
  selectedThreadMechanic, openThread,
  activeThread, setSelectedThreadMechanic, confirmClearThread, setConfirmClearThread, handleClearThread,
  handleToggleSupportStatus, supportStateSaving, handleChangeSupportPriority,
  supportNotesDraft, setSupportNotesDraft, handleSaveSupportNotes,
  threadDraft, setThreadDraft, handleSendThreadReply, threadSending,
}: SupportSectionProps) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-zinc-400">
        {t("supportIntro")}
      </p>

      {supportLoading ? (
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center text-[13px] text-zinc-300">
          {t("loading")}
        </div>
      ) : supportConversations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center">
          <MessageCircle size={28} className="mx-auto text-zinc-200 mb-2" />
          <p className="text-[13px] text-zinc-300 font-medium">{t("noConversationsYet")}</p>
        </div>
      ) : (
        <>
          {/* Búsqueda + filtros (incremento 9, item 7 del pedido: "buscar/filtrar") */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative max-w-xs flex-1 min-w-[180px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text" value={supportSearch} onChange={(e) => setSupportSearch(e.target.value)}
                placeholder={t("supportSearchPlaceholder")}
                className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("supportFilterStatus")}</label>
              <select
                value={supportStatusFilter}
                onChange={(e) => setSupportStatusFilter(e.target.value as typeof supportStatusFilter)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
              >
                <option value="all">{t("auditFilterAll")}</option>
                <option value="open">{t("supportStatusOpen")}</option>
                <option value="closed">{t("supportStatusClosed")}</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t("supportFilterPriority")}</label>
              <select
                value={supportPriorityFilter}
                onChange={(e) => setSupportPriorityFilter(e.target.value as typeof supportPriorityFilter)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-red-400"
              >
                <option value="all">{t("auditFilterAll")}</option>
                <option value="low">{t("supportPriorityLow")}</option>
                <option value="normal">{t("supportPriorityNormal")}</option>
                <option value="high">{t("supportPriorityHigh")}</option>
              </select>
            </div>
            {(supportSearch || supportStatusFilter !== "all" || supportPriorityFilter !== "all") && (
              <button
                onClick={() => { setSupportSearch(""); setSupportStatusFilter("all"); setSupportPriorityFilter("all"); }}
                className="text-[11px] font-bold text-zinc-400 hover:text-red-600 transition-colors px-2 py-2"
              >
                {t("auditFilterClear")}
              </button>
            )}
          </div>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-260px)] min-h-[420px]">
          {/* Conversation list */}
          <div className={`bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-y-auto ${activeThread ? "hidden md:block" : ""}`}>
            {visibleSupportConversations.length === 0 ? (
              <p className="text-[12px] text-zinc-300 text-center py-10 px-4">{t("supportNoMatches")}</p>
            ) : visibleSupportConversations.map((c) => {
              const state = supportThreadStates[c.mechanicId] ?? defaultThreadState(c.mechanicId);
              return (
              <button
                key={c.mechanicId}
                onClick={() => openThread(c.mechanicId)}
                className={`w-full flex items-start gap-2.5 px-4 py-3.5 text-left border-b border-zinc-50 transition-colors ${
                  selectedThreadMechanic === c.mechanicId ? "bg-red-50" : "hover:bg-zinc-50"
                }`}
              >
                {c.unreadCount > 0 && <span className="w-2 h-2 rounded-full bg-red-600 mt-1.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12.5px] font-bold text-zinc-900 truncate">{c.mechanic?.name ?? t("unknownMechanic")}</p>
                    <span className="text-[10px] text-zinc-300 shrink-0">{formatDate(c.lastMessage.created_at)}</span>
                  </div>
                  <p className="text-[11.5px] text-zinc-400 truncate mt-0.5">
                    {c.lastMessage.from_admin ? t("youPrefix") : ""}{c.lastMessage.body}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${state.status === "closed" ? "bg-zinc-100 text-zinc-400" : "bg-emerald-50 text-emerald-600"}`}>
                      {state.status === "closed" ? t("supportStatusClosed") : t("supportStatusOpen")}
                    </span>
                    {state.priority !== "normal" && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${state.priority === "high" ? "bg-red-50 text-red-600" : "bg-zinc-50 text-zinc-400"}`}>
                        {state.priority === "high" ? t("supportPriorityHigh") : t("supportPriorityLow")}
                      </span>
                    )}
                  </div>
                </div>
                {c.unreadCount > 0 && (
                  <span className="text-[9px] font-black bg-red-600 text-white rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shrink-0">{c.unreadCount}</span>
                )}
              </button>
              );
            })}
          </div>

          {/* Thread */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm flex flex-col overflow-hidden">
            {!activeThread ? (
              <div className="flex-1 flex items-center justify-center text-center px-6">
                <p className="text-[12px] text-zinc-300">{t("pickConversationReply")}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-100">
                  <button onClick={() => setSelectedThreadMechanic(null)} className="md:hidden text-zinc-400 hover:text-zinc-700 mr-1">
                    <X size={16} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-zinc-900 truncate">{activeThread.mechanic?.name ?? t("unknownMechanic")}</p>
                    <p className="text-[11px] text-zinc-400 truncate">{activeThread.mechanic?.email ?? ""}</p>
                  </div>
                  {confirmClearThread ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] text-zinc-400 hidden sm:inline">{t("clearForYouOnly")}</span>
                      <button
                        onClick={() => handleClearThread(activeThread.mechanicId)}
                        className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        {t("confirm")}
                      </button>
                      <button
                        onClick={() => setConfirmClearThread(false)}
                        className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 px-2 py-1.5"
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmClearThread(true)}
                      className="text-zinc-300 hover:text-red-600 transition-colors shrink-0"
                      title={t("clearConversationTitle")}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                {/* Estado / prioridad / notas internas del caso (incremento 9) */}
                <div className="px-5 py-2.5 border-b border-zinc-100 bg-zinc-50/60 flex flex-wrap items-center gap-2">
                  {(() => {
                    const state = supportThreadStates[activeThread.mechanicId] ?? defaultThreadState(activeThread.mechanicId);
                    return (
                      <>
                        <button
                          onClick={() => handleToggleSupportStatus(activeThread.mechanicId)}
                          disabled={supportStateSaving}
                          className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                            state.status === "closed" ? "bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {state.status === "closed" ? t("supportReopenCase") : t("supportCloseCase")}
                        </button>
                        <select
                          value={state.priority}
                          disabled={supportStateSaving}
                          onChange={(e) => handleChangeSupportPriority(activeThread.mechanicId, e.target.value as SupportThreadState["priority"])}
                          className="text-[11px] font-semibold rounded-lg border border-zinc-200 bg-white px-2 py-1.5 outline-none focus:border-red-400 disabled:opacity-50"
                        >
                          <option value="low">{t("supportPriorityLow")}</option>
                          <option value="normal">{t("supportPriorityNormal")}</option>
                          <option value="high">{t("supportPriorityHigh")}</option>
                        </select>
                        {state.status === "closed" && state.closed_at && (
                          <span className="text-[10px] text-zinc-400">
                            {t("supportClosedByPrefix")} {state.closed_by ?? "—"} · {formatDate(state.closed_at)}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="px-5 py-2.5 border-b border-zinc-100 flex items-start gap-2">
                  <textarea
                    value={supportNotesDraft}
                    onChange={(e) => setSupportNotesDraft(e.target.value)}
                    placeholder={t("supportInternalNotesPlaceholder")}
                    rows={2}
                    className="flex-1 rounded-lg border border-zinc-200 px-2.5 py-2 text-[11.5px] outline-none focus:border-red-400 resize-none bg-amber-50/40"
                  />
                  <button
                    onClick={() => handleSaveSupportNotes(activeThread.mechanicId)}
                    disabled={supportStateSaving}
                    className="text-[11px] font-bold text-white bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors shrink-0"
                  >
                    {t("save")}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5 bg-zinc-50/40">
                  {activeThread.messages.map((m, i) => {
                    const prev = activeThread.messages[i - 1];
                    const showLabel = !prev || prev.from_admin !== m.from_admin;
                    return (
                      <div key={m.id} className={`flex flex-col ${m.from_admin ? "items-end" : "items-start"}`}>
                        {showLabel && (
                          <p className={`text-[10px] font-black uppercase tracking-wide mb-1 px-1 ${m.from_admin ? "text-zinc-400" : "text-zinc-400"}`}>
                            {m.from_admin ? t("you") : activeThread.mechanic?.name ?? t("mechanicLabel")}
                          </p>
                        )}
                        <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-snug ${
                          m.from_admin ? "bg-red-600 text-white rounded-br-sm" : "bg-white border border-zinc-200 text-zinc-700 rounded-bl-sm"
                        }`}>
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p className={`text-[9.5px] mt-1 ${m.from_admin ? "text-red-100" : "text-zinc-300"}`}>{formatDate(m.created_at)} · {formatTime(m.created_at, locale)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="px-4 py-3 border-t border-zinc-100 flex items-end gap-2">
                  <textarea
                    value={threadDraft}
                    onChange={(e) => setThreadDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendThreadReply(); } }}
                    placeholder={t("quickReplyPlaceholder")}
                    rows={1}
                    className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-[13px] outline-none focus:border-red-400 resize-none"
                  />
                  <button
                    onClick={handleSendThreadReply}
                    disabled={threadSending || !threadDraft.trim()}
                    className="flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-[12px] transition-all shrink-0"
                  >
                    <Send size={13} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
