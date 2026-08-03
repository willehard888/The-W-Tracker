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
