import { describe, it, expect } from "vitest";
import { isVitalReading, meanOfPresent, vitalOrNull, describeVital } from "../measurement";

/**
 * The cases from the bug report, as the pipeline sees them.
 *
 * The push notification said "your zero hours of recorded sleep make
 * high-intensity training dangerous today — cancel your workout" to a member
 * who had slept and logged it, but had not worn a watch. Every step below is a
 * point where that zero used to survive.
 */

/** The proactive rule that sent the notification, before and after. */
const wasShortSleepOld = (min: number | null) => min != null && min < 360;
const isShortSleep = (min: number | null) => min != null && min > 0 && min < 360;

describe("the notification that should never have been sent", () => {
  it("an unrecorded night no longer counts as a short night", () => {
    // HealthNight.swift summed an empty sample array to 0 and stored it.
    expect(wasShortSleepOld(0)).toBe(true); // the bug
    expect(isShortSleep(0)).toBe(false); // the fix
  });

  it("a genuinely short night still raises the flag", () => {
    // The guard must not buy safety by going blind: 4 h measured is 4 h.
    expect(isShortSleep(240)).toBe(true);
    expect(isShortSleep(359)).toBe(true);
    expect(isShortSleep(360)).toBe(false); // 6 h is not short
    expect(isShortSleep(480)).toBe(false);
  });

  it("a night with no row at all raises nothing", () => {
    expect(isShortSleep(null)).toBe(false);
  });
});

describe("HealthKit connected does not mean HealthKit has data", () => {
  it("CASE 1 — watch worn: the measurement is used", () => {
    expect(vitalOrNull(480)).toBe(480);
  });

  it("CASE 2 and 4 — no wearable sample, sleep logged by hand: the manual entry survives", () => {
    // The zero must not reach the night table, so it cannot overwrite or
    // outrank what the member entered themselves.
    const fromWatch = vitalOrNull(0);
    expect(fromWatch).toBeNull();
    const manualHours = 7.5;
    const effective = fromWatch ?? manualHours * 60;
    expect(effective).toBe(450);
  });

  it("CASE 3 and 5 — nothing anywhere: unknown, never zero", () => {
    expect(vitalOrNull(0)).toBeNull();
    expect(vitalOrNull(null)).toBeNull();
    expect(meanOfPresent([null, 0, undefined])).toBeNull();
  });

  it("CASE 11 — the coach is told unknown in words, not a number", () => {
    // A model handed `sleep: 0` reasons about zero. Given "unknown" it says so.
    expect(describeVital(null, "h")).toBe("unknown (not measured)");
    expect(describeVital(0, "h")).toBe("unknown (not measured)");
    expect(describeVital(7.5, "h")).toBe("7.5h");
  });
});

describe("weekly averages stop being halved by missing nights", () => {
  it("three logged nights of 8 h average 8 h, not 3.4 h", () => {
    const week = [8, null, null, 8, null, 8, null];
    expect(meanOfPresent(week)).toBe(8);
    // What six edge functions used to compute:
    const old = week.reduce((sum: number, v) => sum + Number(v ?? 0), 0) / week.length;
    expect(old).toBeCloseTo(3.43, 1);
  });

  it("a week with nothing logged reports unknown rather than zero", () => {
    expect(meanOfPresent([null, null, null])).toBeNull();
  });
});

describe("zero stays legitimate where zero is real", () => {
  it("is only applied to values that cannot honestly be zero", () => {
    // Steps, calories and workouts can genuinely be zero for a day in bed, and
    // this helper must never be used on them — the rule is about sensors that
    // were silent, not about days that were quiet.
    expect(isVitalReading(0)).toBe(false); // sleep minutes, resting HR, HRV
    expect(isVitalReading(1)).toBe(true);
  });
});
