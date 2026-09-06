// Contextual onboarding — shared types (Onboarding Blueprint §2/§4).

export const ONBOARDING_EVENT_IDS = [
  "TODAY_INTRO",
  "CHECKIN_INTRO",
  "XP_INTRO",
  "STREAK_INTRO",
  "STREAK_SHIELD_INTRO",
  "PROGRESSION_INTRO",
  "AI_COACH_INTRO",
  "COACH_MISSION_INTRO",
  "SQUAD_INTRO",
  "RANKS_INTRO",
  // Training. Five moments, not fourteen: the session cap is 2 cards per app
  // launch, and everything else an athlete needs to learn is taught inline by
  // the runner itself — a line under "3 × 8", the rest timer's own label, the
  // progress bar. A card is for what a surface cannot say about itself.
  "TRAINING_PROGRAM_READY",
  "FIRST_WORKOUT_INTRO",
  "WORKOUT_LOGGING_INTRO",
  "WORKOUT_COMPLETE_INTRO",
  "PROGRAM_ADAPTS_INTRO",
] as const;

export type OnboardingEventId = (typeof ONBOARDING_EVENT_IDS)[number];

export interface OnboardingEventDef {
  id: OnboardingEventId;
  /** "spotlight" wants a target rect; "sheet" always uses the bottom sheet;
   *  "none" is bookkeeping only (an existing surface already teaches it). */
  presentation: "spotlight" | "sheet" | "none";
  title: string;
  body: string;
  cta: string;
  /** Chaining HINT: shown next only if its own trigger is already live —
   *  never a hard dependency (skipping one never blocks siblings). */
  chainsTo?: OnboardingEventId;
  /** Ordering guard: don't show until this event is completed OR skipped
   *  (mount order races children ahead of parents otherwise). The next
   *  natural trigger — chain or next visit — re-asks, so nothing is lost. */
  prerequisite?: OnboardingEventId;
  /** Spotlight target missing after polling → "sheet" fallback or silent skip. */
  fallback: "sheet" | "skip";
  /** AI_COACH_INTRO: compliance disclosure — backdrop tap must not dismiss. */
  backdropDismiss: boolean;
}

/** Persisted shape of profiles.onboarding_state ('{}' for fresh users). */
export interface OnboardingState {
  version: number;
  status: "not_started" | "in_progress" | "completed" | "skipped_all";
  seen: Record<string, string>;
  completed: Record<string, string>;
  skipped: Record<string, string>;
  failed: Record<string, { at: string; count: number }>;
  grandfathered: boolean;
  updatedAt: string | null;
}

export const FAILED_ATTEMPT_CAP = 3;
