// Offline check-in queue — the check-in is the ONE action that defines the app,
// and it was lost if the network dropped mid-submit. We persist a failed
// submission to localStorage and replay it (record_checkin is idempotent per
// local calendar day, so replay can never double-log) when connectivity returns.
import type { SupabaseClient } from "@supabase/supabase-js";

const KEY = "pending_checkin_v1";

export interface PendingCheckin {
  args: Record<string, unknown>;
  localDate: string; // YYYY-MM-DD in local time, to drop stale next-day replays
  queuedAt: number;
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

export const queueCheckin = (args: Record<string, unknown>): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ args, localDate: localDateStr(), queuedAt: Date.now() }));
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

export type FlushResult = "synced" | "already" | "none" | "failed";

/** Replay a queued check-in. Drops a stale (previous-day) queue without replaying. */
export async function flushPendingCheckin(supabase: SupabaseClient): Promise<FlushResult> {
  const p = getPendingCheckin();
  if (!p) return "none";
  // Never log yesterday's queued check-in as today's — drop it.
  if (p.localDate !== localDateStr()) { clearPendingCheckin(); return "none"; }

  const { error } = await supabase.rpc("record_checkin" as never, p.args as never);
  if (!error) { clearPendingCheckin(); return "synced"; }
  if (error.message?.includes("ALREADY_CHECKED_IN_TODAY")) { clearPendingCheckin(); return "already"; }
  return "failed"; // keep it; try again on the next online/resume tick
}
