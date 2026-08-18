import { describe, it, expect } from "vitest";
import {
  SPORTS,
  sportFromHealthKit,
  SPORT_CATALOG,
  SPORT_GROUPS,
  NO_WORKOUT,
  sportById,
  sportLabel,
  sportsByGroup,
} from "@/lib/sports";

describe("sport catalog invariants", () => {
  it("every sport stays within the server XP ceiling (≤ 35)", () => {
    // record_checkin budgets +35 for the workout habit (+10 margin). A sport
    // above that gets silently clamped server-side — the UI would lie.
    for (const s of SPORTS) {
      expect(s.xp, `${s.id} xp`).toBeGreaterThan(0);
      expect(s.xp, `${s.id} xp exceeds server ceiling`).toBeLessThanOrEqual(35);
    }
  });

  it("ids are unique (they are persisted in daily_checkins.sport)", () => {
    const ids = SPORT_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every legacy id — persisted values must never break", () => {
    // The original 10 check-in ids. Renaming one orphans historical rows.
    for (const legacy of ["none", "walk", "run", "gym", "swim", "yoga", "combat", "hiit", "team", "cycling", "other"]) {
      expect(SPORT_CATALOG.some((s) => s.id === legacy), legacy).toBe(true);
    }
  });

  it("tennis and the new sports exist", () => {
    for (const id of ["tennis", "padel", "golf", "football", "basketball", "icehockey", "floorball", "climbing", "hike", "ski", "xcski", "rowing", "dance", "skate"]) {
      expect(SPORTS.some((s) => s.id === id), id).toBe(true);
    }
  });

  it("every sport belongs to a declared group", () => {
    for (const s of SPORTS) {
      expect(SPORT_GROUPS).toContain(s.group);
    }
  });

  it("sportsByGroup covers the whole catalog exactly once", () => {
    const grouped = sportsByGroup().flatMap((g) => g.sports.map((s) => s.id));
    expect(grouped.sort()).toEqual(SPORTS.map((s) => s.id).sort());
  });

  it("sportById falls back to NO_WORKOUT for unknown/null", () => {
    expect(sportById("nope")).toEqual(NO_WORKOUT);
    expect(sportById(null)).toEqual(NO_WORKOUT);
    expect(sportById("tennis").label).toBe("Tennis");
  });

  it("sportLabel formats persisted ids and hides none", () => {
    expect(sportLabel("tennis")).toBe("🎾 Tennis");
    expect(sportLabel("none")).toBeNull();
    expect(sportLabel(null)).toBeNull();
  });
});

describe("sportFromHealthKit", () => {
  it("maps the common HKWorkoutActivityType strings to catalog ids", () => {
    expect(sportFromHealthKit("tennis")).toBe("tennis");
    expect(sportFromHealthKit("running")).toBe("run");
    expect(sportFromHealthKit("traditionalStrengthTraining")).toBe("gym");
    expect(sportFromHealthKit("functionalStrengthTraining")).toBe("gym");
    expect(sportFromHealthKit("highIntensityIntervalTraining")).toBe("hiit");
    expect(sportFromHealthKit("soccer")).toBe("football");
    expect(sportFromHealthKit("hockey")).toBe("icehockey");
    expect(sportFromHealthKit("crossCountrySkiing")).toBe("xcski");
    expect(sportFromHealthKit("downhillSkiing")).toBe("ski");
    expect(sportFromHealthKit("martialArts")).toBe("combat");
    expect(sportFromHealthKit("skatingSports")).toBe("skate");
  });

  it("every mapped id exists in the catalog", () => {
    const hkTypes = ["tennis","pickleball","golf","soccer","basketball","hockey","running","walking","hiking","cycling","swimming","rowing","yoga","dance","boxing","traditionalStrengthTraining","highIntensityIntervalTraining","climbing","crossCountrySkiing","downhillSkiing","skatingSports","rugby","volleyball"];
    for (const t of hkTypes) {
      const id = sportFromHealthKit(t);
      expect(id, t).toBeTruthy();
      expect(SPORTS.some((s) => s.id === id), `${t} → ${id}`).toBe(true);
    }
  });

  it("non-workouts and unknowns behave", () => {
    expect(sportFromHealthKit("cooldown")).toBeNull();
    expect(sportFromHealthKit("transition")).toBeNull();
    expect(sportFromHealthKit(null)).toBeNull();
    expect(sportFromHealthKit("underwaterDiving")).toBe("other");
  });
});
