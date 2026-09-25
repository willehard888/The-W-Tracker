import { describe, it, expect } from "vitest";
import { scrubUrl, scrubText, isClean } from "../observability-scrub";

describe("what a crash report may carry off the device", () => {
  it("drops the query string, which is where the reset token lives", () => {
    expect(scrubUrl("https://app.example.com/reset-password?token=abc123&type=recovery"))
      .toBe("https://app.example.com/reset-password");
    expect(scrubUrl("https://app.example.com/coach#thread-4")).toBe("https://app.example.com/coach");
  });

  it("leaves a plain path alone, ids and all", () => {
    // The report already carries the user id; a route without its ids is not
    // worth reading.
    const url = "https://app.example.com/coach/program/6b1f3c2e-0000-4a4a-9e9e-1a2b3c4d5e6f";
    expect(scrubUrl(url)).toBe(url);
  });

  it("redacts a Supabase JWT wherever it appears", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSJ9.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const out = scrubText(`fetch failed with Authorization: Bearer ${jwt}`);
    expect(out).not.toContain(jwt);
    expect(out).not.toContain("eyJ");
  });

  it("redacts an email address", () => {
    expect(scrubText("no profile row for matti.meikalainen@example.fi")).not.toContain("example.fi");
  });

  it("leaves an ordinary stack message untouched", () => {
    const msg = "Cannot read properties of undefined (reading 'movements')";
    expect(scrubText(msg)).toBe(msg);
    expect(isClean(msg)).toBe(true);
  });

  it("is idempotent — scrubbing twice changes nothing more", () => {
    const dirty = "user matti@example.fi token eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.sig";
    expect(scrubText(scrubText(dirty))).toBe(scrubText(dirty));
  });

  it("handles empty and odd input without throwing", () => {
    expect(scrubUrl("")).toBe("");
    expect(scrubText("")).toBe("");
    expect(() => scrubText("?".repeat(1000))).not.toThrow();
  });
});
