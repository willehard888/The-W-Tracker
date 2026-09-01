// Contextual onboarding — pure state logic (Onboarding Blueprint §4).
// Everything here is deterministic and side-effect free: parsing the JSONB
// blob, eligibility, optimistic local writes, cross-device reconciliation,
// and the single-flight queue reducer the provider drives.
import { FAILED_ATTEMPT_CAP, type OnboardingEventId, type OnboardingState } from "./types";

export const EMPTY_ONBOARDING_STATE: OnboardingState = {
  version: 0,
  status: "not_started",
  seen: {},
  completed: {},
  skipped: {},
  failed: {},
  grandfathered: false,
  updatedAt: null,
};

const asRecord = (v: unknown): Record<string, string> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (typeof x === "string") out[k] = x;
  }
  return out;
};

const asFailed = (v: unknown): OnboardingState["failed"] => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: OnboardingState["failed"] = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const e = x as { at?: unknown; count?: unknown };
    if (e && typeof e.at === "string" && typeof e.count === "number") {
      out[k] = { at: e.at, count: e.count };
    }
  }
  return out;
};

/** Parse the raw profiles.onboarding_state blob; every field defaults. */
export const parseOnboardingState = (raw: unknown): OnboardingState => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_ONBOARDING_STATE;
  const r = raw as Record<string, unknown>;
  const status = r.status;
  return {
    version: typeof r.version === "number" ? r.version : 0,
    status:
      status === "in_progress" || status === "completed" || status === "skipped_all"
        ? status
        : "not_started",
    seen: asRecord(r.seen),
    completed: asRecord(r.completed),
    skipped: asRecord(r.skipped),
    failed: asFailed(r.failed),
    grandfathered: r.grandfathered === true,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : null,
  };
};

/**
 * Eligibility (post-versioning-fix): grandfathered users never see events;
 * an event already completed/skipped never re-fires; a target that failed
 * to mount FAILED_ATTEMPT_CAP times is permanently skipped. Version is a
 * grandfather ceiling moved only by migrations — deliberately NOT tested
 * here for v1 events.
 */
/** Completed or skipped — either way the concept has had its moment. */
export const isDone = (state: OnboardingState, id: OnboardingEventId): boolean =>
  id in state.completed || id in state.skipped;

export const isEligible = (state: OnboardingState, id: OnboardingEventId): boolean =>
  !state.grandfathered &&
  state.status !== "skipped_all" &&
  !(id in state.completed) &&
  !(id in state.skipped) &&
  (state.failed[id]?.count ?? 0) < FAILED_ATTEMPT_CAP;

const newerIso = (a: string | undefined, b: string | undefined): string | undefined => {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
};

/**
 * Cross-device reconciliation: merge an incoming realtime state with the
 * local one, per key, latest ISO timestamp wins. Membership merges are
 * additive — a key either device has recorded stays recorded.
 */
export const mergeStates = (local: OnboardingState, incoming: OnboardingState): OnboardingState => {
  const mergeRec = (a: Record<string, string>, b: Record<string, string>) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = newerIso(out[k], v)!;
    return out;
  };
  const failed: OnboardingState["failed"] = { ...local.failed };
  for (const [k, v] of Object.entries(incoming.failed)) {
    const cur = failed[k];
    failed[k] = !cur || v.count > cur.count || (v.count === cur.count && v.at >= cur.at) ? v : cur;
  }
  const localNewer = (local.updatedAt ?? "") >= (incoming.updatedAt ?? "");
  return {
    version: Math.max(local.version, incoming.version),
    status: localNewer ? local.status : incoming.status,
    seen: mergeRec(local.seen, incoming.seen),
    completed: mergeRec(local.completed, incoming.completed),
    skipped: mergeRec(local.skipped, incoming.skipped),
    failed,
    grandfathered: local.grandfathered || incoming.grandfathered,
    updatedAt: newerIso(local.updatedAt ?? undefined, incoming.updatedAt ?? undefined) ?? null,
  };
};

/** Optimistic local apply — the UI updates first, the RPC follows. */
export const applyMark = (
  state: OnboardingState,
  kind: "seen" | "completed" | "skipped" | "failed",
  id: OnboardingEventId,
  at: string,
): OnboardingState => {
  if (kind === "failed") {
    return {
      ...state,
      failed: { ...state.failed, [id]: { at, count: (state.failed[id]?.count ?? 0) + 1 } },
      updatedAt: at,
    };
  }
  return {
    ...state,
    status: state.status === "not_started" ? "in_progress" : state.status,
    [kind]: { ...state[kind], [id]: at },
    updatedAt: at,
  };
};

/** Single-flight lock + queue: one card at a time, later requests wait. */
export interface ShowQueue {
  activeEventId: OnboardingEventId | null;
  queue: OnboardingEventId[];
}

export const EMPTY_QUEUE: ShowQueue = { activeEventId: null, queue: [] };

export const enqueueShow = (q: ShowQueue, id: OnboardingEventId): ShowQueue => {
  if (q.activeEventId === id || q.queue.includes(id)) return q;
  if (q.activeEventId === null) return { activeEventId: id, queue: q.queue };
  return { activeEventId: q.activeEventId, queue: [...q.queue, id] };
};

export const dismissActive = (q: ShowQueue): ShowQueue => {
  const [next, ...rest] = q.queue;
  return { activeEventId: next ?? null, queue: rest };
};
