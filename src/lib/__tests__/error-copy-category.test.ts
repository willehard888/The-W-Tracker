import { describe, it, expect } from "vitest";
import { errorCategory, friendlyError, isOurFault, isRetryable } from "../error-copy";

/**
 * "Connection hiccup — try again." was the only thing an evening reflection
 * failure ever said, and the only trace left behind was a console line on a
 * phone nobody was holding. These assert that the app can now tell the
 * failures apart — which decides the copy, the retry, and whether an engineer
 * ever hears about it.
 */
describe("errorCategory", () => {
  it("recognises the transport failure both webviews report", () => {
    // WKWebView on iOS says "Load failed"; Chrome says "Failed to fetch".
    expect(errorCategory(new Error("Load failed"))).toBe("network");
    expect(errorCategory(new Error("TypeError: Failed to fetch"))).toBe("network");
    expect(errorCategory(new Error("The request timed out"))).toBe("network");
  });

  it("separates an expired session from a dead connection", () => {
    expect(errorCategory({ message: "JWT expired" })).toBe("auth");
    expect(errorCategory({ message: "Invalid Refresh Token" })).toBe("auth");
  });

  it("names a constraint violation as ours, not the network's", () => {
    expect(errorCategory({ message: 'new row violates check constraint "energy_range"' })).toBe("validation");
    expect(errorCategory({ message: "null value in column \"energy_1to5\"" })).toBe("validation");
  });

  it("recognises RLS, duplicates and a missing function", () => {
    expect(errorCategory({ message: "new row violates row-level security policy" })).toBe("permission");
    expect(errorCategory({ message: "duplicate key value" })).toBe("conflict");
    expect(errorCategory({ message: "Could not find the function public.upsert_reflection in the schema cache" })).toBe("server");
  });

  it("admits when it does not know", () => {
    expect(errorCategory(new Error("something odd"))).toBe("unknown");
    expect(errorCategory(null)).toBe("unknown");
  });
});

describe("isOurFault", () => {
  it("does not page anyone for a train tunnel", () => {
    expect(isOurFault("network")).toBe(false);
    expect(isOurFault("auth")).toBe(false);
    expect(isOurFault("conflict")).toBe(false);
  });

  it("does report the failures that would otherwise be invisible", () => {
    expect(isOurFault("server")).toBe(true);
    expect(isOurFault("validation")).toBe(true);
    expect(isOurFault("permission")).toBe(true);
    expect(isOurFault("unknown")).toBe(true);
  });
});

describe("isRetryable", () => {
  it("offers a retry only where trying again could work", () => {
    expect(isRetryable("network")).toBe(true);
    expect(isRetryable("server")).toBe(true);
    // Tapping again cannot fix a constraint or an expired token.
    expect(isRetryable("validation")).toBe(false);
    expect(isRetryable("auth")).toBe(false);
  });
});

describe("friendlyError still guards the toast", () => {
  it("never lets a raw Postgres message reach a member", () => {
    const raw = 'new row for relation "coach_reflections" violates check constraint "energy_1to5_check"';
    expect(friendlyError(raw)).not.toContain("coach_reflections");
  });
});
