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
  purchaseFailed: "purchase_failed",
  purchaseRestored: "purchase_restored",
  // Virality — feeds admin_virality() / k-factor
  inviteShared: "invite_shared",
  // Server-fired (notify-referral fn / revenuecat-webhook) — the viral loop:
  //   invite_shared → referral_joined → referral_converted
  referralJoined: "referral_joined",
  referralConverted: "referral_converted",
  // Server-fired lifecycle (webhooks) — kept here so the constant list stays
  // the single inventory of every event name in the table.
  subscriptionCancelled: "subscription_cancelled",
  paymentFailed: "payment_failed",
  // Server-fired push attribution (winback-lapsed / daily-reminder /
  // coach-proactive) — join against app_opened to measure push→return.
  winbackSent: "winback_sent",
  reminderSent: "reminder_sent",
  nudgeSent: "nudge_sent",
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
