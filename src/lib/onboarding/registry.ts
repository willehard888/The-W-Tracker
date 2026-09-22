// Contextual onboarding — the event registry (Onboarding Blueprint §2).
// Copy comes from the blueprint table verbatim: one card teaches exactly
// one concept. Triggers live in the owning components (they call
// requestShow); this registry owns presentation + copy only.
import type { OnboardingEventDef, OnboardingEventId } from "./types";

export const ONBOARDING_EVENTS: Record<OnboardingEventId, OnboardingEventDef> = {
  TODAY_INTRO: {
    id: "TODAY_INTRO",
    presentation: "sheet",
    title: "This is Today.",
    body: "Everything happens here — one screen a day.",
    cta: "Let's go",
    chainsTo: "CHECKIN_INTRO",
    fallback: "sheet",
    backdropDismiss: true,
  },
  CHECKIN_INTRO: {
    id: "CHECKIN_INTRO",
    presentation: "spotlight",
    title: "Lock your day",
    body: "Banks your Core 4, earns XP, keeps the streak.",
    cta: "Got it",
    // CommandDeck's effect runs before Index's (children first) — without
    // this guard the check-in card wins the race against "This is Today".
    prerequisite: "TODAY_INTRO",
    fallback: "sheet",
    backdropDismiss: true,
  },
  XP_INTRO: {
    id: "XP_INTRO",
    presentation: "spotlight",
    title: "That's XP",
    body: "Every habit earns it; sleep quality scales the total.",
    cta: "Nice",
    fallback: "skip",
    backdropDismiss: true,
  },
  STREAK_INTRO: {
    id: "STREAK_INTRO",
    presentation: "spotlight",
    title: "Your streak",
    body: "Check in daily — one missed calendar day resets it.",
    cta: "Got it",
    chainsTo: "PROGRESSION_INTRO",
    fallback: "skip",
    backdropDismiss: true,
  },
  // Bookkeeping only: ShieldEarnedSheet's existing copy already teaches the
  // concept — we just record that the moment happened.
  STREAK_SHIELD_INTRO: {
    id: "STREAK_SHIELD_INTRO",
    presentation: "none",
    title: "",
    body: "",
    cta: "",
    fallback: "skip",
    backdropDismiss: true,
  },
  PROGRESSION_INTRO: {
    id: "PROGRESSION_INTRO",
    presentation: "spotlight",
    title: "Level up",
    body: "XP climbs tiers — Recruit to Legend.",
    cta: "Got it",
    fallback: "skip",
    backdropDismiss: true,
  },
  AI_COACH_INTRO: {
    id: "AI_COACH_INTRO",
    presentation: "sheet",
    title: "Meet your AI Coach",
    body: "AI-powered. It guides training and recovery — never a medical substitute.",
    cta: "Continue",
    chainsTo: "COACH_MISSION_INTRO",
    fallback: "sheet",
    // Compliance-sensitive disclosure: backdrop tap doesn't dismiss (X does).
    backdropDismiss: false,
  },
  COACH_MISSION_INTRO: {
    id: "COACH_MISSION_INTRO",
    presentation: "spotlight",
    title: "Today's reminders",
    body: "The coach reads your check-in — nothing to tick here.",
    cta: "Got it",
    fallback: "skip",
    backdropDismiss: true,
  },
  SQUAD_INTRO: {
    id: "SQUAD_INTRO",
    presentation: "spotlight",
    title: "Your Squad",
    body: "Feed for the pulse, Tribes for the close crew.",
    cta: "Got it",
    fallback: "sheet",
    backdropDismiss: true,
  },
  RANKS_INTRO: {
    id: "RANKS_INTRO",
    presentation: "spotlight",
    title: "Where you rank",
    body: "Season resets, All-Time is permanent — both earned.",
    cta: "Got it",
    fallback: "sheet",
    backdropDismiss: true,
  },

  // ── Training ────────────────────────────────────────────────────────────
  // The plan is the payoff for a 25-second wait; without a word here the
  // athlete lands in a collapsed four-week accordion.
  TRAINING_PROGRAM_READY: {
    id: "TRAINING_PROGRAM_READY",
    presentation: "sheet",
    title: "Your program is built",
    body: "Shaped around your goal and your days. Any day or movement can be changed by hand.",
    cta: "Show me",
    fallback: "sheet",
    backdropDismiss: true,
  },
  // Chained, so the two together count as ONE teaching moment against the
  // per-launch cap — a first workout is a single beat, not two interruptions.
  FIRST_WORKOUT_INTRO: {
    id: "FIRST_WORKOUT_INTRO",
    presentation: "sheet",
    title: "One set at a time",
    body: "Work down the list. Log what you lift — the next session starts from it.",
    cta: "Start",
    chainsTo: "WORKOUT_LOGGING_INTRO",
    fallback: "sheet",
    backdropDismiss: true,
  },
  WORKOUT_LOGGING_INTRO: {
    id: "WORKOUT_LOGGING_INTRO",
    presentation: "spotlight",
    title: "Weight × reps",
    body: "Whatever you actually did. Rounding up helps nobody — least of all next week.",
    cta: "Got it",
    // The runner mounts its set rows after the plan resolves; without this the
    // spotlight would race the first set and measure an empty rect.
    prerequisite: "FIRST_WORKOUT_INTRO",
    fallback: "skip",
    backdropDismiss: true,
  },
  WORKOUT_COMPLETE_INTRO: {
    id: "WORKOUT_COMPLETE_INTRO",
    presentation: "sheet",
    title: "That counts twice",
    body: "The session is saved, and your check-in already knows you trained.",
    cta: "Good",
    chainsTo: "RECOVERY_INTRO",
    fallback: "sheet",
    backdropDismiss: true,
  },
  // ── Recovery ────────────────────────────────────────────────────────────
  // Chained off the workout-complete card, so the pair counts as ONE teaching
  // moment against the per-launch cap. Finishing a first workout is a single
  // beat; two sheets in a row on one screen is an interruption.
  RECOVERY_INTRO: {
    id: "RECOVERY_INTRO",
    presentation: "sheet",
    title: "Built from what you trained",
    body: "Whealth reads the sets you logged and puts a few minutes together for the areas that took the load. Start it, or save it for later — it keeps until tonight.",
    cta: "Got it",
    prerequisite: "WORKOUT_COMPLETE_INTRO",
    fallback: "sheet",
    backdropDismiss: true,
  },
  RECOVERY_REST_DAY_INTRO: {
    id: "RECOVERY_REST_DAY_INTRO",
    presentation: "sheet",
    title: "Rest days have something in them",
    body: "Short mobility built from your last couple of sessions. A rest day is still a training day for the rest of you.",
    cta: "Got it",
    fallback: "sheet",
    backdropDismiss: true,
  },
  PROGRAM_ADAPTS_INTRO: {
    id: "PROGRAM_ADAPTS_INTRO",
    presentation: "spotlight",
    title: "A week in",
    body: "Next week's loads start from what you logged. Swap a movement or rest a day whenever the week asks for it.",
    cta: "Got it",
    fallback: "skip",
    backdropDismiss: true,
  },
};
