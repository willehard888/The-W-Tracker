import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
// Pull-to-refresh removed temporarily — touch handlers on the page wrapper
// were intercepting inner taps on tribe cards. Re-add once we have a more
// isolated touch-area implementation.
import { Users, Plus, Lock, Crown, Zap, Check, X, Sparkles, Mail, Trophy, ChevronRight, Pause, ShieldCheck } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import TribeSearchBar from "@/components/TribeSearchBar";
import StreakFlameInline from "@/components/StreakFlameInline";
import TribeFireLite from "@/components/TribeFireLite";
import TribeFireHero from "@/components/TribeFireHero";
import TribeAmbientFireField from "@/components/TribeAmbientFireField";
import { useTribeFireReactor } from "@/hooks/use-tribe-fire-reactor";
import { fetchTribeCollectiveStreaks, collectiveStreakTier, collectiveTierName, collectiveAccent } from "@/lib/tribe-streak";

interface Tribe {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  visibility: string;
  member_count: number;
  owner_id: string;
  is_paused?: boolean;
  paused_reason?: string | null;
}

interface Invite {
  id: string;
  tribe_id: string;
  inviter_id: string;
  created_at: string;
  tribe: { name: string; description: string | null; member_count: number; visibility: string } | null;
  inviter: { username: string } | null;
}

import { forwardRef } from "react";

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

interface TribesPageData {
  tribes: Tribe[];
  ownedIds: Set<string>;
  joinedIds: Set<string>;
  memberPreviews: Record<string, { user_id: string; avatar_url: string | null; username: string }[]>;
  userToTribes: Map<string, string[]>;
  collectiveStreaks: Map<string, number>;
}

const EMPTY_PAGE: TribesPageData = {
  tribes: [],
  ownedIds: new Set(),
  joinedIds: new Set(),
  memberPreviews: {},
  userToTribes: new Map(),
  collectiveStreaks: new Map(),
};

