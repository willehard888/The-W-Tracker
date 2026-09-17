import { describe, expect, it, vi, beforeEach } from "vitest";
import { AI_CONSENT_VERSION } from "@/lib/ai-consent";
import { aiConsentGranted, ensureAiConsent, setAiConsentHost } from "@/lib/ai-consent-gate";

describe("ensureAiConsent", () => {
  beforeEach(() => setAiConsentHost(null));

  it("says no, and asks nothing, when no host is mounted", async () => {
    expect(aiConsentGranted()).toBe(false);
    expect(await ensureAiConsent()).toBe(false);
  });

  it("short-circuits once the member has opted in", async () => {
    const ask = vi.fn();
    setAiConsentHost({ version: () => AI_CONSENT_VERSION, ask });
    expect(aiConsentGranted()).toBe(true);
    expect(await ensureAiConsent()).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it("asks once for two callers and hands both the same answer", async () => {
    let resolve!: (v: boolean) => void;
    const ask = vi.fn(() => new Promise<boolean>((r) => { resolve = r; }));
    setAiConsentHost({ version: () => null, ask });
    const a = ensureAiConsent();
    const b = ensureAiConsent();
    resolve(true);
    expect(await a).toBe(true);
    expect(await b).toBe(true);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("asks again after a decline (the member may change their mind on the next tap)", async () => {
    const ask = vi.fn().mockResolvedValue(false);
    setAiConsentHost({ version: () => 0, ask });
    expect(await ensureAiConsent()).toBe(false);
    expect(await ensureAiConsent()).toBe(false);
    expect(ask).toHaveBeenCalledTimes(2);
  });
});
