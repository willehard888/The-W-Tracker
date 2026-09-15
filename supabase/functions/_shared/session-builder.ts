// Today's session, built in a moment from the same safe, drawable pool the
// 4-week generator prescribes from — no model, no wait, no invented lifts.
//
// The athlete picks what to hit (back + biceps, 45 min); the builder lays out
// one or two lead compounds for those muscles, then the secondary compounds,
// then isolation, sets/reps/RPE/rest from the goal, fitted to the minutes.
// Deterministic: the same seed builds the same session, a new seed
// ("Shuffle") a different one. Safety has one authority — `bannedSlugs` from
// program-safety, the table the generator already trusts.
//
// Judgement calls in SESSION_POOL, so nobody re-litigates them by accident:
// upright rows are a vertical pull of the shoulder girdle; shrugs and rear
// delts live under shoulders with back as the secondary focus; pullovers are
// lat work with the chest assisting; dips are a vertical push; JM press and
// the decline close-grip-to-skull-crusher are triceps compounds (tier 2);
// `Cable_Internal_Rotation` is rotator-cuff prehab and is left out so a hash
// can never make it a session's only shoulder move.
import { EXERCISE_CATALOG, filterCatalog, type CatalogItem } from "./exercise-catalog.ts";
import { bannedSlugs, type InjuryTag } from "./program-safety.ts";

export type Pattern =
  | "squat" | "hinge" | "lunge"
  | "horizontal_push" | "vertical_push" | "horizontal_pull" | "vertical_pull"
  | "arm_biceps" | "arm_triceps" | "shoulder_iso" | "chest_iso" | "back_iso" | "leg_iso" | "glute_iso"
  | "core";

export type Focus = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "legs" | "glutes" | "core";
export const FOCUSES: Focus[] = ["chest", "back", "shoulders", "biceps", "triceps", "legs", "glutes", "core"];

/** Drawable slugs deliberately kept out of the session pool. */
export const DROPPED_FROM_POOL = ["Cable_Internal_Rotation"];

export interface PoolEntry {
  pattern: Pattern;
  /** focus[0] is the primary muscle; a compound may carry one secondary. */
  focus: Focus[];
  /** 1 = lead compound, 2 = secondary / machine compound, 3 = isolation. */
  tier: 1 | 2 | 3;
}

