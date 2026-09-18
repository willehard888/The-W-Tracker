// What the athlete keeps choosing, remembered — and nothing else.
//
// Rule-based, not learned. The brief's own list of useful signals is short and
// every one of them is a count:
//
//   picks Quick every time          → open on Quick
//   finishes Deep sessions          → open on Deep
//   keeps starting from Today       → do not push harder for "right now"
//
// So this stores counts, and a preference is the option that has won clearly.
// "Clearly" is deliberately conservative: three sessions, and a margin over the
// runner-up. A default that moves after one unusual evening is worse than one
// that never moves, because the athlete stops being able to predict the app.
//
// Nothing here leaves the device and nothing here is health data — it is which
// of three buttons got pressed.
import { readLocal, writeLocal } from "@/lib/storage";
import type { RecoveryLength } from "./build-session";

const KEY = "recovery-length-counts";

/** Below this many finished sessions, the standard default stands. */
const MIN_SAMPLES = 3;

type Counts = Partial<Record<RecoveryLength, number>>;

const read = (): Counts => {
  const raw = readLocal(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Counts) : {};
  } catch {
    return {};
  }
};

/** Called when a session is FINISHED, not when a length is tapped. */
export const rememberLength = (length: RecoveryLength): void => {
  const counts = read();
  counts[length] = (counts[length] ?? 0) + 1;
  try {
    writeLocal(KEY, JSON.stringify(counts));
  } catch {
    // Preference memory is a convenience; losing it changes one default.
  }
};

/**
 * Which length to open on.
 *
 * Standard until the athlete has shown a habit — three finished sessions, and a
 * clear winner rather than a tie. A default that flips on a single unusual
 * evening teaches people the app is unpredictable, which costs more than the
 * tap it saves.
 */
export const preferredLength = (): RecoveryLength => {
  const counts = read();
  const entries = Object.entries(counts) as [RecoveryLength, number][];
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  if (total < MIN_SAMPLES) return "standard";
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const [top, runnerUp] = sorted;
  if (!top) return "standard";
  if (runnerUp && top[1] === runnerUp[1]) return "standard";
  return top[0];
};
