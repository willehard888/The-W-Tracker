import { fmtInt } from "@/lib/format";
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
import { hapticNotification, hapticSelection } from "@/lib/haptics";
import TribeSearchBar from "@/components/TribeSearchBar";
import TribeFireLite from "@/components/TribeFireLite";
import TribeEmberSeed from "@/components/TribeEmberSeed";
import { useTribeFireReactor } from "@/hooks/use-tribe-fire-reactor";
import { TRIBE_ACTIVITY_GROUPS, activityIcon } from "@/lib/tribe-activities";
import { fetchTribesPage, EMPTY_TRIBES_PAGE, type Tribe, type TribesPageData } from "@/lib/tribes-query";
import { collectiveStreakTier, collectiveTierName, collectiveAccent, collectivePalette, withAlpha } from "@/lib/tribe-streak";

interface Invite {
  id: string;
  tribe_id: string;
  inviter_id: string;
  created_at: string;
  tribe: { name: string; description: string | null; member_count: number; visibility: string } | null;
  inviter: { username: string } | null;
}

/** Mirrors the list: one hero-height block, then quiet rows. */
const TribeSkeleton = forwardRef<HTMLDivElement, { hero?: boolean }>(({ hero }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border border-border bg-card/40 overflow-hidden relative",
      hero ? "p-5" : "p-4",
    )}
  >
    <div className="flex items-center gap-3">
      <div className={cn("rounded-xl bg-secondary/60 shrink-0 shimmer-bg", hero ? "h-20 w-20" : "h-12 w-12")} />
      <div className="flex-1 space-y-2 py-1">
        <div className={cn("rounded bg-secondary/60 shimmer-bg", hero ? "h-5 w-3/5" : "h-3.5 w-2/3")} />
        <div className="h-2.5 w-1/2 rounded bg-secondary/40 shimmer-bg" />
        {hero && <div className="h-2.5 w-2/5 rounded bg-secondary/40 shimmer-bg" />}
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

/** Realtime intake surge on a tribe's flame (replayed via `key`). */
const intakeStyle = (pulses: number): React.CSSProperties | undefined =>
  pulses > 0
    ? {
        animation: "flame-intake 1100ms cubic-bezier(.2,.8,.2,1)",
        willChange: "transform, filter",
        transformOrigin: "50% 92%",
      }
    : undefined;

