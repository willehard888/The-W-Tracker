import { describe, it, expect, beforeEach } from "vitest";
import { areaLoad, topAreas, primaryAreaCount } from "../exposure";
import { buildSession, BUDGET_SEC, swapMovement, type RecoveryLength } from "../build-session";
import { whyThis, whyThisShort, listAreas } from "../explain";
import { deferRecovery, deferredRecovery, clearDeferredRecovery } from "../deferred";
import { preferredLength, rememberLength } from "../preferences";
import { markRecoveryDone, recoveryDaysThisWeek } from "../completion";
import { RECOVERY_MOVEMENTS, movementSeconds } from "@/data/recovery";

const load = (...names: string[]) => areaLoad(names.map((name) => ({ slug: null, name })));
const build = (names: string[], opts = {}) => {
  const l = load(...names);
  return buildSession(topAreas(l), { primaryCount: primaryAreaCount(l), ...opts });
};

const PRESS = ["Bench Press", "Dumbbell Incline Bench Press", "Flat Bench Cable Flys", "Lateral Dumbbell Raises", "Incline Pushdown with Cable"];
const LEGS = ["Barbell Squat", "Romanian Dead Lift", "Standing Calf Raises using Machine"];

describe("what counts as 'what you trained'", () => {
  it("splits by measured load, not by rank position", () => {
    // chest 6, shoulders 5, triceps 4 — all three were genuinely worked.
    expect(primaryAreaCount(load(...PRESS))).toBe(3);
  });

  it("keeps it to one when one area dominates", () => {
    expect(primaryAreaCount(load("Standing Calf Raises using Machine"))).toBe(1);
  });

  it("never exceeds the cap, so the phase stays a phase", () => {
    expect(primaryAreaCount(load(...PRESS, ...LEGS), 3)).toBeLessThanOrEqual(3);
  });

  it("is zero for nothing", () => {
    expect(primaryAreaCount([])).toBe(0);
  });
});

describe("the chain rule keeps a loaded area from vanishing", () => {
  it("a hip-hinge day still offers something for the hips", () => {
    // Measured: hamstrings 5, calves 2, lower back 2, glutes 1. Only the RDL
    // names glutes at all, and only as a secondary — the data is thin, not the
    // training, and the athlete still just did three hinges.
    const areas = topAreas(load("Romanian Dead Lift", "Lying Leg Curl Machine", "Barbell Dead Lifts"));
    expect(areas).toContain("glutes");
  });

  it("does not drag in an unrelated area", () => {
    const areas = topAreas(load("Romanian Dead Lift", "Lying Leg Curl Machine", "Barbell Dead Lifts"));
    expect(areas).not.toContain("chest");
    expect(areas).not.toContain("triceps");
  });

  it("never reorders — measured load still decides the order", () => {
    const l = load("Romanian Dead Lift", "Lying Leg Curl Machine", "Barbell Dead Lifts");
    expect(topAreas(l)[0]).toBe(l[0].area);
  });
});

describe("a session has an arc", () => {
  it("post-workout settles, works what was trained, then finishes", () => {
    const session = build(PRESS);
    const phases = session.blocks.map((b) => b.phase);
    expect(phases[0]).toBe("downshift");
    expect(phases).toContain("primary");
    expect(phases.at(-1)).toBe("finish");
  });

  it("a rest day moves first and winds down last", () => {
    const session = build(LEGS, { context: "rest_day" });
    const phases = session.blocks.map((b) => b.phase);
    expect(phases[0]).toBe("move");
    expect(phases).toContain("mobilize");
    expect(phases.at(-1)).toBe("relax");
  });

  it("a rest day is a different session, not the same one relabelled", () => {
    const post = build(LEGS, { context: "post_workout" });
    const rest = build(LEGS, { context: "rest_day" });
    expect(rest.movements.map((m) => m.id)).not.toEqual(post.movements.map((m) => m.id));
    // And it contains movement that only makes sense on a day with room in it.
    expect(rest.movements.some((m) => m.type === "light" || m.type === "flow")).toBe(true);
    expect(post.movements.some((m) => m.type === "light")).toBe(false);
  });

  it("every block's movements appear in the flattened order", () => {
    const session = build(PRESS);
    expect(session.blocks.flatMap((b) => b.movements)).toEqual(session.movements);
  });
});

