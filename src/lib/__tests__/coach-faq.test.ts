// matchFaq gives instant no-network answers in the coach chat. The precedence
// chain (explicit id > exact question/synonym > substring synonym > tag score
// ≥2 > null) is easy to break by editing the corpus — locked here.
import { describe, it, expect, vi, afterEach } from "vitest";
import { matchFaq, dailyPlaybookPicks, COACH_FAQ } from "@/lib/coach-faq";

afterEach(() => vi.useRealTimers());

describe("matchFaq precedence", () => {
  it("explicit id beats everything", () => {
    const target = COACH_FAQ[3];
    expect(matchFaq("totally unrelated text", target.id)?.id).toBe(target.id);
  });

  it("exact question match, case-insensitive", () => {
    const f = COACH_FAQ[0];
    expect(matchFaq(f.question.toUpperCase())?.id).toBe(f.id);
  });

  it("exact synonym match", () => {
    const withSyn = COACH_FAQ.find((f) => (f.synonyms ?? []).length > 0)!;
    expect(matchFaq(withSyn.synonyms![0])?.id).toBe(withSyn.id);
  });

  it("substring synonym match (synonym embedded in a longer sentence)", () => {
    const withSyn = COACH_FAQ.find((f) => (f.synonyms ?? []).length > 0)!;
    expect(matchFaq(`hey coach, ${withSyn.synonyms![0]} please`)?.id).toBe(withSyn.id);
  });

  it("a single shared tag is NOT enough (score threshold is 2)", () => {
    // One tag word alone shouldn't hijack unrelated questions to a FAQ card.
    const oneTagOnly = matchFaq("protein");
    if (oneTagOnly) {
      // If it matched, it must have been via exact/synonym path, not 1-tag score.
      const viaExact = COACH_FAQ.some(
        (f) =>
          f.question.toLowerCase() === "protein" ||
          (f.synonyms ?? []).some((s) => "protein".includes(s.toLowerCase())),
      );
      expect(viaExact).toBe(true);
    }
    expect(matchFaq("xyzzy plugh")).toBeNull();
  });

  it("empty input returns null", () => {
    expect(matchFaq("")).toBeNull();
  });
});

describe("dailyPlaybookPicks", () => {
  it("returns N distinct consecutive picks, stable within a day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 11, 9, 0));
    const a = dailyPlaybookPicks(3);
    vi.setSystemTime(new Date(2026, 7, 11, 21, 0));
    const b = dailyPlaybookPicks(3);
    expect(a.map((f) => f.id)).toEqual(b.map((f) => f.id));
    expect(new Set(a.map((f) => f.id)).size).toBe(3);
  });
});
