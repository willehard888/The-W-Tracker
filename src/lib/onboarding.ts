// Onboarding ("Initiation") — pure logic layer.
//
// The flow's answers must land in the SAME places the Coach wizard reads, so
// nothing is ever asked twice: the localStorage draft the wizard hydrates
// from, plus a partial upsert_athlete_profile patch (WITHOUT onboarded:true —
// the wizard still runs, just pre-filled and shorter).

import type { MarkFamily } from "@/lib/marks";
import type { GoalId } from "@/hooks/use-athlete-profile";

/** Same key AthleteProfileOnboarding hydrates its draft from. */
export const COACH_DRAFT_KEY = "w_coach_onboarding_draft_v2";

export interface OnboardingAnswers {
  primary_goal?: GoalId;
  sports?: string[];
  /** Raw frequency answer ("0" | "1-2" | "3-4" | "5+") — kept for analytics + copy. */
  training_freq?: string;
  struggle?: string;
}

export interface OnboardingOption {
  v: string;
  label: string;
  /** public/marks/<markFamily ?? onboarding>/<mark>.webp — the drawn glyph beside the option. */
  mark?: string;
  markFamily?: MarkFamily;
  desc?: string;
}

/** Question copy — goal reuses the Coach GOALS taxonomy, struggle/frequency
 *  reuse the proven waitlist-quiz options verbatim. */
export const GOAL_OPTIONS: OnboardingOption[] = [
  { v: "all",         label: "All-around",    mark: "goal-all", desc: "Strong, lean, sharp — balanced progress everywhere" },
  { v: "strength",    label: "Get stronger",  mark: "goal-strength", desc: "Lift heavier, build raw power" },
  { v: "hypertrophy", label: "Build muscle",  mark: "goal-hypertrophy", desc: "Visible size, lean mass" },
  { v: "fat_loss",    label: "Lose fat",      mark: "goal-fat_loss", desc: "Lean down, keep muscle" },
  { v: "endurance",   label: "Endurance",     mark: "goal-endurance", desc: "Run, ride, last longer" },
  { v: "longevity",   label: "Longevity",     mark: "goal-longevity", desc: "Health-span, energy 20 years out" },
  { v: "focus",       label: "Sharpen focus", mark: "goal-focus", desc: "Mind, deep work, sleep" },
];

export const STRUGGLE_OPTIONS: OnboardingOption[] = [
  { v: "consistency", mark: "struggle-consistency", label: "Can't stay consistent", desc: "I train for a week or two, then everyday life takes over." },
  { v: "no-plan",     mark: "struggle-no-plan", label: "No clear plan",         desc: "I never know exactly what to do next, so I improvise — or do nothing." },
  { v: "motivation",  mark: "struggle-motivation", label: "Motivation dies fast",  desc: "I rely on feeling motivated, and the feeling always fades." },
  { v: "busy",        mark: "struggle-busy", label: "Too busy",              desc: "Work and life eat my hours — training is the first thing to go." },
  { v: "quit",        mark: "struggle-quit", label: "I start strong, then quit", desc: "Every restart looks the same: all-in for a month, then nothing." },
  { v: "alone",       mark: "struggle-alone", label: "No one holds me to it", desc: "Nobody notices whether I show up or slip — so slipping is easy." },
];

export const FREQUENCY_OPTIONS: OnboardingOption[] = [
  { v: "0",   mark: "freq-0", label: "Not at all — yet" },
  { v: "1-2", mark: "freq-1-2", label: "1–2× a week" },
  { v: "3-4", mark: "freq-3-4", label: "3–4× a week" },
  { v: "5+",  mark: "freq-5+", label: "5+× a week" },
];

/** Current frequency → a REALISTIC starting training-days preference for the
 *  coach (days 0=Sun..6=Sat, matching training_days_pref). Deliberately one
 *  notch above "nothing", never a fantasy schedule. */
export const TRAINING_DAYS_MAP: Record<string, number[]> = {
  "0":   [1, 4],          // Mon + Thu — a gentle on-ramp
  "1-2": [1, 4],
  "3-4": [1, 3, 5],       // Mon/Wed/Fri
  "5+":  [1, 2, 3, 4, 5], // weekdays
};

/** The teach-screen headline speaks to the user's named struggle. */
export const STRUGGLE_PROMISES: Record<string, { title: string; sub: string }> = {
  consistency: { title: "Motivation fades. Systems don't.", sub: "One check-in a day turns showing up into a game you don't want to lose." },
  "no-plan":   { title: "You'll always know the next step.", sub: "Check in daily — your coach and program tell you exactly what to do." },
  motivation:  { title: "Built for the days you feel nothing.", sub: "Streaks, XP and your tribe carry you when the feeling is gone." },
  busy:        { title: "60 seconds a day still counts.", sub: "A check-in takes a minute. The streak it builds changes everything." },
  quit:        { title: "This time, the restart sticks.", sub: "Daily check-ins make progress visible before results are — that's what keeps you in." },
  alone:       { title: "From now on, someone notices.", sub: "Your coach, your tribe and your streak all see whether you showed up." },
};

const FALLBACK_PROMISE = { title: "Showing up is the whole game.", sub: "One check-in a day. XP, streaks and rank do the rest." };

export const strugglePromise = (struggle?: string) =>
  (struggle && STRUGGLE_PROMISES[struggle]) || FALLBACK_PROMISE;

/** Build the partial athlete-profile patch. Never sets `onboarded` — the
 *  Coach wizard still runs (pre-filled). Empty answers produce an empty
 *  patch so a full skip writes nothing. */
export const athletePatchFromAnswers = (a: OnboardingAnswers): Record<string, unknown> => {
  const patch: Record<string, unknown> = {};
  if (a.primary_goal) patch.primary_goal = a.primary_goal;
  if (a.sports && a.sports.length > 0) patch.sports = a.sports;
  if (a.training_freq && TRAINING_DAYS_MAP[a.training_freq]) {
    patch.training_days_pref = TRAINING_DAYS_MAP[a.training_freq];
  }
  return patch;
};

/** Merge answers into the Coach wizard's localStorage draft. Onboarding keys
 *  win over an existing draft (fresher), everything else is preserved, and
 *  the wizard's separate step key is never touched. */
export const mergeIntoCoachDraft = (
  a: OnboardingAnswers,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): void => {
  const patch = athletePatchFromAnswers(a);
  if (Object.keys(patch).length === 0) return;
  let existing: Record<string, unknown> = {};
  try {
    const raw = storage.getItem(COACH_DRAFT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) existing = parsed;
    }
  } catch { /* corrupt draft — overwrite with the fresh answers */ }
  try {
    storage.setItem(COACH_DRAFT_KEY, JSON.stringify({ ...existing, ...patch }));
  } catch { /* storage full/blocked — the RPC patch still carries the answers */ }
};
