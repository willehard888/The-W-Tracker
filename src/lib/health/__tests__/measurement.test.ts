import { describe, it, expect } from "vitest";
import { describeVital, isVitalReading, meanOfPresent, presentCount, vitalOrNull } from "../measurement";

describe("isVitalReading", () => {
  it("rejects the zero that an empty HealthKit query produces", () => {
    // HealthNight.swift summed an empty sample array to 0 and wrote it as a
    // measurement. Nobody sleeps zero minutes; that zero is an absence.
    expect(isVitalReading(0)).toBe(false);
    expect(isVitalReading(null)).toBe(false);
    expect(isVitalReading(undefined)).toBe(false);
    expect(isVitalReading(Number.NaN)).toBe(false);
    expect(isVitalReading(-30)).toBe(false);
  });

  it("accepts a real reading, including a short night", () => {
    expect(isVitalReading(1)).toBe(true);
    expect(isVitalReading(185)).toBe(true); // 3 h — genuinely bad, genuinely measured
    expect(isVitalReading(480)).toBe(true);
  });
});

describe("vitalOrNull", () => {
  it("never hands a zero downstream", () => {
    expect(vitalOrNull(0)).toBeNull();
    expect(vitalOrNull(undefined)).toBeNull();
    expect(vitalOrNull(420)).toBe(420);
  });
});

describe("meanOfPresent", () => {
  it("divides by the nights that exist, not by the calendar", () => {
    // Three logged nights of 8 h in a 7-day window is an average of 8, not 3.4.
    const week = [480, null, null, 480, null, 480, null];
    expect(meanOfPresent(week)).toBe(480);
    expect(presentCount(week)).toBe(3);
  });

  it("treats a zero in the window as a missing night, not a sleepless one", () => {
    expect(meanOfPresent([480, 0, 480])).toBe(480);
  });

  it("returns null when nothing was measured, rather than a plausible zero", () => {
    // The caller has to decide what to say; it cannot be handed a number that
    // looks like a fact.
    expect(meanOfPresent([])).toBeNull();
    expect(meanOfPresent([null, undefined, 0])).toBeNull();
  });

  it("keeps a genuinely low average low", () => {
    expect(meanOfPresent([300, 360])).toBe(330);
  });
});

describe("describeVital", () => {
  it("says unknown in words a model cannot round to zero", () => {
    expect(describeVital(null, " h")).toBe("unknown (not measured)");
    expect(describeVital(0, " h")).toBe("unknown (not measured)");
    expect(describeVital(7.5, " h")).toBe("7.5 h");
  });
});
