// Contextual onboarding — the centralized controller (Blueprint §4).
// Single source of truth for "what's rendering now" (activeEventId in React
// state), optimistic fire-and-forget RPC writes (analytics.track philosophy),
// localStorage mirror for instant hydration, and per-key latest-wins merge
// with the profiles realtime subscription AuthContext already holds.
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { track, FUNNEL } from "@/lib/analytics";
import { ONBOARDING_EVENTS } from "@/lib/onboarding/registry";
import {
  EMPTY_ONBOARDING_STATE,
  EMPTY_QUEUE,
  applyMark,
  dismissActive,
  enqueueShow,
  isDone,
  isEligible,
  mergeStates,
  parseOnboardingState,
  type ShowQueue,
} from "@/lib/onboarding/state";
import type { OnboardingEventId, OnboardingState } from "@/lib/onboarding/types";
import { OnboardingContext, type OnboardingApi } from "./onboarding-context";
import OnboardingHost from "./OnboardingHost";

const mirrorKey = (uid: string) => `w_onboarding_state_${uid}`;

// Pacing: at most this many trigger-initiated cards per app session — a user
// who tours every tab on minute one shouldn't be carpet-bombed. Chained
// follow-ups don't count (a chain is ONE teaching moment), and deferred
// cards simply re-trigger next session. Module-level: survives provider
// remounts, resets on real app relaunch, which is exactly a "session".
const SESSION_SHOW_CAP = 2;
let sessionShows = 0;

const readMirror = (uid: string): OnboardingState => {
  try {
    const raw = localStorage.getItem(mirrorKey(uid));
    return raw ? parseOnboardingState(JSON.parse(raw)) : EMPTY_ONBOARDING_STATE;
  } catch {
    return EMPTY_ONBOARDING_STATE;
  }
};

const RPC_BY_KIND = {
  seen: "onboarding_mark_seen",
  completed: "onboarding_mark_completed",
  skipped: "onboarding_mark_skipped",
  failed: "onboarding_mark_failed",
} as const;

const TRACK_BY_KIND = {
  seen: FUNNEL.spotlightSeen,
  completed: FUNNEL.spotlightCompleted,
  skipped: FUNNEL.spotlightSkipped,
  failed: FUNNEL.spotlightFailed,
} as const;

