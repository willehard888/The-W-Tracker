// Gap-fill for status-tiers: the compact chip format, per-tier username
// classes, and the legacy-'normal' tolerance (a legacy value found live in
// prod, normalized by migration — the client must still degrade gracefully
// if it ever reappears).
import { describe, it, expect } from "vitest";
import {
  getTierConfig,
  formatTierShort,
  getTierUsernameClass,
  getTierHeroSurface,
  ladderRankValue,
  getNextTier,
  canonicalTier,
  topShareLabel,
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

  it("getNextTier('normal') canonicalizes to recruit's next tier — the old null told a recruit '→ Legend' in the header", () => {
    expect(getNextTier("normal")?.label).toBe(getNextTier("recruit")?.label);
    expect(getNextTier("normal")?.label).toBe("Operator");
  });
});

describe("canonicalTier", () => {
  it("maps legacy/unknown/empty values to recruit, passes real tiers through", () => {
    expect(canonicalTier("normal")).toBe("recruit");
    expect(canonicalTier(undefined)).toBe("recruit");
    expect(canonicalTier(null)).toBe("recruit");
    expect(canonicalTier("garbage")).toBe("recruit");
    expect(canonicalTier("legend")).toBe("legend");
    expect(canonicalTier("operator")).toBe("operator");
  });
});

describe("topShareLabel — the ONE percentile derivation", () => {
  // The header once said "Top 0.1%" (static band) while the nameplate said
  // "Top 50%" (live #1 of 2) for the same user. This locks the shared rule.
  it("prefers the live percentile over the tier band", () => {
    expect(topShareLabel("legend", { percentile: 50, hasRank: true })).toBe("Top 50%");
  });

  it("derives from rank/total when percentile is absent", () => {
    expect(topShareLabel("elite", { rank: 1, totalUsers: 4, hasRank: true })).toBe("Top 25%");
  });

  it("never rounds down to Top 0%", () => {
    expect(topShareLabel("legend", { percentile: 99.9, hasRank: true })).toBe("Top 1%");
  });

  it("shows Unranked for unearned ranks regardless of numbers", () => {
    expect(topShareLabel("recruit", { rank: 3, totalUsers: 2, hasRank: false })).toBe("Unranked");
  });

  it("falls back to the tier band only when no data exists at all", () => {
    expect(topShareLabel("legend", null)).toBe(getTierConfig("legend").percentile);
    expect(topShareLabel("legend", undefined)).toBe(getTierConfig("legend").percentile);
  });

  it("ignores insane rank data (rank > total) instead of inventing a share", () => {
    expect(topShareLabel("legend", { rank: 4, totalUsers: 2, hasRank: true })).toBe(
      getTierConfig("legend").percentile,
    );
  });
});

describe("getTierHeroSurface", () => {
  it("gives every tier a bg + glow, with distinct high-tier surfaces", () => {
    for (const t of TIER_ORDER) {
      const s = getTierHeroSurface(t);
      expect(s.bgClass).toBeTruthy();
      expect(s.glowStyle).toContain("radial-gradient");
    }
    expect(getTierHeroSurface("legend").bgClass).not.toBe(getTierHeroSurface("recruit").bgClass);
    expect(getTierHeroSurface("apex").bgClass).not.toBe(getTierHeroSurface("elite").bgClass);
  });

  it("unknown tiers get the neutral recruit surface", () => {
    expect(getTierHeroSurface("garbage").bgClass).toBe(getTierHeroSurface("recruit").bgClass);
  });
});