export const SESSION_POOL: Record<string, PoolEntry> = {
  // ── squat
  Barbell_Squat:                        { pattern: "squat", focus: ["legs", "glutes"], tier: 1 },
  Barbell_Full_Squat:                   { pattern: "squat", focus: ["legs", "glutes"], tier: 1 },
  Front_Squat_Clean_Grip:               { pattern: "squat", focus: ["legs"], tier: 1 },
  Wide_Stance_Barbell_Squat:            { pattern: "squat", focus: ["legs", "glutes"], tier: 1 },
  Narrow_Stance_Squats:                 { pattern: "squat", focus: ["legs"], tier: 1 },
  Barbell_Hack_Squat:                   { pattern: "squat", focus: ["legs"], tier: 2 },
  Hack_Squat:                           { pattern: "squat", focus: ["legs"], tier: 2 },
  Narrow_Stance_Hack_Squats:            { pattern: "squat", focus: ["legs"], tier: 2 },
  Smith_Machine_Squat:                  { pattern: "squat", focus: ["legs", "glutes"], tier: 2 },
  Dumbbell_Squat:                       { pattern: "squat", focus: ["legs", "glutes"], tier: 2 },
  Dumbbell_Squat_To_A_Bench:            { pattern: "squat", focus: ["legs", "glutes"], tier: 2 },
  Plie_Dumbbell_Squat:                  { pattern: "squat", focus: ["legs", "glutes"], tier: 2 },
  Jefferson_Squats:                     { pattern: "squat", focus: ["legs", "glutes"], tier: 2 },
  "Squats_-_With_Bands":                { pattern: "squat", focus: ["legs", "glutes"], tier: 2 },
  Leg_Press:                            { pattern: "squat", focus: ["legs", "glutes"], tier: 2 },
  Narrow_Stance_Leg_Press:              { pattern: "squat", focus: ["legs"], tier: 2 },
  // ── leg isolation
  Leg_Extensions:                       { pattern: "leg_iso", focus: ["legs"], tier: 3 },
  Lying_Leg_Curls:                      { pattern: "leg_iso", focus: ["legs"], tier: 3 },
  Seated_Leg_Curl:                      { pattern: "leg_iso", focus: ["legs"], tier: 3 },
  // ── lunge / step
  Dumbbell_Lunges:                      { pattern: "lunge", focus: ["legs", "glutes"], tier: 2 },
  Dumbbell_Rear_Lunge:                  { pattern: "lunge", focus: ["legs", "glutes"], tier: 2 },
  Barbell_Lunge:                        { pattern: "lunge", focus: ["legs", "glutes"], tier: 2 },
  Barbell_Step_Ups:                     { pattern: "lunge", focus: ["legs", "glutes"], tier: 2 },
  Dumbbell_Step_Ups:                    { pattern: "lunge", focus: ["legs", "glutes"], tier: 2 },
  Barbell_Walking_Lunge:                { pattern: "lunge", focus: ["legs", "glutes"], tier: 2 },
  // ── hinge
  Barbell_Deadlift:                     { pattern: "hinge", focus: ["legs", "back"], tier: 1 },
  Romanian_Deadlift:                    { pattern: "hinge", focus: ["legs", "glutes"], tier: 1 },
  Good_Morning:                         { pattern: "hinge", focus: ["legs", "glutes"], tier: 2 },
  // ── horizontal push
  "Barbell_Bench_Press_-_Medium_Grip":  { pattern: "horizontal_push", focus: ["chest", "triceps"], tier: 1 },
  "Bench_Press_-_Powerlifting":         { pattern: "horizontal_push", focus: ["chest", "triceps"], tier: 1 },
  "Wide-Grip_Barbell_Bench_Press":      { pattern: "horizontal_push", focus: ["chest"], tier: 2 },
  "Close-Grip_Barbell_Bench_Press":     { pattern: "horizontal_push", focus: ["triceps", "chest"], tier: 2 },
  Barbell_Guillotine_Bench_Press:       { pattern: "horizontal_push", focus: ["chest"], tier: 2 },
  Neck_Press:                           { pattern: "horizontal_push", focus: ["chest"], tier: 2 },
  "Barbell_Incline_Bench_Press_-_Medium_Grip": { pattern: "horizontal_push", focus: ["chest", "shoulders"], tier: 1 },
  Decline_Barbell_Bench_Press:          { pattern: "horizontal_push", focus: ["chest"], tier: 2 },
  "Wide-Grip_Decline_Barbell_Bench_Press": { pattern: "horizontal_push", focus: ["chest"], tier: 2 },
  Reverse_Triceps_Bench_Press:          { pattern: "horizontal_push", focus: ["triceps", "chest"], tier: 2 },
  Dumbbell_Bench_Press:                 { pattern: "horizontal_push", focus: ["chest", "triceps"], tier: 1 },
  Incline_Dumbbell_Press:               { pattern: "horizontal_push", focus: ["chest", "shoulders"], tier: 1 },
  Hammer_Grip_Incline_DB_Bench_Press:   { pattern: "horizontal_push", focus: ["chest"], tier: 2 },
  Decline_Dumbbell_Bench_Press:         { pattern: "horizontal_push", focus: ["chest"], tier: 2 },
  One_Arm_Dumbbell_Bench_Press:         { pattern: "horizontal_push", focus: ["chest"], tier: 2 },
  One_Arm_Floor_Press:                  { pattern: "horizontal_push", focus: ["triceps", "chest"], tier: 2 },
  Machine_Bench_Press:                  { pattern: "horizontal_push", focus: ["chest"], tier: 2 },
  Leverage_Decline_Chest_Press:         { pattern: "horizontal_push", focus: ["chest"], tier: 2 },
  Smith_Machine_Bench_Press:            { pattern: "horizontal_push", focus: ["chest"], tier: 2 },
  Smith_Machine_Incline_Bench_Press:    { pattern: "horizontal_push", focus: ["chest", "shoulders"], tier: 2 },
  "Smith_Machine_Close-Grip_Bench_Press": { pattern: "horizontal_push", focus: ["triceps", "chest"], tier: 2 },
  Pushups:                              { pattern: "horizontal_push", focus: ["chest"], tier: 2 },
  "Push-Ups_With_Feet_Elevated":        { pattern: "horizontal_push", focus: ["chest", "shoulders"], tier: 2 },
  // ── vertical push
  Bench_Dips:                           { pattern: "vertical_push", focus: ["triceps"], tier: 2 },
  "Dips_-_Triceps_Version":             { pattern: "vertical_push", focus: ["triceps", "chest"], tier: 2 },
  Seated_Barbell_Military_Press:        { pattern: "vertical_push", focus: ["shoulders", "triceps"], tier: 1 },
  "Dumbbell_One-Arm_Shoulder_Press":    { pattern: "vertical_push", focus: ["shoulders"], tier: 2 },
  // ── chest isolation
  Cable_Crossover:                      { pattern: "chest_iso", focus: ["chest"], tier: 3 },
  Decline_Dumbbell_Flyes:               { pattern: "chest_iso", focus: ["chest"], tier: 3 },
  Dumbbell_Flyes:                       { pattern: "chest_iso", focus: ["chest"], tier: 3 },
  "Cross_Over_-_With_Bands":            { pattern: "chest_iso", focus: ["chest"], tier: 3 },
  Front_Raise_And_Pullover:             { pattern: "chest_iso", focus: ["chest", "shoulders"], tier: 3 },
  // ── triceps compounds
  JM_Press:                             { pattern: "arm_triceps", focus: ["triceps"], tier: 2 },
  "Decline_Close-Grip_Bench_To_Skull_Crusher": { pattern: "arm_triceps", focus: ["triceps", "chest"], tier: 2 },
  // ── horizontal pull
  Seated_Cable_Rows:                    { pattern: "horizontal_pull", focus: ["back"], tier: 1 },
  "T-Bar_Row_with_Handle":              { pattern: "horizontal_pull", focus: ["back"], tier: 1 },
  "Reverse_Grip_Bent-Over_Rows":        { pattern: "horizontal_pull", focus: ["back", "biceps"], tier: 1 },
  Barbell_Rear_Delt_Row:                { pattern: "horizontal_pull", focus: ["shoulders", "back"], tier: 2 },
  // ── vertical pull
  Upright_Barbell_Row:                  { pattern: "vertical_pull", focus: ["shoulders", "back"], tier: 2 },
  Upright_Cable_Row:                    { pattern: "vertical_pull", focus: ["shoulders", "back"], tier: 2 },
  Smith_Machine_Upright_Row:            { pattern: "vertical_pull", focus: ["shoulders", "back"], tier: 2 },
  "Dumbbell_One-Arm_Upright_Row":       { pattern: "vertical_pull", focus: ["shoulders"], tier: 2 },
  Pullups:                              { pattern: "vertical_pull", focus: ["back", "biceps"], tier: 1 },
  "Full_Range-Of-Motion_Lat_Pulldown":  { pattern: "vertical_pull", focus: ["back"], tier: 1 },
  "V-Bar_Pulldown":                     { pattern: "vertical_pull", focus: ["back"], tier: 2 },
  Underhand_Cable_Pulldowns:            { pattern: "vertical_pull", focus: ["back", "biceps"], tier: 2 },
  // ── shoulder isolation (traps and rear delts live here, back secondary)
  Front_Dumbbell_Raise:                 { pattern: "shoulder_iso", focus: ["shoulders"], tier: 3 },
  "Front_Two-Dumbbell_Raise":           { pattern: "shoulder_iso", focus: ["shoulders"], tier: 3 },
  Dumbbell_Lying_Rear_Lateral_Raise:    { pattern: "shoulder_iso", focus: ["shoulders", "back"], tier: 3 },
  "Dumbbell_Lying_One-Arm_Rear_Lateral_Raise": { pattern: "shoulder_iso", focus: ["shoulders", "back"], tier: 3 },
  Side_Lateral_Raise:                   { pattern: "shoulder_iso", focus: ["shoulders"], tier: 3 },
  "Back_Flyes_-_With_Bands":            { pattern: "shoulder_iso", focus: ["shoulders", "back"], tier: 3 },
  Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench: { pattern: "shoulder_iso", focus: ["shoulders", "back"], tier: 3 },
  "Bent_Over_Low-Pulley_Side_Lateral":  { pattern: "shoulder_iso", focus: ["shoulders", "back"], tier: 3 },
  Barbell_Shrug:                        { pattern: "shoulder_iso", focus: ["shoulders", "back"], tier: 3 },
  Cable_Shrugs:                         { pattern: "shoulder_iso", focus: ["shoulders", "back"], tier: 3 },
  Dumbbell_Shrug:                       { pattern: "shoulder_iso", focus: ["shoulders", "back"], tier: 3 },
  // ── back isolation
  "Bent-Arm_Barbell_Pullover":          { pattern: "back_iso", focus: ["back", "chest"], tier: 3 },
  "Bent-Arm_Dumbbell_Pullover":         { pattern: "back_iso", focus: ["back", "chest"], tier: 3 },
  "Straight-Arm_Dumbbell_Pullover":     { pattern: "back_iso", focus: ["back", "chest"], tier: 3 },
  "Wide-Grip_Decline_Barbell_Pullover": { pattern: "back_iso", focus: ["back", "chest"], tier: 3 },
  Cable_Incline_Pushdown:               { pattern: "back_iso", focus: ["back"], tier: 3 },
  // ── biceps
  High_Cable_Curls:                     { pattern: "arm_biceps", focus: ["biceps"], tier: 3 },
  Drag_Curl:                            { pattern: "arm_biceps", focus: ["biceps"], tier: 3 },
  Alternate_Hammer_Curl:                { pattern: "arm_biceps", focus: ["biceps"], tier: 3 },
  Alternate_Incline_Dumbbell_Curl:      { pattern: "arm_biceps", focus: ["biceps"], tier: 3 },
  Barbell_Curl:                         { pattern: "arm_biceps", focus: ["biceps"], tier: 3 },
  Barbell_Curls_Lying_Against_An_Incline: { pattern: "arm_biceps", focus: ["biceps"], tier: 3 },
  "Cable_Hammer_Curls_-_Rope_Attachment": { pattern: "arm_biceps", focus: ["biceps"], tier: 3 },
  Cable_Preacher_Curl:                  { pattern: "arm_biceps", focus: ["biceps"], tier: 3 },
  "Close-Grip_EZ_Bar_Curl":             { pattern: "arm_biceps", focus: ["biceps"], tier: 3 },
  "Close-Grip_Standing_Barbell_Curl":   { pattern: "arm_biceps", focus: ["biceps"], tier: 3 },
  Concentration_Curls:                  { pattern: "arm_biceps", focus: ["biceps"], tier: 3 },
  Cross_Body_Hammer_Curl:               { pattern: "arm_biceps", focus: ["biceps"], tier: 3 },
  Dumbbell_Alternate_Bicep_Curl:        { pattern: "arm_biceps", focus: ["biceps"], tier: 3 },
  Dumbbell_Bicep_Curl:                  { pattern: "arm_biceps", focus: ["biceps"], tier: 3 },
  Dumbbell_Prone_Incline_Curl:          { pattern: "arm_biceps", focus: ["biceps"], tier: 3 },
  "EZ-Bar_Curl":                        { pattern: "arm_biceps", focus: ["biceps"], tier: 3 },
  // ── triceps isolation
  Reverse_Grip_Triceps_Pushdown:        { pattern: "arm_triceps", focus: ["triceps"], tier: 3 },
  Standing_Overhead_Barbell_Triceps_Extension: { pattern: "arm_triceps", focus: ["triceps"], tier: 3 },
  "Standing_One-Arm_Dumbbell_Triceps_Extension": { pattern: "arm_triceps", focus: ["triceps"], tier: 3 },
  "Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension": { pattern: "arm_triceps", focus: ["triceps"], tier: 3 },
  "Standing_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension": { pattern: "arm_triceps", focus: ["triceps"], tier: 3 },
  "Standing_Low-Pulley_One-Arm_Triceps_Extension": { pattern: "arm_triceps", focus: ["triceps"], tier: 3 },
  Standing_Towel_Triceps_Extension:     { pattern: "arm_triceps", focus: ["triceps"], tier: 3 },
  Cable_Incline_Triceps_Extension:      { pattern: "arm_triceps", focus: ["triceps"], tier: 3 },
  Cable_Lying_Triceps_Extension:        { pattern: "arm_triceps", focus: ["triceps"], tier: 3 },
  Cable_One_Arm_Tricep_Extension:       { pattern: "arm_triceps", focus: ["triceps"], tier: 3 },
  Decline_Dumbbell_Triceps_Extension:   { pattern: "arm_triceps", focus: ["triceps"], tier: 3 },
  Decline_EZ_Bar_Triceps_Extension:     { pattern: "arm_triceps", focus: ["triceps"], tier: 3 },
  "Dumbbell_One-Arm_Triceps_Extension": { pattern: "arm_triceps", focus: ["triceps"], tier: 3 },
  "Dumbbell_Tricep_Extension_-Pronated_Grip": { pattern: "arm_triceps", focus: ["triceps"], tier: 3 },
  // ── calves / adductors / glutes
  Standing_Barbell_Calf_Raise:          { pattern: "leg_iso", focus: ["legs"], tier: 3 },
  Smith_Machine_Reverse_Calf_Raises:    { pattern: "leg_iso", focus: ["legs"], tier: 3 },
  Barbell_Seated_Calf_Raise:            { pattern: "leg_iso", focus: ["legs"], tier: 3 },
  "Dumbbell_Seated_One-Leg_Calf_Raise": { pattern: "leg_iso", focus: ["legs"], tier: 3 },
  Thigh_Adductor:                       { pattern: "leg_iso", focus: ["legs"], tier: 3 },
  Thigh_Abductor:                       { pattern: "glute_iso", focus: ["glutes"], tier: 3 },
  "One-Legged_Cable_Kickback":          { pattern: "glute_iso", focus: ["glutes"], tier: 3 },
  // ── core
  Crunches:                             { pattern: "core", focus: ["core"], tier: 3 },
  "Cross-Body_Crunch":                  { pattern: "core", focus: ["core"], tier: 3 },
  Decline_Crunch:                       { pattern: "core", focus: ["core"], tier: 3 },
  Decline_Oblique_Crunch:               { pattern: "core", focus: ["core"], tier: 3 },
  "Bent-Knee_Hip_Raise":                { pattern: "core", focus: ["core"], tier: 3 },
  Flutter_Kicks:                        { pattern: "core", focus: ["core"], tier: 3 },
  Air_Bike:                             { pattern: "core", focus: ["core"], tier: 3 },
  Barbell_Ab_Rollout:                   { pattern: "core", focus: ["core"], tier: 3 },
  Cable_Seated_Crunch:                  { pattern: "core", focus: ["core"], tier: 3 },
  Dumbbell_Side_Bend:                   { pattern: "core", focus: ["core"], tier: 3 },
};

