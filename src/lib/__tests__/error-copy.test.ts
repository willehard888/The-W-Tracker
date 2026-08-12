// friendlyError is the last line of defense between raw Postgres/RLS
// messages and the user's toast. Known signatures map to app-voice copy —
// including the DB's "clubs" language in an app that calls them Tribes.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { friendlyError } from "@/lib/error-copy";

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

describe("friendlyError", () => {
  it("translates the tribe-limit constraint (and fixes 'clubs' → tribes)", () => {
    const msg = friendlyError(new Error("You can be in up to 25 clubs — leave one first"));
    expect(msg).toMatch(/tribes/);
    expect(msg).not.toMatch(/clubs/);
  });

  it("maps RLS/permission errors to app voice", () => {
    expect(friendlyError(new Error("new row violates row-level security policy"))).toMatch(/access/);
    expect(friendlyError({ message: "permission denied for table kudos" })).toMatch(/access/);
  });

  it("maps duplicates, rate limits, network and check-in idempotency", () => {
    expect(friendlyError(new Error("duplicate key value violates unique constraint"))).toMatch(/already exists/);
    expect(friendlyError(new Error("rate limit exceeded"))).toMatch(/Slow down/);
    expect(friendlyError(new TypeError("Load failed"))).toMatch(/Connection/);
    expect(friendlyError(new Error("ALREADY_CHECKED_IN_TODAY"))).toMatch(/already locked/);
  });

  it("unknown errors get the calm fallback (never the raw message)", () => {
    const raw = "function pg_catalog.xyz(uuid) does not exist";
    const out = friendlyError(new Error(raw));
    expect(out).not.toContain("pg_catalog");
    expect(out).toMatch(/Something went wrong/);
  });

  it("accepts a custom fallback and non-Error inputs", () => {
    expect(friendlyError("weird string error", "Custom line.")).toBe("Custom line.");
    expect(friendlyError(null)).toMatch(/Something went wrong/);
  });

  it("logs the raw detail to console for debugging", () => {
    friendlyError(new Error("secret internal detail"));
    expect(console.error).toHaveBeenCalled();
  });
});
