// The brief's own acceptance examples, run against the engine as it stands.
// This file exists to FAIL where the engine is generic; anything it asserts is
// a claim the brief makes, not a claim the implementation makes.
import { describe, it, expect } from "vitest";
import { areaLoad, topAreas, primaryAreaCount } from "../exposure";
import { buildSession } from "../build-session";

const load = (...names: string[]) => areaLoad(names.map((name) => ({ slug: null, name })));

describe("AUDIT §2 — a pressing session", () => {
  // Bench Press · Incline Dumbbell Press · Cable Fly · Lateral Raise ·
  // Triceps Pushdown, in this catalogue's own titles.
  const pressing = () =>
    load(
      "Bench Press",
      "Dumbbell Incline Bench Press",
      "Flat Bench Cable Flys",
      "Lateral Dumbbell Raises",
      "Incline Pushdown with Cable",
    );

  it("ranks chest and triceps high, shoulders present", () => {
    const ranked = pressing();
    // eslint-disable-next-line no-console
    console.log("PRESSING:", JSON.stringify(ranked));
    const by = Object.fromEntries(ranked.map((r) => [r.area, r.weight]));
    expect(by.chest).toBeGreaterThan(0);
    expect(by.triceps).toBeGreaterThan(0);
    expect(by.shoulders).toBeGreaterThan(0);
    expect(topAreas(ranked)).toEqual(expect.arrayContaining(["chest", "triceps", "shoulders"]));
  });

  it("builds a session that answers all three", () => {
    const l = pressing();
    const session = buildSession(topAreas(l), { primaryCount: primaryAreaCount(l) });
    // eslint-disable-next-line no-console
    console.log("PRESSING SESSION:", session.movements.map((m) => m.id).join(" · "), session.totalSec);
    expect(session.areas).toEqual(expect.arrayContaining(["chest", "triceps", "shoulders"]));
  });
});

describe("AUDIT §2 — a posterior-chain session", () => {
  const posterior = () =>
    load("Romanian Dead Lift", "Lying Leg Curl Machine", "Barbell Dead Lifts");

  it("weights hamstrings and glutes above everything else", () => {
    const ranked = posterior();
    // eslint-disable-next-line no-console
    console.log("POSTERIOR:", JSON.stringify(ranked));
    const top = topAreas(ranked);
    expect(top[0] === "hamstrings" || top[0] === "glutes").toBe(true);
    expect(top).toContain("glutes");
  });
});

describe("AUDIT §4 — length must change the session's character", () => {
  it("deep is more than standard stretched out", () => {
    const areas = topAreas(load("Bench Press", "Seated Military Press", "Incline Pushdown with Cable"));
    const quick = buildSession(areas, { length: "quick" });
    const standard = buildSession(areas, { length: "standard" });
    const deep = buildSession(areas, { length: "deep" });
    // eslint-disable-next-line no-console
    console.log(
      "QUICK:", quick.movements.map((m) => m.id).join(","), quick.totalSec,
      "\nSTANDARD:", standard.movements.map((m) => m.id).join(","), standard.totalSec,
      "\nDEEP:", deep.movements.map((m) => m.id).join(","), deep.totalSec,
    );
    expect(deep.movements.length).toBeGreaterThan(standard.movements.length);
  });
});

describe("AUDIT §8 — a rest day must not be a post-workout session relabelled", () => {
  it("the two contexts produce different sessions for the same areas", () => {
    const areas = topAreas(load("Barbell Squat", "Romanian Dead Lift"));
    const post = buildSession(areas, { context: "post_workout" });
    const rest = buildSession(areas, { context: "rest_day" });
    // eslint-disable-next-line no-console
    console.log("POST:", post.movements.map((m) => m.id).join(","));
    // eslint-disable-next-line no-console
    console.log("REST:", rest.movements.map((m) => m.id).join(","));
    expect(post.movements.map((m) => m.id)).not.toEqual(rest.movements.map((m) => m.id));
  });
});
