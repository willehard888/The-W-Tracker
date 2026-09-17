import { describe, expect, it } from "vitest";
import { AI_CONSENT_REQUIRED, AI_CONSENT_VERSION, aiConsentPatch, aiConsentState, hasAiConsent } from "@/lib/ai-consent";
import * as server from "../../../supabase/functions/_shared/openrouter";

describe("ai consent", () => {
  it("reads the stored version", () => {
    expect(aiConsentState(null)).toBe("unasked");
    expect(aiConsentState(undefined)).toBe("unasked");
    expect(aiConsentState(0)).toBe("declined");
    expect(aiConsentState(AI_CONSENT_VERSION)).toBe("granted");
    // An older acceptance does not cover a newer version: the member is asked again.
    expect(hasAiConsent(AI_CONSENT_VERSION - 1)).toBe(false);
  });

  it("writes the choice with its moment", () => {
    const at = new Date("2026-09-20T10:00:00Z");
    expect(aiConsentPatch(true, at)).toEqual({ ai_consent_version: AI_CONSENT_VERSION, ai_consent_at: "2026-09-20T10:00:00.000Z" });
    expect(aiConsentPatch(false, at).ai_consent_version).toBe(0);
  });

  it("agrees with the server on the version, the rule and the refusal code", () => {
    expect(server.AI_CONSENT_VERSION).toBe(AI_CONSENT_VERSION);
    expect(server.AI_CONSENT_REQUIRED).toBe(AI_CONSENT_REQUIRED);
    for (const v of [null, undefined, 0, AI_CONSENT_VERSION, AI_CONSENT_VERSION + 1]) expect(server.consentOk(v)).toBe(hasAiConsent(v));
  });

  it("the one door refuses without consent and never calls out", async () => {
    const res = await server.openrouterFetch("key", { model: "m" }, { consent: false });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: AI_CONSENT_REQUIRED });
  });
});
