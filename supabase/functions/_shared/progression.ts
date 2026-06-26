// Progression digest — turns the athlete's logged sets into a trajectory the
// coach can actually SEE and drive: per-lift direction, estimated 1RM trend,
// PRs hit, and stalls that need attention. This is what makes the coach feel
// like it's tracking progress and pushing the next step, not just reacting.
//
// FAIL-OPEN: any error → empty, the coach simply won't mention lifts.

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
- Give the EXACT next target: weight × reps. If a lift is climbing or hit the top of its rep range at low RPE, add load or a rep. Celebrate a 🏆 PR by name.
- For a ⏸ STALLED lift, name it and prescribe the fix (small deload then build, a rep/tempo change, or more recovery) — don't let it drift.
- Be concrete and forward-moving. The athlete should feel you are personally driving their numbers up.`;
}
