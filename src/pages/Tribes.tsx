import { useEffect, useMemo, useRef, useState, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
// Pull-to-refresh removed temporarily — touch handlers on the page wrapper
// were intercepting inner taps on tribe cards. Re-add once we have a more
// isolated touch-area implementation.
import {
  Users, Plus, Crown, Check, X, Mail, Trophy, Flame, ChevronRight, Lock,
  Dumbbell, Flower2, GraduationCap, Sparkles, Calendar,
} from "lucide-react";
import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";
import { cn } from "@/lib/utils";
import { avatarUrl } from "@/lib/img";
import AppImage from "@/components/ui/app-image";
import { hapticSelection } from "@/lib/haptics";
import TribeSearchBar from "@/components/TribeSearchBar";
import TribeFireLite from "@/components/TribeFireLite";
import TribeEmberSeed from "@/components/TribeEmberSeed";
import { useTribeFireReactor } from "@/hooks/use-tribe-fire-reactor";
import { TRIBE_ACTIVITY_GROUPS, activityIcon } from "@/lib/tribe-activities";
import { collectiveStreakTier, collectiveTierName, collectiveAccent, collectivePalette, withAlpha } from "@/lib/tribe-streak";

// tribes `.select("*")` — typed to what the discovery UI actually renders.
// (supabase/types.ts predates the fire-server columns; local shape keeps us
// honest without `as any` casts.)
interface Tribe {
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

interface Invite {
  id: string;
  tribe_id: string;
  inviter_id: string;
  created_at: string;
  tribe: { name: string; description: string | null; member_count: number; visibility: string } | null;
  inviter: { username: string } | null;
}

const TribeSkeleton = forwardRef<HTMLDivElement>((_, ref) => (
  <div
    ref={ref}
    className="rounded-2xl p-4 border border-border bg-card/40 overflow-hidden relative"
  >
    <div className="flex items-start gap-3">
      <div className="h-14 w-14 rounded-xl bg-secondary/60 shrink-0 shimmer-bg" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3.5 w-2/3 rounded bg-secondary/60 shimmer-bg" />
        <div className="h-2.5 w-1/2 rounded bg-secondary/40 shimmer-bg" />
      </div>
    </div>
  </div>
));
TribeSkeleton.displayName = "TribeSkeleton";

// Group chips need a face; groups themselves don't carry icons in the lib.
const GROUP_ICONS: Record<string, LucideIcon> = {
  "Fitness & Movement": Dumbbell,
  "Mind & Wellness": Flower2,
  "Learn & Grow": GraduationCap,
  Community: Users,
};

interface NextEvent {
  title: string;
  activity: string | null;
  starts_at: string;
  going: number;
}

interface TribesPageData {
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

const EMPTY_PAGE: TribesPageData = {
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

/**
 * The tribes area under /squad's Tribes tab. The My Tribes/Browse split
 * renders as quiet UNDERLINE tabs — deliberately a subordinate visual
 * language to Squad's gold segment above, never a second pill row (two
 * stacked gold pill rows was the "looks cheap" complaint, twice).
 */
const Tribes = ({ initialSub }: { initialSub?: "mine" | "browse" }) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Ephemeral animation state — seeded from the query, then mutated live by the
  // realtime fire reactor (so it can't live inside TanStack Query).
  const [collectiveStreaks, setCollectiveStreaks] = useState<Map<string, number>>(new Map());
  const [rowPulse, setRowPulse] = useState<Map<string, number>>(new Map());
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"mine" | "browse">(initialSub ?? "browse");
  // Two-level activity picker: a group opens its activities; an activity
  // filters server-side (the old flat 26-chip strip filtered client-side over
  // a top-50 slice, hiding every small tribe).
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<string | null>(null);
  // Members land on My Tribes, newcomers on Browse — decided once on load,
  // never fighting a tab the user (or a ?tab=mine/browse link) has picked.
  const tabTouched = useRef(!!initialSub);
  useEffect(() => {
    if (!profile?.user_id || tabTouched.current) return;
    let alive = true;
    void supabase
      .from("tribe_members")
      .select("tribe_id")
      .eq("user_id", profile.user_id)
      .eq("status", "active")
      .limit(1)
      .then(({ data }) => {
        if (alive && !tabTouched.current && (data?.length ?? 0) > 0) setTab("mine");
      });
    return () => { alive = false; };
  }, [profile?.user_id]);

  // ── Tribe list (browse / mine) ───────────────────────────────────────────
  const tribesQuery = useQuery<TribesPageData>({
    queryKey: ["tribes-page", tab, activityFilter, profile?.user_id],
    enabled: !!profile?.user_id,
    // Keep the current list on screen while the new tab/filter loads — no
    // blank flash on switch (stale-while-revalidate).
    placeholderData: keepPreviousData,
    queryFn: async () => {
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
          .eq("user_id", profile?.user_id ?? "")
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

      if (profile?.user_id && list.length > 0) {
        const ids = list.map((t) => t.id);

        // My membership rows (active AND pending — the row CTA needs the
        // truth for "Requested ✓") + today's pulse + upcoming events,
        // in parallel.
        const [memsRes, pulseRes, eventsRes] = await Promise.all([
          supabase
            .from("tribe_members")
            .select("tribe_id, role, status")
            .eq("user_id", profile.user_id)
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
    },
  });

  const data = tribesQuery.data ?? EMPTY_PAGE;
  const tribes = data.tribes;
  const ownedIds = data.ownedIds;
  const joinedIds = data.joinedIds;
  const pendingIds = data.pendingIds;
  const userToTribes = data.userToTribes;
  const pulse = data.pulse;
  const loading = !profile?.user_id || tribesQuery.isLoading;

  // Seed the live collective-streak map from the rows themselves —
  // tribes.collective_streak is server-owned (nightly refresh_tribe_fire);
  // the reactor layers live deltas on top.
  useEffect(() => {
    setCollectiveStreaks(new Map(tribes.map((t) => [t.id, t.collective_streak ?? 0])));
  }, [tribes]);

  // ── Pending invites ──────────────────────────────────────────────────────
  const invitesQuery = useQuery<Invite[]>({
    queryKey: ["tribe-invites", profile?.user_id],
    enabled: !!profile?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tribe_invites")
        .select("id, tribe_id, inviter_id, created_at")
        .eq("invitee_id", profile!.user_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      const rows = (data as any) ?? [];
      if (rows.length === 0) return [];
      const tribeIds = rows.map((r: any) => r.tribe_id);
      const inviterIds = rows.map((r: any) => r.inviter_id);
      const [tRes, uRes] = await Promise.all([
        supabase.from("tribes").select("id, name, description, member_count, visibility").in("id", tribeIds),
        supabase.from("profiles").select("user_id, username").in("user_id", inviterIds),
      ]);
      const tMap = new Map(((tRes as any).data ?? []).map((t: any) => [t.id, t]));
      const uMap = new Map(((uRes as any).data ?? []).map((u: any) => [u.user_id, u]));
      return rows.map((r: any) => ({
        ...r,
        tribe: tMap.get(r.tribe_id) ?? null,
        inviter: uMap.get(r.inviter_id) ?? null,
      })) as Invite[];
    },
  });

  const invites = invitesQuery.data ?? [];

  // Refresh helpers used by the mutation handlers below.
  const reloadTribes = () => queryClient.invalidateQueries({ queryKey: ["tribes-page"] });
  const reloadInvites = () => queryClient.invalidateQueries({ queryKey: ["tribe-invites"] });

  // Realtime fire reactor — every check-in by a fellow member bumps that
  // tribe's row mini-flame and increments its collective streak. My Tribes
  // only (userToTribes is empty on browse by design).
  const allMemberIds = useMemo(() => Array.from(userToTribes.keys()), [userToTribes]);
  const listReactor = useTribeFireReactor(allMemberIds);
  const lastListEventRef = useRef<string | null>(null);
  useEffect(() => {
    const latest = listReactor.events[listReactor.events.length - 1];
    if (!latest || latest.id === lastListEventRef.current) return;
    lastListEventRef.current = latest.id;
    const tribeIds = userToTribes.get(latest.userId) ?? [];
    if (tribeIds.length === 0) return;
    setCollectiveStreaks((prev) => {
      const next = new Map(prev);
      tribeIds.forEach((tid) => next.set(tid, (next.get(tid) ?? 0) + latest.delta));
      return next;
    });
    setRowPulse((prev) => {
      const next = new Map(prev);
      tribeIds.forEach((tid) => next.set(tid, (next.get(tid) ?? 0) + 1));
      return next;
    });
  }, [listReactor.events, userToTribes]);

  const handleJoin = async (id: string) => {
    const { data, error } = await supabase.rpc("join_tribe" as any, {
      p_tribe_id: id,
    });
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    if (data === "pending") toast.success("Request sent — awaiting approval");
    else if (data === "already_member") toast.info("Already a member");
    else toast.success("Joined the tribe!");
    reloadTribes();
  };

  const handleInviteResponse = async (invite: Invite, accept: boolean) => {
    setRespondingId(invite.id);
    const { error } = await supabase.rpc("respond_to_tribe_invite" as any, {
      p_invite_id: invite.id,
      p_accept: accept,
    });
    setRespondingId(null);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success(accept ? `Joined ${invite.tribe?.name ?? "tribe"}!` : "Invite declined");
    reloadInvites();
    reloadTribes();
    if (accept && invite.tribe_id) navigate(`/tribes/${invite.tribe_id}`);
  };

  const featured = tab === "browse" && !activityFilter
    ? tribes.find((t) => t.id === data.featuredId) ?? null
    : null;
  const restList = featured ? tribes.filter((t) => t.id !== featured.id) : tribes;

  // ── One unified card anatomy — the featured card is a row with an eyebrow,
  //    not a different species. ─────────────────────────────────────────────
  const renderTribeCard = (t: Tribe, opts: { featured?: boolean; idx?: number } = {}) => {
    const cStreak = collectiveStreaks.get(t.id) ?? 0;
    const cTier = collectiveStreakTier(cStreak);
    const cAccent = collectiveAccent(cStreak);
    const isPrivate = t.visibility === "private";
    const isJoined = joinedIds.has(t.id);
    const isPending = pendingIds.has(t.id);
    const p = pulse.get(t.id);
    const spotsLeft = t.member_cap != null ? Math.max(0, t.member_cap - t.member_count) : null;
    const isNew = Date.now() - new Date(t.created_at).getTime() < 14 * 24 * 60 * 60 * 1000;
    const ActIcon = t.primary_activity ? activityIcon(t.primary_activity) : null;

    return (
      /* div+role, not <button>: the row contains real Join/Request <Button>s
         and nested buttons are invalid DOM (breaks hit-testing and SRs). */
      <div
        key={t.id}
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/tribes/${t.id}`)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/tribes/${t.id}`); } }}
        className={cn(
          "w-full text-left cursor-pointer surface-card p-4 apex-tribe-card-hover relative overflow-hidden",
        )}
        style={{
          ...(opts.idx != null ? { animationDelay: `${opts.idx * 60}ms` } : null),
          // Featured rows carry the tribe's own tier color on the edge —
          // the fire's identity, not generic gold.
          ...(opts.featured
            ? { borderColor: withAlpha(cTier >= 0 ? cAccent : "hsl(var(--gold))", 0.4) }
            : null),
        }}
      >
        {opts.featured && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 left-[10%] right-[10%] h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${withAlpha(cTier >= 0 ? cAccent : "hsl(var(--gold))", 0.35)}, transparent)`,
            }}
          />
        )}
        {opts.featured && (
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Flame aria-hidden size={10} className="text-[hsl(var(--ember))]" fill="currentColor" />
              <span className="eyebrow text-gold/85">On fire this week</span>
            </div>
            {(t.weekly_xp ?? 0) > 0 && (
              <span className="text-[10px] font-black tabular-nums text-gold">
                +{(t.weekly_xp ?? 0).toLocaleString()} XP
              </span>
            )}
          </div>
        )}
        <div className="flex items-start gap-3">
          <div
            className="relative h-12 w-12 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0 overflow-hidden"
            style={{
              border: `1px solid ${cTier >= 0 ? withAlpha(cAccent, 0.45) : "hsl(var(--border))"}`,
            }}
          >
            {t.cover_url && (
              <AppImage
                src={t.cover_url}
                width={48}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-75"
              />
            )}
            {cTier >= 0 ? (
              <div
                key={rowPulse.get(t.id) ?? 0}
                className="relative w-full h-full flex items-center justify-center"
                style={
                  (rowPulse.get(t.id) ?? 0) > 0
                    ? {
                        animation: "flame-intake 1100ms cubic-bezier(.2,.8,.2,1)",
                        willChange: "transform, filter",
                        transformOrigin: "50% 92%",
                      }
                    : undefined
                }
              >
                <TribeFireLite aria-hidden tier={cTier} palette={collectivePalette(cStreak)} size={36} variant="mini" />
              </div>
            ) : !t.cover_url ? (
              // Cold ≠ dead: the ember seed is the premium waiting state.
              <TribeEmberSeed aria-hidden size={36} />
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-[15px] truncate leading-tight">{t.name}</p>
              {isPrivate && <Lock size={10} className="text-muted-foreground/70 shrink-0" aria-label="Private" />}
              {ownedIds.has(t.id) && <Crown size={11} className="text-gold shrink-0" aria-label="Owner" />}
              {isNew && !opts.featured && (
                <span className="shrink-0 px-1.5 py-px rounded-full border border-gold/40 bg-gold/10 text-gold text-[8px] font-black tracking-widest uppercase">
                  New
                </span>
              )}
            </div>
            {t.description && (
              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 leading-snug">
                {t.description}
              </p>
            )}
            {/* One meta row: activity · members (+spots) · fire · lit today */}
            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
              {ActIcon && t.primary_activity && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <ActIcon aria-hidden size={9} strokeWidth={2.4} /> {t.primary_activity}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[10px] font-bold tabular-nums text-muted-foreground">
                <Users aria-hidden size={9} /> {t.member_count}
                {spotsLeft != null && spotsLeft > 0 && spotsLeft <= 5 && (
                  <span className="text-[hsl(var(--ember))]">· {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left</span>
                )}
              </span>
              {cTier >= 0 && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold tabular-nums"
                  style={{ color: cAccent }}
                >
                  <Flame aria-hidden size={10} fill="currentColor" /> {cStreak.toLocaleString()}d · {collectiveTierName(cStreak)}
                </span>
              )}
              {p && p.checked > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold tabular-nums text-[hsl(var(--ember))]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--ember))] animate-pulse" />
                  {p.checked}/{p.total} lit today
                </span>
              )}
            </div>
            {(() => {
              const ev = data.nextEvents.get(t.id);
              if (!ev) return null;
              return (
                <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-bold text-[hsl(var(--ember))]">
                  <Calendar aria-hidden size={10} strokeWidth={2.6} className="shrink-0" />
                  <span className="truncate">
                    {ev.title} · {format(new Date(ev.starts_at), "EEE HH:mm")}
                    {ev.going > 0 ? ` · ${ev.going} going` : ""}
                  </span>
                </div>
              );
            })()}
            {opts.featured && data.featuredPreviews.length > 0 && (
              <div className="flex -space-x-2 mt-2">
                {data.featuredPreviews.map((m) => (
                  <div
                    key={m.user_id}
                    className="h-5 w-5 rounded-full bg-secondary border-2 border-background overflow-hidden"
                  >
                    {m.avatar_url ? (
                      <img loading="lazy" decoding="async" src={avatarUrl(m.avatar_url, 40)} alt={m.username} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[7px] font-black text-muted-foreground">
                        {m.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {tab === "browse" && !isJoined && (
            isPending ? (
              <Button size="sm" variant="outline" disabled className="shrink-0">
                <Check aria-hidden size={12} /> Requested
              </Button>
            ) : isPrivate ? (
              <Button
                size="sm"
                variant="ember-glass"
                onClick={(e) => { e.stopPropagation(); handleJoin(t.id); }}
                className="shrink-0"
              >
                <Lock aria-hidden size={11} /> Request
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ember"
                onClick={(e) => { e.stopPropagation(); handleJoin(t.id); }}
                className="shrink-0"
              >
                Join
              </Button>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-full pb-8 px-4 pt-4 relative">

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Mail aria-hidden size={12} className="text-[hsl(var(--ember))]" />
            <h2 className="eyebrow text-[hsl(var(--ember))]">
              Tribe Invites · {invites.length}
            </h2>
          </div>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="rounded-xl p-3 border border-[hsl(var(--ember))]/35 bg-gradient-to-br from-[hsl(var(--ember))]/8 via-card/70 to-gold/5"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[hsl(var(--ember))]/30 to-gold/15 border border-[hsl(var(--ember))]/40 flex items-center justify-center shrink-0">
                    <Crown aria-hidden size={14} className="text-[hsl(var(--ember))]" strokeWidth={2.4} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm truncate">{inv.tribe?.name ?? "Tribe"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Invited by @{inv.inviter?.username ?? "?"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="ember"
                    onClick={() => handleInviteResponse(inv, true)}
                    disabled={respondingId === inv.id}
                    className="flex-1 h-8"
                  >
                    <Check aria-hidden size={12} /> Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleInviteResponse(inv, false)}
                    disabled={respondingId === inv.id}
                    className="flex-1 h-8"
                  >
                    <X aria-hidden size={12} /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="apex-divider mt-5" />
        </div>
      )}

      {/* Sub-tabs — quiet underline style, subordinate to Squad's gold
          segment above. No second pill row. */}
      <div className="flex gap-6 mb-3 border-b border-border/40">
        {(["mine", "browse"] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => { tabTouched.current = true; void hapticSelection(); setTab(t); }}
              className={cn(
                "relative pb-2 text-[12px] font-black uppercase tracking-wider transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground/80",
              )}
            >
              {t === "mine" ? "My Tribes" : "Browse"}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-gold to-[hsl(var(--ember))]" />
              )}
            </button>
          );
        })}
      </div>

      {tab === "browse" && <TribeSearchBar onChanged={reloadTribes} />}

      {/* Browse by activity — 4 group chips, tap to reveal the group's
          activities. Replaces the old flat 26-chip strip. */}
      {tab === "browse" && (
        <>
          <div className="mb-2 -mx-4 px-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-1.5 w-max">
              <button
                onClick={() => { void hapticSelection(); setOpenGroup(null); setActivityFilter(null); }}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold border transition-all active:scale-95",
                  !openGroup && !activityFilter
                    ? "bg-gold text-primary-foreground border-transparent"
                    : "bg-secondary/30 border-border/40 text-muted-foreground",
                )}
              >
                All
              </button>
              {TRIBE_ACTIVITY_GROUPS.map((g) => {
                const GIcon = GROUP_ICONS[g.label] ?? Sparkles;
                const active = openGroup === g.label;
                return (
                  <button
                    key={g.label}
                    onClick={() => {
                      void hapticSelection();
                      if (active) { setOpenGroup(null); setActivityFilter(null); }
                      else { setOpenGroup(g.label); setActivityFilter(null); }
                    }}
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold border transition-all active:scale-95",
                      active
                        ? "bg-gold text-primary-foreground border-transparent"
                        : "bg-secondary/30 border-border/40 text-muted-foreground",
                    )}
                  >
                    <GIcon aria-hidden size={12} strokeWidth={2.4} /> {g.label}
                  </button>
                );
              })}
            </div>
          </div>
          {openGroup && (
            <div className="mb-2 -mx-4 px-4 overflow-x-auto no-scrollbar animate-reveal">
              <div className="flex gap-1.5 w-max">
                {(TRIBE_ACTIVITY_GROUPS.find((g) => g.label === openGroup)?.items ?? []).map((a) => {
                  const active = activityFilter === a.name;
                  const AIcon = a.icon;
                  return (
                    <button
                      key={a.name}
                      onClick={() => { void hapticSelection(); setActivityFilter(active ? null : a.name); }}
                      className={cn(
                        "shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold border transition-all active:scale-95",
                        active
                          ? "bg-[hsl(var(--ember))] text-primary-foreground border-transparent"
                          : "bg-secondary/20 border-border/40 text-muted-foreground",
                      )}
                    >
                      <AIcon aria-hidden size={11} strokeWidth={2.4} /> {a.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Section header — eyebrow + quiet Leaderboard link (navigation, not a CTA) */}
      <div className="flex items-center justify-between mb-2 mt-1">
        <span className="eyebrow">
          {tab === "mine" ? "My tribes" : activityFilter ? `${activityFilter} tribes` : "Discover"}
        </span>
        <button
          onClick={() => navigate("/tribes/leaderboard")}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-gold/85 active:scale-95 transition-transform"
        >
          <Trophy aria-hidden size={11} /> Leaderboard <ChevronRight aria-hidden size={11} className="-ml-0.5" />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          <TribeSkeleton />
          <TribeSkeleton />
          <TribeSkeleton />
        </div>
      ) : tribes.length === 0 ? (
        activityFilter ? (
          <EmptyState
            icon={activityIcon(activityFilter)}
            title={`No ${activityFilter} tribes yet`}
            description="The category is wide open — start the first one and own it."
            action={
              <Button size="sm" variant="ember" onClick={() => navigate("/tribes/new")}>
                <Plus aria-hidden size={14} /> Start the first
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Users}
            title={tab === "browse" ? "No tribes yet" : "No tribes joined"}
            description={
              tab === "browse"
                ? "Be the first founder — start a tribe and rally your circle."
                : "Browse the directory or get invited to start grinding together."
            }
            action={
              tab === "mine" ? (
                <Button size="sm" variant="ember" onClick={() => { tabTouched.current = true; setTab("browse"); }}>
                  <ChevronRight aria-hidden size={14} /> Browse tribes
                </Button>
              ) : (
                <Button size="sm" variant="ember" onClick={() => navigate("/tribes/new")}>
                  <Plus aria-hidden size={14} /> Create a Tribe
                </Button>
              )
            }
          />
        )
      ) : (
        <div className="space-y-3">
          {featured && renderTribeCard(featured, { featured: true })}
          {restList.map((t, idx) => renderTribeCard(t, { idx }))}

          {/* Creation is rare — a quiet ghost row at the end, not a toolbar CTA */}
          <button
            onClick={() => navigate("/tribes/new")}
            className="w-full rounded-2xl border border-dashed border-border/60 p-3.5 flex items-center justify-center gap-2 text-[12px] font-bold text-muted-foreground hover:text-gold hover:border-gold/40 transition-colors active:scale-[0.99]"
          >
            <Plus aria-hidden size={14} /> Start your own tribe
          </button>
        </div>
      )}
    </div>
  );
};

export default Tribes;
