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

/** How the day should feel: the athlete's own call, given with the muscles and the minutes. */
export type Feel = "light" | "normal" | "hard";
export const FEELS: Feel[] = ["light", "normal", "hard"];

export interface BuildInput {
  focus: Focus[];
  minutes: number;
  goal: string | null | undefined;
  experience: string | null | undefined;
  equipment: string[] | null | undefined;
  injuries: Set<InjuryTag>;
  seed: string;
  feel?: Feel;
}

/**
 * The day's feel, applied after the session is laid out, so the movements
 * never change with it: light is one set fewer and well short of failure;
 * hard is one notch closer to it, and never for someone who has not trained.
 */
export const withFeel = <B extends { sets: number; rpe: number }>(b: B, feel: Feel | undefined, experience?: string | null): B => {
  if (feel === "light") return { ...b, sets: Math.max(2, b.sets - 1), rpe: Math.max(5, b.rpe - 1.5) };
  if (feel === "hard" && experience !== "never_trained") return { ...b, rpe: Math.min(9.5, b.rpe + 1) };
  return b;
};

/** Coaching order: heavy compounds first, then secondary, isolation, arms, core. */
const ORDER: Pattern[] = [
  "squat", "hinge", "horizontal_push", "vertical_push", "vertical_pull", "horizontal_pull", "lunge",
  "chest_iso", "back_iso", "shoulder_iso", "leg_iso", "glute_iso", "arm_biceps", "arm_triceps", "core",
];
const NOVICE_EQUIP = new Set(["machine", "cable", "dumbbell", "bodyweight"]);
// Short-rest schemes fit many blocks into the minutes; a session is still a
// handful of movements done well, not a circuit. Past the hour the session
// grows in sets before it grows in movements (see the densify pass).
const maxBlocks = (minutes: number) => (minutes <= 30 ? 5 : minutes <= 45 ? 6 : minutes <= 60 ? 8 : minutes <= 75 ? 9 : 10);
const maxLeads = (minutes: number) => (minutes >= 75 ? 3 : 2);

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

export type PoolItem = CatalogItem & PoolEntry;

/** Sets / reps / RPE / rest for one movement, from the goal and the athlete. */
export const prescribe = (e: PoolItem, o: Pick<BuildInput, "goal" | "experience" | "minutes">): SessionBlock => {
  const scheme = SCHEMES[o.goal ?? "all"] ?? SCHEMES.all;
  const novice = o.experience === "never_trained";
  const rpeAdj = novice ? -1 : o.experience === "under_6_months" ? -0.5 : 0;
  const r = e.tier < 3 ? scheme.compound : scheme.isolation;
  const drop = e.tier < 3 ? (o.minutes < 40 ? 1 : 0) + (novice ? 1 : 0) : 0;
  return { slug: e.slug, name: e.name, sets: Math.max(2, r.sets - drop), reps: r.reps, rpe: r.rpe + rpeAdj, rest_sec: r.rest_sec };
};

/** The athlete's safe, drawable, equipment-matched pool for the picked muscles. */
export const poolFor = (o: Pick<BuildInput, "focus" | "experience" | "equipment" | "injuries">): PoolItem[] => {
  const focus = [...new Set(o.focus)];
  const novice = o.experience === "never_trained";
  const banned = bannedSlugs(EXERCISE_CATALOG, o.injuries, o.experience ?? null);
  const only = new Set(Object.keys(SESSION_POOL));
  // `only` is dropped by filterCatalog below MIN_POOL; unclassified slugs never
  // survive the join, so a thin home gym shrinks the session rather than
  // inventing a lift the app cannot draw.
  return filterCatalog(o.equipment, 999, { exclude: banned, only })
    .flatMap((e) => { const p = SESSION_POOL[e.slug]; return p ? [{ ...e, ...p }] : []; })
    .filter((e) => e.focus.some((f) => focus.includes(f)))
    .filter((e) => !(novice && e.tier < 3 && !NOVICE_EQUIP.has(e.equipment)));
};

/**
 * One movement for another: same pattern first (the row stays a row), then
 * the same primary muscle in any pattern; never one already in the session,
 * never one the athlete's profile bans. Null when the pool has nothing else.
 */
export function swapCandidates(
  o: Pick<BuildInput, "focus" | "experience" | "equipment" | "injuries" | "seed"> & { current: string; exclude: string[] },
): PoolItem[] {
  const cur = SESSION_POOL[o.current];
  if (!cur) return [];
  const taken = new Set([...o.exclude, o.current]);
  const items = poolFor(o).filter((e) => !taken.has(e.slug));
  const order = (a: PoolItem, b: PoolItem) => fnv(o.seed + a.slug) - fnv(o.seed + b.slug);
  const same = items.filter((e) => e.pattern === cur.pattern && e.focus[0] === cur.focus[0]).sort(order);
  const pattern = items.filter((e) => e.pattern === cur.pattern).sort(order);
  const muscle = items.filter((e) => e.focus[0] === cur.focus[0]).sort(order);
  return [...new Set([...same, ...pattern, ...muscle])];
}

