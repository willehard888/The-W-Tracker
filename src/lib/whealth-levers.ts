/**
 * Whealth levers — for every pillar sub-signal, the concrete in-app action
 * that moves it. Pure data; the PillarSheet picks levers for the weakest
 * (or missing) sub-signals so "your score is 62" always comes with
 * "here is the lever".
 */
import type { PillarScores } from "@/lib/whealth-index";

export interface WhealthLever {
  /** Sub-signal this lever moves; "*" = applies to the whole pillar. */
  partKey: string;
  title: string;
  detail: string;
  action: { label: string; path: string };
}

export const WHEALTH_LEVERS: Record<keyof PillarScores, WhealthLever[]> = {
  sleep: [
    {
      partKey: "duration",
      title: "Protect a 7.5–9h window",
      detail: "Set a hard lights-out time tonight — duration is the highest-weight sleep signal.",
      action: { label: "Sleep lesson", path: "/vault?lesson=sleep-7-9-hours" },
    },
    {
      partKey: "consistency",
      title: "Same bedtime ±30 min",
      detail: "Your body keeps time better than any alarm — consistency beats duration heroics.",
      action: { label: "Evening release", path: "/vault?lesson=letting-go" },
    },
    {
      partKey: "stages",
      title: "Deep-sleep hygiene",
      detail: "Cool room, no late screens, last meal 3h before bed — deep + REM share follows.",
      action: { label: "Recovery course", path: "/vault" },
    },
  ],
  recovery: [
    {
      partKey: "rhr",
      title: "Tag last night's factors",
      detail: "Alcohol, late screens and stress show up in resting HR — tag nights so patterns surface.",
      action: { label: "Open recovery card", path: "/profile" },
    },
    {
      partKey: "rest",
      title: "Schedule one full rest day",
      detail: "At least one true rest day per week is what lets the training actually land.",
      action: { label: "Ask your coach", path: "/coach" },
    },
    {
      partKey: "hrv",
      title: "Downshift daily",
      detail: "Five physiological sighs a day nudge HRV — the cheapest recovery lever there is.",
      action: { label: "Energy lesson", path: "/vault?lesson=elevate-your-energy" },
    },
  ],
  movement: [
    {
      partKey: "frequency",
      title: "Lock 3-4 sessions this week",
      detail: "Frequency is the highest-weight movement signal — put the sessions in the calendar now.",
      action: { label: "Exercise library", path: "/exercises" },
    },
    {
      partKey: "steps",
      title: "Walk the gaps",
      detail: "8-9k steps/day comes from walking the small gaps: calls, commutes, coffee.",
      action: { label: "Check in today", path: "/checkin" },
    },
    {
      partKey: "progression",
      title: "Add one rep or 2.5 kg",
      detail: "A stalled lift needs one small overload — log your sets so PRs get counted.",
      action: { label: "Ask your coach", path: "/coach" },
    },
  ],
  nutrition: [
    {
      partKey: "protein",
      title: "Protein first, every meal",
      detail: "30-40g per meal is the floor — batch it once and the week takes care of itself.",
      action: { label: "Meal-prep recipes", path: "/recipes" },
    },
    {
      partKey: "hydration",
      title: "Front-load 1L before noon",
      detail: "Hydration scores climb fastest when the first liter lands before lunch.",
      action: { label: "Check in today", path: "/checkin" },
    },
    {
      partKey: "food",
      title: "One whole-food swap a day",
      detail: "Swap one processed item for a whole-food option — the hit-rate compounds.",
      action: { label: "Meal-prep recipes", path: "/recipes" },
    },
  ],
  mind: [
    {
      partKey: "meditation",
      title: "Two minutes, same time daily",
      detail: "Meditation days are the highest-weight mind signal — anchor it to an existing habit.",
      action: { label: "Check in today", path: "/checkin" },
    },
    {
      partKey: "mood",
      title: "Coach yourself by name",
      detail: "Distanced self-talk measurably lifts regulation on hard days.",
      action: { label: "Self-talk lesson", path: "/vault?lesson=distanced-self-talk" },
    },
    {
      partKey: "energy",
      title: "State before task",
      detail: "Breath, posture, one track — 5 minutes of state work beats an hour of grinding.",
      action: { label: "Energy lesson", path: "/vault?lesson=elevate-your-energy" },
    },
  ],
  inner: [
    {
      partKey: "lessons",
      title: "One Inner Work lesson",
      detail: "The Inner Work course is built exactly for this pillar — 5 minutes per lesson.",
      action: { label: "Start the course", path: "/vault?lesson=inner-operating-system" },
    },
    {
      partKey: "journaling",
      title: "Three good things tonight",
      detail: "Write the win and the friction after your check-in — reflection depth is scored.",
      action: { label: "Reflect now", path: "/coach/reflect" },
    },
    {
      partKey: "identity",
      title: "Write your \"I am\"",
      detail: "One present-tense sentence your daily votes can support — the coach anchors to it.",
      action: { label: "Athlete profile", path: "/coach/profile" },
    },
    {
      partKey: "connection",
      title: "Join or start a tribe",
      detail: "Accountability is a measured sub-signal — one tribe or three friends moves it.",
      action: { label: "Find your squad", path: "/squad" },
    },
  ],
};

/** Levers for a pillar, weakest sub-signals first (missing data counts as weakest). */
export function pickLevers(
  pillar: keyof PillarScores,
  parts: Array<{ key: string; score: number | null }>,
  count = 2,
): WhealthLever[] {
  const levers = WHEALTH_LEVERS[pillar] ?? [];
  const ranked = [...parts].sort((a, b) => (a.score ?? -1) - (b.score ?? -1));
  const out: WhealthLever[] = [];
  for (const part of ranked) {
    const lever = levers.find((l) => l.partKey === part.key && !out.includes(l));
    if (lever) out.push(lever);
    if (out.length >= count) return out;
  }
  for (const lever of levers) {
    if (!out.includes(lever)) out.push(lever);
    if (out.length >= count) break;
  }
  return out;
}
