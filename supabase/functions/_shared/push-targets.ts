// Preference-aware push token lookup.
//
// Every sender used to query push_tokens directly; this is the single choke
// point that also honours profiles.notification_prefs. An absent or malformed
// key means ON — new categories are opt-out, existing users need no backfill.
//
// deno-lint-ignore-file no-explicit-any

export type PushCategory =
  | "coach"
  | "social"
  | "tribe"
  | "briefing"
  | "winback";

export interface PushTarget {
  user_id: string;
  token: string;
  platform: string;
}

/** True unless the user has explicitly switched this category off. */
export function prefAllows(prefs: unknown, category: PushCategory): boolean {
  if (!prefs || typeof prefs !== "object") return true;
  return (prefs as Record<string, unknown>)[category] !== false;
}

/**
 * Tokens for the given users, minus anyone who turned `category` off.
 * `supabase` must be a service-role client (reads other users' prefs).
 */
export async function getPushTargets(
  supabase: any,
  userIds: string[],
  category: PushCategory,
): Promise<PushTarget[]> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return [];

  const [tokensRes, prefsRes] = await Promise.all([
    supabase
      .from("push_tokens")
      .select("user_id, token, platform")
      .in("user_id", ids),
    supabase
      .from("profiles")
      .select("user_id, notification_prefs")
      .in("user_id", ids),
  ]);

  const tokens: PushTarget[] = tokensRes.data ?? [];
  if (tokens.length === 0) return [];

  const optedOut = new Set(
    ((prefsRes.data ?? []) as { user_id: string; notification_prefs: unknown }[])
      .filter((p) => !prefAllows(p.notification_prefs, category))
      .map((p) => p.user_id),
  );

  return tokens.filter((t) => !optedOut.has(t.user_id));
}
