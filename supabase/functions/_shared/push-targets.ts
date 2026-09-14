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

// ── Delivery bookkeeping ───────────────────────────────────────────────────
// Every sender used to compute these two lists inline and then discard them
// (console.log). `sendApnsBatch(tokens, payload, { supabase, kind })` now
// calls both: dead tokens are pruned, and one `push_sent` analytics row per
// device lands with { kind, ok, reason } so reach is a query, not a guess.

export interface ApnsOutcome {
  token: string;
  status: number;
  reason?: string;
}

/** Tokens APNs will never deliver to again — delete them, do not retry. */
export function deadTokens(results: ApnsOutcome[]): string[] {
  return results
    .filter((r) => r.reason === "BadDeviceToken" || r.reason === "Unregistered")
    .map((r) => r.token);
}

/**
 * One `push_sent` row per device that belongs to a known user. Targets
 * without a user_id (a raw token list) produce nothing — the row would have
 * no owner and the table's RLS insists on one.
 */
export function pushSentRows(
  results: ApnsOutcome[],
  targets: { token: string; user_id?: string | null }[],
  kind: string,
): { user_id: string; event: "push_sent"; props: { kind: string; ok: boolean; reason?: string } }[] {
  const owner = new Map<string, string>();
  for (const t of targets) if (t.user_id) owner.set(t.token, t.user_id);
  const rows: ReturnType<typeof pushSentRows> = [];
  for (const r of results) {
    const user_id = owner.get(r.token);
    if (!user_id) continue;
    const ok = r.status === 200;
    rows.push({ user_id, event: "push_sent", props: ok ? { kind, ok } : { kind, ok, reason: r.reason ?? String(r.status) } });
  }
  return rows;
}
