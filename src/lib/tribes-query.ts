import { supabase } from "@/integrations/supabase/client";

/**
 * The Squad → Tribes tab data set, extracted from Tribes.tsx so the
 * app-shell TabPrefetcher can warm the exact same cache entry at boot
 * (key: ["tribes-page", tab, activityFilter, userId]).
 */

// tribes `.select("*")` — typed to what the discovery UI actually renders.
// (supabase/types.ts predates the fire-server columns; local shape keeps us
// honest without `as any` casts.)
export interface Tribe {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  visibility: string;
  member_count: number;
  member_cap: number | null;
  owner_id: string;
  primary_activity: string | null;
  collective_streak: number | null;
  weekly_xp: number | null;
  fire_tier: number | null;
  is_paused?: boolean;
  created_at: string;
}

export interface NextEvent {
  title: string;
  activity: string | null;
  starts_at: string;
  going: number;
}

export interface TribesPageData {
  tribes: Tribe[];
  ownedIds: Set<string>;
  joinedIds: Set<string>;
  pendingIds: Set<string>;
  featuredPreviews: { user_id: string; avatar_url: string | null; username: string }[];
  featuredId: string | null;
  userToTribes: Map<string, string[]>;
  pulse: Map<string, { checked: number; total: number }>;
  nextEvents: Map<string, NextEvent>;
}

export const EMPTY_TRIBES_PAGE: TribesPageData = {
  tribes: [],
  ownedIds: new Set(),
  joinedIds: new Set(),
  pendingIds: new Set(),
  featuredPreviews: [],
  featuredId: null,
  userToTribes: new Map(),
  pulse: new Map(),
  nextEvents: new Map(),
};

