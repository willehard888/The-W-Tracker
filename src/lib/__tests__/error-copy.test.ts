// friendlyError is the last line of defense between raw Postgres/RLS
// messages and the user's toast. Known signatures map to app-voice copy —
// including the DB's "clubs" language in an app that calls them Tribes.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { friendlyError, readEdgeError } from "@/lib/error-copy";

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

// supabase.functions.invoke gives every non-2xx the same useless message and
// hides the function's own sentence in the Response on `context`.
const httpError = (status: number, body?: unknown) =>
  Object.assign(new Error("Edge Function returned a non-2xx status code"), {
    context: { status, json: async () => { if (body === undefined) throw new SyntaxError("no body"); return body; } },
  });

describe("readEdgeError", () => {
  it("surfaces the sentence the function actually sent", async () => {
    const e = await readEdgeError(httpError(429, { error: "You've reached today's Coach limit. It resets at midnight UTC." }));
    expect(e.message).toMatch(/today's Coach limit/);
    expect(e.status).toBe(429);
  });

  it("keeps the raw code so the caller can branch on it", async () => {
    const e = await readEdgeError(httpError(403, { error: "ai_consent_required" }));
    expect(e.code).toBe("ai_consent_required");
  });

  it("falls back to the status when the body is not JSON", async () => {
    expect((await readEdgeError(httpError(403))).message).toMatch(/membership/i);
    expect((await readEdgeError(httpError(401))).message).toMatch(/Sign in/i);
    expect((await readEdgeError(httpError(429))).message).toMatch(/Slow down/i);
  });

  it("prefers the caller's fallback over the status line, and survives a non-HTTP error", async () => {
    expect((await readEdgeError(httpError(500), "Couldn't read progress.")).message).toBe("Couldn't read progress.");
    expect((await readEdgeError(new Error("boom"))).message).toMatch(/Something went wrong/);
  });

  it("still scrubs a leaky server message through the copy map", async () => {
    const e = await readEdgeError(httpError(500, { error: "permission denied for table kudos" }));
    expect(e.message).toMatch(/access/);
    expect(e.message).not.toMatch(/kudos/);
  });
});
