// Display formatting — precision here is a UI concern and never feeds math.

import { roundTo } from "./scale";

const FRACTION_GLYPH: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };
/** No-break space — the fi-FI thousands separator; keeps "1 240" on one line. */
export const NBSP = "\u00A0";

/** Quantity for pills/rows: ½ · ¼ · ¾ · 1½ · integers plain · else ≤ 2 decimals trimmed. */
export function fmtQty(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n < 0) return String(-roundTo(-n, 2));
  const whole = Math.floor(n);
  const glyph = FRACTION_GLYPH[String(roundTo(n - whole, 2))];
  if (glyph) return whole === 0 ? glyph : `${whole}${glyph}`;
  return String(roundTo(n, 2));
}

/** Integer kcal with no-break-space thousands grouping: 1240 → "1 240". */
export function fmtKcal(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const v = Math.round(n);
  const grouped = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return v < 0 ? `-${grouped}` : grouped;
}

/** Grams: one decimal up to 10 g, integers above. */
export function fmtG(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.abs(n) <= 10 ? n.toFixed(1) : String(Math.round(n));
}

/** Search key: trim, collapse spaces, lowercase, strip diacritics (NFD) — mirrors `f_unaccent(lower(btrim()))`. */
export function normalizeQuery(q: string): string {
  return q
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
