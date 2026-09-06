// Safety layer for the AI program generator: which catalog movements an athlete
// must never be offered, and what to do when the model prescribes one anyway.
//
// The 542-item catalog (exercise-catalog.ts) carries no difficulty and no
// contraindications, so until now "Injuries: knee" reached the model as a line
// of prose while Dumbbell Lunges sat in the catalog it was told to pick from.
// The rules here are applied BEFORE the prompt (the banned slugs never reach
// the model) and AFTER the answer (anything outside the safe catalog is
// stripped). Pure TS on purpose — vitest imports this file directly.

export type InjuryTag =
  | "lower_back" | "knee" | "shoulder" | "elbow" | "wrist" | "hip" | "neck" | "ankle";

/** The subset of a catalog row the rules read. Structural, so no import is needed. */
export interface SafetyCatalogItem {
  slug: string;
  name: string;
  primary: string;
  category: string;
}

/**
 * Name patterns (and optionally primary muscles) contraindicated per injury.
 * Deliberately conservative: a false ban costs one exercise out of 200, a
 * missed one costs a knee. Lookbehinds keep "curl"/"extension" for the elbow
 * from banning leg curls and leg extensions.
 */
export const INJURY_BANS: Record<InjuryTag, { primary?: string[]; name: RegExp }> = {
  knee: { name: /lunge|step[- ]?up|jump|\bbox\b|pistol|sissy|leg extension|split squat|burpee|hack squat/i },
  lower_back: {
    primary: ["lower back"],
    name: /dead ?lift|good morning|hyperextension|bent[- ]?over|barbell row|clean|snatch|swing|rollout|ab wheel|russian twist/i,
  },
  shoulder: {
    name: /overhead|shoulder press|military|behind[- ]the[- ]neck|upright row|\bdips?\b|handstand|pike|snatch|jerk|push press|arnold|lateral raise|bench press|\bfly|\bflye/i,
  },
  elbow: {
    name: /pull[- ]?ups?|chin[- ]?ups?|skull|(?<!leg )curl|(?<!leg |back |hip |hyper)extension|\bdips?\b|close[- ]grip|pushdown/i,
  },
  wrist: { name: /push[- ]?ups?|front squat|clean|snatch|jerk|wrist|handstand|plank/i },
  hip: { name: /lateral lunge|side lunge|adductor|abductor|sumo|\bhip|cossack/i },
  neck: { name: /\bneck|guillotine|shrug|bridge|behind[- ]the[- ]neck/i },
  ankle: { name: /jump|\bbox\b|calf|calves|sprint|burpee|lunge/i },
};

/** Lifts with a technical floor a newer athlete has not built yet. */
const ADVANCED_NAME =
  /clean|snatch|jerk|chains|\bboard\b|\bpins?\b|deficit|\bblocks\b|windmill|turkish|pistol|muscle[- ]?up|handstand|planche|\blever\b|glute[- ]ham|zercher|jefferson/i;

/**
 * Keyed by `coach_athlete_profile.training_experience`; `unknown` is the
 * pre-question profile (null). A `never_trained` athlete only reaches the
 * generator after the written 8-week path, so they get the same floor as
 * `under_6_months` — eight weeks of leg press is not a licence to snatch.
 */
export const EXPERIENCE_BANS: Record<string, { category: string[]; name?: RegExp }> = {
  never_trained: { category: ["olympic weightlifting", "powerlifting"], name: ADVANCED_NAME },
  under_6_months: { category: ["olympic weightlifting", "powerlifting"], name: ADVANCED_NAME },
  unknown: { category: ["olympic weightlifting"] },
  experienced: { category: [] },
};

/** Catalog slugs this athlete must not be offered. */
export function bannedSlugs(
  catalog: readonly SafetyCatalogItem[],
  injuries: Set<InjuryTag>,
  experience: string | null,
): Set<string> {
  const exp = EXPERIENCE_BANS[experience ?? "unknown"] ?? EXPERIENCE_BANS.unknown;
  const tags = [...injuries];
  const out = new Set<string>();
  for (const e of catalog) {
    const byExperience = exp.category.includes(e.category) || (exp.name?.test(e.name) ?? false);
    const byInjury = tags.some((t) => INJURY_BANS[t].name.test(e.name) || (INJURY_BANS[t].primary?.includes(e.primary) ?? false));
    if (byExperience || byInjury) out.add(e.slug);
  }
  return out;
}

// ── Plan post-processing ──────────────────────────────────────────────────────
// Loose shapes: plan_json is model output, so nothing below trusts a field.

export interface SafetyBlock { slug?: unknown; name?: unknown }
export interface SafetyDay { day?: unknown; focus?: unknown; blocks?: unknown }
export interface SafetyWeek { week?: unknown; days?: unknown }
export interface SafetyPlan { weeks?: unknown }

const daysOf = (w: SafetyWeek): SafetyDay[] => (Array.isArray(w.days) ? (w.days as SafetyDay[]) : []);
const blocksOf = (d: SafetyDay): SafetyBlock[] => (Array.isArray(d.blocks) ? (d.blocks as SafetyBlock[]) : []);
const isRest = (d: SafetyDay) => String(d.focus ?? "").trim().toLowerCase() === "rest";

/**
 * Drops every block whose slug is not in `allowed` (banned OR invented) and
 * keeps everything else untouched. Returns the names removed so the log says
 * what the model tried to prescribe.
 */
export function stripUnallowedBlocks<P extends SafetyPlan>(plan: P, allowed: Set<string>): { plan: P; removed: string[] } {
  const removed: string[] = [];
  if (!Array.isArray(plan.weeks)) return { plan, removed };
  const weeks = (plan.weeks as SafetyWeek[]).map((w) => ({
    ...w,
    days: daysOf(w).map((d) => ({
      ...d,
      blocks: blocksOf(d).filter((b) => {
        const ok = typeof b.slug === "string" && allowed.has(b.slug);
        if (!ok) removed.push(`W${String(w.week ?? "?")} ${String(d.day ?? "?")}: ${String(b.name ?? b.slug ?? "?")}`);
        return ok;
      }),
    })),
  }));
  return { plan: { ...plan, weeks }, removed };
}

/** Training days (focus ≠ "Rest") left with fewer than `minBlocks` exercises. */
export function thinDays(plan: SafetyPlan, minBlocks = 3): string[] {
  if (!Array.isArray(plan.weeks)) return [];
  const thin: string[] = [];
  for (const w of plan.weeks as SafetyWeek[]) {
    for (const d of daysOf(w)) {
      if (isRest(d)) continue;
      const n = blocksOf(d).length;
      if (n < minBlocks) thin.push(`W${String(w.week ?? "?")} ${String(d.day ?? "?")} (${n} blocks)`);
    }
  }
  return thin;
}
