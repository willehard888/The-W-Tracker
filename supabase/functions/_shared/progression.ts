// Progression digest — turns the athlete's logged sets into a trajectory the
// coach can actually SEE and drive: per-lift direction, estimated 1RM trend,
// PRs hit, and stalls that need attention. This is what makes the coach feel
// like it's tracking progress and pushing the next step, not just reacting.
//
// FAIL-OPEN: any error → empty, the coach simply won't mention lifts.

import { loadAdvice, type LoadAdvice } from "./overload.ts";
import { programWeekState } from "./program-week.ts";

// deno-lint-ignore no-explicit-any
type AnyClient = any;

interface LogRow {
  exercise_slug: string | null;
  exercise_name: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  logged_on: string;
}

export interface ExProgress {
  name: string;
  sessions: number;
  latest: { weight: number | null; reps: number | null; on: string };
  prev?: { weight: number | null; reps: number | null };
  trend: "up" | "down" | "flat" | "new";
  isPR: boolean;
  stalled: boolean;
  daysSince: number;
}

/** Epley estimated 1RM — one number that compares sets across rep ranges. */
const e1rm = (w: number | null, r: number | null): number | null =>
  w == null ? null : w * (1 + (r ?? 1) / 30);

export async function gatherProgression(
  supabase: AnyClient,
  _userId: string,
  opts: { limit?: number } = {},
): Promise<ExProgress[]> {
  let rows: LogRow[] = [];
  try {
    const { data } = await supabase.rpc("recent_workout_logs", { p_limit: opts.limit ?? 200 });
    rows = Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
  if (!rows.length) return [];

  // recent_workout_logs returns newest-first. Group by exercise.
  const groups = new Map<string, LogRow[]>();
  for (const r of rows) {
    const key = r.exercise_slug || r.exercise_name;
    if (!key) continue;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }

  const out: ExProgress[] = [];
  for (const list of groups.values()) {
    const latest = list[0];
    const prev = list[1];
    const withWeight = list.filter((r) => r.weight != null);
    const eLatest = e1rm(latest.weight, latest.reps);
    const ePrev = e1rm(prev?.weight ?? null, prev?.reps ?? null);
    const eBest = withWeight.length ? Math.max(...withWeight.map((r) => e1rm(r.weight, r.reps)!)) : null;

    let trend: ExProgress["trend"] = "new";
    if (list.length >= 2 && eLatest != null && ePrev != null) {
      trend = eLatest > ePrev + 0.5 ? "up" : eLatest < ePrev - 0.5 ? "down" : "flat";
    }
    const isPR = list.length >= 2 && eLatest != null && eBest != null && eLatest >= eBest - 0.01;
    const stalled = withWeight.length >= 3 && !isPR && trend !== "up";
    const daysSince = Math.round((Date.now() - new Date(latest.logged_on).getTime()) / 86_400_000);

    out.push({
      name: latest.exercise_name,
      sessions: list.length,
      latest: { weight: latest.weight, reps: latest.reps, on: latest.logged_on },
      prev: prev ? { weight: prev.weight, reps: prev.reps } : undefined,
      trend,
      isPR,
      stalled,
      daysSince,
    });
  }

  // Most recently trained first.
  out.sort((a, b) => b.latest.on.localeCompare(a.latest.on));
  return out;
}

const setStr = (w: number | null, r: number | null) =>
  `${w != null ? `${w}kg` : ""}${w != null && r != null ? " × " : ""}${r != null ? r : ""}`;

/**
 * Compact progression block for a system prompt, with directives so the coach
 * USES it — references the trajectory, names PRs, prescribes the next target,
 * and addresses stalls. Returns "" when there's nothing logged.
 */
export function buildProgressionBlock(items: ExProgress[]): string {
  if (!items.length) return "";

  const flag = (e: ExProgress) =>
    e.isPR ? "🏆 PR this session" :
    e.trend === "up" ? "📈 climbing" :
    e.trend === "down" ? "🔻 down" :
    e.stalled ? "⏸ STALLED" :
    e.trend === "flat" ? "→ held" : "🆕 first log";

  const lines = items.slice(0, 12).map((e) => {
    const now = setStr(e.latest.weight, e.latest.reps);
    const prev = e.prev ? `, prev ${setStr(e.prev.weight, e.prev.reps)}` : "";
    return `- ${e.name}: now ${now} (${e.sessions} log${e.sessions === 1 ? "" : "s"}${prev}) — ${flag(e)}`;
  });

  const prs = items.filter((e) => e.isPR).map((e) => e.name);
  const stalls = items.filter((e) => e.stalled).map((e) => e.name);

  const summary = [
    prs.length ? `PRs just hit: ${prs.slice(0, 4).join(", ")}.` : "",
    stalls.length ? `Stalled (needs a change — small load/rep bump, tempo, or a deload): ${stalls.slice(0, 4).join(", ")}.` : "",
  ].filter(Boolean).join(" ");

  return `STRENGTH PROGRESSION — the athlete's logged lifts (you track these like a real coach):
${lines.join("\n")}${summary ? `\n${summary}` : ""}

Coach with this:
- When training comes up, reference a SPECIFIC lift's trajectory by its numbers ("your bench has gone X→Y over N sessions"). It proves you're watching.
- Give the EXACT next target: weight × reps — and when a NEXT LOADS block lists the lift, that block's number IS the target (it is the app's own rule and what the set row will show); never add load or reps on top of it. Only a lift absent from NEXT LOADS is yours to reason about from its trajectory. Celebrate a 🏆 PR by name.
- For a ⏸ STALLED lift, name it and prescribe the fix (small deload then build, a rep/tempo change, or more recovery) — don't let it drift.
- Be concrete and forward-moving. The athlete should feel you are personally driving their numbers up.`;
}

// ── The next load, by the app's own rule ────────────────────────────────────
//
// The block above is a digest of top sets; this one is the number the set row
// will seed: double progression (_shared/overload.ts, mirrored from the
// client) over EVERY set of the most recent session, against the rep range
// the current program week prescribes for that movement. The coach quotes
// these, never invents a load.

export interface NextLoad {
  slug: string;
  name: string;
  move: LoadAdvice["move"];
  weight: number | null;
  reps: number | null;
  step: number;
  reason: string;
  /** Last session: its date and the top set, for the sentence. */
  last: { on: string; weight: number | null; reps: number | null } | null;
  /** The rule had a rep range to judge against (a programmed movement). */
  prescribed: boolean;
}

interface SetRow {
  exercise_slug: string | null;
  exercise_name: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  set_index: number | null;
  logged_on: string;
}

/** The rep range and effort each movement is prescribed at in the current program week. */
async function prescriptionBySlug(supabase: AnyClient, userId: string): Promise<Map<string, { reps: string | number; rpe: number | null }>> {
  const out = new Map<string, { reps: string | number; rpe: number | null }>();
  try {
    const { data: program } = await supabase
      .from("coach_programs").select("id, started_on, weeks, plan_json")
      .eq("user_id", userId).eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const weeks = program?.plan_json?.weeks;
    if (!program || !Array.isArray(weeks)) return out;
    const { data: logs } = await supabase.from("coach_program_logs").select("week, completed").eq("user_id", userId).eq("program_id", program.id);
    const { currentWeek } = programWeekState({ startedOn: program.started_on, weeks: program.weeks, logs: (logs ?? []) as { week: number; completed: boolean }[], now: new Date() });
    const wk = weeks.find((w: { week: number }) => w.week === currentWeek) ?? weeks[0];
    for (const d of wk?.days ?? []) {
      for (const b of d?.blocks ?? []) {
        if (typeof b?.slug === "string" && b.reps != null && !out.has(b.slug)) out.set(b.slug, { reps: b.reps, rpe: typeof b.rpe === "number" ? b.rpe : null });
      }
    }
  } catch { /* fail-open: no prescription, the rule holds the weight */ }
  return out;
}

/**
 * Every movement with a loaded set in the window, most recently trained
 * first, each with the load the rule says next. FAIL-OPEN: any error → [].
 */
export async function gatherNextLoads(
  supabase: AnyClient,
  userId: string,
  opts: { days?: number; limit?: number } = {},
): Promise<NextLoad[]> {
  const since = new Date(Date.now() - (opts.days ?? 28) * 86_400_000).toISOString().slice(0, 10);
  let rows: SetRow[] = [];
  try {
    const { data } = await supabase
      .from("workout_set_logs")
      .select("exercise_slug, exercise_name, weight, reps, rpe, set_index, logged_on")
      .eq("user_id", userId).gte("logged_on", since)
      .order("logged_on", { ascending: false }).order("set_index", { ascending: true })
      .limit(opts.limit ?? 600);
    rows = Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
  if (!rows.length) return [];
  const rx = await prescriptionBySlug(supabase, userId);
  const bySlug = new Map<string, SetRow[]>();
  for (const r of rows) {
    if (!r.exercise_slug) continue;
    (bySlug.get(r.exercise_slug) ?? bySlug.set(r.exercise_slug, []).get(r.exercise_slug)!).push(r);
  }
  const out: NextLoad[] = [];
  for (const [slug, list] of bySlug) {
    const p = rx.get(slug);
    const a = loadAdvice(list, p?.reps ?? null, p?.rpe ?? null);
    if (a.move === "first") continue;
    const top = list.find((r) => r.logged_on === a.last?.date && r.weight === a.last?.weight) ?? list[0];
    out.push({
      slug, name: list[0].exercise_name, move: a.move, weight: a.weight, reps: a.reps, step: a.step, reason: a.reason,
      last: a.last ? { on: a.last.date, weight: top.weight, reps: top.reps } : null,
      prescribed: !!p,
    });
  }
  return out.sort((a, b) => (b.last?.on ?? "").localeCompare(a.last?.on ?? ""));
}

const kg = (v: number | null) => (v == null ? "—" : `${Number.isInteger(v) ? v : v.toFixed(1).replace(/\.0$/, "")} kg`);

/** The next loads as prompt text; "" when nothing is loaded. */
export function buildNextLoadsBlock(items: NextLoad[]): string {
  if (!items.length) return "";
  const arrow = (m: NextLoad["move"]) => (m === "up" ? "↑" : m === "repeat" ? "↻" : "→");
  const lines = items.slice(0, 12).map((n) =>
    `- ${n.name}: ${arrow(n.move)} ${kg(n.weight)}${n.reps != null ? ` × ${n.reps}` : ""}${n.reason ? ` — ${n.reason}` : ""}${n.prescribed ? "" : " (no program range: the weight holds)"}`,
  );
  const ups = items.filter((n) => n.move === "up").length;
  return `NEXT LOADS — BINDING. The app's own rule (double progression: every set at the top of the rep range earns one plate of 2.5 kg and the reps restart at the bottom; a set under the range repeats the weight; otherwise the weight holds and the top of the range is the target), computed from every set of the last session. ↑ = plate earned, → = hold, ↻ = repeat. These are exactly what the set rows will show:
${lines.join("\n")}
${ups ? `${ups} lift${ups === 1 ? "" : "s"} earned a plate.` : "No lift earned a plate yet — the weights hold until every set reaches the top of its range."}
When you name a load, sets or reps for one of these movements, use THIS weight × reps and this reason, word for word in substance. Do NOT add 2.5 kg, a rep or a set to a → or ↻ lift, and do not round a number. A lift not listed here has no load you may quote — say the athlete will see it on the set row. This block outranks any load named in the morning brief, the daily plan or an earlier message.`;
}
