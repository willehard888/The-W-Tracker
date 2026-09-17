/**
 * What this member has reported, for this session only.
 *
 * The server keeps a reported comment visible until a moderator acts, so the
 * reporter kept looking at the thing they had just flagged. App Review reads
 * that as "the report did nothing". The ids live in memory: a reload brings the
 * content back if the moderator decided it was fine.
 *
 * The snapshot is replaced on every change, never mutated, so
 * useSyncExternalStore sees a new reference and memoized rows re-render.
 */
let reported: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

export const getReportedIds = (): ReadonlySet<string> => reported;

export const subscribeReportedIds = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const markReported = (contentId: string): void => {
  if (reported.has(contentId)) return;
  reported = new Set(reported).add(contentId);
  listeners.forEach((l) => l());
};

/** Test seam: a module-level store otherwise leaks between cases. */
export const resetReportedIds = (): void => {
  reported = new Set();
  listeners.forEach((l) => l());
};
