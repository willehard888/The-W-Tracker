import { describe, it, expect } from "vitest";
import {
  EQUIPMENT_VALUES,
  EQUIPMENT_PRESETS,
  defaultContext,
  contextLabel,
  substituteForEquipment,
  type Engine,
} from "../equipment-context";
import {
  poolFor,
  swapCandidates,
  prescribe,
  loadClassOf,
  SESSION_POOL,
  FOCUSES,
} from "../../../../supabase/functions/_shared/session-builder";
import { filterCatalog } from "../../../../supabase/functions/_shared/exercise-catalog";
import type { ProgramBlock } from "@/hooks/use-coach-program";

/**
 * Training somewhere else today.
 *
 * Onboarding asks once and stores a coarse preset on the profile, which is the
 * right default and a poor answer to "I am at home with a pair of dumbbells".
 * Today's room has to be sayable without rewriting who the athlete is.
 *
 * The engine is passed in rather than imported by the module under test —
 * session-builder lives under supabase/functions and a separate test asserts
 * that nothing in src/ pulls it into the boot graph. A test file may import it
 * directly, which is the whole reason this shape is testable at all.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const engine = { poolFor, swapCandidates, prescribe, loadClassOf, pool: SESSION_POOL, focuses: FOCUSES } as unknown as Engine;

const input = {
  experience: "experienced" as const,
  goal: "all",
  minutes: 60,
  seed: "t",
};

const block = (slug: string, name = slug): ProgramBlock => ({
  slug,
  name,
  sets: 4,
  reps: "5-8",
  rpe: 8,
  rest_sec: 150,
});

const equipOf = (slug: string) =>
  filterCatalog(null, 999).find((e) => e.slug === slug)?.equipment ?? "unknown";

describe("today's equipment", () => {
  it("reads an empty profile as a full gym, exactly as the generator does", () => {
    // filterCatalog treats no equipment as a fully-equipped gym. Disagreeing
    // here would hand somebody a different day than the builder would.
    expect(new Set(defaultContext([])), "empty").toEqual(new Set(EQUIPMENT_VALUES));
    expect(new Set(defaultContext(null)), "null").toEqual(new Set(EQUIPMENT_VALUES));
  });

  it("expands the four onboarding presets into catalog values", () => {
    expect(defaultContext(["home_minimal"]).sort()).toEqual(["bands", "bodyweight", "dumbbell"]);
    expect(defaultContext(["outdoor"])).toEqual(["bodyweight"]);
    expect(defaultContext(["full_gym"]), "a full gym is most of the catalog").toContain("barbell");
  });

  it("names a chosen room, and falls back to listing it", () => {
    expect(contextLabel(["dumbbell", "bodyweight"])).toBe("Dumbbells only");
    // A full gym is what EQUIP_ALIAS says it is, not "every value" — the two
    // disagreed and the founder’s own card read the list instead of the name.
    expect(contextLabel(EQUIPMENT_PRESETS[0].values)).toBe("Full gym");
    expect(contextLabel(defaultContext(["full_gym"])), "the profile preset agrees").toBe("Full gym");
    expect(contextLabel(["barbell", "cable"])).toBe("Barbell + Cable");
  });

  it("offers no control that cannot change anything", () => {
    // A bench is not equipment in this data — it is part of the movement, and
    // Barbell_Bench_Press is tagged `barbell`. Offering one would be a switch
    // wired to nothing.
    expect(EQUIPMENT_VALUES as readonly string[]).not.toContain("bench");
    for (const preset of EQUIPMENT_PRESETS) {
      for (const v of preset.values) {
        expect(EQUIPMENT_VALUES as readonly string[], `${preset.id}`).toContain(v);
      }
    }
  });
});

describe("substituting a day for the room it will be done in", () => {
  const barbellDay = [
    block("Barbell_Bench_Press", "Barbell Bench Press"),
    block("Barbell_Squat", "Barbell Squat"),
    block("Barbell_Deadlift", "Barbell Deadlift"),
  ].filter((b) => SESSION_POOL[b.slug!]);

  it("leaves a full-gym day untouched in a full gym", () => {
    const r = substituteForEquipment(barbellDay, [...EQUIPMENT_VALUES], engine, input, new Set());
    expect(r.replaced, "nothing to trade").toEqual([]);
    expect(r.dropped).toEqual([]);
    expect(r.blocks.map((b) => b.slug)).toEqual(barbellDay.map((b) => b.slug));
  });

  it("only offers movements the room can actually do", () => {
    const r = substituteForEquipment(barbellDay, ["dumbbell", "bodyweight"], engine, input, new Set());
    for (const b of r.blocks) {
      expect(["dumbbell", "bodyweight"], `${b.name} needs ${equipOf(b.slug!)}`).toContain(equipOf(b.slug!));
    }
  });

  it("never trades away a movement with sets already logged", () => {
    // This is the one that protects real training data: a slug swapped out
    // from under logged sets orphans them against a movement not in the day.
    const locked = new Set([barbellDay[0].slug!]);
    const r = substituteForEquipment(barbellDay, ["bodyweight"], engine, input, locked);
    expect(r.blocks.map((b) => b.slug), "the logged movement stays").toContain(barbellDay[0].slug);
    expect(r.replaced.map((x) => x.from)).not.toContain(barbellDay[0].name);
  });

  it("drops a movement the room genuinely cannot replace, rather than inventing one", () => {
    const r = substituteForEquipment(barbellDay, ["bands"], engine, input, new Set());
    expect(r.blocks.length + r.dropped.length, "every block is kept, traded or dropped")
      .toBe(barbellDay.length);
  });

  it("gives the same room the same day twice", () => {
    const a = substituteForEquipment(barbellDay, ["dumbbell", "bodyweight"], engine, input, new Set());
    const b = substituteForEquipment(barbellDay, ["dumbbell", "bodyweight"], engine, input, new Set());
    expect(a.blocks, "the swap ranking is seeded, so this must be stable").toEqual(b.blocks);
  });

  it("never puts the same movement in a day twice", () => {
    const r = substituteForEquipment(barbellDay, ["dumbbell", "bodyweight"], engine, input, new Set());
    const slugs = r.blocks.map((b) => b.slug);
    expect(new Set(slugs).size, `duplicates in ${slugs.join(", ")}`).toBe(slugs.length);
  });

  it("carries the slot's dose only to the same kind of work", () => {
    const r = substituteForEquipment(barbellDay, ["dumbbell", "bodyweight"], engine, input, new Set());
    for (let i = 0; i < r.blocks.length; i++) {
      const before = barbellDay.find((b) => b.name === r.replaced.find((x) => x.to === r.blocks[i].name)?.from);
      if (!before) continue;
      const sameKind = loadClassOf(SESSION_POOL[before.slug!]) === loadClassOf(SESSION_POOL[r.blocks[i].slug!]);
      if (!sameKind) {
        // A different class must not inherit 4x5-8 — that is the rep-range bug
        // in miniature, arriving through the back door.
        expect(r.blocks[i].reps, `${before.name} → ${r.blocks[i].name}`).not.toBe(before.reps);
      }
    }
  });

  it("leaves a hand-written movement with no slug alone", () => {
    const hand: ProgramBlock = { slug: null, name: "Coach's own thing", sets: 3, reps: "10" };
    const r = substituteForEquipment([hand], ["bodyweight"], engine, input, new Set());
    expect(r.blocks, "nothing to look up means nothing to judge").toEqual([hand]);
  });
});

/**
 * Programs built before the current pool existed carry movement names that
 * were never catalog slugs. Caught on the founder's own card: opening the
 * sheet in a fully-equipped gym offered to change all five movements,
 * because "the pool has never heard of this" was being read as "this room
 * cannot do this". Picking any equipment would have emptied the day.
 */
describe("a movement the pool has never heard of", () => {
  const legacy: ProgramBlock[] = [
    { slug: "Barbell_Overhead_Press", name: "Barbell Overhead Press", sets: 4, reps: "5-8", rpe: 8 },
    { slug: "Seated_Cable_Row_Invented", name: "Seated Cable Row", sets: 3, reps: "8", rpe: 7.5 },
  ];

  it("is left alone rather than reported as unreachable", () => {
    for (const b of legacy) {
      expect(SESSION_POOL[b.slug!], `${b.slug} must be absent for this test to mean anything`).toBeUndefined();
    }
    const r = substituteForEquipment(legacy, [...EQUIPMENT_VALUES], engine, input, new Set());
    expect(r.dropped, "nothing is dropped in a full gym").toEqual([]);
    expect(r.replaced).toEqual([]);
    expect(r.blocks).toEqual(legacy);
  });

  it("is still left alone in the narrowest possible room", () => {
    const r = substituteForEquipment(legacy, ["bodyweight"], engine, input, new Set());
    expect(r.blocks, "unknown is not the same as impossible").toEqual(legacy);
  });
});
