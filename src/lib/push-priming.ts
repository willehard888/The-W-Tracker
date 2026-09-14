/**
 * May the in-app reminder rationale be shown right now?
 *
 * One rule for both doors — the Home fallback 3.5 s after launch and the
 * moment of intent right after a check-in. Never on a denied permission (the
 * OS will not prompt again), never inside the 7-day snooze after "Maybe
 * later", and never when the OS already granted (nothing left to ask).
 */
export const PRIMING_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export const shouldPrimeNow = (args: {
  permission: string | null | undefined;
  snoozedAt: number;
  now?: number;
}): boolean => {
  const { permission, snoozedAt, now = Date.now() } = args;
  if (permission !== "prompt" && permission !== "prompt-with-rationale") return false;
  if (Number.isFinite(snoozedAt) && snoozedAt > 0 && now - snoozedAt < PRIMING_SNOOZE_MS) return false;
  return true;
};