describe("length changes the session, not just its label", () => {
  const lengths: RecoveryLength[] = ["quick", "standard", "deep"];

  it("each step is genuinely longer than the last", () => {
    const [q, s, d] = lengths.map((length) => build(PRESS, { length }));
    expect(s.totalSec).toBeGreaterThan(q.totalSec);
    expect(d.totalSec).toBeGreaterThan(s.totalSec);
    expect(d.movements.length).toBeGreaterThan(s.movements.length);
  });

  it("lands in the ranges the product asks for", () => {
    const [q, s, d] = lengths.map((length) => build(PRESS, { length }));
    expect(q.totalSec / 60).toBeGreaterThanOrEqual(2.5);
    expect(q.totalSec / 60).toBeLessThanOrEqual(4);
    expect(s.totalSec / 60).toBeGreaterThanOrEqual(5);
    expect(s.totalSec / 60).toBeLessThanOrEqual(8);
    expect(d.totalSec / 60).toBeGreaterThanOrEqual(9);
    expect(d.totalSec / 60).toBeLessThanOrEqual(15);
  });

  it("quick spends everything on what was actually loaded", () => {
    const session = build(PRESS, { length: "quick" });
    expect(session.blocks.some((b) => b.phase === "supporting")).toBe(false);
    expect(session.blocks.some((b) => b.phase === "downshift")).toBe(false);
  });

  it("stays inside its budget at every length and context", () => {
    for (const length of lengths) {
      for (const context of ["post_workout", "rest_day"] as const) {
        const session = build(PRESS, { length, context });
        expect(session.totalSec).toBeLessThanOrEqual(BUDGET_SEC[length]);
      }
    }
  });
});

describe("saying you are sore changes the session", () => {
  it("makes it shorter and gentler, and claims nothing", () => {
    const normal = build(LEGS);
    const sore = build(LEGS, { soreness: "sore" });
    expect(sore.totalSec).toBeLessThan(normal.totalSec);
    for (const m of sore.movements) {
      expect(m.intensity ?? "moderate").toBe("gentle");
    }
  });

  it("still produces a usable session", () => {
    const sore = build(LEGS, { soreness: "sore" });
    expect(sore.movements.length).toBeGreaterThan(1);
  });

  it("saying you feel good changes nothing", () => {
    expect(build(LEGS, { soreness: "good" }).movements).toEqual(build(LEGS).movements);
  });
});

describe("why this session", () => {
  it("names the exercises it was built from", () => {
    const session = build(PRESS);
    expect(whyThis("post_workout", session, load(...PRESS), 5)).toContain("5 exercises");
  });

  it("never claims provenance for a general session", () => {
    const general = buildSession([]);
    const line = whyThis("post_workout", general, [], 0);
    expect(line).toContain("general");
    expect(line).not.toContain("built from");
    expect(whyThisShort("post_workout", general, 0)).toContain("general");
  });

  it("reads like something a person would say", () => {
    expect(listAreas(["chest"])).toBe("chest");
    expect(listAreas(["chest", "triceps"])).toBe("chest and triceps");
    expect(listAreas(["chest", "shoulders", "triceps"])).toBe("chest, shoulders and triceps");
  });
});

describe("maybe later means later", () => {
  beforeEach(() => { localStorage.clear(); });

  it("parks the session and hands it back the same day", () => {
    deferRecovery({ source: "post_workout", query: "p=1&w=1&d=2", areas: ["chest"], minutes: 6 });
    const parked = deferredRecovery();
    expect(parked?.query).toBe("p=1&w=1&d=2");
    expect(parked?.minutes).toBe(6);
  });

  it("expires with the day it belongs to", () => {
    const monday = new Date(2026, 8, 14, 18, 0);
    deferRecovery({ source: "post_workout", query: "p=1", areas: ["chest"], minutes: 6 }, monday);
    expect(deferredRecovery(monday)).not.toBeNull();
    expect(deferredRecovery(new Date(2026, 8, 15, 9, 0))).toBeNull();
  });

  it("is cleared by finishing a session", () => {
    deferRecovery({ source: "rest_day", query: "", areas: [], minutes: 3 });
    clearDeferredRecovery();
    expect(deferredRecovery()).toBeNull();
  });

  it("survives nonsense in storage instead of throwing", () => {
    localStorage.setItem("recovery-deferred", "{not json");
    expect(() => deferredRecovery()).not.toThrow();
    expect(deferredRecovery()).toBeNull();
  });
});

