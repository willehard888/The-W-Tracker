// Display formatting — precision here is a UI concern and never feeds math.

import { roundTo } from "./scale";

// NBSP / fmtKcal / fmtG live in the app-wide formatter now; re-exported so
// nutrition call sites keep one import.
export { NBSP, fmtKcal, fmtG } from "@/lib/format";

const FRACTION_GLYPH: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };
/** Quantity for pills/rows: ½ · ¼ · ¾ · 1½ · integers plain · else ≤ 2 decimals trimmed. */
export function fmtQty(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n < 0) return String(-roundTo(-n, 2));
  const whole = Math.floor(n);
  const glyph = FRACTION_GLYPH[String(roundTo(n - whole, 2))];
  if (glyph) return whole === 0 ? glyph : `${whole}${glyph}`;
  return String(roundTo(n, 2));
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
