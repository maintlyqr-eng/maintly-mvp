"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Wrench, Bell, CheckCircle2, Circle } from "lucide-react";
import { REMINDER_STATUS_COLOR, REMINDER_STATUS_LABEL, type ReminderStatus } from "@/lib/reminders";

const BUBBLE_WIDTH = 272;
const MAX_ITEMS_PER_SECTION = 4;

export type DayInfo = {
  services: { label: string; type: string }[];
  tasks: { title: string; done: boolean }[];
  reminders: { label: string; type: string; status: ReminderStatus }[];
};

type Props = {
  dateKey: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  dateLabel: string;
  info?: DayInfo;
  dotColor: string | null;
};

export default function CalendarDayCell({ dateKey, day, inMonth, isToday, dateLabel, info, dotColor }: Props) {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, arrowLeft: BUBBLE_WIDTH / 2 });

  function handleEnter() {
    if (!info) return;
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawLeft = rect.left + rect.width / 2 - BUBBLE_WIDTH / 2;
    const left = Math.min(Math.max(8, rawLeft), window.innerWidth - BUBBLE_WIDTH - 8);
    const arrowLeft = Math.min(Math.max(16, rect.left + rect.width / 2 - left), BUBBLE_WIDTH - 16);
    setPos({ top: rect.bottom + 10, left, arrowLeft });
    setHover(true);
  }

  const hasAny = !!info && (info.services.length + info.tasks.length + info.reminders.length > 0);

  return (
    <Link
      ref={anchorRef}
      href={`/dashboard/calendar?date=${dateKey}`}
      className="relative flex flex-col items-center py-1"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHover(false)}
    >
      <span className={`text-[11px] w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
        isToday ? "bg-red-600 text-white font-bold" : !inMonth ? "text-zinc-300" : "text-zinc-600 hover:bg-zinc-100"
      }`}>
        {day}
      </span>
      <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${dotColor ?? "bg-transparent"}`} />

      {hover && hasAny && info && (
        <div className="fixed z-[100] pointer-events-none" style={{ top: pos.top, left: pos.left, width: BUBBLE_WIDTH }}>
          <div
            className="absolute w-3 h-3 bg-white border-l border-t border-zinc-200 rotate-45 -top-1.5"
            style={{ left: pos.arrowLeft - 6 }}
          />
          <div className="relative bg-white rounded-2xl border border-zinc-200 shadow-2xl p-4">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[12px] font-black text-zinc-900">{dateLabel}</p>
              {isToday && <span className="text-[9px] font-bold text-red-600 bg-red-50 rounded-full px-2 py-[2px]">Today</span>}
            </div>

            <div className="space-y-3">
              {info.reminders.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-400 uppercase tracking-wide mb-1.5">
                    <Bell size={10} /> Due this day
                  </p>
                  <div className="space-y-1">
                    {info.reminders.slice(0, MAX_ITEMS_PER_SECTION).map((r, i) => {
                      const sc = REMINDER_STATUS_COLOR[r.status];
                      return (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sc.dot}`} />
                          <p className="text-[11px] text-zinc-700 truncate flex-1">{r.label} <span className="text-zinc-400">· {r.type}</span></p>
                          <span className={`shrink-0 text-[8.5px] font-bold px-1.5 py-[1px] rounded-full ${sc.bg} ${sc.text}`}>{REMINDER_STATUS_LABEL[r.status]}</span>
                        </div>
                      );
                    })}
                    {info.reminders.length > MAX_ITEMS_PER_SECTION && (
                      <p className="text-[10px] text-zinc-400">+{info.reminders.length - MAX_ITEMS_PER_SECTION} more</p>
                    )}
                  </div>
                </div>
              )}

              {info.tasks.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-400 uppercase tracking-wide mb-1.5">
                    <CheckCircle2 size={10} /> Planned tasks
                  </p>
                  <div className="space-y-1">
                    {info.tasks.slice(0, MAX_ITEMS_PER_SECTION).map((t, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        {t.done ? <CheckCircle2 size={11} className="text-emerald-500 shrink-0" /> : <Circle size={11} className="text-blue-400 shrink-0" />}
                        <p className={`text-[11px] truncate ${t.done ? "text-zinc-300 line-through" : "text-zinc-700"}`}>{t.title}</p>
                      </div>
                    ))}
                    {info.tasks.length > MAX_ITEMS_PER_SECTION && (
                      <p className="text-[10px] text-zinc-400">+{info.tasks.length - MAX_ITEMS_PER_SECTION} more</p>
                    )}
                  </div>
                </div>
              )}

              {info.services.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-400 uppercase tracking-wide mb-1.5">
                    <Wrench size={10} /> Services logged
                  </p>
                  <div className="space-y-1">
                    {info.services.slice(0, MAX_ITEMS_PER_SECTION).map((s, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <p className="text-[11px] text-zinc-700 truncate">{s.label} <span className="text-zinc-400">· {s.type}</span></p>
                      </div>
                    ))}
                    {info.services.length > MAX_ITEMS_PER_SECTION && (
                      <p className="text-[10px] text-zinc-400">+{info.services.length - MAX_ITEMS_PER_SECTION} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <p className="text-[9.5px] text-zinc-300 mt-3 pt-2 border-t border-zinc-100">Click to open in Calendar →</p>
          </div>
        </div>
      )}
    </Link>
  );
}
