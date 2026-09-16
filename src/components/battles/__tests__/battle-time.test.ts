import { describe, it, expect } from "vitest";
import { battleDay, battleDayLine, daysLeft, daysLeftLine, localToday } from "@/components/battles/battle-time";

const now = Date.parse("2026-09-08T12:00:00Z");

describe("battleDay (calendar days)", () => {
  it("counts day N of M from the battle's own dates", () => {
    expect(battleDay("2026-09-18", "2026-09-24", "2026-09-18")).toEqual({ day: 1, total: 7, left: 6, started: true, over: false });
    expect(battleDay("2026-09-18", "2026-09-24", "2026-09-20")).toEqual({ day: 3, total: 7, left: 4, started: true, over: false });
    expect(battleDay("2026-09-18", "2026-09-24", "2026-09-24")).toEqual({ day: 7, total: 7, left: 0, started: true, over: false });
  });

  it("knows a battle that starts tomorrow and one whose window is over", () => {
    expect(battleDay("2026-09-18", "2026-09-20", "2026-09-17")).toEqual({ day: 0, total: 3, left: 3, started: false, over: false });
    expect(battleDay("2026-09-18", "2026-09-20", "2026-09-21")).toMatchObject({ day: 3, total: 3, left: 0, over: true });
  });

  it("is inert without dates (pre-calendar rows)", () => {
    expect(battleDay(null, null)).toEqual({ day: 0, total: 0, left: 0, started: false, over: false });
  });

  it("localToday is the device's own calendar date", () => {
    expect(localToday(new Date(2026, 8, 18, 23, 30))).toBe("2026-09-18");
    expect(localToday(new Date(2026, 0, 5, 0, 5))).toBe("2026-01-05");
  });
});

describe("battleDayLine", () => {
  it("reads as one sentence at every stage", () => {
    expect(battleDayLine(0, 7, "@mika")).toBe("Starts tomorrow against @mika.");
    expect(battleDayLine(3, 7, "@mika")).toBe("Day 3 of 7 against @mika.");
    expect(battleDayLine(7, 7, "@mika")).toBe("Final day against @mika.");
  });
});

describe("daysLeft (legacy timestamps)", () => {
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
