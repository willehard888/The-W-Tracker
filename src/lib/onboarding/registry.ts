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
    title: "Today's missions",
    body: "A few missions a day build the program.",
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
};
