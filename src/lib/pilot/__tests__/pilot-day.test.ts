import { describe, it, expect } from "vitest";
import { pilotDay, inObservationWindow, pilotDayLabel } from "../day";

/**
 * The contract this file pins down is shared with SQL: pilot_context() in
 * migration 20260929090000 computes the same number the same way, by
 * subtracting two dates taken AT TIME ZONE the tester's own zone. The server is
 * the authority — every eligibility decision uses the day it reports — so these
 * cases are written as the definition both sides answer to.
 */

const HELSINKI = "Europe/Helsinki";

describe("which day of the pilot it is", () => {
  it("is day 0 on the day the code was redeemed", () => {
    expect(pilotDay("2026-09-25T09:00:00Z", new Date("2026-09-25T20:00:00Z"), "UTC")).toBe(0);
  });

  // The rule is calendar days, not elapsed hours, and this is the case that
  // separates the two. Somebody who joins at 23:50 is on day 1 ten minutes
  // later — correctly: they have seen a new day of the app, and the day-1
  // question is about their first day, not their first twenty-four hours.
  it("turns over at midnight, not 24 hours later", () => {
    // Helsinki is UTC+3 in September, so 20:50Z is 23:50 local on the 25th.
    const redeemed = "2026-09-25T20:50:00Z";
    // 21:10Z is 00:10 local on the 26th — twenty minutes later, and a new day.
    expect(pilotDay(redeemed, new Date("2026-09-25T21:10:00Z"), HELSINKI)).toBe(1);
    // The same two instants are both the 25th in UTC. This is the whole reason
    // the zone is carried rather than assumed.
    expect(pilotDay(redeemed, new Date("2026-09-25T21:10:00Z"), "UTC")).toBe(0);
  });

  it("counts in the tester's timezone, and the zone can change the answer", () => {
    // 22:30 UTC on the 25th is already 01:30 on the 26th in Helsinki.
    const redeemed = "2026-09-24T12:00:00Z";
    const now = new Date("2026-09-25T22:30:00Z");
    expect(pilotDay(redeemed, now, "UTC")).toBe(1);
    expect(pilotDay(redeemed, now, HELSINKI)).toBe(2);
  });

  it("reaches the checkpoints on the days they are named for", () => {
    const redeemed = "2026-09-01T08:00:00Z";
    expect(pilotDay(redeemed, new Date("2026-09-02T08:00:00Z"), "UTC")).toBe(1);
    expect(pilotDay(redeemed, new Date("2026-09-08T08:00:00Z"), "UTC")).toBe(7);
    expect(pilotDay(redeemed, new Date("2026-09-15T08:00:00Z"), "UTC")).toBe(14);
  });

  it("survives a daylight-saving change without losing or inventing a day", () => {
    // EU clocks go back on the last Sunday of October (2026-10-25).
    const redeemed = "2026-10-23T10:00:00Z";
    expect(pilotDay(redeemed, new Date("2026-10-26T10:00:00Z"), HELSINKI)).toBe(3);
  });

  it("never goes negative, whatever the clock says", () => {
    // A phone with a skewed clock, or a redemption stamped slightly ahead.
    expect(pilotDay("2026-09-25T00:00:00Z", new Date("2026-09-20T00:00:00Z"), "UTC")).toBe(0);
  });

  it("does not throw on input it cannot use", () => {
    expect(pilotDay("not a date", new Date(), "UTC")).toBe(0);
    expect(() => pilotDay("2026-09-25T00:00:00Z", new Date(), "Mars/Olympus_Mons")).not.toThrow();
    // An unknown zone falls back to UTC rather than taking the app down.
    expect(pilotDay("2026-09-25T00:00:00Z", new Date("2026-09-27T00:00:00Z"), "Mars/Olympus_Mons")).toBe(2);
  });

  it("accepts a Date as readily as a string", () => {
    const d = new Date("2026-09-25T09:00:00Z");
    expect(pilotDay(d, new Date("2026-09-27T09:00:00Z"), "UTC")).toBe(2);
  });
});

describe("the observation window", () => {
  it("includes the last day and ends after it", () => {
    expect(inObservationWindow(13, 14)).toBe(true);
    expect(inObservationWindow(14, 14)).toBe(true);
    expect(inObservationWindow(15, 14)).toBe(false);
  });

  // The window is what we WATCH. Access is 90 days and is a different number on
  // purpose — see the migration header.
  it("says nothing about access", () => {
    expect(inObservationWindow(0, 14)).toBe(true);
  });

  it("labels the day without ever running past the end", () => {
    expect(pilotDayLabel(4, 14)).toBe("Päivä 4 / 14");
    expect(pilotDayLabel(99, 14)).toBe("Päivä 14 / 14");
  });
});
