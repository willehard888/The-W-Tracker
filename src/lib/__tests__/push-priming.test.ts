import { describe, it, expect } from "vitest";
import { shouldPrimeNow, PRIMING_SNOOZE_MS } from "@/lib/push-priming";

const now = 1_800_000_000_000;

describe("shouldPrimeNow", () => {
  it("asks only while the OS would still prompt", () => {
    expect(shouldPrimeNow({ permission: "prompt", snoozedAt: 0, now })).toBe(true);
    expect(shouldPrimeNow({ permission: "prompt-with-rationale", snoozedAt: 0, now })).toBe(true);
    expect(shouldPrimeNow({ permission: "granted", snoozedAt: 0, now })).toBe(false);
    expect(shouldPrimeNow({ permission: "denied", snoozedAt: 0, now })).toBe(false);
    expect(shouldPrimeNow({ permission: null, snoozedAt: 0, now })).toBe(false);
  });
  it("respects the week-long snooze after Maybe later", () => {
    expect(shouldPrimeNow({ permission: "prompt", snoozedAt: now - 1000, now })).toBe(false);
    expect(shouldPrimeNow({ permission: "prompt", snoozedAt: now - PRIMING_SNOOZE_MS + 1, now })).toBe(false);
    expect(shouldPrimeNow({ permission: "prompt", snoozedAt: now - PRIMING_SNOOZE_MS - 1, now })).toBe(true);
  });
  it("treats a corrupt snooze value as no snooze", () => {
    expect(shouldPrimeNow({ permission: "prompt", snoozedAt: Number.NaN, now })).toBe(true);
  });
});
