// The athlete data pack — the one place every coach reads the member's
// wellbeing data from, so the chat, the morning brief, the daily plan, the
// weekly review, the weekly letter and the check-in reaction all see the same
// athlete. Seven functions used to hand-pick their own gatherers and run six
// different daily_checkins selects; nothing saw steps, HRV, body weight, VO2,
// a single food name, carbs/fat/fibre, the water target, badges, today's
// missions or the last weekly review. These readers are the ones that were
// missing; the existing gatherers (night, workouts, habits, lifts, situation)
// stay where they are and plug in through `gatherAthletePack`.
//
// Every reader is FAIL-OPEN: an error leaves its section null, the block
// simply says less. All reads go through the caller's user client (RLS).

import { gatherNightSignals, gatherHealthWorkouts, buildCausalBlock, buildWorkoutsBlock, type NightSignals, type HealthWorkoutDay } from "./health-causal.ts";
import { gatherHabitGaps, buildHabitGapsBlock, type HabitGaps } from "./habit-gaps.ts";
import { sportName } from "./sports.ts";

// deno-lint-ignore no-explicit-any
type AnyClient = any;

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const r0 = (v: number | null | undefined) => (v == null ? null : Math.round(v));
const avg = (xs: Array<number | null | undefined>): number | null => {
  const a = xs.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
};

// ── Day signals (Apple Health day rows) ─────────────────────────────────────

export interface DaySignals {
  days: number;
  steps: { yesterday: number | null; avg7: number | null; avg28: number | null };
  activeKcalAvg7: number | null;
  workoutMin7: number;
  mindfulMin7: number;
  flightsAvg7: number | null;
  body: { massKg: number | null; on: string | null; delta28: number | null; fatPct: number | null; vo2max: number | null };
  sources: string[];
}

export async function gatherDaySignals(sb: AnyClient, userId: string, days = 28): Promise<DaySignals | null> {
  try {
    const since = isoDay(Date.now() - days * DAY);
    const { data } = await sb
      .from("health_sync_snapshots")
      .select("snapshot_date, steps, active_kcal, workout_minutes, mindful_minutes, flights, body_mass_kg, body_fat_pct, vo2max, sources")
      .eq("user_id", userId).gte("snapshot_date", since)
      .order("snapshot_date", { ascending: false }).limit(days);
    const rows: Array<Record<string, unknown>> = Array.isArray(data) ? data : [];
    if (!rows.length) return null;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const yesterday = isoDay(Date.now() - DAY);
    const week = rows.slice(0, 7);
    const massRows = rows.filter((x) => n(x.body_mass_kg) != null);
    const latestMass = massRows[0], oldestMass = massRows[massRows.length - 1];
    const sources = new Set<string>();
    for (const x of rows) for (const s of (Array.isArray(x.sources) ? x.sources : []) as string[]) sources.add(s);
    return {
      days: rows.length,
      steps: {
        yesterday: n(rows.find((x) => x.snapshot_date === yesterday)?.steps),
        avg7: r0(avg(week.map((x) => n(x.steps)))),
        avg28: r0(avg(rows.map((x) => n(x.steps)))),
      },
      activeKcalAvg7: r0(avg(week.map((x) => n(x.active_kcal)))),
      workoutMin7: week.reduce((s, x) => s + (n(x.workout_minutes) ?? 0), 0),
      mindfulMin7: week.reduce((s, x) => s + (n(x.mindful_minutes) ?? 0), 0),
      flightsAvg7: r0(avg(week.map((x) => n(x.flights)))),
      body: {
        massKg: n(latestMass?.body_mass_kg),
        on: (latestMass?.snapshot_date as string | undefined) ?? null,
        delta28: latestMass && oldestMass && latestMass !== oldestMass ? Math.round(((n(latestMass.body_mass_kg) ?? 0) - (n(oldestMass.body_mass_kg) ?? 0)) * 10) / 10 : null,
        fatPct: n(rows.find((x) => n(x.body_fat_pct) != null)?.body_fat_pct),
        vo2max: n(rows.find((x) => n(x.vo2max) != null)?.vo2max),
      },
      sources: [...sources].slice(0, 4),
    };
  } catch {
    return null;
  }
}

// ── Diet (the food diary against the targets) ───────────────────────────────

export interface Macro { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null }
export interface DietSummary {
  daysLogged7: number;
  meals7: number;
  avg: Macro;
  yesterday: Macro | null;
  target: (Macro & { waterMl: number | null }) | null;
  /** Days of the 7 whose protein reached the target (when there is one). */
  proteinDaysHit: number | null;
  /** The foods logged most often in 14 days, by name. */
  topFoods: string[];
}

