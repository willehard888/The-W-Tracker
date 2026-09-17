// Today's session as the member sees it on Home: a session they built for
// today ("today by focus", a one-day coach_programs row with status 'session')
// leads; otherwise the running program's day. The coach used to read only the
// program, so with a Chest session in progress it answered "rest day".
//
// deno-lint-ignore-file no-explicit-any
type Day = { focus?: string; duration_min?: number; blocks?: unknown[] };

/** The one non-empty day of today's focus session, or null. `localDay` is the member's YYYY-MM-DD. */
export const todaysFocusSession = async (sb: any, userId: string, localDay: string): Promise<Day | null> => {
  const { data } = await sb
    .from("coach_programs")
    .select("plan_json")
    .eq("user_id", userId)
    .eq("status", "session")
    .eq("started_on", localDay)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return pickSessionDay(data?.plan_json);
};

/** Pure half, tested from the app: the first day of week one that has movements in it. */
export const pickSessionDay = (plan: any): Day | null =>
  ((plan?.weeks?.[0]?.days ?? []) as Day[]).find((d) => (d?.blocks?.length ?? 0) > 0) ?? null;
