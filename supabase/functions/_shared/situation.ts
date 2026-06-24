// Cross-domain situation awareness — the coach's eyes on the user's WHOLE life
// inside the app, not just their training file. Pulls social (tribe, friends),
// competitive (battles, leaderboard rank) and timing (checked in today? streak
// at risk tonight?) signals so the coach can encourage and prescribe at the
// RIGHT MOMENT — protect a streak before midnight, rally before a tribe event,
// push to win a live battle.
//
// Design rules:
// - FAIL-OPEN. Every signal is independent and best-effort. A missing table,
//   an RLS block, or a thrown query never breaks the coach — that line is just
//   omitted from the block.
// - Works with both a user-scoped client (anon key + JWT, RLS applies) and a
//   service-role client (cron). Every query is explicitly scoped by userId, so
//   it's correct either way.
// - Cheap: one batch of parallel queries, tiny selects, hard limits.

// deno-lint-ignore no-explicit-any
type AnyClient = any;

export interface SituationData {
  rank?: number | null;
  totalUsers?: number | null;
  percentile?: number | null;
  tribeName?: string | null;
  tribeMemberCount?: number | null;
  tribeActivity?: string | null;
  nextEvent?: { title: string; activity: string | null; startsAt: string; online: boolean } | null;
  activeBattle?: { type: string; role: "challenger" | "opponent"; endsAt: string | null } | null;
  pendingIncomingBattle?: boolean;
  checkedInToday?: boolean;
  streakAtRisk?: boolean;
  streak?: number | null;
  friendCount?: number | null;
}

const safe = async <T>(p: PromiseLike<T>, fallback: T): Promise<T> => {
  try { return await p; } catch { return fallback; }
};

/** Local calendar date (YYYY-MM-DD) for a UTC instant given a tz offset. */
const localDateStr = (ms: number, tzOffsetMinutes: number): string =>
  new Date(ms - tzOffsetMinutes * 60_000).toISOString().slice(0, 10);

const localHour = (ms: number, tzOffsetMinutes: number): number =>
  new Date(ms - tzOffsetMinutes * 60_000).getUTCHours();

/**
 * Gather the user's cross-domain situation. `tzOffsetMinutes` is the value of
 * `new Date().getTimezoneOffset()` on the client (positive = west of UTC); pass
 * 0 when unknown (timing nuance degrades gracefully).
 */