export interface Rx { sets: number; reps: string; rpe: number; rest_sec: number }

/** Sets / reps / RPE / rest by goal — the data form of the generator's prose. */
export const SCHEMES: Record<string, { compound: Rx; isolation: Rx }> = {
  all:         { compound: { sets: 4, reps: "5-8",   rpe: 8,   rest_sec: 120 }, isolation: { sets: 3, reps: "8-12",  rpe: 8, rest_sec: 60 } },
  strength:    { compound: { sets: 5, reps: "3-6",   rpe: 8.5, rest_sec: 180 }, isolation: { sets: 3, reps: "8-12",  rpe: 8, rest_sec: 90 } },
  hypertrophy: { compound: { sets: 4, reps: "6-10",  rpe: 8,   rest_sec: 90  }, isolation: { sets: 3, reps: "10-15", rpe: 8, rest_sec: 60 } },
  fat_loss:    { compound: { sets: 3, reps: "12-15", rpe: 7,   rest_sec: 60  }, isolation: { sets: 3, reps: "15-20", rpe: 8, rest_sec: 45 } },
  endurance:   { compound: { sets: 3, reps: "12-15", rpe: 7,   rest_sec: 60  }, isolation: { sets: 3, reps: "15-20", rpe: 7, rest_sec: 45 } },
  longevity:   { compound: { sets: 3, reps: "8-12",  rpe: 6.5, rest_sec: 90  }, isolation: { sets: 2, reps: "12-15", rpe: 7, rest_sec: 60 } },
  focus:       { compound: { sets: 3, reps: "6-10",  rpe: 7,   rest_sec: 120 }, isolation: { sets: 2, reps: "10-15", rpe: 7, rest_sec: 60 } },
};

