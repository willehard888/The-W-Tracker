import { describe, it, expect } from "vitest";
import {
  resolveCheckinHabits,
  CORE_KEYS,
  DEFAULT_CHECKIN_KEYS,
  OPTIONAL_XP_CAP,
  VERIFIED_BONUS_XP,
  CHECKIN_HABITS,
} from "@/lib/checkin-habits";

describe("checkin-habits constants", () => {
  it("anti-cheat / bonus values are the agreed contract", () => {
    expect(OPTIONAL_XP_CAP).toBe(40);
    expect(VERIFIED_BONUS_XP).toBe(10);
  });
  it("every core key maps to a habit flagged core in the library", () => {
    for (const key of CORE_KEYS) {
      const habit = CHECKIN_HABITS.find((h) => h.key === key);
      expect(habit, `core key ${key} exists`).toBeTruthy();
      expect(habit!.core).toBe(true);
    }
  });
});

describe("resolveCheckinHabits", () => {
  const keysOf = (hs: { key: string }[]) => hs.map((h) => h.key);

  it("falls back to the defaults for null/empty input", () => {
    const fromNull = keysOf(resolveCheckinHabits(null));
    const fromEmpty = keysOf(resolveCheckinHabits([]));
    expect(fromNull).toEqual(fromEmpty);
    // Defaults must be represented.
    for (const k of DEFAULT_CHECKIN_KEYS) expect(fromNull).toContain(k);
  });

  it("always includes every core habit, even if not selected", () => {
    const resolved = resolveCheckinHabits(["some_optional_that_does_not_exist"]);
    for (const core of CORE_KEYS) {
      expect(keysOf(resolved)).toContain(core);
    }
  });

  it("includes a chosen optional habit alongside core", () => {
    const optional = CHECKIN_HABITS.find((h) => !h.core);
    expect(optional).toBeTruthy();
    const resolved = keysOf(resolveCheckinHabits([optional!.key]));
    expect(resolved).toContain(optional!.key);
    for (const core of CORE_KEYS) expect(resolved).toContain(core);
  });

  it("preserves library order (stable rendering)", () => {
    const resolved = resolveCheckinHabits(DEFAULT_CHECKIN_KEYS);
    const libraryOrder = CHECKIN_HABITS.filter((h) => resolved.includes(h)).map((h) => h.key);
    expect(resolved.map((h) => h.key)).toEqual(libraryOrder);
  });
});

describe("earned habits", () => {
  it("adds a habit the athlete never chose, in library order", () => {
    const base = resolveCheckinHabits([]);
    expect(base.some((h) => h.key === "mobility")).toBe(false);

    const withRecovery = resolveCheckinHabits([], ["mobility"]);
    expect(withRecovery.some((h) => h.key === "mobility")).toBe(true);
    // Among the movement habits, not appended after Connection.
    const keys = withRecovery.map((h) => h.key);
    expect(keys.indexOf("mobility")).toBeLessThan(keys.indexOf("healthy_food"));
  });

  it("does not duplicate a habit the athlete already chose", () => {
    const habits = resolveCheckinHabits(["mobility"], ["mobility"]);
    expect(habits.filter((h) => h.key === "mobility")).toHaveLength(1);
  });

  it("changes nothing when nothing was earned", () => {
    expect(resolveCheckinHabits(["reading"], [])).toEqual(resolveCheckinHabits(["reading"]));
  });

  it("is the same list the XP model scores, so an earned habit pays", () => {
    const habits = resolveCheckinHabits([], ["mobility"]);
    const mobility = habits.find((h) => h.key === "mobility");
    expect(mobility?.xp).toBe(15);
    expect(mobility?.core).toBeFalsy(); // optional, so the OPTIONAL_XP_CAP applies
  });
});
