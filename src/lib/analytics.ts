import { supabase } from "@/integrations/supabase/client";
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
      props: props ?? null,
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
  paywallViewed: "paywall_viewed",
  purchaseStarted: "purchase_started",
  purchaseCompleted: "purchase_completed",
  purchaseCancelled: "purchase_cancelled",
  purchaseFailed: "purchase_failed",
  purchaseRestored: "purchase_restored",
} as const;
