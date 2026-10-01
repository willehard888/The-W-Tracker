// The pilot's data layer.
//
// FAIL OPEN, ALWAYS
//
// Every member-side call here swallows its error and returns the inert answer.
// This is not defensive habit — it is the design. If pilot_context() is ever
// missing or refuses, this returns { is_pilot: false } and the entire pilot
// layer is simply dark. That is the same state every non-pilot user is in, so
// there is no broken state to be in: the feature is either switched on by the
// server or it does not exist.
//
// (Until 2026-09-29 this file carried a hand-written adapter over `supabase`
// because the generated types did not know migration 20260929090000. They do
// now; the calls go straight through.)

import { supabase } from "@/integrations/supabase/client";
import { captureException } from "@/lib/observability";

/** Exactly what pilot_context() returns. */
export interface PilotContext {
  is_pilot: boolean;
  cohort: string | null;
  day: number;
  observe_days: number;
  in_window: boolean;
  redeemed_at: string | null;
}

export const NOT_IN_PILOT: PilotContext = {
  is_pilot: false,
  cohort: null,
  day: 0,
  observe_days: 0,
  in_window: false,
  redeemed_at: null,
};

/** One row of pilot_prompt_log. */
export interface PromptLogRow {
  prompt_id: string;
  shown_at: string | null;
  answered_at: string | null;
  dismissed_at: string | null;
}

export interface FeedbackInput {
  promptId: string;
  kind: "checkpoint" | "contextual" | "volunteered" | "bug";
  rating?: number | null;
  choice?: string | null;
  comment?: string | null;
  /** WHICH SCREEN. Never health data — pilot-leakage.test.ts enforces the keys. */
  context?: { route?: string; surface?: string } | null;
}

/**
 * Which build this came from.
 *
 * Resolved here and not asked of the caller. The column, the parameter and the
 * admin column that displays it all existed for a day with nothing on earth
 * setting them — a pipe laid end to end and never connected. A caller that CAN
 * forget eventually does, so callers are not offered the chance.
 *
 * Native only: App.getInfo() is the same source Sentry's release tag uses
 * (observability.ts). On web there is no build number to report and null is the
 * honest answer. Resolved once and cached — this cannot change mid-session.
 */
let appVersion: string | null | undefined;
const resolveAppVersion = async (): Promise<string | null> => {
  if (appVersion !== undefined) return appVersion;
  appVersion = null;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { App } = await import("@capacitor/app");
      const info = await App.getInfo();
      appVersion = `${info.version}+${info.build}`;
    }
  } catch { /* web, or the plugin is missing — null is correct either way */ }
  return appVersion;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const num = (v: unknown, fallback = 0): number => (typeof v === "number" ? v : fallback);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/**
 * Who the caller is, as far as the pilot is concerned.
 *
 * Never throws and never rejects. A missing function, a network failure and a
 * genuine "not a tester" all produce the same inert answer, on purpose.
 */
export const fetchPilotContext = async (): Promise<PilotContext> => {
  try {
    const { data, error } = await supabase.rpc("pilot_context");
    if (error || !isRecord(data)) return NOT_IN_PILOT;
    if (data.is_pilot !== true) return NOT_IN_PILOT;
    return {
      is_pilot: true,
      cohort: str(data.cohort),
      day: num(data.day),
      observe_days: num(data.observe_days, 14),
      in_window: data.in_window === true,
      redeemed_at: str(data.redeemed_at),
    };
  } catch {
    return NOT_IN_PILOT;
  }
};

/** What this person has already been asked. Empty on any failure. */
export const fetchPromptLog = async (): Promise<PromptLogRow[]> => {
  try {
    const { data, error } = await supabase
      .from("pilot_prompt_log")
      .select("prompt_id, shown_at, answered_at, dismissed_at");
    if (error || !Array.isArray(data)) return [];
    return data.filter(isRecord).map((r) => ({
      prompt_id: String(r.prompt_id ?? ""),
      shown_at: str(r.shown_at),
      answered_at: str(r.answered_at),
      dismissed_at: str(r.dismissed_at),
    }));
  } catch {
    return [];
  }
};

/**
 * Note that a prompt was shown, answered or dismissed.
 *
 * Fire-and-forget by contract, like `track`. But unlike analytics, a lost write
 * here has a visible cost — the same question comes back — so a failure is
 * reported to Sentry rather than swallowed in silence. The onboarding system
 * learned this the hard way: a silently-failed mark made a spotlight return on
 * every launch, forever, with nothing in any log.
 */
export const markPrompt = async (promptId: string, outcome: "shown" | "answered" | "dismissed"): Promise<void> => {
  try {
    const { error } = await supabase.rpc("pilot_mark_prompt", { _prompt_id: promptId, _outcome: outcome });
    if (error) captureException(error, { where: "pilot.markPrompt", promptId, outcome });
  } catch (e) {
    captureException(e, { where: "pilot.markPrompt", promptId, outcome });
  }
};

/**
 * The only keys allowed out of the device with a piece of feedback.
 *
 * A whitelist rather than a blacklist, and enforced at runtime rather than by
 * review, because the failure mode is silent: a caller adds one more field for
 * debugging, it ships, and self-reported body state is in a table again. That
 * exact bug is the reason `soreness` had to be taken out of the recovery
 * events — the contract said it was not there and it was.
 *
 * `route` is which screen. `surface` is which door the sheet was opened by.
 * Nothing else is worth the risk.
 */