const Tribes = () => {
  const { profile, isApexSubscriber } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Ephemeral animation state — seeded from the query, then mutated live by the
  // realtime fire reactor (so it can't live inside TanStack Query).
  const [collectiveStreaks, setCollectiveStreaks] = useState<Map<string, number>>(new Map());
  const [rowPulse, setRowPulse] = useState<Map<string, number>>(new Map());
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [activityFilter, setActivityFilter] = useState<string | null>(null);

  const tier = profile?.status_tier;
  // Tribes/clubs are open to everyone now — no tier gate.
  const canCreate = true;

  // ── Tribe list (browse / mine) ───────────────────────────────────────────
  const tribesQuery = useQuery<TribesPageData>({
    queryKey: ["tribes-page", tab, profile?.user_id],
    enabled: !!profile?.user_id,
    // Keep the current list on screen while the new tab/user loads — no blank
    // flash on tab switch (stale-while-revalidate).
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let list: Tribe[] = [];

      if (tab === "browse") {
        // All tribes are private. We list every tribe so people can discover
        // and *request* to join — gating happens via approval, not visibility.
        const { data } = await supabase
          .from("tribes" as any)
          .select("*")
          .order("member_count", { ascending: false })
          .limit(50);
        list = (data as any) ?? [];
      } else {
        const { data: memberships } = await supabase
          .from("tribe_members" as any)
          .select("tribe_id")
          .eq("user_id", profile?.user_id ?? "")
          .eq("status", "active");
        const ids = ((memberships as any) ?? []).map((m: any) => m.tribe_id);
        if (ids.length === 0) {
          list = [];
        } else {
          const { data } = await supabase
            .from("tribes" as any)
            .select("*")
            .in("id", ids);
          list = (data as any) ?? [];
        }
      }

      const ownedIds = new Set<string>();
      const joinedIds = new Set<string>();
      let memberPreviews: TribesPageData["memberPreviews"] = {};
      let userToTribes = new Map<string, string[]>();

      // Mark owned + joined
      if (profile?.user_id && list.length > 0) {
        const ids = list.map((t) => t.id);
        const { data: mems } = await supabase
          .from("tribe_members" as any)
          .select("tribe_id, role, status")
          .eq("user_id", profile.user_id)
          .in("tribe_id", ids);
        ((mems as any) ?? []).forEach((m: any) => {
          if (m.status === "active") joinedIds.add(m.tribe_id);
          if (m.role === "owner") ownedIds.add(m.tribe_id);
        });

        // Member avatar previews — top 4 per tribe, plus all-member map for reactor
        const { data: previews } = await supabase
          .from("tribe_members" as any)
          .select("tribe_id, user_id")
          .in("tribe_id", ids)
          .eq("status", "active")
          .limit(ids.length * 40);
        const userIds: string[] = Array.from(new Set(((previews as any) ?? []).map((p: any) => p.user_id as string)));
        const { data: profs } = userIds.length
          ? await supabase
              .from("profiles")
              .select("user_id, username, avatar_url")
              .in("user_id", userIds)
          : { data: [] as any[] };
        const profMap = new Map(((profs as any) ?? []).map((p: any) => [p.user_id, p]));
        const map: TribesPageData["memberPreviews"] = {};
        const u2t = new Map<string, string[]>();
        ((previews as any) ?? []).forEach((row: any) => {
          const arr = map[row.tribe_id] ?? (map[row.tribe_id] = []);
          if (arr.length < 4) {
            const p = profMap.get(row.user_id);
            if (p) arr.push(p as any);
          }
          const tArr = u2t.get(row.user_id) ?? [];
          tArr.push(row.tribe_id);
          u2t.set(row.user_id, tArr);
        });
        memberPreviews = map;
        userToTribes = u2t;
      }

      // Collective streak per tribe — drives the inline flame on each row
      let collectiveStreaks = new Map<string, number>();
      if (list.length > 0) {
        try {
          collectiveStreaks = await fetchTribeCollectiveStreaks(list.map((t) => t.id));
        } catch {
          collectiveStreaks = new Map();
        }
      }

      return { tribes: list, ownedIds, joinedIds, memberPreviews, userToTribes, collectiveStreaks };
    },
  });

  const data = tribesQuery.data ?? EMPTY_PAGE;
  const tribes = data.tribes;
  const ownedIds = data.ownedIds;
  const joinedIds = data.joinedIds;
  const memberPreviews = data.memberPreviews;
  const userToTribes = data.userToTribes;
  const loading = !!profile?.user_id && tribesQuery.isLoading;

  // Seed the live collective-streak map whenever fresh server data arrives.
  useEffect(() => {
    setCollectiveStreaks(data.collectiveStreaks);
  }, [data.collectiveStreaks]);

  // ── Pending invites ──────────────────────────────────────────────────────
  const invitesQuery = useQuery<Invite[]>({
    queryKey: ["tribe-invites", profile?.user_id],
    enabled: !!profile?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tribe_invites" as any)
        .select("id, tribe_id, inviter_id, created_at")
        .eq("invitee_id", profile!.user_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      const rows = (data as any) ?? [];
      if (rows.length === 0) return [];
      const tribeIds = rows.map((r: any) => r.tribe_id);
      const inviterIds = rows.map((r: any) => r.inviter_id);
      const [tRes, uRes] = await Promise.all([
        supabase.from("tribes" as any).select("id, name, description, member_count, visibility").in("id", tribeIds),
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

  // Realtime fire reactor — every check-in by any member of any visible tribe
  // bumps that tribe's row mini-flame and increments its collective streak.
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

  // Total ambient heat across all the user's joined tribes — drives the page's ember field
  const ambientHeat = useMemo(() => {
    let sum = 0;
    joinedIds.forEach((id) => { sum += collectiveStreaks.get(id) ?? 0; });
    return sum;
  }, [joinedIds, collectiveStreaks]);
  const ambientAccent = collectiveAccent(ambientHeat);

  const handleJoin = async (id: string) => {
    const { data, error } = await supabase.rpc("join_tribe" as any, {
      p_tribe_id: id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data === "pending") toast.success("Request sent — awaiting approval");
    else if (data === "already_member") toast.info("Already a member");
    else toast.success("Joined the tribe!");
    reloadTribes();
  };

  const handleClaim = async (id: string, name: string) => {
    const { error } = await supabase.rpc("claim_paused_tribe" as any, {
      p_tribe_id: id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`You now lead ${name} — fire revived 🔥`);
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
      toast.error(error.message);
      return;
    }
    toast.success(accept ? `Joined ${invite.tribe?.name ?? "tribe"}!` : "Invite declined");
    reloadInvites();
    reloadTribes();
    if (accept && invite.tribe_id) navigate(`/tribes/${invite.tribe_id}`);
  };

  const featuredRaw = tribes.find((t) => !joinedIds.has(t.id) && t.member_count > 0 && !t.is_paused);
  // Hide the featured card while an activity filter is active so the grid is pure.
  const featured = activityFilter ? null : featuredRaw;
  const restBase = featured ? tribes.filter((t) => t.id !== featured.id) : tribes;
  const restList = activityFilter
    ? restBase.filter((t) => (t as any).primary_activity === activityFilter)
    : restBase;

  return (
    <div className="min-h-full pb-8 px-4 pt-4 relative">
      {/* Ambient fire field — drifts behind the whole page, intensifies with
          the user's combined tribe heat. Cold (<30) = invisible. */}
      {ambientHeat >= 30 && (
        <div className="fixed inset-0 pointer-events-none -z-10">
          <TribeAmbientFireField total={ambientHeat} accent={ambientAccent} />
        </div>
      )}

      {/* THE HERO — collective fire is the centerpiece */}
      <TribeFireHero tribeCount={joinedIds.size} />
      <div id="tribes-browse-anchor" />

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Mail size={12} className="text-[hsl(18_95%_58%)]" />
            <h2 className="text-[11px] font-black tracking-widest uppercase text-[hsl(18_95%_58%)]">
              Tribe Invites · {invites.length}
            </h2>
          </div>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="rounded-xl p-3 border border-[hsl(18_95%_58%)]/35 bg-gradient-to-br from-[hsl(18_95%_58%)]/8 via-card/70 to-gold/5"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[hsl(18_95%_58%)]/30 to-gold/15 border border-[hsl(18_95%_58%)]/40 flex items-center justify-center shrink-0">
                    <Crown size={14} className="text-[hsl(18_95%_58%)]" strokeWidth={2.4} />
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
                    <Check size={12} /> Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleInviteResponse(inv, false)}
                    disabled={respondingId === inv.id}
                    className="flex-1 h-8"
                  >
                    <X size={12} /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="apex-divider mt-5" />
        </div>
      )}

      {/* Create CTA — single, refined (the empty state no longer duplicates it) */}
      {canCreate ? (
        <Button
          onClick={() => navigate("/tribes/new")}
          variant="ember"
          className="w-full mb-4"
        >
          <Plus size={16} /> Create a Tribe
        </Button>
      ) : (
        <div className="mb-4 rounded-xl p-4 border border-[hsl(18_95%_58%)]/25 bg-[hsl(18_95%_58%)]/5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[hsl(18_95%_58%)]/15 border border-[hsl(18_95%_58%)]/30 flex items-center justify-center shrink-0">
            <Lock size={14} className="text-[hsl(18_95%_58%)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-[hsl(18_95%_58%)] tracking-wide">
              Reach Elite to lead your own tribe
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Hit top 20% rank — or 20 active days with a 21-day streak. Earned, not bought.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate("/profile")} className="shrink-0">
            Progress
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 p-1 rounded-xl surface-inset border border-border/40">
        {(["browse", "mine"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 text-xs font-black py-2 rounded-lg uppercase tracking-wider transition-all",
              tab === t
                ? "bg-gold text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "browse" ? "Browse" : "My Tribes"}
          </button>
        ))}
      </div>

      {/* Open to all — clubs are free to create and join */}
      <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-secondary/20">
        <Users size={11} className="text-muted-foreground shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-tight">
          <span className="font-black text-foreground">Open to everyone</span> — create your own and
          join up to <span className="font-black text-[hsl(18_95%_58%)]">25 tribes</span>.
        </p>
      </div>

      {/* Browse-only: search + leaderboard CTA */}
      {tab === "browse" && (
        <>
          <TribeSearchBar onChanged={reloadTribes} />
          <button
            onClick={() => navigate("/tribes/leaderboard")}
            className="w-full mb-4 rounded-xl p-3 border border-border/60 bg-card/40 flex items-center gap-3 text-left transition-transform active:scale-[0.99]"
          >
            <div className="h-9 w-9 rounded-lg bg-gold/12 border border-gold/25 flex items-center justify-center shrink-0">
              <Trophy size={16} className="text-gold" strokeWidth={2.6} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest font-black text-gold/85">
                Tribe Leaderboard
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                Which tribes earn the most XP this week
              </p>
            </div>
            <ChevronRight size={14} className="text-muted-foreground shrink-0" />
          </button>

          {/* Browse by activity */}
          <div className="mb-4 -mx-4 px-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-1.5 w-max">
              {[null, "Run", "Gym", "Yoga", "Ride", "Swim", "Hike", "Combat", "Walk", "Other"].map((a) => {
                const active = activityFilter === a;
                return (
                  <button
                    key={a ?? "all"}
                    onClick={() => setActivityFilter(a)}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black border transition-all active:scale-95",
                      active
                        ? "bg-gold text-primary-foreground border-transparent"
                        : "bg-secondary/40 border-border/50 text-muted-foreground",
                    )}
                  >
                    {a ?? "All"}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          <TribeSkeleton />
          <TribeSkeleton />
          <TribeSkeleton />
        </div>
      ) : tribes.length === 0 ? (
        <EmptyState
          icon={Users}
          title={tab === "browse" ? "No public tribes yet" : "No tribes joined"}
          description={
            tab === "browse"
              ? "Be the first founder — start a tribe and rally your circle."
              : "Browse the public directory or get invited to start grinding together."
          }
          action={
            tab === "mine" ? (
              <Button size="sm" variant="ember" onClick={() => setTab("browse")}>
                <ChevronRight size={14} /> Browse tribes
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {/* Featured Tribe */}
          {tab === "browse" && featured && (
            <button
              onClick={() => navigate(`/tribes/${featured.id}`)}
              className="group w-full text-left rounded-2xl p-[2px] apex-conic-border apex-tribe-card-hover overflow-hidden"
            >
              <div className="rounded-2xl p-5 bg-gradient-to-br from-card/90 via-[hsl(18_95%_58%)]/8 to-gold/5 relative overflow-hidden apex-portal-glow">
                <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/50 backdrop-blur-sm border border-[hsl(18_95%_58%)]/40">
                  <Sparkles size={9} className="text-[hsl(18_95%_58%)]" />
                  <span className="text-[9px] font-black tracking-widest uppercase text-[hsl(18_95%_58%)]">
                    Featured
                  </span>
                </div>
                <div className="flex items-start gap-4 relative">
                  <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-[hsl(18_95%_58%)]/35 via-gold/20 to-[hsl(18_95%_58%)]/25 border border-[hsl(18_95%_58%)]/55 flex items-center justify-center shrink-0 shadow-[0_0_28px_hsl(18_95%_58%/0.55)] overflow-hidden">
                    {featured.cover_url && (
                      <img
                        src={featured.cover_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover opacity-70"
                      />
                    )}
                    {(collectiveStreaks.get(featured.id) ?? 0) >= 30 ? (
                      <TribeFireLite
                        tier={collectiveStreakTier(collectiveStreaks.get(featured.id) ?? 0)}
                        accent={collectiveAccent(collectiveStreaks.get(featured.id) ?? 0)}
                        size={64}
                      />
                    ) : !featured.cover_url ? (
                      <Crown size={32} className="text-[hsl(18_95%_58%)] drop-shadow-[0_0_10px_hsl(18_95%_58%/0.9)]" strokeWidth={2.4} />
                    ) : null}
                    <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-gradient-to-br from-[hsl(18_95%_58%)] to-gold border-2 border-background flex items-center justify-center shadow-[0_0_8px_hsl(18_95%_58%/0.8)] animate-pulse">
                      <Zap size={10} className="text-background" strokeWidth={3} fill="currentColor" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="font-display font-black text-2xl truncate leading-tight tracking-tight bg-gradient-to-r from-foreground via-[hsl(42_78%_70%)] to-[hsl(18_95%_70%)] bg-clip-text text-transparent drop-shadow-[0_2px_12px_hsl(18_95%_58%/0.4)]">
                      {featured.name}
                    </p>
                    {featured.description && (
                      <p className="text-[11px] text-muted-foreground/90 line-clamp-2 mt-1">
                        {featured.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[hsl(18_95%_58%)]/10 border border-[hsl(18_95%_58%)]/30">
                        <Users size={9} className="text-[hsl(18_95%_58%)]" />
                        <span className="text-[10px] font-bold tabular-nums text-[hsl(18_95%_58%)]">
                          {featured.member_count}
                        </span>
                      </span>
                      {(collectiveStreaks.get(featured.id) ?? 0) >= 30 && (
                        <StreakFlameInline
                          streak={collectiveStreaks.get(featured.id) ?? 0}
                          suffix="d"
                          className="text-[11px]"
                        />
                      )}
                      {memberPreviews[featured.id] && memberPreviews[featured.id].length > 0 && (
                        <div className="flex -space-x-2">
                          {memberPreviews[featured.id].slice(0, 4).map((p) => (
                            <div
                              key={p.user_id}
                              className="h-6 w-6 rounded-full bg-secondary border-2 border-background overflow-hidden"
                            >
                              {p.avatar_url ? (
                                <img loading="lazy" decoding="async" src={p.avatar_url} alt={p.username} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-[8px] font-black text-muted-foreground">
                                  {p.username.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          )}

          {restList.map((t, idx) => {
            const cStreak = collectiveStreaks.get(t.id) ?? 0;
            const cTier = collectiveStreakTier(cStreak);
            const cAccent = collectiveAccent(cStreak);
            const isPaused = !!t.is_paused;
            // Ember-bar height grows with collective tier (cold → 0%, legendary → 100%)
            const heatPct = cTier < 0 ? 0 : Math.min(100, ((cTier + 1) / 6) * 100);
            return (
            <button
              key={t.id}
              onClick={() => navigate(`/tribes/${t.id}`)}
              className={cn(
                "group w-full text-left rounded-2xl p-4 border apex-tribe-card-hover relative overflow-hidden",
                isPaused
                  ? "border-muted-foreground/30 bg-gradient-to-br from-card/60 to-secondary/20 grayscale-[0.4]"
                  : "border-[hsl(18_95%_58%)]/20 bg-gradient-to-br from-card/80 via-card/60 to-[hsl(18_95%_58%)]/5"
              )}
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              {/* Left-edge ember bar — visible heat ladder when scanning the list */}
              {!isPaused && cTier >= 0 && (
                <div
                  aria-hidden
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                  style={{
                    height: `${heatPct}%`,
                    background: `linear-gradient(180deg, ${cAccent.replace(")", " / 0.0)")} 0%, ${cAccent} 50%, ${cAccent.replace(")", " / 0.0)")} 100%)`,
                    boxShadow: `0 0 8px ${cAccent.replace(")", " / 0.7)")}`,
                  }}
                />
              )}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-gradient-to-r from-transparent via-[hsl(18_95%_58%)]/8 to-transparent" />

              {ownedIds.has(t.id) && !isPaused && (
                <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gold/15 border border-gold/40">
                  <Crown size={8} className="text-gold" />
                  <span className="text-[9px] font-black tracking-wider uppercase text-gold">
                    Owner
                  </span>
                </div>
              )}

              {isPaused && (
                <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted-foreground/15 border border-muted-foreground/40">
                  <Pause size={8} className="text-muted-foreground" strokeWidth={2.6} fill="currentColor" />
                  <span className="text-[9px] font-black tracking-wider uppercase text-muted-foreground">
                    Paused
                  </span>
                </div>
              )}

              <div className="flex items-start gap-3 relative">
                <div
                  className="relative h-14 w-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                  style={{
                    background: !isPaused && cTier >= 0
                      ? `radial-gradient(ellipse at 50% 90%, ${cAccent.replace(")", " / 0.30)")} 0%, transparent 70%)`
                      : "hsl(var(--secondary) / 0.5)",
                    border: `1px solid ${!isPaused && cTier >= 0 ? cAccent.replace(")", " / 0.5)") : "hsl(var(--border))"}`,
                    boxShadow: !isPaused && cTier >= 0 ? `0 0 14px ${cAccent.replace(")", " / 0.4)")}` : undefined,
                  }}
                >
                  {t.cover_url && (
                    <img
                      src={t.cover_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover opacity-75"
                    />
                  )}
                  {!isPaused && cTier >= 0 ? (
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
                      <TribeFireLite tier={cTier} accent={cAccent} size={Math.min(56, 36 + cTier * 6)} />
                    </div>
                  ) : !t.cover_url ? (
                    <span className="text-2xl opacity-50 leading-none">{isPaused ? "⏸️" : "🕯️"}</span>
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  {/* TRIBE NAME — dominant, gradient, larger so it reads first */}
                  <p
                    className={cn(
                      "font-display font-black text-xl truncate leading-tight tracking-tight",
                      isPaused
                        ? "text-muted-foreground/80"
                        : "bg-gradient-to-r from-foreground via-foreground to-[hsl(18_95%_70%)] bg-clip-text text-transparent drop-shadow-[0_1px_8px_hsl(18_95%_58%/0.25)]"
                    )}
                  >
                    {t.name}
                  </p>
                  {(t as any).primary_activity && (
                    <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded-md bg-gold/10 border border-gold/30 text-[9px] font-black uppercase tracking-wider text-gold">
                      {(t as any).primary_activity}
                    </span>
                  )}
                  {t.description && (
                    <p className="text-[11px] text-muted-foreground/90 line-clamp-2 mt-1 leading-snug">
                      {t.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {isPaused ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-muted-foreground/40 bg-muted-foreground/10 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        Awaiting Apex owner
                      </span>
                    ) : cTier >= 0 ? (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-black tabular-nums"
                        style={{
                          color: cAccent,
                          borderColor: cAccent.replace(")", " / 0.4)"),
                          background: cAccent.replace(")", " / 0.10)"),
                        }}
                      >
                        🔥 {cStreak.toLocaleString()}d · {collectiveTierName(cStreak)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md border border-border text-[10px] font-black text-muted-foreground">
                        Cold fire
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-secondary/40 border border-border/60">
                      <Users size={9} className="text-muted-foreground" />
                      <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                        {t.member_count}
                      </span>
                    </span>
                  </div>
                </div>
                {/* Action: Claim (paused + member + apex), or Join (not joined + browse) */}
                {isPaused && joinedIds.has(t.id) && canCreate && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClaim(t.id, t.name);
                    }}
                    className="shrink-0"
                  >
                    <ShieldCheck size={12} /> Claim
                  </Button>
                )}
                {tab === "browse" && !joinedIds.has(t.id) && !isPaused && (
                  <Button
                    size="sm"
                    variant="ember"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoin(t.id);
                    }}
                    className="shrink-0"
                  >
                    Join
                  </Button>
                )}
              </div>
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Tribes;
