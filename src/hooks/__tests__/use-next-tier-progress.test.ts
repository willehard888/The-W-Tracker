// The promotion rule has to be told the same way in three places: this card,
// the ladder sheet, and SQL `update_status_tier`. It wasn't — the card kept
// its own ELITE_REQUIREMENTS with a 21-day streak while both of the others
// said 30, so a user at 21 saw a full bar and a ticked requirement and then
// was not promoted. These tests pin the card to status-tiers, and status-tiers
// to the migration's thresholds.
import { describe, it, expect } from "vitest";
import { tierProgress } from "@/hooks/use-next-tier-progress";
import { nextTierRequirements, getTierConfig } from "@/lib/status-tiers";

describe("tierProgress — the card cannot promise what the server won't give", () => {
  const elite = getTierConfig("elite").requirements;

  it("Elite's grind path is the migration's: 80th percentile OR 30-day streak + 20 days", () => {
    // supabase/migrations/20260707130000_tier_divisions.sql:71
    expect(elite).toMatchObject({ percentile: 80, activeDays: 20, streak: 30, orPath: true });
    expect(nextTierRequirements("high_performer")!.requirements).toBe(elite);
  });

  it("a 21-day streak with 20 active days is NOT a met path", () => {
    const p = tierProgress(elite, { percentile: 10, activityDays: 20, streak: 21 });
    expect(p.streakProgress).toBeLessThan(1);
    expect(p.metCount).toBe(0);
    expect(p.overallPercent).toBeLessThan(100);
  });

  it("30 days of streak with 20 active days IS a met path", () => {
    const p = tierProgress(elite, { percentile: 10, activityDays: 20, streak: 30 });
    expect(p.metCount).toBe(1);
    expect(p.overallPercent).toBe(100);
  });

  it("the rank path alone is enough on an OR rung", () => {
    const p = tierProgress(elite, { percentile: 80, activityDays: 0, streak: 0 });
    expect(p.pathCount).toBe(2);
    expect(p.metCount).toBe(1);
    expect(p.overallPercent).toBe(100);
  });

  it("an AND rung (Apex) needs every line, not the best one", () => {
    const apex = nextTierRequirements("elite")!.requirements;
    expect(apex.orPath).toBeUndefined();
    const p = tierProgress(apex, { percentile: 90, activityDays: 30, streak: 0 });
    expect(p.pathCount).toBe(1);
    expect(p.metCount).toBe(0);
    expect(p.overallPercent).toBeLessThan(100);
    expect(tierProgress(apex, { percentile: 90, activityDays: 30, streak: 30 }).metCount).toBe(1);
  });

  it("a rung with no streak requirement doesn't hold a zero streak against you", () => {
    const operator = nextTierRequirements("recruit")!.requirements;
    expect(operator.streak).toBe(0);
    const p = tierProgress(operator, { percentile: 25, activityDays: 5, streak: 0 });
    expect(p.metCount).toBe(1);
    expect(p.overallPercent).toBe(100);
  });

  it("there is no next rung above Legend", () => {
    expect(nextTierRequirements("legend")).toBeNull();
  });
});
