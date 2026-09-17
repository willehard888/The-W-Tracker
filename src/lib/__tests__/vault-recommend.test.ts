import { describe, expect, it } from "vitest";
import { nextStep, pickTodaysPractice, recommendPath, signalsFromCheckins, type VaultSignals } from "../vault-recommend";
import { VAULT_PATHS, PATH_BY_SLUG } from "@/data/vault-paths";

const base: VaultSignals = {
  checkinDays: 6,
  workoutDays: 3,
  meditationDays: 1,
  sleepAvg: 7.6,
  streak: 12,
  practicedSlugs: new Set(),
};

describe("recommendPath: a pointer from logged behaviour, never a diagnosis", () => {
  it("few check-ins → discipline, with the count in the reason", () => {
    const r = recommendPath({ ...base, checkinDays: 2 }, 0);
    expect(r.path.slug).toBe("discipline");
    expect(r.reason).toMatch(/2 check-ins/);
  });

  it("heavy training on short sleep → the long game", () => {
    const r = recommendPath({ ...base, workoutDays: 5, sleepAvg: 6.4 }, 0);
    expect(r.path.slug).toBe("long-game");
    expect(r.reason).toMatch(/6\.4 h/);
  });

  it("a meditation habit → presence; a long streak → meaning", () => {
    expect(recommendPath({ ...base, meditationDays: 5 }, 0).path.slug).toBe("presence");
    expect(recommendPath({ ...base, streak: 45 }, 0).path.slug).toBe("meaning");
  });

  it("rules are skipped once their path is finished, and fall through to rotation", () => {
    const practicedSlugs = new Set(PATH_BY_SLUG.discipline.steps);
    const r = recommendPath({ ...base, checkinDays: 1, practicedSlugs }, 3);
    expect(r.path.slug).not.toBe("discipline");
    expect(r.reason).toBe("Today's door on the map.");
  });

  it("rotation walks the open paths evenly by day", () => {
    const seen = new Set<string>();
    for (let d = 0; d < VAULT_PATHS.length; d++) seen.add(recommendPath(base, d).path.slug);
    expect(seen.size).toBe(VAULT_PATHS.length);
  });

  it("every path walked → still returns a path, with an honest reason", () => {
    const practicedSlugs = new Set(VAULT_PATHS.flatMap((p) => p.steps));
    const r = recommendPath({ ...base, practicedSlugs }, 1);
    expect(r.path).toBeDefined();
    expect(r.reason).toMatch(/Every path walked/);
  });

  it("reasons never name a state of mind", () => {
    const words = /anx|depress|lonely|lazy|weak|broken|struggl|fail/i;
    for (let d = 0; d < 12; d++) {
      for (const s of [base, { ...base, checkinDays: 1 }, { ...base, workoutDays: 6, sleepAvg: 5.5 }, { ...base, streak: 60 }]) {
        expect(recommendPath(s, d).reason).not.toMatch(words);
      }
    }
  });
});

describe("pickTodaysPractice + nextStep", () => {
  it("today's practice is the first unpractised step of the recommended path", () => {
    const p = PATH_BY_SLUG.discipline;
    const r = pickTodaysPractice({ ...base, checkinDays: 2, practicedSlugs: new Set([p.steps[0]]) }, 0)!;
    expect(r.path?.slug).toBe("discipline");
    expect(r.slug).toBe(p.steps[1]);
    expect(nextStep(p, new Set(p.steps))).toBeNull();
  });

  it("every path walked: the rest of the library takes over, from any shelf, until nothing is left", () => {
    const walked = new Set(VAULT_PATHS.flatMap((x) => x.steps));
    const library = [...walked, "zone-2-cardio", "sleep-7-9-hours"];
    const r = pickTodaysPractice({ ...base, practicedSlugs: walked }, 0, library)!;
    expect(r.path).toBeNull();
    expect(r.slug).toBe("zone-2-cardio");
    expect(pickTodaysPractice({ ...base, practicedSlugs: walked }, 1, library)!.slug).toBe("sleep-7-9-hours");
    // Nothing left anywhere: a walked path comes round again rather than an empty card.
    const all = new Set(library);
    const again = pickTodaysPractice({ ...base, practicedSlugs: all }, 0, library)!;
    expect(again.path).not.toBeNull();
    expect(again.path!.steps).toContain(again.slug);
  });
});

describe("signalsFromCheckins", () => {
  it("counts days, averages only real sleep, caps at seven", () => {
    const rows = [
      { sleep_hours: 8, workout: true, meditation_morning: true, meditation_evening: false },
      { sleep_hours: 0, workout: false, meditation_morning: false, meditation_evening: true },
      { sleep_hours: 6, workout: true, meditation_morning: false, meditation_evening: false },
    ];
    const s = signalsFromCheckins(rows, 9, new Set(["x"]));
    expect(s).toMatchObject({ checkinDays: 3, workoutDays: 2, meditationDays: 2, sleepAvg: 7, streak: 9 });
    expect(s.practicedSlugs.has("x")).toBe(true);
    expect(signalsFromCheckins([], 0, new Set()).sleepAvg).toBeNull();
    expect(signalsFromCheckins(new Array(9).fill(rows[0]), 0, new Set()).checkinDays).toBe(7);
  });
});
