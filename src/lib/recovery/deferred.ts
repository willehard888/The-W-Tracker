// "Maybe later" has to mean later, not never.
//
// In the first version, declining the offer on the finish screen set a boolean
// that hid the card and nothing else. The session was gone. The athlete who
// meant "not with a bar still on the rack" got the same outcome as the one who
// meant "never" — which is the quiet way a feature teaches people it is
// optional in the sense of pointless.
//
// So a decline parks the session on Today instead. It survives an app restart,
// it expires with the day it belongs to, and finishing a recovery session
// clears it. One place to pick it back up, and no nagging beyond it.
import { readLocal, removeLocal, writeLocal } from "@/lib/storage";
import { localDateKey } from "@/lib/date";

const KEY = "recovery-deferred";

export interface DeferredRecovery {
  /** Local date the session belongs to; anything older is ignored, not shown. */
  day: string;
  source: "post_workout" | "rest_day";
  /** Query string for /recovery, e.g. "p=…&w=1&d=2". */
  query: string;
  areas: string[];
  minutes: number;
}

export const deferRecovery = (
  value: Omit<DeferredRecovery, "day">,
  when: Date = new Date(),
): void => {
  try {
    writeLocal(KEY, JSON.stringify({ ...value, day: localDateKey(when) }));
  } catch {
    // A session that cannot be parked is a session the athlete can still start
    // from Today's training row. Nothing here is worth failing a screen over.
  }
};

/**
 * The parked session, if there is one and it is still today's.
 *
 * Yesterday's is not shown: a recovery session built from Tuesday's pressing
 * work is the wrong thing to offer on Wednesday, and an offer that will not go
 * away is how a helpful row becomes a chore.
 */
export const deferredRecovery = (when: Date = new Date()): DeferredRecovery | null => {
  const raw = readLocal(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DeferredRecovery;
    if (!parsed || parsed.day !== localDateKey(when)) return null;
    if (typeof parsed.query !== "string" || !Array.isArray(parsed.areas)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearDeferredRecovery = (): void => removeLocal(KEY);
