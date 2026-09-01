import { useMemo } from "react";
import { useAthleteProfile, type ToneId } from "@/hooks/use-athlete-profile";
import { useDailyPlan } from "@/hooks/use-daily-plan";

/**
 * useCoachObservation — returns one short Coach-voiced sentence derived
 * from data the app already has (LifeOS brief, daily plan, athlete profile).
 *
 * Deterministic templating — NO edge-function call. Cheap to consume on
 * many surfaces (home, profile, post-checkin, banners). If we later want
 * a real AI-generated observation we swap the body of this hook without
 * touching any call site.
 *
 * The four `tone_pref` voices match the persona block in the edge
 * functions so the same line reads identically whether the user reads it
 * inline on home or in a chat reply on /coach.
 */

export type CoachObservationContext =
  | "home"
  | "post-checkin"
  | "profile"
  | "streak-risk";

interface UseCoachObservationOptions {
  context: CoachObservationContext;
  /** Optional fact the caller wants reflected — e.g. last sleep hours, today's workout flag. */
  extras?: Record<string, string | number | boolean | null | undefined>;
}

interface CoachObservation {
  /** Ready-to-render Coach line. Always non-empty unless `enabled` is false. */
  text: string;
  /** True until the underlying hooks have hydrated; UI can hide until then. */
  isLoading: boolean;
  /**
   * Today's plan progress, passed straight through from the useDailyPlan call
   * this hook already makes.
   *
   * Exposed rather than left for callers to fetch themselves: useDailyPlan
   * opens a realtime channel per mount by design (uniqueChannelName appends a
   * UUID), so a consumer calling it *alongside* this hook doubles the live
   * subscriptions and invalidations on the same screen. Reading them from here
   * keeps Home to one.
   */
  readiness: number | null;
  headline: string | null;
  missionsDone: number;
  missionsTotal: number;
}

const isMeaningful = (s: string | null | undefined): s is string =>
  typeof s === "string" && s.trim().length > 0;

/**
 * Map (tone, context) → small bank of one-liner templates. The template
 * may include {focus} (today's brief headline) or {adjust} (push/hold/etc).
 * Templates are short on purpose — CoachLine caps at 180 chars and we
 * want most lines to fit one row on a phone.
 */
const TEMPLATES: Record<ToneId, Record<CoachObservationContext, string[]>> = {
  calm_mentor: {
    home: [
      "Today's focus: {focus}. Move with that, nothing else.",
      "{focus}. Keep it small, keep it daily.",
      "One thing today: {focus}. The rest can wait.",
    ],
    "post-checkin": [
      "Logged. {focus} — protect it tomorrow.",
      "Solid. {focus} carries you through the week.",
      "Noted. Stay with {focus} — one day at a time.",
    ],
    profile: [
      "This week reads steady. {focus} is the through-line.",
      "You showed up. {focus} is where you keep building.",
      "Quiet consistency. {focus} compounds.",
    ],
    "streak-risk": [
      "That streak is your identity now. Don't lose it on a tired Tuesday.",
      "Short window left. One small action protects everything.",
      "Three hours to log. That's all today asks.",
    ],
  },
  drill_sergeant: {
    home: [
      "Focus: {focus}. Move. Now.",
      "{focus}. No debate. Execute.",
      "One target: {focus}. Lock in.",
    ],
    "post-checkin": [
      "Logged. {focus} tomorrow — same hour. No drift.",
      "Done. {focus} is the order for tomorrow.",
      "Good. {focus} — and don't miss it.",
    ],
    profile: [
      "Pattern's clear: {focus}. Hold the line.",
      "You showed up. Now hold {focus} another week.",
      "Discipline's working. {focus}. Repeat.",
    ],
    "streak-risk": [
      "Streak's on the line. Get the rep in. NOW.",
      "Hours left. No excuses. Log it.",
      "You don't break here. Move.",
    ],
  },
  scientist: {
    home: [
      "Today's lever: {focus} — highest leverage on your data right now.",
      "{focus} — small dose, daily, drives the slope.",
      "Today's signal points at {focus}. Act on it.",
    ],
    "post-checkin": [
      "Logged. {focus} compounds — protect dose tomorrow.",
      "Done. Variance up; {focus} stabilises it.",
      "Recorded. Maintain {focus} for the trend to hold.",
    ],
    profile: [
      "7-day trend: rising. {focus} is the driver — keep dose.",
      "Slope positive. {focus} explains most of it.",
      "Stable week. {focus} is the variable to hold.",
    ],
    "streak-risk": [
      "Risk window. One log shifts the trend back to positive.",
      "Streak variance high. Action now is the cheapest intervention.",
      "Skip cost ≈ 14% to streak slope. Worth a 5-minute log.",
    ],
  },
  hype: {
    home: [
      "Today's heat: {focus}. Light it up.",
      "{focus}. THIS is the day. Go.",
      "One mission: {focus}. Crush it.",
    ],
    "post-checkin": [
      "Logged. {focus} tomorrow — same fire.",
      "Done and dusted. {focus} keeps the streak alive.",
      "Locked in. {focus} — stack another day.",
    ],
    profile: [
      "You're cooking. {focus} is the pattern — keep building.",
      "This week? Real. {focus} is the next rep.",
      "Solid week. {focus} — let's stack another.",
    ],
    "streak-risk": [
      "STREAK ALERT. One quick log saves everything.",
      "Don't break the chain. 5 minutes. Go.",
      "Heat's still there. Log it before the clock kills it.",
    ],
  },
};

/**
 * Pick a deterministic template index so the line doesn't flicker on each
 * re-render but still varies across days. Use the date string as the seed.
 */
const pickIndex = (seedDate: string, bucket: number): number => {
  let h = 0;
  for (let i = 0; i < seedDate.length; i++) h = (h * 31 + seedDate.charCodeAt(i)) | 0;
  return Math.abs(h) % Math.max(1, bucket);
};

export const useCoachObservation = ({ context }: UseCoachObservationOptions): CoachObservation => {
  const { profile, isLoading: profileLoading } = useAthleteProfile();
  const { plan, done, total, isLoading: planLoading } = useDailyPlan();

  const isLoading = profileLoading || planLoading;

  const text = useMemo(() => {
    const tone = (profile?.tone_pref ?? "calm_mentor") as ToneId;
    const bank = TEMPLATES[tone]?.[context] ?? TEMPLATES.calm_mentor[context];
    if (!bank?.length) return "";

    const seed = new Date().toISOString().slice(0, 10);
    const tmpl = bank[pickIndex(`${seed}-${context}`, bank.length)];

    // {focus} resolves from the daily plan headline (the LifeOS brief source
    // was removed — its edge function was dead: never generated, broken
    // column select; Whealth OS snapshots supersede it).
    const focus =
      (isMeaningful(plan?.headline) && plan!.headline) ||
      "showing up daily";

    return tmpl.replace("{focus}", focus).replace("{adjust}", plan?.adjustment ?? "hold");
  }, [profile?.tone_pref, plan?.headline, plan?.adjustment, context]);

  return {
    text,
    isLoading,
    readiness: plan?.readiness_score ?? null,
    headline: plan?.headline ?? null,
    missionsDone: done,
    missionsTotal: total,
  };
};
