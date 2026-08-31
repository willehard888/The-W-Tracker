import { describe, it, expect } from "vitest";
import { stripCoachSignoff, briefPreview } from "@/lib/coach-signoff";

describe("stripCoachSignoff", () => {
  // Rows written before the sign-off instruction was removed still carry it,
  // and there is no backfill — this is the case that must keep working.
  it("removes the legacy W Coach sign-off", () => {
    expect(stripCoachSignoff("Today: show up. Lock the basics. — W Coach"))
      .toBe("Today: show up. Lock the basics.");
  });

  it("removes an AI Coach sign-off a model volunteers anyway", () => {
    expect(stripCoachSignoff("Sleep is your lever today. — AI Coach"))
      .toBe("Sleep is your lever today.");
  });

  it("handles the trailing period and an en/em dash", () => {
    expect(stripCoachSignoff("Rest well. – AI Coach.")).toBe("Rest well.");
    expect(stripCoachSignoff("Rest well. — W Coach.")).toBe("Rest well.");
  });

  it("leaves text without a sign-off untouched", () => {
    expect(stripCoachSignoff("Sleep 7-8h tonight.")).toBe("Sleep 7-8h tonight.");
  });

  // "coach" mid-sentence must survive — only a trailing sign-off goes.
  it("does not eat the word coach inside a sentence", () => {
    const s = "Ask your coach about the deload.";
    expect(stripCoachSignoff(s)).toBe(s);
  });

  it("returns an empty string for null/undefined", () => {
    expect(stripCoachSignoff(null)).toBe("");
    expect(stripCoachSignoff(undefined)).toBe("");
  });
});

describe("briefPreview", () => {
  it("takes the first sentence, strips markdown and the sign-off", () => {
    expect(briefPreview("**Sleep** is the lever. Then train hard. — W Coach"))
      .toBe("Sleep is the lever.");
  });

  it("truncates to the requested length", () => {
    expect(briefPreview("a".repeat(300), 50)).toHaveLength(50);
  });

  it("returns null when there is nothing left to show", () => {
    expect(briefPreview(null)).toBeNull();
    expect(briefPreview("— W Coach")).toBeNull();
  });
});
