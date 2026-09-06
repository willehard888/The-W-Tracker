/**
 * Columns that change on every heartbeat / refetch without changing anything
 * the app renders. `updated_at` moves on every server touch, `last_active_at`
 * on every presence ping, the timezone pair on every launch.
 */
const HEARTBEAT = new Set(["updated_at", "last_active_at", "rank_score_updated_at", "utc_offset_minutes", "timezone"]);

const sameValue = (x: unknown, y: unknown): boolean =>
  x === y ||
  (typeof x === "object" && typeof y === "object" && x !== null && y !== null && JSON.stringify(x) === JSON.stringify(y));

/**
 * True when two profile rows render identically. AuthContext uses it to keep
 * the previous object on refetch / realtime, so every `profile` consumer
 * (and the context value memo) stays put unless something visible changed.
 */
export const sameProfile = (a: Record<string, unknown>, b: Record<string, unknown>): boolean => {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (HEARTBEAT.has(k)) continue;
    if (!sameValue(a[k], b[k])) return false;
  }
  return true;
};
