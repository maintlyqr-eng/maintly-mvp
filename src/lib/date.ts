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
