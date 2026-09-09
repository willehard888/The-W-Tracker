import { describe, it, expect } from "vitest";
import { daysLeft, daysLeftLine } from "@/components/battles/battle-time";

const now = Date.parse("2026-09-08T12:00:00Z");

describe("daysLeft", () => {
  it("counts whole days from the start and never goes below zero", () => {
    expect(daysLeft("2026-09-06T12:00:00Z", 7, now)).toBe(5);
    expect(daysLeft("2026-09-08T00:00:00Z", 7, now)).toBe(7);
    expect(daysLeft("2026-08-01T00:00:00Z", 7, now)).toBe(0);
  });

  it("counts from now when the battle has not started", () => {
    expect(daysLeft(null, 3, now)).toBe(3);
  });
});

describe("daysLeftLine", () => {
  it("reads as one sentence at every count", () => {
    expect(daysLeftLine(0, "@mika")).toBe("Final day against @mika.");
    expect(daysLeftLine(1, "@mika")).toBe("1 day left against @mika.");
    expect(daysLeftLine(3, "Iron Tribe")).toBe("3 days left against Iron Tribe.");
  });
});