/** The first candidate, prescribed: the one-tap swap. */
export function swapBlock(o: BuildInput & { current: string; exclude: string[]; sets?: number }): SessionBlock | null {
  const cur = SESSION_POOL[o.current];
  const pick = swapCandidates(o)[0];
  if (!cur || !pick) return null;
  const block = prescribe(pick, o);
  // A long session has grown its sets; the replacement inherits them when it
  // is the same kind of movement (compound for compound), within the cap.
  const sameKind = (pick.tier < 3) === (cur.tier < 3);
  const cap = block.sets + (pick.tier < 3 ? 2 : 1);
  if (sameKind && o.sets && o.sets > block.sets) block.sets = Math.min(cap, Math.floor(o.sets));
  return withFeel(block, o.feel, o.experience);
}

/** Duration of a block list under the same model the builder fits with. */
export const sessionMinutes = (blocks: { sets: number; rest_sec: number }[]): number =>
  Math.round(10 + blocks.reduce((t, b) => t + blockMinutes(b), 0));

/**
 * Re-prescribe a client-chosen slug list (the preview after swaps) — only
 * pool movements survive, and the list grows in sets exactly as a built one.
 */
export function prescribeSlugs(slugs: string[], o: BuildInput): SessionBlock[] {
  const bySlug = new Map(poolFor(o).map((e) => [e.slug, e]));
  const out: SessionBlock[] = [];
  for (const slug of [...new Set(slugs)]) {
    const e = bySlug.get(slug);
    if (e) out.push(prescribe(e, o));
  }
  densify(out, o.minutes);
  return out.map((b) => withFeel(b, o.feel, o.experience));
}

export function buildSession(o: BuildInput): BuiltSession {
  const focus = [...new Set(o.focus)];
  const items = poolFor(o);

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

  const rx = (e: PoolItem): SessionBlock => prescribe(e, o);

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
      const patternCap = pass === 1 ? 1 : focus.length === 1 || e.tier === 3 || o.minutes >= 60 ? 2 : 1;
      if ((seen.get(e.pattern) ?? 0) >= patternCap) continue;
      if (e.tier === 1 && leads >= maxLeads(o.minutes)) continue;
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

  densify(blocks, o.minutes);
  const felt = blocks.map((b) => withFeel(b, o.feel, o.experience));
  return { focus: focusLabel(focus), duration_min: sessionMinutes(felt), blocks: felt };
}

// A long session at the gym is more sets on the same movements before it is
// more movements. One set at a time in session order, up to two extra on
// compounds and one on isolation, while the minutes allow.
function densify(blocks: SessionBlock[], minutes: number): void {
  let total = 10 + blocks.reduce((t, b) => t + blockMinutes(b), 0);
  const extra = new Map<string, number>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const b of blocks) {
      const capExtra = (SESSION_POOL[b.slug]?.tier ?? 3) < 3 ? 2 : 1;
      if ((extra.get(b.slug) ?? 0) >= capExtra) continue;
      const cost = (45 + b.rest_sec) / 60;
      if (total + cost > minutes + 3) continue;
      b.sets += 1;
      total += cost;
      extra.set(b.slug, (extra.get(b.slug) ?? 0) + 1);
      grew = true;
    }
  }
}

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * The exact plan_json the runner, Home and the coach functions read: one
 * week of seven days. A day without a session is a rest day, `focus: "Rest"`
 * with no blocks: the one shape every reader agrees on.
 */
export const weekPlan = (days: (BuiltSession | null)[], o: { theme: string; nutritionNote: string; progressionNote: string }) => {
  const training = days.filter(Boolean).length;
  return {
    weekly_check_targets: { workouts: Math.max(1, training), sleep_avg_h: 7.5, hydration_l: 2.5, perfect_days: Math.max(1, training) },
    weeks: [{
      week: 1,
      theme: o.theme,
      days: DAY_NAMES.map((d, i) => {
        const day = days[i];
        return day
          ? { day: d, focus: day.focus, duration_min: day.duration_min, blocks: day.blocks, conditioning: "" }
          : { day: d, focus: "Rest", duration_min: 0, blocks: [] as SessionBlock[], conditioning: "" };
      }),
      nutrition: { protein_g_per_kg: 1.6, daily_kcal_band: "Maintenance", notes: o.nutritionNote },
      recovery: { sleep_target_h: 7.5, mobility_min: 10, breathwork: "Five slow breaths before the first set." },
      progression_note: o.progressionNote,
    }],
  };
};

/** One session on one day of an otherwise empty week: today by focus. */
export const sessionPlan = (day: BuiltSession, dayIndex: number) =>
  weekPlan(DAY_NAMES.map((_, i) => (i === dayIndex ? day : null)), {
    theme: day.focus,
    nutritionNote: "One session. Eat normally, protein at every meal.",
    progressionNote: "Beat last time by one rep or one small plate.",
  });

// ── A whole week ─────────────────────────────────────────────────────────

