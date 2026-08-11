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
