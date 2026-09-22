import { describe, it, expect } from "vitest";
import { shouldGateOnboarding } from "@/lib/onboarding-gate";

/**
 * The paywall is the first door after sign-up: ProtectedRoute (src/App.tsx)
 * checks membership BEFORE the username and onboarding gates, and only the
 * paywall and the legal pages are exempt. This pins the two facts the order
 * rests on, so a reordering or a widened exemption list is a deliberate edit.
 */
describe("the access gate order", () => {
  it("onboarding still gates a fresh profile (it just comes after the paywall now)", () => {
    type P = Parameters<typeof shouldGateOnboarding>[0];
    expect(shouldGateOnboarding({ onboarded_at: null } as P, false)).toBe(true);
    expect(shouldGateOnboarding({ onboarded_at: "2026-09-22T00:00:00Z" } as P, false)).toBe(false);
  });

  it("only the paywall and the legal pages are reachable without membership", async () => {
    const src = await import("node:fs").then((fs) => fs.readFileSync("src/App.tsx", "utf8"));
    const block = src.slice(src.indexOf("const ACCESS_EXEMPT = new Set(["), src.indexOf("]);", src.indexOf("const ACCESS_EXEMPT")));
    const paths = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(paths).toEqual(["/paywall", "/privacy", "/reset-password", "/terms"]);
    // The paywall check precedes the username check in the route guard.
    const guard = src.slice(src.indexOf("const ProtectedRoute"));
    expect(guard.indexOf("ACCESS_EXEMPT.has(path)")).toBeLessThan(guard.indexOf('to="/choose-username"'));
  });
});
