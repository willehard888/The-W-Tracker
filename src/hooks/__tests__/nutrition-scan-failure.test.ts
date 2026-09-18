import { describe, it, expect } from "vitest";
import { failureFor } from "@/hooks/use-nutrition-scan";

// nutrition-scan answers 403 for two different refusals. The mapper used to
// shortcut every 403 to "membership required", so when the AI-consent gate
// shipped, a member who had never been asked was shown a paywall for a
// membership they already held — and was never offered the question that
// would have let them through.
describe("failureFor", () => {
  it("tells the consent refusal apart from the membership one, though both are 403", () => {
    expect(failureFor(403, "ai_consent_required", undefined).reason).toBe("ai_consent_required");
    expect(failureFor(403, undefined, undefined).reason).toBe("membership_required");
  });

  it("still lets the function's own code win over the status", () => {
    expect(failureFor(500, "scan_limit", undefined).reason).toBe("scan_limit");
    expect(failureFor(400, "ai_timeout", undefined).reason).toBe("timeout");
    expect(failureFor(502, undefined, undefined).reason).toBe("invalid_response");
  });

  it("falls back to the status map for an unknown code, and keeps the retry flag", () => {
    expect(failureFor(429, "something_new", undefined).reason).toBe("scan_limit");
    expect(failureFor(504, undefined, undefined)).toEqual({ reason: "timeout", retryable: true });
    expect(failureFor(504, undefined, false).retryable).toBe(false);
    expect(failureFor(undefined, undefined, undefined)).toEqual({ reason: "failed", retryable: true });
  });
});
