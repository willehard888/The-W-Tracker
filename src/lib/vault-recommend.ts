import { VAULT_PATHS, type VaultPath } from "@/data/vault-paths";

/**
 * Which path today points at, and the piece to run. Pure, deterministic,
 * and built only from things the member logged themselves: check-in days,
 * training days, meditation days, average sleep, streak, and which pieces
 * they have already practised. The reason is always a behaviour they can
 * see on their own Home screen — never a reading of who they are.
 */
export interface VaultSignals {
  /** Check-ins in the last 7 days (0–7). */
  checkinDays: number;
  workoutDays: number;
  meditationDays: number;
  /** Mean sleep hours over the check-ins, or null when none. */
  sleepAvg: number | null;
  streak: number;
  practicedSlugs: ReadonlySet<string>;
}

export interface PathPick {
  path: VaultPath;
  reason: string;
}

const pathBySlug = (slug: string) => VAULT_PATHS.find((p) => p.slug === slug)!;

const isComplete = (path: VaultPath, practiced: ReadonlySet<string>) =>
  path.steps.every((s) => practiced.has(s));

/** The first step of a path the member has not practised, or null when done. */
export const nextStep = (path: VaultPath, practiced: ReadonlySet<string>): string | null =>
  path.steps.find((s) => !practiced.has(s)) ?? null;

/**
 * Pointer, not diagnosis. Rules in priority order, each tied to a number the
 * member logged; when none fires, the paths rotate by local day so the map
 * gets walked evenly. A path already finished is skipped.
 */
export const recommendPath = (s: VaultSignals, dayIndex: number): PathPick => {
  const open = VAULT_PATHS.filter((p) => !isComplete(p, s.practicedSlugs));
  if (open.length === 0) {
    const p = VAULT_PATHS[dayIndex % VAULT_PATHS.length];
    return { path: p, reason: "Every path walked. Walk one again with a different week behind you." };
  }
  const pick = (slug: string, reason: string): PathPick | null => {
    const p = pathBySlug(slug);
    return open.includes(p) ? { path: p, reason } : null;
  };

  // No week logged yet: the map's own manual is the first door, and Home already
  // says so. Send them to discipline, the path that builds the check-in.
  if (s.checkinDays <= 3) {
    const r = pick("discipline", `${s.checkinDays} check-in${s.checkinDays === 1 ? "" : "s"} this week. Systems before motivation.`);
    if (r) return r;
  }
  if (s.workoutDays >= 4 && s.sleepAvg != null && s.sleepAvg < 7) {
    const r = pick("long-game", `Trained ${s.workoutDays} days on ${s.sleepAvg.toFixed(1)} h of sleep. Recovery is the lever.`);
    if (r) return r;
  }
  if (s.meditationDays >= 4) {
    const r = pick("presence", `Meditated ${s.meditationDays} days this week. Go deeper on attention.`);
    if (r) return r;
  }
  if (s.streak >= 30) {
    const r = pick("meaning", `${s.streak} days in. Time to ask what it is for.`);
    if (r) return r;
  }
  if (s.workoutDays >= 5) {
    const r = pick("stoic", `Five training days. The Stoics on what you control, and the apprenticeship.`);
    if (r) return r;
  }
  const p = open[dayIndex % open.length];
  return { path: p, reason: "Today's door on the map." };
};

/**
 * Today's practice: the next unpractised step of the recommended path. Once
 * every path is walked, the rest of the library takes over, one unpractised
 * piece a day from any shelf (`path` is then null); only when nothing at all
 * is left does a walked path come round again.
 */
export const pickTodaysPractice = (
  s: VaultSignals,
  dayIndex: number,
  librarySlugs: readonly string[] = [],
): { path: VaultPath | null; slug: string; reason: string } | null => {
  const rec = recommendPath(s, dayIndex);
  const step = nextStep(rec.path, s.practicedSlugs);
  if (step) return { path: rec.path, slug: step, reason: rec.reason };
  const rest = librarySlugs.filter((x) => !s.practicedSlugs.has(x));
  if (rest.length) {
    return { path: null, slug: rest[dayIndex % rest.length], reason: "Every path walked. The rest of the shelf, one piece a day." };
  }
  const slug = rec.path.steps[dayIndex % rec.path.steps.length];
  return slug ? { path: rec.path, slug, reason: rec.reason } : null;
};

/** Signals from the last week of check-ins, in the shape the recommender wants. */
export const signalsFromCheckins = (
  rows: { sleep_hours: number; workout: boolean; meditation_morning: boolean; meditation_evening: boolean }[],
  streak: number,
  practicedSlugs: ReadonlySet<string>,
): VaultSignals => {
  const sleeps = rows.map((r) => r.sleep_hours).filter((h) => h > 0);
  return {
    checkinDays: Math.min(7, rows.length),
    workoutDays: rows.filter((r) => r.workout).length,
    meditationDays: rows.filter((r) => r.meditation_morning || r.meditation_evening).length,
    sleepAvg: sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null,
    streak,
    practicedSlugs,
  };
};