export async function gatherDiet(sb: AnyClient, userId: string): Promise<DietSummary | null> {
  try {
    const since7 = isoDay(Date.now() - 7 * DAY), since14 = isoDay(Date.now() - 14 * DAY);
    const [mealsRes, itemsRes, targetRes] = await Promise.all([
      sb.from("meal_logs").select("log_date, kcal, protein_g, carbs_g, fat_g").eq("user_id", userId).gte("log_date", since7),
      sb.from("meal_log_items").select("display_name, snapshot, created_at").eq("user_id", userId).gte("created_at", `${since14}T00:00:00Z`).limit(400),
      sb.from("nutrition_targets").select("kcal, protein_g, carbs_g, fat_g, fiber_g, water_ml").eq("user_id", userId).order("effective_from", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const meals: Array<Record<string, unknown>> = Array.isArray(mealsRes?.data) ? mealsRes.data : [];
    if (!meals.length) return null;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const byDay = new Map<string, Macro>();
    for (const m of meals) {
      const d = String(m.log_date);
      const t = byDay.get(d) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: null };
      t.kcal = (t.kcal ?? 0) + (n(m.kcal) ?? 0);
      t.protein = (t.protein ?? 0) + (n(m.protein_g) ?? 0);
      t.carbs = (t.carbs ?? 0) + (n(m.carbs_g) ?? 0);
      t.fat = (t.fat ?? 0) + (n(m.fat_g) ?? 0);
      byDay.set(d, t);
    }
    // Fibre lives in the item snapshots (meal_logs carries the four macros only).
    const items: Array<Record<string, unknown>> = Array.isArray(itemsRes?.data) ? itemsRes.data : [];
    const fiberByDay = new Map<string, number>();
    const foodCount = new Map<string, number>();
    for (const it of items) {
      const name = String(it.display_name ?? "").trim();
      if (name) foodCount.set(name, (foodCount.get(name) ?? 0) + 1);
      const d = String(it.created_at ?? "").slice(0, 10);
      const f = n((it.snapshot as Record<string, unknown> | null)?.fiber_g);
      if (d >= since7 && f != null) fiberByDay.set(d, (fiberByDay.get(d) ?? 0) + f);
    }
    for (const [d, f] of fiberByDay) { const t = byDay.get(d); if (t) t.fiber = Math.round(f); }
    const days = [...byDay.values()];
    const t = targetRes?.data as Record<string, unknown> | null;
    const target = t ? { kcal: n(t.kcal), protein: n(t.protein_g), carbs: n(t.carbs_g), fat: n(t.fat_g), fiber: n(t.fiber_g), waterMl: n(t.water_ml) } : null;
    const yesterday = byDay.get(isoDay(Date.now() - DAY)) ?? null;
    return {
      daysLogged7: days.length,
      meals7: meals.length,
      avg: {
        kcal: r0(avg(days.map((d) => d.kcal))), protein: r0(avg(days.map((d) => d.protein))),
        carbs: r0(avg(days.map((d) => d.carbs))), fat: r0(avg(days.map((d) => d.fat))),
        fiber: r0(avg(days.map((d) => d.fiber))),
      },
      yesterday: yesterday ? { kcal: r0(yesterday.kcal), protein: r0(yesterday.protein), carbs: r0(yesterday.carbs), fat: r0(yesterday.fat), fiber: yesterday.fiber } : null,
      target,
      proteinDaysHit: target?.protein ? days.filter((d) => (d.protein ?? 0) >= target.protein!).length : null,
      topFoods: [...foodCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name]) => name),
    };
  } catch {
    return null;
  }
}

// ── Reflections (energy · mood · sleep quality · RPE) ───────────────────────

export interface ReflectionTrend {
  n7: number;
  avg7: { energy: number | null; mood: number | null; sleepQ: number | null; rpe: number | null };
  prev7: { energy: number | null; mood: number | null; sleepQ: number | null; rpe: number | null };
  lastWin: string | null;
  lastFriction: string | null;
}

