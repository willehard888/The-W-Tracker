import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { captureEvent } from "@/lib/observability";

/**
 * Minimal, fail-open product analytics. Writes one row per event to the
 * `analytics_events` table (see migration). Used to instrument the activation
 * funnel — North Star = verified check-ins:
 *
 *   signup → healthkit_connected → checkin_verified
 *
 * RULES:
 * - Fire-and-forget: never await this in a way that blocks UX, and never throw.
 *   Analytics must not be able to break a user flow.
 * - Authenticated-only (RLS lets a user insert only their own rows).
 */
export async function track(
  event: string,
  props?: Record<string, unknown>,
  userId?: string,
): Promise<void> {
  // Mirror to PostHog (no-op until configured) for funnels + retention cohorts.
  captureEvent(event, props);
  try {
    let uid = userId;
    if (!uid) {
      // getSession reads local storage (no network) — cheap.
      const { data: { session } } = await supabase.auth.getSession();
      uid = session?.user?.id;
    }
    if (!uid) return;
    await supabase.from("analytics_events").insert({
      user_id: uid,
      event,
      // Event props are plain JSON-serializable literals at every call site.
      props: (props ?? null) as unknown as Json,
    });
  } catch {
    /* swallow — analytics is best-effort */
  }
}

// Funnel event names (keep stable; the dashboard queries depend on them).
// Activation funnel: signup → healthkit_connected → checkin_completed →
//                    checkin_verified → streak_milestone
// Monetization funnel: paywall_viewed → purchase_started →
//                    (purchase_completed | purchase_cancelled | purchase_failed)
export const FUNNEL = {
  signup: "signup",
  healthkitConnected: "healthkit_connected",
  checkinCompleted: "checkin_completed",
  checkinVerified: "checkin_verified",
  /** record_checkin failed after its retries — the user saw a toast, nobody else did.
   *  `{ network, reason, code }`, all from closed sets (lib/analytics-error.ts).
   *  It used to carry a 120-char slice of the raw Postgres message, which is a
   *  length cap and not a filter. */
  checkinFailed: "checkin_failed",
  /** An offline check-in came back after midnight and could not be logged for its day. */
  checkinSyncStale: "checkin_sync_stale",
  streakMilestone: "streak_milestone",
  // Monetization
  // Trial lifecycle — enables trial→paid conversion measurement, which was
  // previously impossible (no trial events existed at all).
  trialStarted: "trial_started",
  trialExpired: "trial_expired",
  paywallViewed: "paywall_viewed",
  purchaseStarted: "purchase_started",
  purchaseCompleted: "purchase_completed",
  purchaseCancelled: "purchase_cancelled",
  /** Ask to Buy / SCA: the purchase left the device and waits on someone else's
   *  approval. Counted separately or it reads as a loss in the funnel. */
  purchasePending: "purchase_pending",
  purchaseFailed: "purchase_failed",
  purchaseRestored: "purchase_restored",
  /** The store as the app saw it when the paywall opened (ids, labels, errors). */
  storeDiag: "store_diag",
  // Virality — feeds admin_virality() / k-factor
  inviteShared: "invite_shared",
  // Server-fired (notify-referral fn / revenuecat-webhook) — the viral loop:
  //   invite_shared → referral_joined → referral_converted
  referralJoined: "referral_joined",
  referralConverted: "referral_converted",
  // Server-fired lifecycle (webhooks) — kept here so the constant list stays
  // the single inventory of every event name in the table.
  subscriptionCancelled: "subscription_cancelled",
  // Server-fired push attribution (winback-lapsed / coach-proactive) — join
  // against app_opened to measure push→return. `push_sent` is written by the
  // shared APNs batch sender for EVERY push, one row per device with
  // { kind, ok, reason }; `push_opened` by the tap handlers on the device.
  // (`payment_failed` and `reminder_sent` were declared here for years with
  // no emitter — the admin page rendered a permanent zero for one of them.)
  winbackSent: "winback_sent",
  nudgeSent: "nudge_sent",
  pushSent: "push_sent",
  pushOpened: "push_opened",
  // Today's session by focus (coach-build-session): { focus, minutes, commit }.
  sessionBuilt: "session_built",
  // The coach's week, built on the client from the split: { days, minutes }.
  weekBuilt: "week_built",
  // A hand edit to a program: { op: rest|train|swap|add|remove|manual_start|repeat, scope, source: program|runner, via: coach|manual }.
  programEdited: "program_edited",
  // A neglected muscle group was taken up: { focus, surface: sheet|picker }.
  balanceSuggestionUsed: "balance_suggestion_used",

  // The workout itself. This app is a training app and, until the pilot, a
  // finished workout fired NOTHING: Workouts.tsx did not import analytics at
  // all, and the only proxy was program_edited. Both events are fired from
  // use-workout-session.ts rather than the page, so the auto-finish path (every
  // set logged, no button) counts the same as the button — and both are fired
  // once, not on every reopen of the same row.
  //
  // There is deliberately no workout_abandoned. A session is abandoned when the
  // app is killed, which is exactly when a client event does not arrive; it is
  // read instead from coach_program_logs (status in_progress, stale started_at),
  // where the evidence actually is.
  workoutStarted: "workout_started",
  workoutCompleted: "workout_completed",

  // "+30 s" during rest. `overdue` says whether the clock had already run out
  // when they reached for it — which is the interesting half, because that is
  // the case that used to hand back less than thirty seconds, and it tells us
  // whether two minutes is the right default rest at all.
  restExtended: "rest_extended",

  // The coach, which was equally dark. `turn` is the message number in the
  // thread; the message text never leaves the device and is not stored server
  // side at all. coach_answer_rated is the pilot's only direct read on whether
  // an AI answer was any good — the same shape meal_scan_reviews already uses
  // for the scanner.
  coachMessageSent: "coach_message_sent",
  coachAnswerRated: "coach_answer_rated",

  // Evening reflection: a whole feature that looked unused because nothing
  // counted it. Never the reflection text.
  reflectionSubmitted: "reflection_submitted",

  // The athlete-profile wizard — the multi-step run a new member meets right
  // after signup, and the one place we could not see where they dropped.
  athleteProfileStep: "athlete_profile_step",
  athleteProfileDone: "athlete_profile_done",
  // Recovery, as one funnel. The pilot's question is how many finished
  // workouts turn into a recovery session that is actually finished, so the
  // spine is offered → opened → started → completed, with dismissed and
  // skipped as the two ways out. `source` is post_workout | rest_day | manual
  // on every one of them. No health data rides along: `areas` are muscle
  // names, never sleep, heart rate or soreness.
  //
  // That last word was not true until 2026-09-25: `soreness` rode along in
  // started/completed and the same value rode in session_built as `feel`, so
  // a self-reported body state reached a third party on every session. Both
  // are gone. Soreness still shapes the session on the device
  // (lib/recovery/build-session.ts) — it just never leaves it, and
  // pilot-leakage.test.ts fails the build if it comes back.
  recoveryOffered: "recovery_offered",
  recoveryDismissed: "recovery_dismissed",
  recoveryOpened: "recovery_opened",
  recoveryStarted: "recovery_started",
  recoveryCompleted: "recovery_completed",
  recoverySkipped: "recovery_skipped",
  // Which movements get replaced, and by what — the pilot question is whether
  // one keeps coming back, which is a library problem and not a user one.
  recoverySwapped: "recovery_swapped",
  // The Vault's practice loop: a piece opened, understood (Mark complete),
  // its reflection answered, its practice run (server-recorded, +XP), its
  // integration answered; and a path walked to the end. Props carry
  // { slug, master, path } — never the reflection text.
  vaultOpened: "vault_opened",
  lessonOpened: "lesson_opened",
  lessonCompleted: "lesson_completed",
  vaultReflected: "vault_reflected",
  vaultPracticed: "vault_practiced",
  vaultIntegrated: "vault_integrated",
  pathCompleted: "path_completed",
  // Activation spine (Growth Engine): every step a user can drop from.
  onboardingViewed: "onboarding_viewed",
  onboardingStep: "onboarding_step",
  onboardingDone: "onboarding_done",
  onboardingSkipped: "onboarding_skipped",
  // Contextual spotlight onboarding (post-signup coach-marks) — the event
  // id rides in properties.event so one funnel covers all cards.
  spotlightSeen: "onboarding_spotlight_seen",
  spotlightCompleted: "onboarding_spotlight_completed",
  spotlightSkipped: "onboarding_spotlight_skipped",
  spotlightFailed: "onboarding_spotlight_failed",
  appOpened: "app_opened",
  pushPermission: "push_permission",
  healthkitPromptShown: "healthkit_prompt_shown",
  // Anonymous top-of-funnel — fired via log_anon_event RPC (allowlisted
  // server-side), user_id NULL. The only pre-auth events that exist.
  landingViewed: "landing_viewed",
  authViewed: "auth_viewed",
  signupSubmitted: "signup_submitted",
} as const;

/**
 * Anonymous top-of-funnel event (pre-auth). Goes through the allowlisted
 * log_anon_event SECURITY DEFINER RPC — plain track() drops anon events by
 * design. Fail-open like everything else here.
 */
export async function trackAnon(
  event: "landing_viewed" | "auth_viewed" | "signup_submitted",
): Promise<void> {
  captureEvent(event);
  try {
    await supabase.rpc("log_anon_event", { _event: event });
  } catch {
    /* best-effort */
  }
}