export interface SessionBlock { slug: string; name: string; sets: number; reps: string; rpe: number; rest_sec: number }
export interface BuiltSession { focus: string; duration_min: number; blocks: SessionBlock[] }

export interface BuildInput {
  focus: Focus[];
  minutes: number;
  goal: string | null | undefined;
  experience: string | null | undefined;
  equipment: string[] | null | undefined;
  injuries: Set<InjuryTag>;
  seed: string;
}

/** Coaching order: heavy compounds first, then secondary, isolation, arms, core. */
const ORDER: Pattern[] = [
  "squat", "hinge", "horizontal_push", "vertical_push", "vertical_pull", "horizontal_pull", "lunge",
  "chest_iso", "back_iso", "shoulder_iso", "leg_iso", "glute_iso", "arm_biceps", "arm_triceps", "core",
];
const NOVICE_EQUIP = new Set(["machine", "cable", "dumbbell", "bodyweight"]);
// Short-rest schemes fit many blocks into the minutes; a session is still a
// handful of movements done well, not a circuit of eight.
const maxBlocks = (minutes: number) => (minutes <= 30 ? 5 : minutes <= 45 ? 6 : 8);

/** FNV-1a — the tie-break that makes a seed reproducible and a shuffle different. */
const fnv = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const focusLabel = (focus: Focus[]): string => focus.map(cap).join(" & ");

