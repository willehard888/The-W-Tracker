import { describe, expect, it } from "vitest";
import {
  EMPTY_ONBOARDING_STATE,
  EMPTY_QUEUE,
  applyMark,
  dismissActive,
  enqueueShow,
  isDone,
  isEligible,
  mergeStates,
  parseOnboardingState,
} from "@/lib/onboarding/state";
import { placeCard } from "@/lib/onboarding/placement";
import { ONBOARDING_EVENTS } from "@/lib/onboarding/registry";
import { FAILED_ATTEMPT_CAP, ONBOARDING_EVENT_IDS } from "@/lib/onboarding/types";

describe("parseOnboardingState", () => {
  it("defaults every field for '{}' and garbage input", () => {
    expect(parseOnboardingState({})).toEqual(EMPTY_ONBOARDING_STATE);
    expect(parseOnboardingState(null)).toEqual(EMPTY_ONBOARDING_STATE);
    expect(parseOnboardingState("nope")).toEqual(EMPTY_ONBOARDING_STATE);
    expect(parseOnboardingState([1, 2])).toEqual(EMPTY_ONBOARDING_STATE);
  });

  it("keeps valid fields and drops malformed entries", () => {
    const s = parseOnboardingState({
      version: 1,
      status: "skipped_all",
      grandfathered: true,
      seen: { TODAY_INTRO: "2026-08-31T10:00:00Z", bad: 42 },
      failed: { XP_INTRO: { at: "2026-08-31T10:00:00Z", count: 2 }, junk: { at: 1 } },
      updatedAt: "2026-08-31T10:00:00Z",
    });
    expect(s.version).toBe(1);
    expect(s.status).toBe("skipped_all");
    expect(s.grandfathered).toBe(true);
    expect(s.seen).toEqual({ TODAY_INTRO: "2026-08-31T10:00:00Z" });
    expect(s.failed).toEqual({ XP_INTRO: { at: "2026-08-31T10:00:00Z", count: 2 } });
  });
});

describe("isEligible", () => {
  it("fresh user is eligible for every registered event", () => {
    for (const id of ONBOARDING_EVENT_IDS) {
      expect(isEligible(EMPTY_ONBOARDING_STATE, id)).toBe(true);
    }
  });

  it("grandfathered/skipped_all users see nothing", () => {
    expect(isEligible({ ...EMPTY_ONBOARDING_STATE, grandfathered: true }, "TODAY_INTRO")).toBe(false);
    expect(isEligible({ ...EMPTY_ONBOARDING_STATE, status: "skipped_all" }, "TODAY_INTRO")).toBe(false);
  });

  it("completed, skipped, and failed-capped events never re-fire — but siblings stay eligible", () => {
    const s = {
      ...EMPTY_ONBOARDING_STATE,
      status: "in_progress" as const,
      completed: { TODAY_INTRO: "2026-08-31T10:00:00Z" },
      skipped: { XP_INTRO: "2026-08-31T10:00:00Z" },
      failed: { STREAK_INTRO: { at: "2026-08-31T10:00:00Z", count: FAILED_ATTEMPT_CAP } },
    };
    expect(isEligible(s, "TODAY_INTRO")).toBe(false);
    expect(isEligible(s, "XP_INTRO")).toBe(false);
    expect(isEligible(s, "STREAK_INTRO")).toBe(false);
    // The §4 versioning fix: completing one event must not block the rest.
    expect(isEligible(s, "CHECKIN_INTRO")).toBe(true);
    expect(isEligible(s, "SQUAD_INTRO")).toBe(true);
    // isDone: completed OR skipped both count (prerequisite ordering guard).
    expect(isDone(s, "TODAY_INTRO")).toBe(true);
    expect(isDone(s, "XP_INTRO")).toBe(true);
    expect(isDone(s, "SQUAD_INTRO")).toBe(false);
  });
});

describe("mergeStates (cross-device reconciliation)", () => {
  it("is additive per key with latest ISO winning, and keeps the higher fail count", () => {
    const a = applyMark(EMPTY_ONBOARDING_STATE, "completed", "TODAY_INTRO", "2026-08-31T10:00:00Z");
    const b0 = applyMark(EMPTY_ONBOARDING_STATE, "completed", "XP_INTRO", "2026-08-31T11:00:00Z");
    const b = applyMark(b0, "failed", "STREAK_INTRO", "2026-08-31T11:30:00Z");
    const m = mergeStates(a, b);
    expect(Object.keys(m.completed).sort()).toEqual(["TODAY_INTRO", "XP_INTRO"]);
    expect(m.failed.STREAK_INTRO.count).toBe(1);
    expect(m.updatedAt).toBe("2026-08-31T11:30:00Z");
    // grandfathered is sticky from either side
    expect(mergeStates(a, { ...b, grandfathered: true }).grandfathered).toBe(true);
  });
});

describe("applyMark", () => {
  it("moves not_started → in_progress and increments fail counts", () => {
    const s1 = applyMark(EMPTY_ONBOARDING_STATE, "seen", "TODAY_INTRO", "2026-08-31T10:00:00Z");
    expect(s1.status).toBe("in_progress");
    const f1 = applyMark(s1, "failed", "XP_INTRO", "2026-08-31T10:01:00Z");
    const f2 = applyMark(f1, "failed", "XP_INTRO", "2026-08-31T10:02:00Z");
    expect(f2.failed.XP_INTRO.count).toBe(2);
    // An established status is preserved, not reset.
    const done = applyMark({ ...s1, status: "completed" }, "seen", "XP_INTRO", "2026-08-31T10:03:00Z");
    expect(done.status).toBe("completed");
  });
});

