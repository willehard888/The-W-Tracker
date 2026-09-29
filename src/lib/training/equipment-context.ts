import type { ProgramBlock } from "@/hooks/use-coach-program";

/**
 * Where the athlete is training today, as distinct from where they usually do.
 *
 * Onboarding asks once, on an optional step, and stores four coarse presets on
 * the profile. That is the right default and a poor answer to "I am at home
 * with a pair of dumbbells today": the nearest preset, `home_minimal`, means
 * dumbbells AND bands AND bodyweight, which is not the same room.
 *
 * So today's choice is made in the catalog's own vocabulary — the seven values
 * every exercise is actually tagged with — while the profile keeps its four
 * presets. `EQUIP_ALIAS` in exercise-catalog already maps both, so neither
 * needs a new data model.
 *
 * Note what is NOT here: a bench. It is not a piece of equipment in this data,
 * it is part of the movement (Barbell_Bench_Press is tagged `barbell`), so
 * offering it would be a control that changes nothing.
 */
export const EQUIPMENT_VALUES = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "kettlebells",
  "bands",
  "bodyweight",
] as const;

export type EquipmentValue = (typeof EQUIPMENT_VALUES)[number];

export const EQUIPMENT_LABEL: Record<EquipmentValue, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbells",
  cable: "Cable",
  machine: "Machines",
  kettlebells: "Kettlebells",
  bands: "Bands",
  bodyweight: "Bodyweight",
};

/** One tap for the rooms people actually stand in. */
export const EQUIPMENT_PRESETS: { id: string; label: string; values: EquipmentValue[] }[] = [
  { id: "full_gym", label: "Full gym", values: [...EQUIPMENT_VALUES] },
  { id: "dumbbells", label: "Dumbbells only", values: ["dumbbell", "bodyweight"] },
  { id: "home", label: "Home", values: ["dumbbell", "bands", "bodyweight"] },
  { id: "bodyweight", label: "Bodyweight", values: ["bodyweight"] },
];

/**
 * The profile's equipment expanded into catalog values, or a full gym.
 *
 * The fallback mirrors filterCatalog: an empty list there means "assume a
 * fully-equipped gym", and disagreeing here would quietly give somebody a
 * different day than the generator would.
 */
export const defaultContext = (profileEquipment: string[] | null | undefined): EquipmentValue[] => {
  const ids = profileEquipment ?? [];
  if (ids.length === 0) return [...EQUIPMENT_VALUES];
  const out = new Set<EquipmentValue>();
  for (const id of ids) {
    const preset = PROFILE_PRESETS[id];
    if (preset) preset.forEach((v) => out.add(v));
    else if ((EQUIPMENT_VALUES as readonly string[]).includes(id)) out.add(id as EquipmentValue);
  }
  return out.size ? [...out] : [...EQUIPMENT_VALUES];
};

/** The four onboarding presets, in catalog terms. Mirrors EQUIP_ALIAS. */
const PROFILE_PRESETS: Record<string, EquipmentValue[]> = {
  full_gym: ["barbell", "dumbbell", "machine", "cable", "kettlebells", "bodyweight"],
  home_minimal: ["dumbbell", "bands", "bodyweight"],
  outdoor: ["bodyweight"],
  combat_sport: ["bodyweight"],
};

export const contextLabel = (values: readonly string[]): string => {
  const set = new Set(values);
  const preset = EQUIPMENT_PRESETS.find(
    (p) => p.values.length === set.size && p.values.every((v) => set.has(v)),
  );
  if (preset) return preset.label;
  if (set.size === 0) return "Nothing selected";
  return EQUIPMENT_VALUES.filter((v) => set.has(v)).map((v) => EQUIPMENT_LABEL[v]).join(" + ");
};

/** What the substitution did, so the athlete can be told before it happens. */
export interface Substitution {
  blocks: ProgramBlock[];
  replaced: { from: string; to: string }[];
  dropped: string[];
}

