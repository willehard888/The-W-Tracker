/**
 * Deterministic daily pick from a list — same item all day for everyone,
 * rotates at local midnight. `salt` decorrelates independent surfaces
 * (header quote vs. daily insight) so they don't move in lockstep.
 */
export function pickDaily<T>(items: T[], salt = ""): T {
  const key = new Date().toDateString() + salt;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash) + key.charCodeAt(i);
  return items[Math.abs(hash) % items.length];
}

/** Whole days since the epoch in local time — the one place "which day is it"
 *  arithmetic lives, so surfaces that alternate by day agree with each other. */
export const localDayIndex = (now = new Date()): number =>
  Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000);