/**
 * The tribes area under /squad's Tribes tab.
 *
 * Thesis: "your fire". Your tribe is the second spectacle of the app (the
 * lava CTA is the first), so on My Tribes it is a hero — a real flame, the
 * name in display type, tonight's pulse — not a 76px row above a void. On
 * Browse the week's hottest tribe takes the same hero slot; everything else
 * is a quiet row. The My Tribes/Browse split stays as underline tabs, one
 * row with the Leaderboard link, subordinate to Squad's gold segment above
 * (two stacked gold pill rows was the "looks cheap" complaint, twice).
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
    queryFn: () => fetchTribesPage(tab, activityFilter, profile!.user_id),
  });

  const data = tribesQuery.data ?? EMPTY_TRIBES_PAGE;
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
      const rows = data ?? [];
      if (rows.length === 0) return [];
      const tribeIds = rows.map((r) => r.tribe_id);
      const inviterIds = rows.map((r) => r.inviter_id);
      const [tRes, uRes] = await Promise.all([
        supabase.from("tribes").select("id, name, description, member_count, visibility").in("id", tribeIds),
        supabase.from("profiles").select("user_id, username").in("user_id", inviterIds),
      ]);
      const tMap = new Map((tRes.data ?? []).map((t) => [t.id, t]));
      const uMap = new Map((uRes.data ?? []).map((u) => [u.user_id, u]));
      return rows.map((r) => ({
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
  // tribe's flame and increments its collective streak. My Tribes only
  // (userToTribes is empty on browse by design).
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
    const { data, error } = await supabase.rpc("join_tribe", {
      p_tribe_id: id,
    });
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    // Joining is the biggest commitment on the social surface and it used to
    // land with nothing but a toast at the edge of the screen. The success
    // haptic is exempt from the tap-coalescing window in haptics.ts on
    // purpose — tap, then commit, felt as two separate things.
    if (data === "pending") {
      hapticNotification("success");
      toast.success("Request sent — awaiting approval");
    } else if (data === "already_member") {
      toast.info("Already a member");
    } else {
      hapticNotification("success");
      toast.success("Joined the tribe!");
    }
    reloadTribes();
  };

  const handleInviteResponse = async (invite: Invite, accept: boolean) => {
    setRespondingId(invite.id);
    const { error } = await supabase.rpc("respond_to_tribe_invite", {
      p_invite_id: invite.id,
      p_accept: accept,
    });
    setRespondingId(null);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    if (accept) hapticNotification("success");
    toast.success(accept ? `Joined ${invite.tribe?.name ?? "tribe"}!` : "Invite declined");
    reloadInvites();
    reloadTribes();
    if (accept && invite.tribe_id) navigate(`/tribes/${invite.tribe_id}`);
  };

  // The hero slot: your first tribe on My Tribes, the week's hottest on an
  // unfiltered Browse. Everything else is a row.
  const heroTribe: Tribe | null =
    tab === "mine"
      ? tribes[0] ?? null
      : activityFilter
      ? null
      : tribes.find((t) => t.id === data.featuredId) ?? null;
  const heroIsFeatured = tab === "browse" && heroTribe !== null;
  const restList = heroTribe ? tribes.filter((t) => t.id !== heroTribe.id) : tribes;

  const openTribe = (id: string) => navigate(`/tribes/${id}`);
  const keyOpen = (id: string) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTribe(id); }
  };

  /** Browse-only join affordance shared by hero and rows. */
  const renderJoin = (t: Tribe, wide: boolean) => {
    if (tab !== "browse" || joinedIds.has(t.id)) return null;
    const cls = wide ? "flex-1" : "shrink-0";
    if (pendingIds.has(t.id)) {
      return (
        <Button size="sm" variant="outline" disabled className={cls}>
          <Check aria-hidden size={12} /> Requested
        </Button>
      );
    }
    if (t.visibility === "private") {
      return (
        <Button size="sm" variant="ember-glass" className={cls} onClick={(e) => { e.stopPropagation(); handleJoin(t.id); }}>
          <Lock aria-hidden size={11} /> {wide ? "Request to join" : "Request"}
        </Button>
      );
    }
    return (
      <Button size="sm" variant="ember" className={cls} onClick={(e) => { e.stopPropagation(); handleJoin(t.id); }}>
        Join
      </Button>
    );
  };

  // ── Hero — the fire with a name, not a row with an eyebrow ───────────────
  const renderTribeHero = (t: Tribe) => {
    const cStreak = collectiveStreaks.get(t.id) ?? 0;
    const cTier = collectiveStreakTier(cStreak);
    const cAccent = collectiveAccent(cStreak);
    const edge = cTier >= 0 ? cAccent : "hsl(var(--ember))";
    const p = pulse.get(t.id);
    const spotsLeft = t.member_cap != null ? Math.max(0, t.member_cap - t.member_count) : null;
    const ev = data.nextEvents.get(t.id);
    const pulses = rowPulse.get(t.id) ?? 0;

    return (
      /* div+role, not <button>: the hero contains real Join <Button>s and
         nested buttons are invalid DOM (breaks hit-testing and SRs). */
      <div
        role="button"
        tabIndex={0}
        onClick={() => openTribe(t.id)}
        onKeyDown={keyOpen(t.id)}
        className="w-full text-left cursor-pointer surface-card relative overflow-hidden p-5 apex-tribe-card-hover"
        style={{ borderColor: withAlpha(edge, 0.38) }}
      >
        {/* Cover as deep ground under a scrim — identity, not decoration */}
        {t.cover_url && (
          <div aria-hidden className="absolute inset-0 pointer-events-none">
            <AppImage
              src={t.cover_url}
              width={640}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-[0.22]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/60 to-background/90" />
          </div>
        )}
        {/* The fire's own color on the edge, and a warm bloom behind it */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-[10%] right-[10%] h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${withAlpha(edge, 0.45)}, transparent)` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-8 -bottom-12 h-48 w-48 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${withAlpha(edge, 0.2)}, transparent 70%)` }}
        />

        <div className="relative flex items-center gap-4">
          <div
            key={pulses}
            className="relative shrink-0 w-[84px] h-[88px] flex items-end justify-center"
            style={intakeStyle(pulses)}
          >
            {cTier >= 0 ? (
              <TribeFireLite aria-hidden tier={cTier} palette={collectivePalette(cStreak)} size={66} variant="standard" />
            ) : (
              // Cold ≠ dead: the ember seed is the premium waiting state.
              <TribeEmberSeed aria-hidden size={76} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="font-display font-black text-[22px] leading-[1.05] tracking-tight truncate">{t.name}</h2>
              {t.visibility === "private" && <Lock size={13} className="text-muted-foreground/70 shrink-0" aria-label="Private" />}
              {ownedIds.has(t.id) && <Crown size={12} className="text-gold shrink-0" aria-label="Owner" />}
            </div>
            {t.description && (
              <p className="text-[13px] text-muted-foreground line-clamp-1 mt-1 leading-snug">{t.description}</p>
            )}
            <div className="mt-2.5 flex items-center gap-x-3 gap-y-1 flex-wrap">
              {cTier >= 0 ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-black tabular-nums" style={{ color: cAccent }}>
                  <Flame aria-hidden size={13} fill="currentColor" /> {fmtInt(cStreak)}d · {collectiveTierName(cStreak)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[hsl(var(--ember))]/85">
                  <Flame aria-hidden size={13} /> Embers waiting
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[12px] font-bold tabular-nums text-muted-foreground">
                <Users aria-hidden size={12} /> {t.member_count}
                {spotsLeft != null && spotsLeft > 0 && spotsLeft <= 5 && (
                  <span className="text-[hsl(var(--ember))]">· {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left</span>
                )}
              </span>
              {p && p.checked > 0 && (
                <span className="inline-flex items-center gap-1 text-[12px] font-bold tabular-nums text-[hsl(var(--ember))]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--ember))] animate-pulse" />
                  {p.checked}/{p.total} lit today
                </span>
              )}
              {heroIsFeatured && (t.weekly_xp ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[12px] font-black tabular-nums text-gold">
                  On fire this week · +{fmtInt(t.weekly_xp ?? 0)} XP
                </span>
              )}
            </div>
            {ev && (
              <div className="flex items-center gap-1.5 mt-2 text-[12px] font-bold text-[hsl(var(--ember))]">
                <Calendar aria-hidden size={12} strokeWidth={2.6} className="shrink-0" />
                <span className="truncate">
                  {ev.title} · {format(new Date(ev.starts_at), "EEE HH:mm")}
                  {ev.going > 0 ? ` · ${ev.going} going` : ""}
                </span>
              </div>
            )}
            {heroIsFeatured && data.featuredPreviews.length > 0 && (
              <div className="flex -space-x-2 mt-2.5">
                {data.featuredPreviews.map((m) => (
                  <div
                    key={m.user_id}
                    className="h-6 w-6 rounded-full bg-secondary border-2 border-background overflow-hidden"
                  >
                    {m.avatar_url ? (
                      <img loading="lazy" decoding="async" src={avatarUrl(m.avatar_url, 40)} alt={m.username} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[10px] font-black text-muted-foreground">
                        {m.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {tab === "browse" && !joinedIds.has(t.id) && (
          <div className="relative mt-4 flex gap-2">{renderJoin(t, true)}</div>
        )}
      </div>
    );
  };

  // ── Row — quiet, scannable, one meta line ────────────────────────────────
  const renderTribeRow = (t: Tribe, idx: number) => {
    const cStreak = collectiveStreaks.get(t.id) ?? 0;
    const cTier = collectiveStreakTier(cStreak);
    const cAccent = collectiveAccent(cStreak);
    const p = pulse.get(t.id);
    const spotsLeft = t.member_cap != null ? Math.max(0, t.member_cap - t.member_count) : null;
    const isNew = Date.now() - new Date(t.created_at).getTime() < 14 * 24 * 60 * 60 * 1000;
    const ActIcon = t.primary_activity ? activityIcon(t.primary_activity) : null;
    const ev = data.nextEvents.get(t.id);
    const pulses = rowPulse.get(t.id) ?? 0;

    return (
      // Entrance on a wrapper: the keyframe's fill-mode pins transform, which
      // used to kill the row's own press scale on the first eight rows.
      <div
        key={t.id}
        className={cn(idx < 8 && "animate-fade-in-up")}
        style={idx < 8 ? { animationDelay: `${220 + Math.min(idx, 10) * 40}ms` } : undefined}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => openTribe(t.id)}
          onKeyDown={keyOpen(t.id)}
          className="w-full text-left cursor-pointer surface-card surface-card-quiet p-4 apex-tribe-card-hover relative overflow-hidden"
        >
          <div className="flex items-start gap-3">
            <div
              className="relative h-12 w-12 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0 overflow-hidden"
              style={{ border: `1px solid ${cTier >= 0 ? withAlpha(cAccent, 0.45) : "hsl(var(--border))"}` }}
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
                <div key={pulses} className="relative w-full h-full flex items-center justify-center" style={intakeStyle(pulses)}>
                  <TribeFireLite aria-hidden tier={cTier} palette={collectivePalette(cStreak)} size={36} variant="mini" />
                </div>
              ) : !t.cover_url ? (
                <TribeEmberSeed aria-hidden size={36} />
              ) : null}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-[15px] truncate leading-tight">{t.name}</p>
                {t.visibility === "private" && <Lock size={12} className="text-muted-foreground/70 shrink-0" aria-label="Private" />}
                {ownedIds.has(t.id) && <Crown size={11} className="text-gold shrink-0" aria-label="Owner" />}
                {isNew && (
                  <span className="eyebrow-sm shrink-0 px-1.5 py-px rounded-full border border-gold/40 bg-gold/10 text-gold">
                    New
                  </span>
                )}
              </div>
              {t.description && (
                <p className="text-[12px] text-muted-foreground line-clamp-1 mt-0.5 leading-snug">
                  {t.description}
                </p>
              )}
              {/* One meta row: activity · members (+spots) · fire · lit today */}
              <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                {ActIcon && t.primary_activity && (
                  <span className="eyebrow inline-flex items-center gap-1 text-muted-foreground">
                    <ActIcon aria-hidden size={11} strokeWidth={2.4} /> {t.primary_activity}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums text-muted-foreground">
                  <Users aria-hidden size={11} /> {t.member_count}
                  {spotsLeft != null && spotsLeft > 0 && spotsLeft <= 5 && (
                    <span className="text-[hsl(var(--ember))]">· {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left</span>
                  )}
                </span>
                {cTier >= 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums" style={{ color: cAccent }}>
                    <Flame aria-hidden size={12} fill="currentColor" /> {fmtInt(cStreak)}d · {collectiveTierName(cStreak)}
                  </span>
                )}
                {p && p.checked > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums text-[hsl(var(--ember))]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--ember))] animate-pulse" />
                    {p.checked}/{p.total} lit today
                  </span>
                )}
              </div>
              {ev && (
                <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-bold text-[hsl(var(--ember))]">
                  <Calendar aria-hidden size={12} strokeWidth={2.6} className="shrink-0" />
                  <span className="truncate">
                    {ev.title} · {format(new Date(ev.starts_at), "EEE HH:mm")}
                    {ev.going > 0 ? ` · ${ev.going} going` : ""}
                  </span>
                </div>
              )}
            </div>
            {renderJoin(t, false)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-full pb-8 px-4 pt-4 relative">

      {/* Pending invites — rare and urgent, so they keep their ember cards */}
      {invites.length > 0 && (
        <div className="home-rise mb-5">
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
                    <p className="text-[12px] text-muted-foreground truncate">
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

      {/* One row: underline sub-tabs left, Leaderboard right. The old extra
          "MY TRIBES" eyebrow under the "MY TRIBES" tab said the same thing
          twice within 140px. */}
      <div className="home-rise flex items-end justify-between mb-3 border-b border-border/40">
        <div className="flex gap-6">
          {(["mine", "browse"] as const).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => { tabTouched.current = true; void hapticSelection(); setTab(t); }}
                aria-pressed={active}
                className={cn(
                  "eyebrow relative min-h-11 inline-flex items-end pb-2 transition-colors",
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
        <button
          onClick={() => navigate("/tribes/leaderboard")}
          className="pb-2 inline-flex items-center gap-1 text-[12px] font-bold text-gold/85 active:scale-95 transition-transform"
        >
          <Trophy aria-hidden size={11} /> Leaderboard <ChevronRight aria-hidden size={11} className="-ml-0.5" />
        </button>
      </div>

      {/* Browse tools — search, then 4 group chips that open their activities
          (replaced the old flat 26-chip strip). Filter chips share ONE
          selected language across the surface: gold-outline selected, plain
          outline otherwise. */}
      {tab === "browse" && (
        <div className="home-rise home-rise-1">
          <TribeSearchBar onChanged={reloadTribes} />
          <div className="mb-2 -mx-4 px-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-1.5 w-max">
              <Button
                variant={!openGroup && !activityFilter ? "gold-outline" : "outline"}
                size="pill"
                className="shrink-0"
                onClick={() => { void hapticSelection(); setOpenGroup(null); setActivityFilter(null); }}
              >
                All
              </Button>
              {TRIBE_ACTIVITY_GROUPS.map((g) => {
                const GIcon = GROUP_ICONS[g.label] ?? Sparkles;
                const active = openGroup === g.label;
                return (
                  <Button
                    key={g.label}
                    variant={active ? "gold-outline" : "outline"}
                    size="pill"
                    className="shrink-0"
                    onClick={() => {
                      void hapticSelection();
                      if (active) { setOpenGroup(null); setActivityFilter(null); }
                      else { setOpenGroup(g.label); setActivityFilter(null); }
                    }}
                  >
                    <GIcon aria-hidden size={12} strokeWidth={2.4} /> {g.label}
                  </Button>
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
                    <Button
                      key={a.name}
                      variant={active ? "gold-outline" : "outline"}
                      size="pill"
                      className="shrink-0"
                      onClick={() => { void hapticSelection(); setActivityFilter(active ? null : a.name); }}
                    >
                      <AIcon aria-hidden size={11} strokeWidth={2.4} /> {a.name}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3 mt-1">
          <TribeSkeleton hero />
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
        <div className="space-y-3 mt-1">
          {heroTribe && (
            // Wrapper carries the entrance so the hero keeps its press scale.
            <div className="home-rise home-rise-2">{renderTribeHero(heroTribe)}</div>
          )}
          {restList.map((t, idx) => renderTribeRow(t, idx))}

          {/* Creation is rare — a quiet text row at the end, not a box. */}
          <button
            type="button"
            onClick={() => navigate("/tribes/new")}
            className="w-full py-3.5 inline-flex items-center justify-center gap-1.5 text-[13px] font-bold text-muted-foreground hover:text-gold active:scale-[0.98] transition-[color,transform]"
          >
            <Plus aria-hidden size={14} /> Start your own tribe
          </button>
        </div>
      )}
    </div>
  );
};

export default Tribes;
