/**
 * THE number/date formatters. Numbers group thousands with a no-break space
 * (fi-FI style, never a comma) and glue to their unit with one, so "1 240 XP"
 * can never wrap between the digits and the unit.
 */

/** No-break space — thousands separator and number↔unit glue. */
export const NBSP = " ";

/** Integer with NBSP thousands grouping: 1240 → "1 240"; non-finite → "—". */
export const fmtInt = (n: number): string => {
  if (!Number.isFinite(n)) return "—";
  const v = Math.round(n);
  const grouped = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return v < 0 ? `-${grouped}` : grouped;
};

/** kcal is an integer. */
export const fmtKcal = fmtInt;

/** Grams: one decimal up to 10 g, integers above. */
export const fmtG = (n: number): string =>
  !Number.isFinite(n) ? "—" : Math.abs(n) <= 10 ? n.toFixed(1) : String(Math.round(n));

/** Number glued to its unit: fmtUnit(1240, "XP") → "1 240 XP". */
export const fmtUnit = (n: number, unit: string): string => `${fmtInt(n)}${NBSP}${unit}`;

/** "Aug 24" — the year is added only when it is not the current one. */
export const fmtDate = (d: string | number | Date, now: Date = new Date()): string => {
  const date = new Date(d);
  if (!Number.isFinite(date.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (date.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return date.toLocaleDateString("en-US", opts);
};

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * Short relative time for feeds and lists: "just now" · "5m ago" · "3h ago"
 * · "6d ago" · "in 2d"; older than a week falls back to the date.
 */
export const fmtRelative = (d: string | number | Date, now: number = Date.now()): string => {
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = now - t;
  const abs = Math.abs(diff);
  if (abs < MIN) return "just now";
  if (abs >= 7 * DAY) return fmtDate(t, new Date(now));
  const span = abs < HOUR ? `${Math.floor(abs / MIN)}m` : abs < DAY ? `${Math.floor(abs / HOUR)}h` : `${Math.floor(abs / DAY)}d`;
  return diff < 0 ? `in ${span}` : `${span} ago`;
};
