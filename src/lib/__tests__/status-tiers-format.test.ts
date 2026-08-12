// Gap-fill for status-tiers: the compact chip format, per-tier username
// classes, and the legacy-'normal' tolerance (a legacy value found live in
// prod, normalized by migration — the client must still degrade gracefully
// if it ever reappears).
import { describe, it, expect } from "vitest";
import {
  getTierConfig,
  formatTierShort,
  getTierUsernameClass,
  ladderRankValue,
  getNextTier,
  TIER_ORDER,
} from "@/lib/status-tiers";

describe("formatTierShort", () => {
  it("appends the division roman only on divisioned tiers", () => {
    expect(formatTierShort("elite", 2)).toBe(`${getTierConfig("elite").shortLabel} II`);
    expect(formatTierShort("recruit", 2)).toBe(getTierConfig("recruit").shortLabel); // singular
    expect(formatTierShort("legend", 3)).toBe(getTierConfig("legend").shortLabel);
  });
});

describe("getTierUsernameClass", () => {
  it("returns a non-empty class for every ladder tier", () => {
    for (const t of TIER_ORDER) {
      expect(getTierUsernameClass(t)).toBeTruthy();
    }
  });
});

describe("legacy 'normal' tier tolerance", () => {
  it("falls back to recruit config instead of crashing", () => {
    expect(getTierConfig("normal")).toEqual(getTierConfig("recruit"));
  });

  it("ranks at the bottom of the ladder (clamped, never negative)", () => {
    expect(ladderRankValue("normal")).toBeGreaterThanOrEqual(0);
    expect(ladderRankValue("normal")).toBe(ladderRankValue("recruit"));
  });

  it("KNOWN LIMITATION: getNextTier('normal') is null — the data migration normalize_legacy_normal_tier keeps the value out of prod", () => {
    expect(getNextTier("normal")).toBeNull();
  });
});
