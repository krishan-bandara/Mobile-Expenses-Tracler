export function formatCurrency(amount: number, currency = "LKR"): string {
  const symbol = currency === "LKR" ? "Rs " : `${currency} `;
  return symbol + amount.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * "YYYY-MM-DD" built from a Date's own local year/month/day fields —
 * never via .toISOString(), which converts to UTC first and silently
 * rolls the date back by one day in any timezone ahead of UTC (all of
 * Sri Lanka, most of Asia, Europe, Australia). That bug is exactly why
 * month boundaries and "today" were previously landing on the wrong
 * day/month for anyone not in a UTC-or-behind timezone.
 */
export function localDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM" from local calendar fields — same reasoning as localDateISO. */
export function localMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function monthStartISO(date = new Date()): string {
  return localDateISO(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function daysLeftInMonth(date = new Date()): number {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return end.getDate() - date.getDate();
}

export function todayISO(): string {
  return localDateISO(new Date());
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
