import { describe, expect, it } from "vitest";
import { allowSandboxEvent } from "../../../supabase/functions/_shared/sandbox-rule";

describe("revenuecat sandbox rule", () => {
  it("lets production through, and sandbox only for testers or the debug switch", () => {
    expect(allowSandboxEvent({ environment: "PRODUCTION", isAdmin: false, debugAllow: false })).toBe(true);
    expect(allowSandboxEvent({ environment: undefined, isAdmin: false, debugAllow: false })).toBe(true);
    expect(allowSandboxEvent({ environment: "SANDBOX", isAdmin: false, debugAllow: false })).toBe(false);
    expect(allowSandboxEvent({ environment: "SANDBOX", isAdmin: true, debugAllow: false })).toBe(true);
    expect(allowSandboxEvent({ environment: "sandbox", isAdmin: false, debugAllow: true })).toBe(true);
  });
});
