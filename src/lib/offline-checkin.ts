// Offline check-in queue — the check-in is the ONE action that defines the app,
// and it was lost if the network dropped mid-submit. We persist a failed
// submission to localStorage and replay it (record_checkin is idempotent per
// local calendar day, so replay can never double-log) when connectivity returns.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type RecordCheckinArgs = Database["public"]["Functions"]["record_checkin"]["Args"];

const KEY = "pending_checkin_v1";

export interface PendingCheckin {
  args: RecordCheckinArgs;
  localDate: string; // YYYY-MM-DD in local time, to drop stale next-day replays
  queuedAt: number;
  userId?: string; // never replay one user's queue as another user
}

/** Local calendar date (YYYY-MM-DD) — matches the record_checkin window model. */
export const localDateStr = (): string => new Date().toLocaleDateString("en-CA");

export const getPendingCheckin = (): PendingCheckin | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingCheckin) : null;
  } catch {
    return null;
  }
};

export const queueCheckin = (args: RecordCheckinArgs, userId?: string): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ args, localDate: localDateStr(), queuedAt: Date.now(), userId }));
  } catch { /* storage full / unavailable — nothing we can do */ }
};

export const clearPendingCheckin = (): void => {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
};

/** True for errors that mean "the request never reached the server" (replayable). */
export const isNetworkError = (err: { message?: string } | null): boolean => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const m = err?.message?.toLowerCase() ?? "";
  return /failed to fetch|networkerror|network request failed|load failed|timeout|fetch/.test(m);
};

export type FlushResult = "synced" | "already" | "none" | "failed" | "stale";

/** Replay a queued check-in. Same-local-day only — see the stale note below. */
export async function flushPendingCheckin(supabase: SupabaseClient): Promise<FlushResult> {
  const p = getPendingCheckin();
  if (!p) return "none";
  // Genuinely abandoned queue — drop silently.
  if (Date.now() - p.queuedAt > 36 * 60 * 60 * 1000) { clearPendingCheckin(); return "none"; }
  // record_checkin timestamps the row with server now(), so a queue replayed on
  // a LATER local day is recorded as THAT day's check-in — spending a shield or
  // breaking the streak for the gap, and blocking the new day's real check-in.
  // A short grace window still covers the 23:58 → 00:02 midnight crossing
  // (deliberate, regression-locked); anything older on a different day is
  // reported "stale" so the UI can be honest instead of claiming it synced.
  const crossedDay = p.localDate !== localDateStr();
  const ageMs = Date.now() - p.queuedAt;
  if (crossedDay && ageMs > 3 * 60 * 60 * 1000) { clearPendingCheckin(); return "stale"; }
  // Never replay one user's queued check-in under another account (shared device).
  if (p.userId) {
    const { data } = await supabase.auth.getUser();
    if (data.user && data.user.id !== p.userId) return "none"; // keep; expires via date guard
  }

  const { error } = await supabase.rpc("record_checkin", p.args);
  if (!error) { clearPendingCheckin(); return "synced"; }
  if (error.message?.includes("ALREADY_CHECKED_IN_TODAY")) { clearPendingCheckin(); return "already"; }
  return "failed"; // keep it; try again on the next online/resume tick
}