export default function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const uid: string | null = user?.id ?? null;

  const [state, setState] = useState<OnboardingState>(EMPTY_ONBOARDING_STATE);
  const [queue, setQueue] = useState<ShowQueue>(EMPTY_QUEUE);
  const targets = useRef(new Map<OnboardingEventId, HTMLElement>());
  // Refs so every action keeps a stable identity (trigger effects depend on
  // them) and so no setState updater ever needs to contain a side effect —
  // StrictMode runs updaters twice and drops nested dispatches.
  const stateRef = useRef(state);
  stateRef.current = state;
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const uidRef = useRef(uid);
  uidRef.current = uid;
  const readyRef = useRef(false);

  // Dev-only tracing (?obDev=1): the queue/mark flow is invisible otherwise.
  const trace = (...args: unknown[]) => {
    if (import.meta.env.DEV && window.location.search.includes("obDev")) {
      console.log("[onboarding]", ...args);
    }
  };

  // Hydrate from the localStorage mirror the moment we know the user, then
  // merge every profile update (initial fetch + realtime) on top.
  useEffect(() => {
    setQueue(EMPTY_QUEUE);
    setState(uid ? readMirror(uid) : EMPTY_ONBOARDING_STATE);
  }, [uid]);

  const rawServerState: unknown = profile?.onboarding_state;
  useEffect(() => {
    if (rawServerState == null) return;
    setState((prev) => mergeStates(prev, parseOnboardingState(rawServerState)));
  }, [rawServerState]);

  // Persist the mirror on every change (fail-open on quota/private mode).
  useEffect(() => {
    if (!uid) return;
    try {
      localStorage.setItem(mirrorKey(uid), JSON.stringify(state));
    } catch {
      /* mirror is a convenience — server state is the authority */
    }
  }, [uid, state]);

  const mark = useCallback((kind: keyof typeof RPC_BY_KIND, id: OnboardingEventId) => {
    trace("mark", kind, id);
    const next = applyMark(stateRef.current, kind, id, new Date().toISOString());
    stateRef.current = next;
    setState(next);
    // Fire-and-forget, never awaited into the UI path; server guard makes
    // duplicates harmless. `as never`: generated DB types lag the migration.
    void supabase
      .rpc(RPC_BY_KIND[kind] as never, { _event_id: id } as never)
      .then(undefined, () => {});
    void track(TRACK_BY_KIND[kind], { event: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestShow = useCallback(
    (id: OnboardingEventId) => {
      const def = ONBOARDING_EVENTS[id];
      if (!def || !uidRef.current || !readyRef.current) return;
      if (!isEligible(stateRef.current, id)) {
        trace("requestShow ineligible", id);
        return;
      }
      if (def.prerequisite && !isDone(stateRef.current, def.prerequisite)) {
        trace("requestShow blocked by prerequisite", id, "←", def.prerequisite);
        return;
      }
      if (def.presentation === "none") {
        // Bookkeeping-only event (an existing surface teaches it) — record, no UI.
        mark("completed", id);
        return;
      }
      if (sessionShows >= SESSION_SHOW_CAP) {
        // Deferred, NOT marked — the trigger re-asks next session.
        trace("requestShow deferred by session cap", id);
        return;
      }
      const next = enqueueShow(queueRef.current, id);
      if (next !== queueRef.current) sessionShows += 1;
      trace("requestShow", id, "→", next);
      queueRef.current = next;
      setQueue(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mark],
  );

  // A card became active → record "seen" once.
  const active = queue.activeEventId;
  useEffect(() => {
    if (active && !(active in stateRef.current.seen)) mark("seen", active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mark]);

  // Cross-device: if another device completed/skipped the active card, drop it.
  useEffect(() => {
    if (active && !isEligible(state, active) && !(active in state.seen)) {
      const next = dismissActive(queueRef.current);
      queueRef.current = next;
      setQueue(next);
    }
  }, [active, state]);

  const finishActive = useCallback(
    (kind: "completed" | "skipped" | "failed") => {
      const q = queueRef.current;
      const id = q.activeEventId;
      if (!id) return;
      // Side effects FIRST, outside any updater; then one pure queue write.
      mark(kind, id);
      let next = dismissActive(q);
      if (kind === "completed") {
        const chain = ONBOARDING_EVENTS[id].chainsTo;
        // Chaining is a HINT: only fires now if the next target is already
        // on-screen; otherwise its own trigger shows it later.
        if (chain && isEligible(stateRef.current, chain) && targets.current.has(chain)) {
          next = enqueueShow(next, chain);
        }
      }
      trace("finish", kind, id, "→", next);
      queueRef.current = next;
      setQueue(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mark],
  );

  // Dev harness (?obDev=1): exercise the flow before the migration exists —
  // server state is ignored, everything runs on the local mirror. Sticky via
  // sessionStorage because SPA navigation drops the query string. Dead code
  // in production builds (import.meta.env.DEV is compile-time false).
  let devForced = false;
  if (import.meta.env.DEV) {
    if (new URLSearchParams(window.location.search).has("obDev")) {
      sessionStorage.setItem("w_ob_dev", "1");
    }
    devForced = sessionStorage.getItem("w_ob_dev") === "1";
  }
  const systemReady = devForced || (rawServerState !== undefined && rawServerState !== null);

  // Dev showcase (?obDev=1): window.__obShow("SQUAD_INTRO") force-shows any
  // card — clears its marks and enqueues it directly, skipping eligibility.
  // Dead code in production builds.
  useEffect(() => {
    if (!import.meta.env.DEV || !devForced) return;
    const w = window as unknown as { __obShow?: (id: OnboardingEventId) => void };
    w.__obShow = (id) => {
      const s = stateRef.current;
      const strip = <T,>(m: Record<string, T>): Record<string, T> => {
        const c = { ...m };
        delete c[id];
        return c;
      };
      const next = {
        ...s,
        seen: strip(s.seen),
        completed: strip(s.completed),
        skipped: strip(s.skipped),
        failed: strip(s.failed),
      };
      stateRef.current = next;
      setState(next);
      const q = enqueueShow(queueRef.current, id);
      queueRef.current = q;
      setQueue(q);
    };
    return () => {
      delete w.__obShow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devForced]);

  readyRef.current = systemReady;

  const api = useMemo<OnboardingApi>(
    () => ({
      // Inert until the migration has landed in this environment: only then
      // does the profile row carry onboarding_state (default '{}').
      systemReady,
      requestShow,
      completeActive: () => finishActive("completed"),
      skipActive: () => finishActive("skipped"),
      registerTarget: (id, el) => {
        if (el) targets.current.set(id, el);
        else targets.current.delete(id);
      },
      getTarget: (id) => targets.current.get(id) ?? null,
      activeEventId: active,
    }),
    [systemReady, requestShow, finishActive, active],
  );

  return (
    <OnboardingContext.Provider value={api}>
      {children}
      <OnboardingHost
        activeEventId={active}
        getTarget={api.getTarget}
        onComplete={api.completeActive}
        onSkip={api.skipActive}
        onTargetFailed={() => finishActive("failed")}
      />
    </OnboardingContext.Provider>
  );
}
