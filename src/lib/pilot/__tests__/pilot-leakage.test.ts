import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { sanitizeContext, NOT_IN_PILOT } from "../rpc";

/**
 * What a piece of feedback is allowed to carry off the device.
 *
 * This is not a hypothetical. `soreness` — a self-reported "good | tight |
 * sore" — rode along in recovery_started and recovery_completed for months
 * while analytics.ts said in writing that no health data did, and every one of
 * those props was mirrored to a third party. It was not added maliciously; it
 * was added because it was useful and the contract lived in a comment.
 *
 * So the contract lives in a whitelist, and the whitelist is tested.
 */
describe("what feedback may carry", () => {
  it("keeps the two keys it is allowed to keep", () => {
    expect(sanitizeContext({ route: "/coach", surface: "settings" })).toEqual({
      route: "/coach",
      surface: "settings",
    });
  });

  it("drops health data by name, however it is spelled", () => {
    const dirty = {
      route: "/recovery",
      soreness: "sore",
      feel: "tight",
      sleep_hours: 6.5,
      weight_kg: 84.3,
      resting_hr: 52,
      energy_1to5: 2,
    };
    expect(sanitizeContext(dirty)).toEqual({ route: "/recovery" });
  });

  it("drops identity, because a row already knows whose it is", () => {
    const dirty = { surface: "bug", email: "matti@example.fi", user_id: "abc", username: "matti" };
    expect(sanitizeContext(dirty)).toEqual({ surface: "bug" });
  });

  // The rule that makes it hold: anything not named is gone, so a field added
  // for debugging next month does not ship itself.
  it("drops every key it has never heard of", () => {
    expect(sanitizeContext({ route: "/", anythingElse: "x", debug: { a: 1 } })).toEqual({ route: "/" });
  });

  it("caps a route rather than trusting it", () => {
    const long = "/" + "x".repeat(500);
    const out = sanitizeContext({ route: long });
    expect(out?.route?.length).toBe(120);
  });

  it("returns null rather than an empty object when nothing survives", () => {
    expect(sanitizeContext({ soreness: "sore" })).toBeNull();
    expect(sanitizeContext({})).toBeNull();
    expect(sanitizeContext(null)).toBeNull();
    expect(sanitizeContext(undefined)).toBeNull();
  });

  it("ignores a key of the right name but the wrong type", () => {
    expect(sanitizeContext({ route: 42, surface: ["a"] })).toBeNull();
  });
});

describe("failing open is the design, not a habit", () => {
  // If the app ships before the migration runs, every pilot call fails and this
  // is the answer. It has to be identical to "you are not a tester", or there
  // is a broken state for a user to be in.
  it("has an inert default that switches the whole layer off", () => {
    expect(NOT_IN_PILOT.is_pilot).toBe(false);
    expect(NOT_IN_PILOT.in_window).toBe(false);
    expect(NOT_IN_PILOT.day).toBe(0);
  });
});

describe("the hand-written adapter is temporary", () => {
  /**
   * rpc.ts exists only because the generated types do not carry migration
   * 20260925120000 yet. The moment they do, the adapter is dead weight that
   * type-checks against a copy of the schema instead of the schema.
   *
   * Left to a comment, that cleanup never happens. So it is a failing test
   * instead — the only kind of reminder that survives a busy month.
   */
  it("fails once the generated types catch up, so the cast gets deleted", () => {
    const types = readFileSync(
      join(resolve(__dirname, "../../../.."), "src", "integrations", "supabase", "types.ts"),
      "utf8",
    );
    const deployed = types.includes("pilot_context");
    expect(
      deployed,
      "Migration 20260925120000 is deployed and types.ts now knows pilot_context. " +
        "Delete the LooseDb cast in src/lib/pilot/rpc.ts, call supabase.rpc directly, " +
        "and delete this test.",
    ).toBe(false);
  });
});