export const fetchTribesPage = async (
  tab: "mine" | "browse",
  activityFilter: string | null,
  userId: string,
): Promise<TribesPageData> => {
      let list: Tribe[] = [];

      if (tab === "browse") {
        let q = supabase
          .from("tribes")
          .select("*")
          .order("member_count", { ascending: false })
          .limit(50);
        // Server-side activity filter — small tribes must be findable even
        // when they'd never crack the top-50 by member count.
        if (activityFilter) q = q.eq("primary_activity", activityFilter);
        const { data } = await q;
        list = (((data as any) ?? []) as Tribe[]).filter((t) => !t.is_paused);
      } else {
        const { data: memberships } = await supabase
          .from("tribe_members")
          .select("tribe_id")
          .eq("user_id", userId)
          .eq("status", "active");
        const ids = ((memberships as any) ?? []).map((m: any) => m.tribe_id);
        if (ids.length === 0) {
          list = [];
        } else {
          const { data } = await supabase
            .from("tribes")
            .select("*")
            .in("id", ids);
          list = ((data as any) ?? []) as Tribe[];
        }
      }

      const ownedIds = new Set<string>();
      const joinedIds = new Set<string>();
      const pendingIds = new Set<string>();
      let userToTribes = new Map<string, string[]>();
      let pulse = new Map<string, { checked: number; total: number }>();
      const nextEvents = new Map<string, NextEvent>();
      let featuredPreviews: TribesPageData["featuredPreviews"] = [];
      let featuredId: string | null = null;

      if (userId && list.length > 0) {
        const ids = list.map((t) => t.id);

        // My membership rows (active AND pending — the row CTA needs the
        // truth for "Requested ✓") + today's pulse + upcoming events,
        // in parallel.
        const [memsRes, pulseRes, eventsRes] = await Promise.all([
          supabase
            .from("tribe_members")
            .select("tribe_id, role, status")
            .eq("user_id", userId)
            .in("tribe_id", ids)
            .in("status", ["active", "pending"]),
          supabase.rpc("tribe_today_pulse" as any, { p_tribe_ids: ids }),
          supabase
            .from("tribe_events")
            .select("id, tribe_id, title, activity, starts_at")
            .in("tribe_id", ids)
            .gte("starts_at", new Date().toISOString())
            .order("starts_at", { ascending: true })
            .limit(60),
        ]);
        // If MY membership rows fail to load, do NOT render the page with an
        // empty joinedIds — that shows "Join" to existing members (reads as
        // "the app threw me out"). Throw so react-query retries while
        // keepPreviousData holds the last good page on screen.
        if ((memsRes as any).error) throw (memsRes as any).error;
        (((memsRes as any).data ?? []) as any[]).forEach((m: any) => {
          if (m.status === "active") joinedIds.add(m.tribe_id);
          if (m.status === "pending") pendingIds.add(m.tribe_id);
          if (m.role === "owner") ownedIds.add(m.tribe_id);
        });
        (((pulseRes as any).data ?? []) as any[]).forEach((r: any) => {
          pulse.set(r.tribe_id, { checked: r.checked, total: r.total });
        });

        // First upcoming event per tribe — "Group ride · Sat 8.00 · 6 going"
        // is the strongest join signal a row can carry. RLS scopes this to
        // public tribes + my own, which is exactly right for discovery.
        const firstEvents = new Map<string, { id: string; title: string; activity: string | null; starts_at: string }>();
        (((eventsRes as any).data ?? []) as any[]).forEach((e: any) => {
          if (!firstEvents.has(e.tribe_id)) firstEvents.set(e.tribe_id, e);
        });
        if (firstEvents.size > 0) {
          const evIds = Array.from(firstEvents.values()).map((e) => e.id);
          const { data: rsvps } = await supabase
            .from("tribe_event_rsvps")
            .select("event_id")
            .in("event_id", evIds)
            .eq("status", "going");
          const goingByEvent = new Map<string, number>();
          ((rsvps as any) ?? []).forEach((r: any) => {
            goingByEvent.set(r.event_id, (goingByEvent.get(r.event_id) ?? 0) + 1);
          });
          firstEvents.forEach((e, tribeId) => {
            nextEvents.set(tribeId, {
              title: e.title,
              activity: e.activity,
              starts_at: e.starts_at,
              going: goingByEvent.get(e.id) ?? 0,
            });
          });
        }

        if (tab === "browse") {
          // Featured = momentum, not size: the unjoined tribe with the most
          // weekly XP. (The old pick was "biggest tribe you're not in".)
          const candidates = list.filter((t) => !joinedIds.has(t.id));
          const featured = candidates.reduce<Tribe | null>(
            (best, t) =>
              (t.weekly_xp ?? 0) > (best?.weekly_xp ?? -1) ? t : best,
            null,
          );
          if (featured && featured.member_count > 0) {
            featuredId = featured.id;
            // Avatar previews only for the one card that renders them —
            // the old page fetched ~2000 member rows for 50 tribes and
            // showed 4 avatars.
            const { data: previews } = await supabase
              .from("tribe_members")
              .select("user_id")
              .eq("tribe_id", featured.id)
              .eq("status", "active")
              .limit(4);
            const uids = ((previews as any) ?? []).map((p: any) => p.user_id);
            if (uids.length) {
              const { data: profs } = await supabase
                .from("profiles")
                .select("user_id, username, avatar_url")
                .in("user_id", uids);
              featuredPreviews = ((profs as any) ?? []) as TribesPageData["featuredPreviews"];
            }
          }
        } else {
          // Realtime reactor member map — My Tribes only (a browse list of 50
          // strangers' tribes doesn't need a 2000-user realtime sub).
          const { data: members } = await supabase
            .from("tribe_members")
            .select("tribe_id, user_id")
            .in("tribe_id", ids)
            .eq("status", "active")
            .limit(ids.length * 40);
          const u2t = new Map<string, string[]>();
          ((members as any) ?? []).forEach((row: any) => {
            const arr = u2t.get(row.user_id) ?? [];
            arr.push(row.tribe_id);
            u2t.set(row.user_id, arr);
          });
          userToTribes = u2t;
        }
      }

      return { tribes: list, ownedIds, joinedIds, pendingIds, featuredPreviews, featuredId, userToTribes, pulse, nextEvents };
};