/**
 * The engine, passed in rather than imported.
 *
 * `session-builder.ts` lives under supabase/functions and a test asserts that
 * no file in src/ imports it statically — it is a 540-line module that has no
 * business in the app's boot graph. Taking it as a parameter keeps that true
 * and makes this function trivially testable besides.
 */
export interface Engine {
  poolFor: (o: {
    focus: string[];
    experience: string | null | undefined;
    equipment: string[] | null | undefined;
    injuries: Set<never>;
  }) => { slug: string; name: string }[];
  swapCandidates: (o: {
    focus: string[];
    experience: string | null | undefined;
    equipment: string[] | null | undefined;
    injuries: Set<never>;
    seed: string;
    current: string;
    exclude: string[];
  }) => { slug: string; name: string }[];
  loadClassOf: (e: unknown) => string;
  /** A fresh dose for a movement the slot's prescription does not suit. */
  prescribe: (
    e: { slug: string; name: string },
    o: { goal: string | null | undefined; experience: string | null | undefined; minutes: number },
  ) => { sets: number; reps: string; rpe: number; rest_sec: number };
  pool: Record<string, unknown>;
  /**
   * Every focus the pool knows.
   *
   * Reachability is a question about the room, not about today: a leg
   * movement sitting in a chest day is still a leg movement, and asking
   * the pool with the day’s focus reported it unreachable and traded it
   * away in a gym that had everything.
   */
  focuses: string[];
}

export interface SubstituteInput {
  experience: string | null | undefined;
  goal: string | null | undefined;
  minutes: number;
  seed: string;
}

/**
 * Today's movements, for today's room.
 *
 * The day keeps its shape: only the movements the room cannot do are traded,
 * and they are traded for the same pattern and the same primary muscle first
 * — the existing swap ranking, which is already equipment-aware because its
 * candidates come from an equipment-filtered pool.
 *
 * A movement with sets already logged is never touched. Trading it away would
 * orphan real training data against a slug no longer in the day.
 */
export const substituteForEquipment = (
  blocks: ProgramBlock[],
  context: string[],
  engine: Engine,
  input: SubstituteInput,
  locked: ReadonlySet<string>,
): Substitution => {
  const reachable = new Set(
    engine
      .poolFor({ focus: engine.focuses, experience: input.experience, equipment: context, injuries: new Set() })
      .map((e) => e.slug),
  );

  const out: ProgramBlock[] = [];
  const replaced: { from: string; to: string }[] = [];
  const dropped: string[] = [];
  const taken = blocks.map((b) => b.slug).filter((s): s is string => !!s);

  for (const block of blocks) {
    const slug = block.slug;
    // No slug means nothing can be looked up, so nothing can be judged
    // unreachable either — a hand-written movement stays as written.
    if (!slug || reachable.has(slug) || locked.has(slug)) {
      out.push(block);
      continue;
    }
    const pick = engine.swapCandidates({
      focus: engine.focuses,
      experience: input.experience,
      equipment: context,
      injuries: new Set(),
      seed: input.seed,
      current: slug,
      exclude: taken,
    })[0];
    if (!pick) {
      dropped.push(block.name);
      continue;
    }
    taken.push(pick.slug);
    // The substitute inherits the slot's prescription when it is the same kind
    // of work. A dumbbell bench for a barbell bench is the same dose; a lateral
    // raise standing in for a row is not, and carrying 4x5-8 across would be
    // the original bug in miniature.
    const sameKind = engine.loadClassOf(engine.pool[slug]) === engine.loadClassOf(engine.pool[pick.slug]);
    if (sameKind) {
      out.push({ ...block, slug: pick.slug, name: pick.name, alt: null });
    } else {
      const rx = engine.prescribe(pick, {
        goal: input.goal,
        experience: input.experience,
        minutes: input.minutes,
      });
      out.push({
        ...block,
        slug: pick.slug,
        name: pick.name,
        alt: null,
        sets: rx.sets,
        reps: rx.reps,
        rpe: rx.rpe,
        rest_sec: rx.rest_sec,
      });
    }
    replaced.push({ from: block.name, to: pick.name });
  }

  return { blocks: out, replaced, dropped };
};
