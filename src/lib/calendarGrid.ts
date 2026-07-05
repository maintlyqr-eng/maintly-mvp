// Shared month-grid helper for the mini calendar (Dashboard widget) and the
// full Calendar page, so both build the exact same 6-week grid and date keys.

export function dateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function todayKey() {
  const t = new Date();
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

export type MonthCell = { key: string; day: number; inMonth: boolean; isToday: boolean };

export function buildMonthGrid(year: number, month: number): MonthCell[] {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0 = Sunday
  const tKey = todayKey();

  const startDate = new Date(year, month, 1 - startWeekday);
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const k = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    cells.push({ key: k, day: d.getDate(), inMonth: d.getMonth() === month, isToday: k === tKey });
  }
  return cells;
}

// Monday-first version, used by the Dashboard's compact widget (matches its
// existing MON..SUN header row). Same cells, just week starts on Monday.
export function buildMonthGridMondayFirst(year: number, month: number): MonthCell[] {
  const firstDay = new Date(year, month, 1);
  const jsWeekday = firstDay.getDay(); // 0 = Sunday
  const mondayFirstOffset = (jsWeekday + 6) % 7; // 0 = Monday
  const tKey = todayKey();

  const startDate = new Date(year, month, 1 - mondayFirstOffset);
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const k = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    cells.push({ key: k, day: d.getDate(), inMonth: d.getMonth() === month, isToday: k === tKey });
  }
  return cells;
}
