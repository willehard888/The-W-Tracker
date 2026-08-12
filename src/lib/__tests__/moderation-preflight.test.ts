// validateFile guards proof-photo uploads before any network cost;
// getFriendlyMessage converts moderation categories to app-voice copy
// (raw category strings must never reach a toast).
import { describe, it, expect } from "vitest";
import { validateFile, getFriendlyMessage } from "@/lib/moderation-preflight";

const fakeFile = (size: number, type = "image/jpeg") =>
  ({ size, type }) as File;

describe("validateFile", () => {
  it("accepts a normal photo", () => {
    expect(validateFile(fakeFile(500 * 1024)).ok).toBe(true);
  });

  it("rejects non-images", () => {
    const r = validateFile(fakeFile(500 * 1024, "video/mp4"));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/image/i);
  });

  it("boundaries: under 10KB too small, over 10MB too large", () => {
    expect(validateFile(fakeFile(10 * 1024 - 1)).ok).toBe(false);
    expect(validateFile(fakeFile(10 * 1024)).ok).toBe(true);
    expect(validateFile(fakeFile(10 * 1024 * 1024)).ok).toBe(true);
    expect(validateFile(fakeFile(10 * 1024 * 1024 + 1)).ok).toBe(false);
  });
});

describe("getFriendlyMessage", () => {
  it("maps known categories to app-voice copy", () => {
    expect(getFriendlyMessage(["nudity"])).toMatch(/Modesty/);
    expect(getFriendlyMessage(["ai_generated"])).toMatch(/Real proofs/);
  });

  it("self_harm gets the compassionate variant", () => {
    expect(getFriendlyMessage(["self_harm"])).toMatch(/reach out/);
  });

  it("unknown categories fall back to the generic line", () => {
    expect(getFriendlyMessage(["totally_new_category"])).toMatch(/couldn't be verified/);
    expect(getFriendlyMessage()).toMatch(/couldn't be verified/);
  });

  it("retry fallback has its own copy", () => {
    expect(getFriendlyMessage([], "moderation_unavailable_retry")).toMatch(/temporarily unavailable/);
  });
});