const CONTEXT_KEYS = ["route", "surface"] as const;

export const sanitizeContext = (
  ctx: Record<string, unknown> | null | undefined,
): { route?: string; surface?: string } | null => {
  if (!isRecord(ctx)) return null;
  const out: { route?: string; surface?: string } = {};
  for (const key of CONTEXT_KEYS) {
    const v = ctx[key];
    // Capped: a route is a path, not a place to put a paragraph.
    if (typeof v === "string" && v) out[key] = v.slice(0, 120);
  }
  return Object.keys(out).length ? out : null;
};

export interface SubmitResult {
  success: boolean;
  reason?: string;
}

/**
 * Send one piece of feedback.
 *
 * `pilot_day` and `cohort` are NOT sent — the function reads them from
 * pilot_context() server-side, because they are what the whole read is sliced
 * by and a client that can set them can rewrite the finding.
 */
export const submitFeedback = async (input: FeedbackInput): Promise<SubmitResult> => {
  try {
    const { data, error } = await supabase.rpc("pilot_submit_feedback", {
      _prompt_id: input.promptId,
      _kind: input.kind,
      _rating: input.rating ?? undefined,
      _choice: input.choice ?? undefined,
      _comment: input.comment ?? undefined,
      _context: sanitizeContext(input.context) ?? undefined,
      _app_version: (await resolveAppVersion()) ?? undefined,
    });
    if (error) {
      captureException(error, { where: "pilot.submitFeedback", promptId: input.promptId });
      return { success: false, reason: "network" };
    }
    if (isRecord(data) && data.success === true) return { success: true };
    return { success: false, reason: isRecord(data) ? String(data.reason ?? "unknown") : "unknown" };
  } catch (e) {
    captureException(e, { where: "pilot.submitFeedback", promptId: input.promptId });
    return { success: false, reason: "network" };
  }
};

// ── The founders' side ───────────────────────────────────────────────────────
//
// The aggregates have to be an RPC because analytics_events has no SELECT policy at
// all, but the feedback ROWS are read straight from the table — pilot_feedback
// carries an admin SELECT policy shaped like pilot_code_redemptions', because a
// comment has to be read as it was written and an aggregate cannot do that.

export interface PilotReach {
  onboarded: number;
  checked_in: number;
  trained: number;
  reflected: number;
  asked_coach: number;
  recovered: number;
  opened_3d: number;
}

export interface PilotOverview {
  cohort: string | null;
  members: number;
  in_window: number;
  median_day: number | null;
  observe_days: number | null;
  reach: PilotReach | null;
  feedback_new: number;
  bugs_open: number;
  ttv_minutes: { first_checkin: number | null; first_workout: number | null } | null;
  stalled_sessions: number;
}

export interface FeedbackRow {
  id: string;
  prompt_id: string;
  kind: string;
  rating: number | null;
  choice: string | null;
  comment: string | null;
  pilot_day: number | null;
  cohort: string | null;
  app_version: string | null;
  status: string;
  created_at: string;
}

/** Throws on failure: an admin page that renders zeroes when the RPC refused is worse than one that says so. */
export const fetchPilotOverview = async (cohort?: string | null): Promise<PilotOverview> => {
  const { data, error } = await supabase.rpc("admin_pilot_overview", { p_cohort: cohort ?? undefined });
  if (error) throw error instanceof Error ? error : new Error("admin_pilot_overview failed");
  if (!isRecord(data)) throw new Error("admin_pilot_overview returned nothing");
  return data as unknown as PilotOverview;
};

/** One row per question: how many saw it, how many answered, how many passed. */
export interface PromptStat {
  prompt_id: string;
  shown: number;
  answered: number;
  dismissed: number;
}

/**
 * What was asked, and what came back.
 *
 * Without this, silence is ambiguous: a question with no answers might never
 * have been shown to anybody at all, and those are different problems with
 * different fixes. The function has been deployed since 29 September with
 * nothing calling it, and prompts.ts has been promising it is readable.
 */
export const fetchPromptStats = async (cohort?: string | null): Promise<PromptStat[]> => {
  const { data, error } = await supabase.rpc("admin_pilot_prompts", { p_cohort: cohort ?? undefined });
  if (error) throw error instanceof Error ? error : new Error("admin_pilot_prompts failed");
  return Array.isArray(data) ? data : [];
};

export const fetchFeedback = async (limit = 200): Promise<FeedbackRow[]> => {
  const { data, error } = await supabase
    .from("pilot_feedback")
    .select("id, prompt_id, kind, rating, choice, comment, pilot_day, cohort, app_version, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error instanceof Error ? error : new Error("pilot_feedback read failed");
  return Array.isArray(data) ? (data as unknown as FeedbackRow[]) : [];
};

/** Triage. The only column an admin may move, and the RLS policy says so too. */
export const setFeedbackStatus = async (id: string, status: string): Promise<void> => {
  const { error } = await supabase.from("pilot_feedback").update({ status }).eq("id", id);
  if (error) throw error instanceof Error ? error : new Error("status update failed");
};