describe("remembering what the athlete keeps choosing", () => {
  beforeEach(() => { localStorage.clear(); });

  it("stands on standard until there is a habit to see", () => {
    expect(preferredLength()).toBe("standard");
    rememberLength("quick");
    rememberLength("quick");
    expect(preferredLength()).toBe("standard");
  });

  it("follows a clear habit", () => {
    rememberLength("quick");
    rememberLength("quick");
    rememberLength("quick");
    expect(preferredLength()).toBe("quick");
  });

  it("refuses to guess on a tie", () => {
    rememberLength("quick");
    rememberLength("quick");
    rememberLength("deep");
    rememberLength("deep");
    expect(preferredLength()).toBe("standard");
  });
});

describe("the library as data", () => {
  it("rest-day-only movement exists, or the two contexts cannot differ", () => {
    const restOnly = RECOVERY_MOVEMENTS.filter(
      (m) => m.contexts.includes("rest_day") && !m.contexts.includes("post_workout"),
    );
    expect(restOnly.length).toBeGreaterThanOrEqual(4);
  });

  it("has enough gentle movement to build a sore session from", () => {
    const gentle = RECOVERY_MOVEMENTS.filter((m) => m.intensity === "gentle");
    expect(gentle.length).toBeGreaterThanOrEqual(8);
  });

  it("keeps every single movement inside the shortest budget", () => {
    for (const m of RECOVERY_MOVEMENTS) {
      expect(movementSeconds(m)).toBeLessThanOrEqual(BUDGET_SEC.quick);
    }
  });

  it("gives every area more than one answer, so Deep can be deep", () => {
    const counts = new Map<string, number>();
    for (const m of RECOVERY_MOVEMENTS) {
      for (const a of m.areas) counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    const thin = [...counts.entries()].filter(([, n]) => n < 2).map(([a]) => a);
    expect(thin).toEqual([]);
  });
});

describe("swapping keeps the recovery target", () => {
  it("offers a different movement that covers the same area", () => {
    const session = build(LEGS);
    const first = session.movements.find((m) => m.areas.length > 0)!;
    const alt = swapMovement(session, first);
    expect(alt).not.toBeNull();
    expect(alt!.id).not.toBe(first.id);
    expect(first.areas.some((a) => alt!.areas.includes(a))).toBe(true);
  });

  it("never offers something already in the session", () => {
    const session = build(LEGS, { length: "deep" });
    for (const m of session.movements) {
      const alt = swapMovement(session, m);
      if (alt) expect(session.movements.map((x) => x.id)).not.toContain(alt.id);
    }
  });

  it("respects a sore session — a swap cannot smuggle in harder work", () => {
    const session = build(LEGS, { soreness: "sore" });
    for (const m of session.movements) {
      const alt = swapMovement(session, m, { soreness: "sore" });
      if (alt) expect(alt.intensity ?? "moderate").toBe("gentle");
    }
  });

  it("is deterministic", () => {
    const session = build(LEGS);
    const m = session.movements[1];
    expect(swapMovement(session, m)?.id).toBe(swapMovement(session, m)?.id);
  });
});

describe("the weekly count", () => {
  beforeEach(() => { localStorage.clear(); });

  it("counts days, not sessions — two in one evening is one good day", () => {
    const d = new Date(2026, 8, 18, 18, 0);
    markRecoveryDone(d);
    markRecoveryDone(new Date(2026, 8, 18, 21, 0));
    expect(recoveryDaysThisWeek(d)).toBe(1);
  });

  it("looks back seven days and no further", () => {
    const today = new Date(2026, 8, 18);
    markRecoveryDone(new Date(2026, 8, 16));
    markRecoveryDone(new Date(2026, 8, 18));
    markRecoveryDone(new Date(2026, 8, 5));
    expect(recoveryDaysThisWeek(today)).toBe(2);
  });

  it("is zero before anything is done", () => {
    expect(recoveryDaysThisWeek()).toBe(0);
  });
});
