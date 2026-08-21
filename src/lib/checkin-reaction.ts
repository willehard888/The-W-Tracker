// Post-check-in coach reaction — shared fetch + query key.
//
// The key deliberately does NOT depend on the record_checkin RESPONSE
// (old key used newTotalXp/newStreak), so DailyCheckin can prefetch the AI
// reaction at submit time with predicted values and run it IN PARALLEL with
// the check-in RPC — the summary screen then hits a warm cache instead of
// starting a 1–8s round-trip on mount.

import { supabase } from "@/integrations/supabase/client";
import { localDateStr } from "@/lib/offline-checkin";

/** One reaction per user per local day. */
export const checkinReactionKey = (userId: string) =>
  ["checkin-reaction", userId, localDateStr()] as const;

export interface CheckinReactionBody {
  xp_earned: number;
  tasks_done: number;
  tasks_total: number;
  streak: number;
  /** Habit KEYS completed/missed today (server whitelists + maps to labels).
   *  Sent by the submit-time prefetch — today's row isn't in the DB yet at
   *  that point, so the body is the only source of today's per-habit truth. */
  done_keys?: string[];
  missed_keys?: string[];
}

const TIMEOUT_MS = 12_000;
const TIMED_OUT = Symbol("timeout");

/**
 * Invoke coach-reaction with a hard timeout (Promise.race — functions.invoke
 * has no reliable abort support). Every failure (offline, non-member 403,
 * provider down, timeout) resolves to null — the caller's deterministic
 * template line stays, the celebration never breaks.
 */
export const fetchCheckinReaction = async (
  body: CheckinReactionBody,
): Promise<string | null> => {
  try {
    const result = await Promise.race([
      supabase.functions.invoke("coach-reaction", { body }),
      new Promise<typeof TIMED_OUT>((resolve) =>
        setTimeout(() => resolve(TIMED_OUT), TIMEOUT_MS),
      ),
    ]);
    if (result === TIMED_OUT) return null;
    const { data, error } = result;
    if (error) return null;
    const t = (data as { text?: string } | null)?.text;
    return typeof t === "string" && t.trim() ? t.trim() : null;
  } catch {
    return null;
  }
};
