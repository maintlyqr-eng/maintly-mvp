"use client";

// Facu (26 jul 2026): quinta sección extraída del split del admin — mismo
// criterio que las anteriores (JSX movido tal cual, estado y lógica se
// quedan en page.tsx).

import { Flag, MessageCircle, X } from "lucide-react";
import type { useTranslations } from "next-intl";
import {
  formatDate, formatTime,
  type MechanicConversation, type MechanicReportRow, type MechanicMsgRow,
} from "../page";

type TeamChatSectionProps = {
  // t.rich() se usa acá (línea "reportedLine"), por eso el tipo completo de
  // next-intl en vez del `(key, values) => string` simplificado que usan
  // las otras secciones — esas no necesitan .rich().
  t: ReturnType<typeof useTranslations>;
  locale: string;

  teamChatView: "conversations" | "reports";
  setTeamChatView: (v: "conversations" | "reports") => void;

  mechanicReports: MechanicReportRow[];
  mechanicReportsLoading: boolean;
  teamChatConversations: MechanicConversation[];
  teamChatLoading: boolean;

  selectedTeamChatPair: string | null;
  setSelectedTeamChatPair: (v: string | null) => void;
  activeTeamChatThread: MechanicConversation | null;

  teamChatPersonLabel: (m: MechanicMsgRow, id: string) => string;
};

export default function TeamChatSection({
  t, locale,
  teamChatView, setTeamChatView,
  mechanicReports, mechanicReportsLoading, teamChatConversations, teamChatLoading,
  selectedTeamChatPair, setSelectedTeamChatPair, activeTeamChatThread,
  teamChatPersonLabel,
}: TeamChatSectionProps) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-zinc-400">
        {t("teamChatIntro")}
      </p>

      <div className="flex items-center gap-1 bg-white rounded-xl border border-zinc-200/80 p-1 w-fit">
        <button
          onClick={() => setTeamChatView("conversations")}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${
            teamChatView === "conversations" ? "bg-red-600 text-white" : "text-zinc-500 hover:bg-zinc-100"
          }`}
        >
          {t("conversationsTab")}
        </button>
        <button
          onClick={() => setTeamChatView("reports")}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors flex items-center gap-1.5 ${
            teamChatView === "reports" ? "bg-red-600 text-white" : "text-zinc-500 hover:bg-zinc-100"
          }`}
        >
          <Flag size={12} /> {t("reportsTab")}
          {mechanicReports.length > 0 && (
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none ${
              teamChatView === "reports" ? "bg-white text-red-600" : "bg-amber-500 text-white"
            }`}>
              {mechanicReports.length}
            </span>
          )}
        </button>
      </div>

      {teamChatView === "reports" ? (
        mechanicReportsLoading ? (
          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center text-[13px] text-zinc-300">
            {t("loading")}
          </div>
        ) : mechanicReports.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center">
            <Flag size={28} className="mx-auto text-zinc-200 mb-2" />
            <p className="text-[13px] text-zinc-300 font-medium">{t("noReportsFiled")}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm divide-y divide-zinc-50">
            {mechanicReports.map((r) => {
              const pairKey = [r.reporter_id, r.reported_id].sort().join("|");
              const hasThread = teamChatConversations.some((c) => c.pairKey === pairKey);
              return (
                <div key={r.id} className="px-5 py-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-bold text-zinc-900">
                      {t.rich("reportedLine", {
                        reporter: r.reporter?.name ?? t("unknown"),
                        reported: r.reported?.name ?? t("unknown"),
                        span: (chunks) => <span className="font-normal text-zinc-400">{chunks}</span>,
                      })}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{r.reporter?.email} → {r.reported?.email}</p>
                    {r.reason && <p className="text-[12px] text-zinc-600 mt-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">{r.reason}</p>}
                    <p className="text-[10.5px] text-zinc-300 mt-1.5">{formatDate(r.created_at)} · {formatTime(r.created_at, locale)}</p>
                  </div>
                  {hasThread && (
                    <button
                      onClick={() => { setTeamChatView("conversations"); setSelectedTeamChatPair(pairKey); }}
                      className="text-[11px] font-bold text-red-600 hover:text-red-700 shrink-0 whitespace-nowrap"
                    >
                      {t("viewConversation")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : teamChatLoading ? (
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center text-[13px] text-zinc-300">
          {t("loading")}
        </div>
      ) : teamChatConversations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm py-16 text-center">
          <MessageCircle size={28} className="mx-auto text-zinc-200 mb-2" />
          <p className="text-[13px] text-zinc-300 font-medium">{t("noTeamChatConversations")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-260px)] min-h-[420px]">
          {/* Conversation list */}
          <div className={`bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-y-auto ${activeTeamChatThread ? "hidden md:block" : ""}`}>
            {teamChatConversations.map((c) => (
              <button
                key={c.pairKey}
                onClick={() => setSelectedTeamChatPair(c.pairKey)}
                className={`w-full flex items-start gap-2.5 px-4 py-3.5 text-left border-b border-zinc-50 transition-colors ${
                  selectedTeamChatPair === c.pairKey ? "bg-red-50" : "hover:bg-zinc-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-zinc-900 truncate">
                    {c.a.info?.name ?? t("unknown")} <span className="font-normal text-zinc-400">↔</span> {c.b.info?.name ?? t("unknown")}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-[11.5px] text-zinc-400 truncate">{teamChatPersonLabel(c.lastMessage, c.lastMessage.sender_id)}: {c.lastMessage.body}</p>
                    <span className="text-[10px] text-zinc-300 shrink-0">{formatDate(c.lastMessage.created_at)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Thread */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm flex flex-col overflow-hidden">
            {!activeTeamChatThread ? (
              <div className="flex-1 flex items-center justify-center text-center px-6">
                <p className="text-[12px] text-zinc-300">{t("pickConversationHistory")}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-100">
                  <button onClick={() => setSelectedTeamChatPair(null)} className="md:hidden text-zinc-400 hover:text-zinc-700 mr-1">
                    <X size={16} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-zinc-900 truncate">
                      {activeTeamChatThread.a.info?.name ?? t("unknown")} ↔ {activeTeamChatThread.b.info?.name ?? t("unknown")}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">{activeTeamChatThread.a.info?.email} · {activeTeamChatThread.b.info?.email}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5 bg-zinc-50/40">
                  {activeTeamChatThread.messages.map((m, i) => {
                    const prev = activeTeamChatThread.messages[i - 1];
                    const showLabel = !prev || prev.sender_id !== m.sender_id;
                    const isA = m.sender_id === activeTeamChatThread.a.id;
                    const hiddenNote = [
                      m.hidden_for_sender ? t("clearedBySender") : null,
                      m.hidden_for_recipient ? t("clearedByRecipient") : null,
                    ].filter(Boolean).join(", ");
                    return (
                      <div key={m.id} className={`flex flex-col ${isA ? "items-start" : "items-end"}`}>
                        {showLabel && (
                          <p className="text-[10px] font-black uppercase tracking-wide mb-1 px-1 text-zinc-400">
                            {teamChatPersonLabel(m, m.sender_id)}
                          </p>
                        )}
                        <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-snug ${
                          isA ? "bg-white border border-zinc-200 text-zinc-700 rounded-bl-sm" : "bg-red-600 text-white rounded-br-sm"
                        }`}>
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p className={`text-[9.5px] mt-1 ${isA ? "text-zinc-300" : "text-red-100"}`}>
                            {formatDate(m.created_at)} · {formatTime(m.created_at, locale)}
                            {hiddenNote && ` · ${hiddenNote}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