export async function gatherReflectionTrend(sb: AnyClient, userId: string): Promise<ReflectionTrend | null> {
  try {
    const since = isoDay(Date.now() - 14 * DAY);
    const { data } = await sb.from("coach_reflections")
      .select("reflection_date, energy_1to5, mood_1to5, sleep_quality_1to5, rpe_1to10, win, friction")
      .eq("user_id", userId).gte("reflection_date", since).order("reflection_date", { ascending: false }).limit(14);
    const rows: Array<Record<string, unknown>> = Array.isArray(data) ? data : [];
    if (!rows.length) return null;
    const split = isoDay(Date.now() - 7 * DAY);
    const week = rows.filter((r) => String(r.reflection_date) >= split), prev = rows.filter((r) => String(r.reflection_date) < split);
    const n = (v: unknown) => (typeof v === "number" ? v : null);
    const m = (xs: Array<Record<string, unknown>>) => ({
      energy: avg(xs.map((r) => n(r.energy_1to5))), mood: avg(xs.map((r) => n(r.mood_1to5))),
      sleepQ: avg(xs.map((r) => n(r.sleep_quality_1to5))), rpe: avg(xs.map((r) => n(r.rpe_1to10))),
    });
    const r1 = (o: ReturnType<typeof m>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v == null ? null : Math.round(v * 10) / 10])) as ReturnType<typeof m>;
    const lastWin = rows.find((r) => typeof r.win === "string" && (r.win as string).trim())?.win as string | undefined;
    const lastFriction = rows.find((r) => typeof r.friction === "string" && (r.friction as string).trim())?.friction as string | undefined;
    return { n7: week.length, avg7: r1(m(week)), prev7: r1(m(prev)), lastWin: lastWin?.slice(0, 120) ?? null, lastFriction: lastFriction?.slice(0, 120) ?? null };
  } catch {
    return null;
  }
}

// ── The rest: badges · today's plan · last review · recovery ─────────────────

