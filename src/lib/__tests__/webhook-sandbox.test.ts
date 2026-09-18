import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// App Review always buys in the sandbox. The webhook once acknowledged and
// dropped sandbox events for anyone who was not an admin, so a reviewer's
// purchase never unlocked the app — a guaranteed rejection under guideline 2.1
// that no other test would have caught. This keeps that gate from coming back
// unnoticed.
const webhook = readFileSync(resolve(__dirname, "../../../supabase/functions/revenuecat-webhook/index.ts"), "utf8");

describe("revenuecat-webhook and the sandbox", () => {
  it("applies sandbox events instead of dropping them", () => {
    expect(webhook).not.toMatch(/skipped:\s*["']non-production["']/);
    expect(webhook).not.toMatch(/allowSandboxEvent|DEBUG_ALLOW_SANDBOX/);
  });

  it("still records the environment, so sandbox never counts as money", () => {
    expect(webhook).toMatch(/environment,/);
    expect(webhook).toMatch(/props:\s*\{[^}]*environment/);
  });
});
