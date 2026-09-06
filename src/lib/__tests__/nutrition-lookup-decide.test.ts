// Pure decisions of the nutrition-lookup edge function (Deno) — lives outside
// src/ but has no Deno imports so vitest can pin them: when a cached miss is
// still trusted, when "nothing found" means throttled vs. a real miss, and
// the USDA query form.
import { describe, it, expect } from "vitest";
import { MISS_TTL_MS, missCacheFresh, missOutcome, usdaBarcodeQuery } from "../../../supabase/functions/nutrition-lookup/decide";

const NOW = Date.parse("2026-09-05T12:00:00Z");
const at = (agoMs: number) => new Date(NOW - agoMs).toISOString();

describe("missCacheFresh", () => {
  it("is stale past the TTL and for no row", () => {
    expect(missCacheFresh(null, ["off"], NOW)).toBe(false);
    expect(missCacheFresh({ checked_at: at(MISS_TTL_MS), sources_checked: ["off", "usda"] }, ["off"], NOW)).toBe(false);
  });
  it("is stale when a configured source was not asked back then", () => {
    expect(missCacheFresh({ checked_at: at(60_000), sources_checked: ["off"] }, ["off", "usda"], NOW)).toBe(false);
  });
  it("is fresh inside the TTL with every configured source checked", () => {
    expect(missCacheFresh({ checked_at: at(60_000), sources_checked: ["off", "usda"] }, ["off", "usda"], NOW)).toBe(true);
    expect(missCacheFresh({ checked_at: at(60_000), sources_checked: ["off", "usda"] }, ["off"], NOW)).toBe(true);
  });
});

describe("missOutcome", () => {
  it("OFF throttled + USDA miss → a miss remembered for usda only", () => {
    expect(missOutcome({ off: "rate_limited", usda: "miss" })).toEqual({ kind: "miss", sources_checked: ["usda"] });
  });
  it("OFF throttled + USDA skipped → rate limited", () => {
    expect(missOutcome({ off: "rate_limited", usda: "skipped" })).toEqual({ kind: "rate_limited" });
  });
  it("both errored → a miss nobody vouched for (nothing to remember)", () => {
    expect(missOutcome({ off: "error", usda: "error" })).toEqual({ kind: "miss", sources_checked: [] });
  });
  it("both said no → remember both", () => {
    expect(missOutcome({ off: "miss", usda: "miss" })).toEqual({ kind: "miss", sources_checked: ["off", "usda"] });
  });
});

describe("usdaBarcodeQuery", () => {
  it("strips the UPC-A padding zero, leaves EAN-13 and EAN-8 alone", () => {
    expect(usdaBarcodeQuery("0036000291452")).toBe("036000291452");
    expect(usdaBarcodeQuery("4006381333931")).toBe("4006381333931");
    expect(usdaBarcodeQuery("96385074")).toBe("96385074");
  });
});