export async function gatherSituation(
  supabase: AnyClient,
  userId: string,
  opts: { tzOffsetMinutes?: number; streak?: number | null } = {},
): Promise<SituationData> {
  const tz = opts.tzOffsetMinutes ?? 0;
  const out: SituationData = { streak: opts.streak ?? null };

  // Independent best-effort queries, all in parallel.
  const [rankRes, memberRes, battleRes, pendingRes, checkinRes, friendRes] = await Promise.all([
    safe(supabase.rpc("get_user_rank", { p_user_id: userId }), { data: null }),
    safe(
      supabase.from("tribe_members").select("tribe_id").eq("user_id", userId).eq("status", "active"),
      { data: null },
    ),
    safe(
      supabase
        .from("battles")
        .select("challenger_id, opponent_id, battle_type, ended_at, started_at")
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      { data: null },
    ),
    safe(
      supabase
        .from("battles")
        .select("id")
        .eq("opponent_id", userId)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle(),
      { data: null },
    ),
    safe(
      supabase
        .from("daily_checkins")
        .select("checked_in_at")
        .eq("user_id", userId)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      { data: null },
    ),
    safe(
      supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq("status", "accepted"),
      { count: null },
    ),
  ]);

  // Rank
  const rankRow = Array.isArray(rankRes?.data) ? rankRes.data[0] : rankRes?.data;
  if (rankRow?.has_rank) {
    out.rank = rankRow.rank ?? null;
    out.totalUsers = rankRow.total_users ?? null;
    out.percentile = rankRow.percentile ?? null;
  }

  // Friends
  out.friendCount = friendRes?.count ?? null;

  // Check-in timing
  const lastCheckin = checkinRes?.data?.checked_in_at as string | undefined;
  const now = Date.now();
  if (lastCheckin) {
    out.checkedInToday = localDateStr(new Date(lastCheckin).getTime(), tz) === localDateStr(now, tz);
  } else {
    out.checkedInToday = false;
  }
  // Streak at risk: a live streak, not yet checked in today, and it's evening
  // local time (≥17:00) — the window to protect it is closing.
  out.streakAtRisk =
    !!out.checkedInToday === false &&
    (opts.streak ?? 0) > 0 &&
    (opts.tzOffsetMinutes !== undefined ? localHour(now, tz) >= 17 : false);

  // Active battle
  const b = battleRes?.data;
  if (b) {
    out.activeBattle = {
      type: String(b.battle_type ?? "xp"),
      role: b.challenger_id === userId ? "challenger" : "opponent",
      endsAt: (b.ended_at as string | null) ?? null,
    };
  }
  out.pendingIncomingBattle = !!pendingRes?.data;

  // Tribe — needs a second hop for tribe metadata + next event.
  const tribeIds: string[] = (memberRes?.data ?? []).map((r: { tribe_id: string }) => r.tribe_id).filter(Boolean);
  if (tribeIds.length) {
    const [tribesRes, eventRes] = await Promise.all([
      safe(
        supabase.from("tribes").select("name, member_count, primary_activity").in("id", tribeIds).limit(1).maybeSingle(),
        { data: null },
      ),
      safe(
        supabase
          .from("tribe_events")
          .select("title, activity, starts_at, meeting_url")
          .in("tribe_id", tribeIds)
          .gt("starts_at", new Date(now).toISOString())
          .order("starts_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        { data: null },
      ),
    ]);
    const t = tribesRes?.data;
    if (t) {
      out.tribeName = t.name ?? null;
      out.tribeMemberCount = t.member_count ?? null;
      out.tribeActivity = t.primary_activity ?? null;
    }
    const ev = eventRes?.data;
    if (ev) {
      out.nextEvent = {
        title: String(ev.title ?? "meetup"),
        activity: (ev.activity as string | null) ?? null,
        startsAt: ev.starts_at as string,
        online: !!ev.meeting_url,
      };
    }
  }

  return out;
}

/** Human "in 3h" / "tomorrow" / "in 2 days" for an upcoming ISO instant. */
const relativeWhen = (iso: string): string => {
  const diffH = (new Date(iso).getTime() - Date.now()) / 3_600_000;
  if (diffH < 1) return "very soon";
  if (diffH < 24) return `in ${Math.round(diffH)}h`;
  if (diffH < 48) return "tomorrow";
  return `in ${Math.round(diffH / 24)} days`;
};

/**
 * Render the situation as a compact system-prompt block. Returns "" when there
 * is nothing worth saying, so callers can append unconditionally.
 */
export function buildSituationBlock(s: SituationData): string {
  const lines: string[] = [];

  if (s.rank && s.totalUsers) {
    const top = s.percentile != null ? ` (top ${Math.max(1, Math.round(100 - s.percentile))}%)` : "";
    lines.push(`- Leaderboard: ranked #${s.rank} of ${s.totalUsers}${top}.`);
  }
  if (s.tribeName) {
    const act = s.tribeActivity ? `, focus ${s.tribeActivity}` : "";
    const cnt = s.tribeMemberCount ? `, ${s.tribeMemberCount} members` : "";
    lines.push(`- In the tribe "${s.tribeName}"${cnt}${act}.`);
  }
  if (s.nextEvent) {
    const mode = s.nextEvent.online ? "online" : "in person";
    lines.push(`- Next tribe event: "${s.nextEvent.title}" ${relativeWhen(s.nextEvent.startsAt)} (${mode}).`);
  }
  if (s.activeBattle) {
    const ends = s.activeBattle.endsAt ? `, ends ${relativeWhen(s.activeBattle.endsAt)}` : "";
    lines.push(`- In a LIVE ${s.activeBattle.type} battle against another member${ends} — they're competing right now.`);
  }
  if (s.pendingIncomingBattle) {
    lines.push(`- Someone has challenged them to a battle and is waiting for their answer.`);
  }
  if (s.streakAtRisk) {
    lines.push(`- STREAK AT RISK: ${s.streak}-day streak and they have NOT checked in yet today — the window is closing tonight.`);
  } else if (s.checkedInToday === false && (s.streak ?? 0) > 0) {
    lines.push(`- Not checked in yet today (streak ${s.streak}d on the line).`);
  } else if (s.checkedInToday === true) {
    lines.push(`- Already checked in today. ✓`);
  }
  if (s.friendCount && s.friendCount > 0) {
    lines.push(`- ${s.friendCount} friends on the platform.`);
  }

  if (!lines.length) return "";

  return `Their wider situation right now (social, competitive, timing — use to TIME your encouragement; never recite this list back):
${lines.join("\n")}

Weave at most ONE of these in naturally when it sharpens motivation or timing — e.g. protect a streak that's at risk, rally them before a tribe event, fire them up to win a live battle, or nudge them to answer a challenge. If none is relevant to what they asked, ignore them entirely.`;
}
