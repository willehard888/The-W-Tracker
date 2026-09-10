import { describe, it, expect } from "vitest";
import {
  getTierConfig,
  tierRequirementSentence,
  formatTier,
  ladderRankValue,
  tierFromLadder,
  divisionFromLadder,
  divisionRoman,
  getNextTier,
  getPreviousTier,
  TIER_ORDER,
} from "@/lib/status-tiers";

describe("getTierConfig", () => {
  it("returns a config for every known tier", () => {
    for (const t of TIER_ORDER) {
      expect(getTierConfig(t).label).toBeTruthy();
    }
  });
  it("falls back gracefully for an unknown tier (never throws)", () => {
    expect(() => getTierConfig("does_not_exist")).not.toThrow();
    expect(getTierConfig("does_not_exist").label).toBeTruthy();
  });
});

describe("ladder value ↔ tier/division round-trip", () => {
  it("is monotonic across the ladder", () => {
    expect(ladderRankValue("recruit")).toBeLessThan(ladderRankValue("operator"));
    expect(ladderRankValue("operator")).toBeLessThan(ladderRankValue("legend"));
    // Higher division within a tier ranks higher.
    expect(ladderRankValue("operator", 2)).toBeGreaterThan(ladderRankValue("operator", 1));
  });

  it("decodes back to the same tier + division", () => {
    for (const tier of TIER_ORDER) {
      for (const div of [0, 1, 2, 3]) {
        const v = ladderRankValue(tier, div);
        expect(tierFromLadder(v)).toBe(tier);
        expect(divisionFromLadder(v)).toBe(div);
      }
    }
  });
});

describe("formatTier", () => {
  it("omits divisions for singular tiers (recruit / legend)", () => {
    expect(formatTier("recruit", 2)).toBe(getTierConfig("recruit").label);
    expect(formatTier("legend", 3)).toBe(getTierConfig("legend").label);
  });
  it("appends a roman division for divisioned tiers", () => {
    const withDiv = formatTier("operator", 2);
    expect(withDiv.startsWith(getTierConfig("operator").label)).toBe(true);
    expect(withDiv.length).toBeGreaterThan(getTierConfig("operator").label.length);
  });
  it("divisionRoman is empty for 0 / null", () => {
    expect(divisionRoman(0)).toBe("");
    expect(divisionRoman(null)).toBe("");
    expect(divisionRoman(undefined)).toBe("");
  });
});

describe("getNextTier / getPreviousTier", () => {
  it("walks the ladder and terminates at the ends", () => {
    expect(getNextTier("recruit")?.label).toBe(getTierConfig("operator").label);
    expect(getPreviousTier("operator")?.label).toBe(getTierConfig("recruit").label);
    expect(getNextTier("legend")).toBeNull();
    expect(getPreviousTier("recruit")).toBeNull();
  });
});

describe("tierRequirementSentence", () => {
  it("joins an AND rung's two clauses so they do not run together", () => {
    // Operator: percentile AND active days. Rendered with a bare space this
    // read "Top 75% in rank score 5 active days in the last 30."
    expect(tierRequirementSentence("operator")).toBe("Top 75% in rank score, and 5 active days in the last 30");
  });

  it("keeps an OR rung's own connector", () => {
    const s = tierRequirementSentence("elite");
    expect(s).toContain(", or ");
    expect(s).toContain("30-day current streak");
  });

  it("says something for the bottom rung", () => {
    expect(tierRequirementSentence("recruit")).toBe("Where everyone starts.");
  });
});
