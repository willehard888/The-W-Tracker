// Pure decisions of the nutrition-lookup edge function. No Deno imports on
// purpose: src/lib/__tests__/nutrition-lookup-decide.test.ts pins them.

export type UpstreamStatus = "hit" | "miss" | "rate_limited" | "error" | "skipped";
export type MissSource = "off" | "usda";

export const MISS_TTL_MS = 7 * 86400_000;

/**
 * A remembered miss only counts while its TTL holds AND every source we can
 * ask today was asked back then — a miss cached before the USDA key existed
 * must not silence USDA now.
 */
export function missCacheFresh(
  row: { checked_at: string; sources_checked: string[] } | null,
  configured: string[],
  now = Date.now(),
): boolean {
  if (!row || now - new Date(row.checked_at).getTime() >= MISS_TTL_MS) return false;
  return configured.every((s) => row.sources_checked.includes(s));
}

/**
 * Nothing found anywhere: throttled only when every source we asked said so;
 * otherwise a miss listing the sources that definitively said "no" (a
 * timeout, an error or a missing key is not a "no").
 */
export function missOutcome(status: {
  off: UpstreamStatus;
  usda: UpstreamStatus;
}): { kind: "rate_limited" } | { kind: "miss"; sources_checked: MissSource[] } {
  const asked = (["off", "usda"] as const).filter((s) => status[s] !== "skipped");
  if (asked.length && asked.every((s) => status[s] === "rate_limited")) return { kind: "rate_limited" };
  return { kind: "miss", sources_checked: asked.filter((s) => status[s] === "miss") };
}

/** USDA stores label GTINs as printed — UPC-A products are 12 digits there. */
export const usdaBarcodeQuery = (code: string): string =>
  code.length === 13 && code.startsWith("0") ? code.slice(1) : code;