/** A warm-up plus every set and its rest — the beginner path's model. */
export const blockMinutes = (b: { sets: number; rest_sec: number }): number => (b.sets * (45 + b.rest_sec)) / 60;

type PoolItem = CatalogItem & PoolEntry;

export function buildSession(o: BuildInput): BuiltSession {
  const focus = [...new Set(o.focus)];
  const novice = o.experience === "never_trained";
  const banned = bannedSlugs(EXERCISE_CATALOG, o.injuries, o.experience ?? null);
  const only = new Set(Object.keys(SESSION_POOL));

  // `only` is dropped by filterCatalog below MIN_POOL; unclassified slugs never
  // survive the join, so a thin home gym shrinks the session rather than
  // inventing a lift the app cannot draw.
  const items: PoolItem[] = filterCatalog(o.equipment, 999, { exclude: banned, only })
    .flatMap((e) => { const p = SESSION_POOL[e.slug]; return p ? [{ ...e, ...p }] : []; })
    .filter((e) => e.focus.some((f) => focus.includes(f)))
    .filter((e) => !(novice && e.tier < 3 && !NOVICE_EQUIP.has(e.equipment)));

  const key = (e: PoolItem) => ORDER.indexOf(e.pattern) * 2 ** 32 + fnv(o.seed + e.slug);
  const byKey = (a: PoolItem, b: PoolItem) => key(a) - key(b);
  // Primary-focus lists per picked muscle, round-robin so back + biceps
  // alternates; secondary matches (a deadlift for "back") come last.
  const list = (tier: number, f?: Focus) =>
    items.filter((e) => e.tier === tier && (f ? e.focus[0] === f : !focus.includes(e.focus[0]))).sort(byKey);
  const interleave = (lists: PoolItem[][]) => {
    const out: PoolItem[] = [];
    for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
    return out;
  };
  // Within a tier: the picked muscles round-robin, then the secondary matches
  // (a deadlift for "back") — never interleaved ahead of a real row.
  const ranked = [1, 2, 3].flatMap((t) => [...interleave(focus.map((f) => list(t, f))), ...list(t)]);

  const scheme = SCHEMES[o.goal ?? "all"] ?? SCHEMES.all;
  const rpeAdj = novice ? -1 : o.experience === "under_6_months" ? -0.5 : 0;
  const rx = (e: PoolItem): SessionBlock => {
    const r = e.tier < 3 ? scheme.compound : scheme.isolation;
    const drop = e.tier < 3 ? (o.minutes < 40 ? 1 : 0) + (novice ? 1 : 0) : 0;
    return { slug: e.slug, name: e.name, sets: Math.max(2, r.sets - drop), reps: r.reps, rpe: r.rpe + rpeAdj, rest_sec: r.rest_sec };
  };

  const blocks: SessionBlock[] = [];
  const used = new Set<string>();
  const seen = new Map<Pattern, number>();
  let total = 10;
  let leads = 0;
  // Pass 1 takes one exercise per pattern and at most two leads; pass 2
  // spends the minutes that are left — a second isolation of a pattern, or a
  // second compound when a single muscle was picked.
  for (const pass of [1, 2]) {
    for (const e of ranked) {
      if (blocks.length >= maxBlocks(o.minutes)) break;
      if (used.has(e.slug)) continue;
      const patternCap = pass === 1 ? 1 : focus.length === 1 || e.tier === 3 ? 2 : 1;
      if ((seen.get(e.pattern) ?? 0) >= patternCap) continue;
      if (e.tier === 1 && leads >= 2) continue;
      const b = rx(e);
      const cost = blockMinutes(b);
      if (total + cost > o.minutes + 5) continue;
      blocks.push(b);
      used.add(e.slug);
      seen.set(e.pattern, (seen.get(e.pattern) ?? 0) + 1);
      total += cost;
      if (e.tier === 1) leads++;
    }
  }

  return { focus: focusLabel(focus), duration_min: Math.round(total), blocks };
}

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * The exact plan_json the runner, Home and the coach functions read: one
 * week, seven days, only today's slot carrying blocks. Rest days are
 * `focus: "Rest"` with no blocks — the one shape every reader agrees on.
 */
export const sessionPlan = (day: BuiltSession, dayIndex: number) => ({
  weekly_check_targets: { workouts: 1, sleep_avg_h: 7.5, hydration_l: 2.5, perfect_days: 1 },
  weeks: [{
    week: 1,
    theme: day.focus,
    days: DAY_NAMES.map((d, i) =>
      i === dayIndex
        ? { day: d, focus: day.focus, duration_min: day.duration_min, blocks: day.blocks, conditioning: "" }
        : { day: d, focus: "Rest", duration_min: 0, blocks: [], conditioning: "" }),
    nutrition: { protein_g_per_kg: 1.6, daily_kcal_band: "Maintenance", notes: "One session. Eat normally, protein at every meal." },
    recovery: { sleep_target_h: 7.5, mobility_min: 10, breathwork: "Five slow breaths before the first set." },
    progression_note: "Beat last time by one rep or one small plate.",
  }],
});
