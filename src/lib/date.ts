// Shared date display helper — the whole platform shows dates as DD/MM/YYYY.
// Accepts either a plain "YYYY-MM-DD" date string (from a date column) or a
// full ISO timestamp (e.g. created_at). Plain dates are parsed at local
// midnight so the calendar day never shifts due to timezone conversion.

export function formatDateDMY(input: string | null | undefined): string {
  if (!input) return "—";

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(input);
  const d = isDateOnly ? new Date(input + "T00:00:00") : new Date(input);
  if (isNaN(d.getTime())) return input;

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Days between a "YYYY-MM-DD" date string and today (local calendar days, not 24h periods).
// Positive = in the future, negative = in the past, 0 = today.
function daysFromToday(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - todayMidnight.getTime()) / 86400000);
}

// "3 days ago" / "Today" / "Yesterday" for a past date.
export function daysAgoLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const diff = daysFromToday(dateStr);
  const ago = -diff;
  if (ago <= 0) return "Today";
  if (ago === 1) return "Yesterday";
  return `${ago} days ago`;
}

// "In 3 days" / "Today" / "Overdue by 3 days" for a future/target date.
export function daysUntilLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const diff = daysFromToday(dateStr);
  if (diff === 0) return "Today";
  if (diff > 0) return diff === 1 ? "In 1 day" : `In ${diff} days`;
  const overdueBy = -diff;
  return overdueBy === 1 ? "Overdue by 1 day" : `Overdue by ${overdueBy} days`;
}
