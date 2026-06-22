import { supabase } from "@/integrations/supabase/client";

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
  try {
    let uid = userId;
    if (!uid) {
      // getSession reads local storage (no network) — cheap.
      const { data: { session } } = await supabase.auth.getSession();
      uid = session?.user?.id;
    }
    if (!uid) return;
    await supabase.from("analytics_events" as any).insert({
      user_id: uid,
      event,
      props: props ?? null,
    });
  } catch {
    /* swallow — analytics is best-effort */
  }
}

// Funnel event names (keep stable; the dashboard queries depend on them).
export const FUNNEL = {
  signup: "signup",
  healthkitConnected: "healthkit_connected",
  checkinVerified: "checkin_verified",
} as const;