const FULL_BODY: Focus[][] = [["legs", "chest", "back"], ["legs", "back", "shoulders"], ["glutes", "chest", "back"]];
const SPLIT = {
  upper: { name: "Upper", focus: ["chest", "back", "shoulders"] as Focus[] },
  lower: { name: "Lower", focus: ["legs", "glutes", "core"] as Focus[] },
  push: { name: "Push", focus: ["chest", "shoulders", "triceps"] as Focus[] },
  pull: { name: "Pull", focus: ["back", "biceps"] as Focus[] },
  legs: { name: "Legs", focus: ["legs", "glutes", "core"] as Focus[] },
};

/** The split for n training days: full body up to three, upper/lower at four, push/pull/legs from five. */
export const weekSplit = (n: number): { name: string; focus: Focus[] }[] => {
  const days = Math.max(1, Math.min(6, Math.floor(n) || 1));
  if (days <= 3) return FULL_BODY.slice(0, days).map((focus) => ({ name: "Full body", focus }));
  if (days === 4) return [SPLIT.upper, SPLIT.lower, SPLIT.upper, SPLIT.lower];
  if (days === 5) return [SPLIT.push, SPLIT.pull, SPLIT.legs, SPLIT.upper, SPLIT.lower];
  return [SPLIT.push, SPLIT.pull, SPLIT.legs, SPLIT.push, SPLIT.pull, SPLIT.legs];
};

/**
 * A week from the athlete's training days (0 = Mon): one session per day from
 * the split, each seeded apart so a repeated day is still a different session.
 * A day the safe pool cannot fill (under two movements) stays a rest day.
 */
export function buildWeek(o: Omit<BuildInput, "focus">, trainDays: number[]): (BuiltSession | null)[] {
  const days = [...new Set(trainDays)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b).slice(0, 6);
  const split = weekSplit(days.length);
  return DAY_NAMES.map((_, i) => {
    const at = days.indexOf(i);
    if (at < 0) return null;
    const day = buildSession({ ...o, focus: split[at].focus, seed: `${o.seed}:${at}` });
    return day.blocks.length >= 2 ? { ...day, focus: split[at].name } : null;
  });
}

// ── What a hand-built day is, and what the athlete has been skipping ─────

const BIG_FIRST: Focus[] = ["legs", "back", "chest", "glutes", "shoulders", "core", "biceps", "triceps"];

/** The muscles a list of movements mostly trains, biggest share first (at most three): a hand-built day's name. */
export const primaryFocuses = (slugs: string[]): Focus[] => {
  const count = new Map<Focus, number>();
  for (const slug of slugs) {
    const f = SESSION_POOL[slug]?.focus[0];
    if (f) count.set(f, (count.get(f) ?? 0) + 1);
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || BIG_FIRST.indexOf(a[0]) - BIG_FIRST.indexOf(b[0]))
    .slice(0, 3)
    .map(([f]) => f);
};

/**
 * The muscle groups the athlete has been avoiding, from what they logged in
 * the last 28 days. An exercise on a day counts once: 1 for its primary
 * muscle, 0.5 for a secondary. Nothing is said before three training days.
 * Neglected = under 40% of the median of the muscles they do train (the
 * median of the trained ones, so a chest-only lifter is still told about
 * legs). Lowest first, big groups before small, at most three.
 * ponytail: frequency, not volume (the log feed is one row per exercise-day);
 * add a set-count query if volume balance is ever wanted.
 */
export function neglectedFocuses(rows: { exercise_slug: string | null; logged_on: string }[], today: string): Focus[] {
  const from = new Date(`${today}T00:00:00Z`).getTime() - 27 * 86_400_000;
  const days = new Set<string>();
  const seen = new Set<string>();
  const score = new Map<Focus, number>(FOCUSES.map((f) => [f, 0]));
  for (const r of rows) {
    const t = new Date(`${r.logged_on}T00:00:00Z`).getTime();
    if (!(t >= from) || r.logged_on > today) continue;
    days.add(r.logged_on);
    const entry = r.exercise_slug ? SESSION_POOL[r.exercise_slug] : undefined;
    const key = `${r.exercise_slug}|${r.logged_on}`;
    if (!entry || seen.has(key)) continue;
    seen.add(key);
    entry.focus.forEach((f, i) => score.set(f, (score.get(f) ?? 0) + (i === 0 ? 1 : 0.5)));
  }
  if (days.size < 3) return [];
  const trained = [...score.values()].filter((v) => v > 0).sort((a, b) => a - b);
  if (!trained.length) return [];
  const mid = trained.length / 2;
  const median = trained.length % 2 ? trained[Math.floor(mid)] : (trained[mid - 1] + trained[mid]) / 2;
  return FOCUSES
    .filter((f) => (score.get(f) ?? 0) < 0.4 * median)
    .sort((a, b) => (score.get(a) ?? 0) - (score.get(b) ?? 0) || BIG_FIRST.indexOf(a) - BIG_FIRST.indexOf(b))
    .slice(0, 3);
}
