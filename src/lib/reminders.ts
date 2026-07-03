// Shared logic for computing maintenance reminder status.
// A reminder is set manually per service record (next_due_date and/or next_due_km_hours).
// Status is derived from the asset's most recent service record that has a reminder set,
// compared against today's date and/or the asset's latest known km/hours reading.

export type ReminderStatus = "overdue" | "due_soon" | "ok" | "none";

export const DEFAULT_DUE_SOON_DAYS = 14;
export const DEFAULT_DUE_SOON_KM_HOURS = 500;

export type ReminderInput = {
  nextDueDate?: string | null;       // "YYYY-MM-DD"
  nextDueKmHours?: number | null;
  currentKmHours?: number | null;    // most recent known km/hours reading for the asset
  dueSoonDays?: number;
  dueSoonKmHours?: number;
  today?: Date;                      // injectable for tests; defaults to now
};

const STATUS_RANK: Record<ReminderStatus, number> = {
  none: 0,
  ok: 1,
  due_soon: 2,
  overdue: 3,
};

function worse(a: ReminderStatus, b: ReminderStatus): ReminderStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

export function computeReminderStatus(input: ReminderInput): ReminderStatus {
  const {
    nextDueDate,
    nextDueKmHours,
    currentKmHours,
    dueSoonDays = DEFAULT_DUE_SOON_DAYS,
    dueSoonKmHours = DEFAULT_DUE_SOON_KM_HOURS,
    today = new Date(),
  } = input;

  let status: ReminderStatus = "none";

  if (nextDueDate) {
    const due = new Date(nextDueDate + "T00:00:00");
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daysUntil = Math.round((due.getTime() - t.getTime()) / 86400000);
    const dateStatus: ReminderStatus = daysUntil < 0 ? "overdue" : daysUntil <= dueSoonDays ? "due_soon" : "ok";
    status = worse(status, dateStatus);
  }

  if (nextDueKmHours != null && currentKmHours != null) {
    const remaining = nextDueKmHours - currentKmHours;
    const kmStatus: ReminderStatus = remaining <= 0 ? "overdue" : remaining <= dueSoonKmHours ? "due_soon" : "ok";
    status = worse(status, kmStatus);
  } else if (nextDueKmHours != null && currentKmHours == null) {
    // A km/hours target was set but we have no current reading to compare — treat as "ok" (not none)
    // since a reminder does exist, just can't be evaluated precisely yet.
    status = worse(status, "ok");
  }

  return status;
}

export const REMINDER_STATUS_LABEL: Record<ReminderStatus, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  ok: "OK",
  none: "No reminder",
};

export const REMINDER_STATUS_COLOR: Record<ReminderStatus, { bg: string; text: string; dot: string }> = {
  overdue:  { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500" },
  due_soon: { bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-500" },
  ok:       { bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500" },
  none:     { bg: "bg-zinc-100",   text: "text-zinc-400",   dot: "bg-zinc-300" },
};
