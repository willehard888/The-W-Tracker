/**
 * realtime.ts — small utility for Supabase Realtime channel names.
 *
 * Why this exists:
 *   React StrictMode (and any HMR re-mount) fires useEffect TWICE in dev.
 *   If both mounts call `supabase.channel(name)` with the same name, the
 *   second mount gets back the already-subscribed channel from the first
 *   mount BEFORE its `removeChannel` cleanup has finished. Calling `.on()`
 *   on the already-subscribed channel throws:
 *     "cannot add `postgres_changes` callbacks for ... after `subscribe()`"
 *   and crashes the host page through ErrorBoundary.
 *
 *   The fix is to append a per-mount unique suffix to every channel name.
 *   Doing it inline at every call site is repetitive and one missed spot
 *   re-introduces the bug. This helper makes the safe pattern the easy
 *   pattern.
 *
 * Usage:
 *   const channelName = uniqueChannelName("tribe-feed", id);
 *   const ch = supabase.channel(channelName).on(...).subscribe();
 *
 * The returned name is `${prefix}-${...keys}-${uuid}`. Keys are filtered
 * for null/undefined and joined with "-".
 */

export const uniqueChannelName = (
  prefix: string,
  ...keys: Array<string | number | null | undefined>
): string => {
  const cleaned = keys
    .filter((k): k is string | number => k !== null && k !== undefined && k !== "")
    .map((k) => String(k));
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return [prefix, ...cleaned, suffix].join("-");
};