describe("mergeStates edge branches", () => {
  it("handles one-sided timestamps, equal fail counts, and status from the newer side", () => {
    const a = { ...EMPTY_ONBOARDING_STATE, updatedAt: null, status: "not_started" as const };
    const b = {
      ...EMPTY_ONBOARDING_STATE,
      status: "in_progress" as const,
      updatedAt: "2026-08-31T12:00:00Z",
      failed: { XP_INTRO: { at: "2026-08-31T12:00:00Z", count: 1 } },
    };
    const m = mergeStates(a, b);
    expect(m.status).toBe("in_progress"); // incoming is newer
    expect(m.updatedAt).toBe("2026-08-31T12:00:00Z");
    // Equal counts → newer `at` wins.
    const aF = { ...b, failed: { XP_INTRO: { at: "2026-08-31T11:00:00Z", count: 1 } } };
    expect(mergeStates(aF, b).failed.XP_INTRO.at).toBe("2026-08-31T12:00:00Z");
    // Local newer → local status kept.
    const localNew = { ...a, status: "completed" as const, updatedAt: "2026-08-31T13:00:00Z" };
    expect(mergeStates(localNew, b).status).toBe("completed");
  });
});

describe("show queue (single-flight lock)", () => {
  it("activates the first request, queues later ones, dedupes, and advances on dismiss", () => {
    let q = enqueueShow(EMPTY_QUEUE, "TODAY_INTRO");
    expect(q.activeEventId).toBe("TODAY_INTRO");
    q = enqueueShow(q, "CHECKIN_INTRO");
    q = enqueueShow(q, "CHECKIN_INTRO"); // dupe ignored
    q = enqueueShow(q, "TODAY_INTRO"); // active ignored
    expect(q.queue).toEqual(["CHECKIN_INTRO"]);
    q = dismissActive(q);
    expect(q.activeEventId).toBe("CHECKIN_INTRO");
    expect(dismissActive(q)).toEqual(EMPTY_QUEUE);
  });
});

describe("placeCard", () => {
  const vp = { width: 390, height: 800, insetTop: 48, insetBottom: 96 };
  const card = { width: 272, height: 148 };

  it("prefers below the target and horizontally clamps into the margin", () => {
    const p = placeCard({ top: 100, left: 10, width: 60, height: 40 }, card, vp, "bottom");
    expect(p?.edge).toBe("bottom");
    expect(p?.top).toBe(152); // target bottom + gap
    expect(p?.left).toBe(12); // clamped to margin, not centered off-screen
  });

  it("flips above when below would collide with the bottom inset", () => {
    const p = placeCard({ top: 640, left: 60, width: 270, height: 48 }, card, vp, "bottom");
    expect(p?.edge).toBe("top");
    expect((p?.top ?? 0) + card.height).toBeLessThanOrEqual(640);
  });

  it("returns null when nothing fits (sheet fallback)", () => {
    // Target covers essentially the whole safe viewport.
    const p = placeCard({ top: 50, left: 0, width: 390, height: 700 }, card, vp, "bottom");
    expect(p).toBeNull();
  });

  it("side placement works on a wide viewport and clamps vertically", () => {
    const wide = { width: 900, height: 400, insetTop: 48, insetBottom: 96 };
    const right = placeCard({ top: 60, left: 40, width: 60, height: 300 }, card, wide, "right");
    expect(right?.edge).toBe("right");
    expect(right?.left).toBe(112); // target right + gap
    expect(right?.top).toBeGreaterThanOrEqual(60); // clamped into safe area
    // Preferred right, no room on either side → falls through to bottom/top.
    const narrow = placeCard({ top: 100, left: 10, width: 370, height: 40 }, card, vp, "right");
    expect(narrow?.edge).toBe("bottom");
    // Preferred left mirrors to the right when the left side has no room.
    const left = placeCard({ top: 60, left: 800, width: 60, height: 100 }, card, wide, "left");
    expect(left?.edge).toBe("left");
  });
});

describe("registry", () => {
  it("covers every event id with copy, and only AI_COACH_INTRO locks its backdrop", () => {
    for (const id of ONBOARDING_EVENT_IDS) {
      const def = ONBOARDING_EVENTS[id];
      expect(def.id).toBe(id);
      if (def.presentation !== "none") {
        expect(def.title.length).toBeGreaterThan(0);
        expect(def.cta.length).toBeGreaterThan(0);
      }
      expect(def.backdropDismiss).toBe(id !== "AI_COACH_INTRO");
    }
    // Chaining hints stay inside the registry.
    expect(ONBOARDING_EVENTS.TODAY_INTRO.chainsTo).toBe("CHECKIN_INTRO");
    expect(ONBOARDING_EVENTS.STREAK_INTRO.chainsTo).toBe("PROGRESSION_INTRO");
    expect(ONBOARDING_EVENTS.AI_COACH_INTRO.chainsTo).toBe("COACH_MISSION_INTRO");
  });
});
