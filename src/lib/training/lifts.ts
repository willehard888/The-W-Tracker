/**
 * The lift list on Progress: every movement the athlete has logged, from the
 * heaviest set per exercise per day that `recent_workout_logs` returns —
 * enough for a mini curve of top weights, the last session and a delta.
 * The full chart (every set) opens from the row and reads its own history.
 */

interface TopSetRow {
  exercise_slug: string | null;
  exercise_name: string;
  weight: number | null;
  reps: number | null;
  logged_on: string;
}

export interface LiftRow {
  /** The slug when the rows carry one (the chart needs it), else the name. */
  key: string;
  slug: string | null;
  name: string;
  sessions: number;
  /** Top weight per session, oldest first — or best reps for a movement never loaded. */
  series: number[];
  unit: "kg" | "reps";
  last: { weight: number | null; reps: number | null; logged_on: string };
  /** Last minus first of `series`; 0 with one session. */
  delta: number;
  /** Whole days since the last session. */
  daysSince: number;
}

const dayNum = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / 86_400_000;

/** Rows (any order) → one lift per movement, the most recently trained first. */
export function liftsFrom(rows: TopSetRow[], today: string): LiftRow[] {
  const byKey = new Map<string, TopSetRow[]>();
  for (const r of rows) {
    const key = r.exercise_slug ?? r.exercise_name;
    if (!key || !r.logged_on) continue;
    const list = byKey.get(key) ?? [];
    list.push(r);
    byKey.set(key, list);
  }
  const out: LiftRow[] = [];
  for (const [key, list] of byKey) {
    const asc = [...list].sort((a, b) => a.logged_on.localeCompare(b.logged_on));
    const loaded = asc.some((r) => r.weight != null);
    const series = asc.map((r) => (loaded ? r.weight : r.reps)).filter((v): v is number => v != null);
    const last = asc[asc.length - 1];
    const first = series[0];
    const latest = series[series.length - 1];
    out.push({
      key,
      slug: last.exercise_slug,
      name: list.find((r) => r.exercise_name)?.exercise_name ?? key,
      sessions: asc.length,
      series,
      unit: loaded ? "kg" : "reps",
      last: { weight: last.weight, reps: last.reps, logged_on: last.logged_on },
      delta: series.length >= 2 ? Math.round((latest - first) * 10) / 10 : 0,
      daysSince: Math.max(0, Math.round(dayNum(today) - dayNum(last.logged_on))),
    });
  }
  return out.sort((a, b) => b.last.logged_on.localeCompare(a.last.logged_on) || a.name.localeCompare(b.name));
}