export async function gatherBadges(sb: AnyClient, userId: string, days = 28): Promise<string[]> {
  try {
    const { data } = await sb.from("user_badges").select("earned_at, badges(name)").eq("user_id", userId)
      .gte("earned_at", new Date(Date.now() - days * DAY).toISOString()).order("earned_at", { ascending: false }).limit(6);
    return (Array.isArray(data) ? data : []).map((r: { badges?: { name?: string } | null }) => r.badges?.name).filter((x: unknown): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export interface TodaysPlan { headline: string | null; missions: Array<{ title: string; done: boolean }> }

export async function gatherTodaysPlan(sb: AnyClient, userId: string, today: string): Promise<TodaysPlan | null> {
  try {
    const { data: plan } = await sb.from("coach_daily_plans").select("id, headline, missions").eq("user_id", userId).eq("plan_date", today).maybeSingle();
    if (!plan) return null;
    const { data: logs } = await sb.from("coach_mission_logs").select("mission_id").eq("user_id", userId).eq("daily_plan_id", plan.id);
    const done = new Set((Array.isArray(logs) ? logs : []).map((l: { mission_id: string }) => l.mission_id));
    const missions = (Array.isArray(plan.missions) ? plan.missions : []) as Array<{ id?: string; title?: string }>;
    return { headline: typeof plan.headline === "string" ? plan.headline : null, missions: missions.slice(0, 6).map((m) => ({ title: String(m.title ?? "").slice(0, 80), done: !!m.id && done.has(m.id) })) };
  } catch {
    return null;
  }
}

export interface LastReview { weekStartsOn: string; driver: string | null; focus: string | null; liftsNote: string | null; tweak: string | null }

export async function gatherLastReview(sb: AnyClient, userId: string): Promise<LastReview | null> {
  try {
    const { data } = await sb.from("coach_weekly_reviews").select("week_starts_on, driver_of_week, next_week_focus, lifts_note, program_tweak")
      .eq("user_id", userId).order("week_starts_on", { ascending: false }).limit(1).maybeSingle();
    if (!data) return null;
    return { weekStartsOn: data.week_starts_on, driver: data.driver_of_week ?? null, focus: data.next_week_focus ?? null, liftsNote: data.lifts_note ?? null, tweak: data.program_tweak ?? null };
  } catch {
    return null;
  }
}

export interface RecoverySummary { sessions28: number; minutes28: number; last: string | null; areas: string[] }

export async function gatherRecovery(sb: AnyClient, userId: string): Promise<RecoverySummary | null> {
  try {
    const { data } = await sb.from("recovery_sessions").select("started_at, actual_sec, areas, status").eq("user_id", userId)
      .gte("started_at", new Date(Date.now() - 28 * DAY).toISOString()).order("started_at", { ascending: false }).limit(60);
    const rows: Array<Record<string, unknown>> = Array.isArray(data) ? data : [];
    if (!rows.length) return null;
    const areas = new Map<string, number>();
    for (const r of rows) for (const a of (Array.isArray(r.areas) ? r.areas : []) as string[]) areas.set(a, (areas.get(a) ?? 0) + 1);
    return {
      sessions28: rows.length,
      minutes28: Math.round(rows.reduce((s, r) => s + ((typeof r.actual_sec === "number" ? r.actual_sec : 0) / 60), 0)),
      last: String(rows[0].started_at ?? "").slice(0, 10) || null,
      areas: [...areas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a]) => a),
    };
  } catch {
    return null;
  }
}

// ── The pack ────────────────────────────────────────────────────────────────

export type PackScope = "full" | "light";

export interface AthletePack {
  today: string;
  day: DaySignals | null;
  diet: DietSummary | null;
  reflections: ReflectionTrend | null;
  badges: string[];
  plan: TodaysPlan | null;
  lastReview: LastReview | null;
  recovery: RecoverySummary | null;
  /** Filled only when the caller asked (the chat and the plan already hold their own). */
  night: NightSignals | null;
  workouts: HealthWorkoutDay[] | null;
  habits: HabitGaps | null;
}

/** A pack that knows nothing — what a failed gather hands the block builder. */
export const emptyPack = (today: string): AthletePack =>
  ({ today, day: null, diet: null, reflections: null, badges: [], plan: null, lastReview: null, recovery: null, night: null, workouts: null, habits: null });

/**
 * One read for the member's wellbeing data. `night`/`workouts`/`habits` are
 * opt-in so a consumer that already gathers them does not pay twice.
 */
export async function gatherAthletePack(
  sb: AnyClient,
  userId: string,
  opts: { today: string; scope?: PackScope; night?: boolean; workouts?: boolean; habits?: boolean } ,
): Promise<AthletePack> {
  const scope = opts.scope ?? "full";
  const [day, diet, reflections, badges, plan, lastReview, recovery, night, workouts, habits] = await Promise.all([
    gatherDaySignals(sb, userId),
    gatherDiet(sb, userId),
    scope === "full" ? gatherReflectionTrend(sb, userId) : Promise.resolve(null),
    scope === "full" ? gatherBadges(sb, userId) : Promise.resolve([] as string[]),
    scope === "full" ? gatherTodaysPlan(sb, userId, opts.today) : Promise.resolve(null),
    scope === "full" ? gatherLastReview(sb, userId) : Promise.resolve(null),
    scope === "full" ? gatherRecovery(sb, userId) : Promise.resolve(null),
    opts.night ? gatherNightSignals(sb, userId).catch(() => ({ hasData: false } as NightSignals)) : Promise.resolve(null),
    opts.workouts ? gatherHealthWorkouts(sb, 7).catch(() => [] as HealthWorkoutDay[]) : Promise.resolve(null),
    opts.habits ? gatherHabitGaps(sb, userId, { days: 14 }).catch(() => null) : Promise.resolve(null),
  ]);
  return { today: opts.today, day, diet, reflections, badges, plan, lastReview, recovery, night, workouts, habits };
}

const kg = (v: number | null) => (v == null ? "?" : `${v}`);
const vs = (v: number | null, t: number | null, unit = "") =>
  v == null ? "—" : `${v}${unit}${t != null ? ` / ${t}${unit}` : ""}`;
const delta = (now: number | null, prev: number | null) => (now != null && prev != null ? ` (${now - prev >= 0 ? "+" : ""}${Math.round((now - prev) * 10) / 10} vs prior week)` : "");

/** The pack as prompt blocks; "" when nothing is known. Blocks the caller already builds itself are left out by not asking for them. */
export function buildPackBlocks(p: AthletePack): string {
  const blocks: string[] = [];

  if (p.day) {
    const d = p.day;
    const lines: string[] = [];
    if (d.steps.avg7 != null || d.steps.yesterday != null) lines.push(`- Steps: ${d.steps.yesterday != null ? `${d.steps.yesterday} yesterday, ` : ""}avg ${d.steps.avg7 ?? "?"}/day this week${d.steps.avg28 != null ? ` (28-day avg ${d.steps.avg28})` : ""}`);
    if (d.activeKcalAvg7 != null) lines.push(`- Active energy: avg ${d.activeKcalAvg7} kcal/day`);
    if (d.workoutMin7) lines.push(`- Health-recorded training: ${d.workoutMin7} min in 7 days`);
    if (d.mindfulMin7) lines.push(`- Mindful minutes: ${d.mindfulMin7} in 7 days`);
    if (d.body.massKg != null) lines.push(`- Body weight: ${d.body.massKg} kg (${d.body.on})${d.body.delta28 != null ? `, ${d.body.delta28 >= 0 ? "+" : ""}${d.body.delta28} kg over 28 days` : ""}${d.body.fatPct != null ? `, body fat ${d.body.fatPct}%` : ""}`);
    if (d.body.vo2max != null) lines.push(`- VO2max: ${d.body.vo2max}`);
    if (lines.length) blocks.push(`DAILY ACTIVITY & BODY (Apple Health${d.sources.length ? ` via ${d.sources.join(", ")}` : ""}):\n${lines.join("\n")}`);
  }

  if (p.diet) {
    const f = p.diet, t = f.target;
    const lines = [
      `- Logged ${f.daysLogged7} of 7 days (${f.meals7} meals). Daily average: ${vs(f.avg.kcal, t?.kcal ?? null, " kcal")} · protein ${vs(f.avg.protein, t?.protein ?? null, " g")} · carbs ${vs(f.avg.carbs, t?.carbs ?? null, " g")} · fat ${vs(f.avg.fat, t?.fat ?? null, " g")}${f.avg.fiber != null ? ` · fibre ${vs(f.avg.fiber, t?.fiber ?? null, " g")}` : ""}`,
    ];
    if (f.proteinDaysHit != null) lines.push(`- Protein target reached on ${f.proteinDaysHit} of ${f.daysLogged7} logged days`);
    if (f.yesterday) lines.push(`- Yesterday: ${f.yesterday.kcal ?? "?"} kcal, ${f.yesterday.protein ?? "?"} g protein`);
    if (t?.waterMl) lines.push(`- Water target: ${(t.waterMl / 1000).toFixed(1)} L/day`);
    if (f.topFoods.length) lines.push(`- Eats most often: ${f.topFoods.join(", ")}`);
    blocks.push(`FOOD DIARY (self-logged, 7 days — name foods and numbers, never guess what was not logged):\n${lines.join("\n")}`);
  }

  if (p.reflections && p.reflections.n7 > 0) {
    const r = p.reflections;
    blocks.push(`EVENING REFLECTIONS (${r.n7} this week, 1–5 unless noted): energy ${kg(r.avg7.energy)}${delta(r.avg7.energy, r.prev7.energy)} · mood ${kg(r.avg7.mood)}${delta(r.avg7.mood, r.prev7.mood)} · sleep quality ${kg(r.avg7.sleepQ)}${delta(r.avg7.sleepQ, r.prev7.sleepQ)} · session RPE ${kg(r.avg7.rpe)}/10${delta(r.avg7.rpe, r.prev7.rpe)}${r.lastWin ? `\n- Last win: "${r.lastWin}"` : ""}${r.lastFriction ? `\n- Last friction: "${r.lastFriction}"` : ""}`);
  }

  if (p.plan && (p.plan.headline || p.plan.missions.length)) {
    const done = p.plan.missions.filter((m) => m.done).length;
    blocks.push(`TODAY'S PLAN (the missions the daily plan set; ${done}/${p.plan.missions.length} covered so far):${p.plan.headline ? ` "${p.plan.headline}"` : ""}\n${p.plan.missions.map((m) => `- ${m.done ? "✓" : "○"} ${m.title}`).join("\n")}`);
  }

  if (p.lastReview) {
    const w = p.lastReview;
    blocks.push(`LAST WEEKLY REVIEW (week of ${w.weekStartsOn}):${w.driver ? ` driver — ${w.driver}.` : ""}${w.focus ? ` Focus — ${w.focus}` : ""}${w.liftsNote ? ` Lifts — ${w.liftsNote}` : ""}${w.tweak ? ` Program tweak — ${w.tweak}` : ""}`);
  }

  if (p.recovery) {
    const rc = p.recovery;
    blocks.push(`RECOVERY ROUTINES (breathwork / mobility in the app): ${rc.sessions28} sessions, ${rc.minutes28} min in 28 days${rc.last ? `, last ${rc.last}` : ""}${rc.areas.length ? `, mostly ${rc.areas.join(", ")}` : ""}.`);
  }

  if (p.badges.length) blocks.push(`BADGES EARNED (28 days): ${p.badges.join(", ")}.`);

  if (p.night) { const b = buildCausalBlock(p.night); if (b) blocks.push(b); }
  if (p.workouts) { const b = buildWorkoutsBlock(p.workouts, (id) => sportName(id) ?? id); if (b) blocks.push(b); }
  if (p.habits) { const b = buildHabitGapsBlock(p.habits); if (b) blocks.push(b); }

  return blocks.join("\n\n");
}
