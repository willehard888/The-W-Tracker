import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchPilotContext,
  fetchPromptLog,
  markPrompt,
  submitFeedback,
  NOT_IN_PILOT,
  type FeedbackInput,
  type PilotContext,
} from "@/lib/pilot/rpc";
import type { PromptLog } from "@/lib/pilot/eligibility";
import { NO_SIGNALS, type PilotSignals } from "@/lib/pilot/prompts";

/**
 * The pilot, as the app sees it.
 *
 * Everything here is gated on `is_pilot`, which only the server can set. For
 * everyone who is not a tester — which, outside the pilot, is everybody — these
 * hooks make no requests beyond the first cheap one and return the inert
 * answer, so the pilot layer costs a non-tester one RPC per session and
 * nothing else.
 */

const CONTEXT_STALE_MS = 5 * 60 * 1000;

export const usePilotContext = (): { context: PilotContext; loading: boolean } => {
  const { user } = useAuth();
  const { data, isPending } = useQuery({
    queryKey: ["pilot-context", user?.id],
    enabled: !!user?.id,
    // The day only changes at midnight, and a stale day for five minutes is
    // not a state anybody can notice.
    staleTime: CONTEXT_STALE_MS,
    retry: false,
    queryFn: fetchPilotContext,
  });
  return { context: data ?? NOT_IN_PILOT, loading: isPending && !!user?.id };
};

const toMs = (iso: string | null): number | null => (iso ? Date.parse(iso) : null);

/** What this person has already been asked, in the shape the rule wants. */
export const usePromptLog = (enabled: boolean): { log: PromptLog; loading: boolean } => {
  const { user } = useAuth();
  const { data, isPending } = useQuery({
    queryKey: ["pilot-prompt-log", user?.id],
    enabled: enabled && !!user?.id,
    staleTime: CONTEXT_STALE_MS,
    retry: false,
    queryFn: async (): Promise<PromptLog> => {
      const rows = await fetchPromptLog();
      return Object.fromEntries(
        rows.map((r) => [
          r.prompt_id,
          { shownAt: toMs(r.shown_at), answeredAt: toMs(r.answered_at), dismissedAt: toMs(r.dismissed_at) },
        ]),
      );
    },
  });
  return { log: data ?? {}, loading: enabled && isPending };
};

/** Did this device ever hold a coach thread? The transcript is localStorage-only. */
const hasCoachHistory = (): boolean => {
  try {
    const raw = localStorage.getItem("w_coach_messages_v1");
    return !!raw && raw.length > 2 && raw.includes("assistant");
  } catch {
    return false;
  }
};

/** Did a recovery session ever finish here? completion.ts keeps 14 days of dates. */
const hasRecoveryHistory = (): boolean => {
  try {
    const raw = localStorage.getItem("recovery-done-log");
    return !!raw && raw.length > 2;
  } catch {
    return false;
  }
};

/**
 * What this person has actually done — the gate on whether a contextual
 * question may be asked at all.
 *
 * Two facts come from the database and two from localStorage, and that split is
 * not a choice: the coach transcript has no table (it lives under
 * w_coach_messages_v1 and dies on sign-out) and recovery completion is a
 * 14-day array of local dates. The cross-device record of both is
 * analytics_events, which no client may read.
 *
 * What that costs: a tester who asks the coach on their phone and opens the app
 * on a second device is not asked about the coach there. For a pilot on
 * TestFlight this is close to theoretical, and the failure is silence rather
 * than a wrong question — which is the right way round.
 */
export const usePilotSignals = (enabled: boolean): PilotSignals => {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["pilot-signals", user?.id],
    enabled: enabled && !!user?.id,
    staleTime: CONTEXT_STALE_MS,
    retry: false,
    queryFn: async (): Promise<PilotSignals> => {
      const [checkin, trained] = await Promise.all([
        supabase.from("daily_checkins").select("id").eq("user_id", user!.id).limit(1),
        supabase.from("coach_program_logs").select("id").eq("user_id", user!.id).eq("completed", true).limit(1),
      ]);
      return {
        checkedIn: (checkin.data?.length ?? 0) > 0,
        trained: (trained.data?.length ?? 0) > 0,
        askedCoach: hasCoachHistory(),
        recovered: hasRecoveryHistory(),
      };
    },
  });
  return data ?? NO_SIGNALS;
};

/**
 * Send feedback, and keep the local log in step.
 *
 * Not a react-query mutation: the sheet needs a plain promise that resolves to
 * "did it land", and the only cache that matters afterwards is the prompt log.
 */
export const useSubmitFeedback = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return async (input: FeedbackInput): Promise<boolean> => {
    const res = await submitFeedback(input);
    if (res.success) {
      void qc.invalidateQueries({ queryKey: ["pilot-prompt-log", user?.id] });
    }
    return res.success;
  };
};

/** Note a prompt as shown or dismissed, and refresh what we think we know. */
export const useMarkPrompt = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return async (promptId: string, outcome: "shown" | "dismissed"): Promise<void> => {
    await markPrompt(promptId, outcome);
    void qc.invalidateQueries({ queryKey: ["pilot-prompt-log", user?.id] });
  };
};
